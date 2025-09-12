// auth.controller.ts

import { Request, Response } from "express";
import { successResponse, failureResponse } from "../../common/utils/responses";
import db from "../../common/database/index";
import jwt from "jsonwebtoken";
import { usersTable, verificationCodes } from "../../common/database/schema";
import bcrypt from "bcrypt";
import { eq, and, desc, or } from "drizzle-orm";
import { generateVerificationCode } from "../../common/utils/auth.util";
import { publishToQueue } from "../email/producers/email.producers";
import { uploadFile } from "../../common/utils/cloudinary";

class AuthController {
  async registerUser(req: Request, res: Response): Promise<void> {
    const { name, email, password } = req.body;

    try {
      await db.transaction(async (tx) => {
        // 1️⃣ Check if user exists
        const [existingUserEmail] = await tx
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, email))
          .limit(1);

        if (existingUserEmail) {
          if (existingUserEmail.status === "active") {
            return successResponse(res, 400, "Email already registered");
          } else {
            await tx
              .update(verificationCodes)
              .set({ isUsed: true })
              .where(
                and(
                  eq(verificationCodes.userId, existingUserEmail.id),
                  eq(verificationCodes.type, "email"),
                  eq(verificationCodes.isUsed, false)
                )
              );

            //resend otp
            const verificationCode = generateVerificationCode(6);
            await tx.insert(verificationCodes).values({
              userId: existingUserEmail.id,
              code: verificationCode,
              type: "email",
              expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            });
            try {
              await publishToQueue({
                email,
                subject: "Verify Your Email Address",
                templatePath: "verify-email.ejs",
                templateData: { verificationCode, name },
              });
            } catch (err) {
              throw new Error(
                "Email sending failed: " + (err as Error).message
              );
            }
            return successResponse(
              res,
              400,
              "Email not verified | OTP has been sent again"
            );
          }
        }

        // 2️⃣ Create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = generateVerificationCode(6);

        const [newUser] = await tx
          .insert(usersTable)
          .values({
            id: crypto.randomUUID(),
            name,
            email,
            passwordHash: hashedPassword,
          })
          .returning({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
          });

        // 3️⃣ Insert verification code
        await tx.insert(verificationCodes).values({
          userId: newUser.id,
          code: verificationCode,
          type: "email",
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        });

        // 4️⃣ Send email (throw if fails → rollback transaction)
        try {
          await publishToQueue({
            email,
            subject: "Verify Your Email Address",
            templatePath: "verify-email.ejs",
            templateData: { verificationCode, name },
          });
        } catch (err) {
          throw new Error("Email sending failed: " + (err as Error).message);
        }

        return successResponse(
          res,
          201,
          "User registered successfully",
          newUser
        );
      });
    } catch (error: any) {
      console.error("Signup failed:", error);
      return failureResponse(
        res,
        500,
        error.message || "Internal Server Error"
      );
    }
  }

  async resendOtp(req: Request, res: Response): Promise<void> {
    const { email, type } = req.body;

    if (!["email", "forget_password"].includes(type)) {
      return failureResponse(res, 400, "Invalid verification type");
    }

    try {
      await db.transaction(async (tx) => {
        const [user] = await tx
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, email))
          .limit(1);

        if (!user) {
          return failureResponse(
            res,
            404,
            "No account found with this email address"
          );
        }
        if (type === "email" && user.status === "active") {
          return failureResponse(res, 400, "Email already verified");
        }

        // invalidate previous codes
        await tx
          .update(verificationCodes)
          .set({ isUsed: true })
          .where(
            and(
              eq(verificationCodes.userId, user.id),
              eq(verificationCodes.type, type),
              eq(verificationCodes.isUsed, false)
            )
          );

        const verificationCode = generateVerificationCode(6);

        await tx.insert(verificationCodes).values({
          userId: user.id,
          code: verificationCode,
          type,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          isUsed: false,
        });

        const emailDetails =
          type === "email"
            ? {
                subject: "Verify Your Email Address",
                templatePath: "verify-email.ejs",
              }
            : {
                subject: "Reset Your Password",
                templatePath: "reset-password.ejs",
              };

        // send email
        try {
          await publishToQueue({
            email,
            subject: emailDetails.subject,
            templatePath: emailDetails.templatePath,
            templateData: { verificationCode, name: user.name },
          });
        } catch (err: any) {
          throw new Error("Email sending failed: " + err.message);
        }

        return successResponse(
          res,
          200,
          `New verification code sent to your email for ${
            type === "email" ? "email verification" : "password reset"
          }`
        );
      });
    } catch (error: any) {
      console.error("Resend OTP failed:", error);
      return failureResponse(
        res,
        500,
        error.message || "Internal Server Error"
      );
    }
  }

  async loginUser(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);

      if (!user) {
        return successResponse(res, 400, "Invalid credentials");
      }

      if (user.authProvider === "google") {
        return failureResponse(
          res,
          403,
          "This email is linked to a Google account. Please sign in with Google."
        );
      }

      const isPasswordValid = await bcrypt.compare(
        password,
        user.passwordHash as string
      );

      if (!isPasswordValid) {
        return successResponse(res, 400, "Invalid credentials");
      }

      if (user.status !== "active") {
        await db
          .update(verificationCodes)
          .set({ isUsed: true })
          .where(
            and(
              eq(verificationCodes.userId, user.id),
              eq(verificationCodes.type, "email"),
              eq(verificationCodes.isUsed, false)
            )
          );

        // resend otp
        const verificationCode = generateVerificationCode(6);
        await db.insert(verificationCodes).values({
          userId: user.id,
          code: verificationCode,
          type: "email",
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        });
        try {
          await publishToQueue({
            email,
            subject: "Verify Your Email Address",
            templatePath: "verify-email.ejs",
            templateData: { verificationCode, name: user.name },
          });
        } catch (err: any) {
          throw new Error("Email sending failed: " + err.message);
        }
        return successResponse(
          res,
          403,
          "User is not verified. Redirecting...",
          {
            redirectUrl: "/otp?email=" + user.email,
          }
        );
      }

      const token = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET as string,
        {
          expiresIn: process.env.JWT_EXPIRATION_TIME as any,
        }
      );

      return successResponse(res, 200, "Login successful", {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        profilePhoto: user.profilePhoto,
        role: user.role,
        token,
        loginMethod: "credentials",
      });
    } catch (error: any) {
      console.error(`Login failed: ${error.message}`);
      return failureResponse(
        res,
        500,
        error.message || "Internal Server Error"
      );
    }
  }

  async forgotPassword(req: Request, res: Response): Promise<void> {
    const { email } = req.body;

    try {
      await db.transaction(async (tx) => {
        const [user] = await tx
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, email))
          .limit(1);

        if (!user) {
          return successResponse(
            res,
            404,
            "No account found with this email address"
          );
        }

        if (user.authProvider === "google") {
          return failureResponse(
            res,
            403,
            "This email is linked to a Google account. Please sign in with Google."
          );
        }
        await tx
          .update(verificationCodes)
          .set({ isUsed: true })
          .where(
            and(
              eq(verificationCodes.userId, user.id),
              eq(verificationCodes.type, "forget_password"),
              eq(verificationCodes.isUsed, false)
            )
          );

        const verificationCode = generateVerificationCode(6);

        await tx.insert(verificationCodes).values({
          userId: user.id,
          code: verificationCode,
          type: "forget_password",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          isUsed: false,
        });

        try {
          await publishToQueue({
            email,
            subject: "Reset Your Password",
            templatePath: "reset-password.ejs",
            templateData: { verificationCode, name: user.name },
          });
        } catch (err: any) {
          throw new Error("Email sending failed: " + err.message);
        }

        return successResponse(
          res,
          200,
          "Password reset code sent to your email"
        );
      });
    } catch (error: any) {
      console.error("Forgot password failed:", error);
      return failureResponse(
        res,
        500,
        error.message || "Internal Server Error"
      );
    }
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email, newPassword } = req.body;

      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);

      if (!user) {
        return successResponse(
          res,
          404,
          "No account found with this email address"
        );
      }

      // Check if the new password is the same as the current one
      const isSamePassword = await bcrypt.compare(
        newPassword,
        user.passwordHash as string
      );

      if (isSamePassword) {
        return successResponse(
          res,
          400,
          "New password cannot be the same as your current password"
        );
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await db
        .update(usersTable)
        .set({ passwordHash: hashedPassword })
        .where(eq(usersTable.id, user.id));

      return successResponse(res, 200, "Password updated successfully");
    } catch (error: any) {
      console.error(`Reset password failed: ${error.message}`);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { email, verificationCode, type = "email" } = req.body;
      if (!email) {
        return failureResponse(res, 400, "Email is required");
      }
      if (!verificationCode) {
        return failureResponse(res, 400, "Verification code is required");
      }

      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);

      if (!user) {
        return failureResponse(
          res,
          404,
          "No account found with this email address"
        );
      }

      const [codeEntry] = await db
        .select()
        .from(verificationCodes)
        .where(
          and(
            eq(verificationCodes.userId, user.id),
            eq(verificationCodes.code, verificationCode),
            eq(verificationCodes.type, type)
          )
        )
        .orderBy(desc(verificationCodes.createdAt))
        .limit(1);

      if (!codeEntry || codeEntry.isUsed) {
        return failureResponse(res, 400, "Invalid verification code");
      }

      if (new Date(codeEntry.expiresAt) < new Date()) {
        return failureResponse(res, 400, "Verification code has expired");
      }

      if (type === "email") {
        await db
          .update(usersTable)
          .set({ status: "active" })
          .where(eq(usersTable.id, user.id));
      }

      await db
        .update(verificationCodes)
        .set({ isUsed: true })
        .where(eq(verificationCodes.id, codeEntry.id));

      return successResponse(
        res,
        200,
        type === "email"
          ? "Email verified successfully"
          : "Verification code validated successfully"
      );
    } catch (error: any) {
      console.error(`Email verification failed: ${error.message}`);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }
  async uploadProfilePhoto(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file;
      const userId = req.user?.id;

      if (!userId) {
        return failureResponse(res, 401, "Unauthorized");
      }

      if (!file) {
        return failureResponse(res, 400, "No file uploaded");
      }

      let profilePhotoUrl: string;

      try {
        const uploadResult = await uploadFile(file, {
          folder: "profile-photos",
        });
        profilePhotoUrl = uploadResult.secure_url;
      } catch (err) {
        console.error("Upload failed:", err);
        return failureResponse(res, 500, "Failed to upload photo");
      }

      const [updatedUser] = await db
        .update(usersTable)
        .set({ profilePhoto: profilePhotoUrl, updatedAt: new Date() })
        .where(eq(usersTable.id, userId))
        .returning();

      return successResponse(
        res,
        200,
        "Profile photo updated",
        updatedUser.profilePhoto
      );
    } catch (error) {
      console.error("Error updating profile photo:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async deleteProfilePhoto(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return failureResponse(res, 401, "Unauthorized");
      }

      const [updatedUser] = await db
        .update(usersTable)
        .set({ profilePhoto: null, updatedAt: new Date() })
        .where(eq(usersTable.id, userId))
        .returning();

      return successResponse(
        res,
        200,
        "Profile photo deleted",
        updatedUser.profilePhoto
      );
    } catch (error) {
      console.error("Error deleting profile photo:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async googleSyncUser(req: Request, res: Response): Promise<void> {
    try {
      const { email, name } = req.body;

      if (!email || !name) {
        return failureResponse(res, 400, "Email and name are required.");
      }

      const [existingUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);

      const [firstName, ...rest] = name.trim().split(" ");
      const finalName = `${firstName} ${rest.join(" ")}`.trim();

      // ❌ If user exists & has password, block Google login
      if (existingUser) {
        const hasPassword = !!existingUser.passwordHash;

        if (hasPassword) {
          return failureResponse(
            res,
            403,
            "This email is already registered with a password. Please use email/password to sign in."
          );
        }

        // ✅ Optionally update name if it changed
        if (existingUser.name !== finalName) {
          await db
            .update(usersTable)
            .set({ name: finalName })
            .where(eq(usersTable.id, existingUser.id));
        }

        const token = jwt.sign(
          {
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.name,
            profilePhoto: existingUser.profilePhoto,
          },
          process.env.JWT_SECRET!,
          { expiresIn: "1d" }
        );

        return successResponse(res, 200, "Google login allowed", {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          token,
          profilePhoto: existingUser.profilePhoto,
          role: existingUser.role || "user",
        });
      }

      // 👶 Create new Google-based user
      const [newUser] = await db
        .insert(usersTable)
        .values({
          id: crypto.randomUUID(),
          email,
          name: finalName,
          passwordHash: null,
          authProvider: "google",
          status: "active",
        })
        .returning();

      const token = jwt.sign(
        { id: newUser.id, email: newUser.email, name: newUser.name },
        process.env.JWT_SECRET!,
        { expiresIn: "1d" }
      );

      return successResponse(res, 200, "Google user created", {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        token,
        profilePhoto: newUser.profilePhoto,
        role: newUser.role || "user",
      });
    } catch (err: any) {
      console.error("Google sync error:", err.message);
      return failureResponse(res, 500, "Internal server error.");
    }
  }

  async verifyPassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      const { password } = req.body;

      if (!userId || !password) {
        return failureResponse(res, 400, "User ID and password are required.");
      }

      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      if (!user) {
        return failureResponse(res, 404, "User not found.");
      }

      const isPasswordValid = await bcrypt.compare(
        password,
        user.passwordHash as string
      );

      if (!isPasswordValid) {
        return failureResponse(res, 400, "Invalid password.");
      }

      return successResponse(res, 200, "Password verified successfully.");
    } catch (error: any) {
      console.error(`Password verification failed: ${error.message}`);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { newPassword } = req.body;

      if (!userId || !newPassword) {
        return failureResponse(
          res,
          400,
          "User ID and new password are required."
        );
      }

      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      if (!user) {
        return failureResponse(res, 404, "User not found.");
      }

      const isSamePassword = await bcrypt.compare(
        newPassword,
        user.passwordHash as string
      );

      if (isSamePassword) {
        return failureResponse(
          res,
          400,
          "You cannot use current password as a new one."
        );
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      await db
        .update(usersTable)
        .set({
          passwordHash: hashedNewPassword,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, user.id));

      return successResponse(res, 200, "Password changed successfully.");
    } catch (error: any) {
      console.error(`Change password failed: ${error.message}`);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async uploadFileToCloudinary(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        return failureResponse(res, 400, "No file uploaded");
      }

      const uploadResult = await uploadFile(file, {
        folder: "photos",
      });

      return successResponse(res, 200, "File uploaded successfully", {
        secure_url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
      });
    } catch (error: any) {
      console.error(`File upload failed: ${error.message}`);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }
}

export default new AuthController();
