// auth.controller.ts

import { Request, Response } from "express";
import {
  successResponse,
  failureResponse,
} from "../../common/utils/responses.ts";
import db from "../../common/database/index.ts";
import jwt from "jsonwebtoken";
import { usersTable, verificationCodes } from "../../common/database/schema.ts";
import bcrypt from "bcrypt";
import { eq, and, desc, or } from "drizzle-orm";
import { generateVerificationCode } from "../../common/utils/auth.util.ts";
import { publishToQueue } from "../email/producers/email.producers.ts";

class AuthController {
  async registerUser(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, password } = req.body;

      //check if nickname is already taken
      const [existingUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);

      if (existingUser) {
        return successResponse(res, 400, "Email already registered");
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const verificationCode = generateVerificationCode(6);

      const [newUser] = await db
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

      await db.insert(verificationCodes).values({
        userId: newUser.id,
        code: verificationCode,
        type: "email",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // expires in 5 minutes
      });

      await publishToQueue({
        email,
        subject: "Verify Your Email Address",
        templatePath: "verify-email.ejs",
        templateData: { verificationCode, name },
      });

      return successResponse(res, 201, "User registered successfully", newUser);
    } catch (error: any) {
      console.error(`Signup failed: ${error.message}`);

      if (error.code === "23505" && error.constraint === "users_email_unique") {
        return failureResponse(res, 409, "Email already registered");
      }
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async resendOtp(req: Request, res: Response): Promise<void> {
    try {
      const { email, type } = req.body;

      if (!["email", "forget_password"].includes(type)) {
        return failureResponse(res, 400, "Invalid verification type");
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

      // Mark all existing verification codes of this type as used (invalidate them)
      await db
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

      await db.insert(verificationCodes).values({
        userId: user.id,
        code: verificationCode,
        type: type,
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

      await publishToQueue({
        email,
        subject: emailDetails.subject,
        templatePath: emailDetails.templatePath,
        templateData: {
          verificationCode,
          name: user.name,
        },
      });

      return successResponse(
        res,
        200,
        `New verification code sent to your email for ${
          type === "email" ? "email verification" : "password reset"
        }`
      );
    } catch (error: any) {
      console.error(`Resend OTP failed: ${error.message}`);
      return failureResponse(res, 500, "Internal Server Error");
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

      // Traditional password-based login
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

      if (!isPasswordValid) {
        return successResponse(res, 400, "Invalid credentials");
      }
      if (user.status !== "active") {
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
        token,
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
    try {
      const { email } = req.body;

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

      const verificationCode = generateVerificationCode(6);

      await db.insert(verificationCodes).values({
        userId: user.id,
        code: verificationCode,
        type: "forget_password",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        isUsed: false,
      });

      await publishToQueue({
        email,
        subject: "Reset Your Password",
        templatePath: "reset-password.ejs",
        templateData: {
          verificationCode,
          name: user.name,
        },
      });

      return successResponse(
        res,
        200,
        "Password reset code sent to your email"
      );
    } catch (error: any) {
      console.error(`Forgot password failed: ${error.message}`);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email, verificationCode, newPassword } = req.body;

      console.log(verificationCode, newPassword);

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

      const [codeEntry] = await db
        .select()
        .from(verificationCodes)
        .where(
          and(
            eq(verificationCodes.userId, user.id),
            eq(verificationCodes.code, verificationCode)
          )
        )
        .limit(1);

      console.log(codeEntry);

      const isExpired = codeEntry && new Date(codeEntry.expiresAt) < new Date();

      console.log("isExpired", isExpired);

      if (
        !codeEntry ||
        codeEntry.code !== verificationCode ||
        codeEntry.type !== "forget_password" ||
        codeEntry.isUsed ||
        isExpired
      ) {
        return successResponse(
          res,
          400,
          "Invalid or expired verification code"
        );
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Check if the new password is the same as the current password
      const isSamePassword = await bcrypt.compare(
        newPassword,
        user.passwordHash
      );

      if (isSamePassword) {
        return successResponse(
          res,
          400,
          "New password cannot be the same as your current password"
        );
      }

      await db
        .update(usersTable)
        .set({ passwordHash: hashedPassword })
        .where(eq(usersTable.id, user.id));

      await db
        .update(verificationCodes)
        .set({
          isUsed: true,
          updatedAt: new Date(),
        })
        .where(eq(verificationCodes.id, codeEntry.id));

      return successResponse(res, 200, "Password updated successfully");
    } catch (error: any) {
      console.error(`Set password failed: ${error.message}`);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { email, verificationCode } = req.body;
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
            eq(verificationCodes.type, "email")
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

      await db
        .update(usersTable)
        .set({ status: "active" })
        .where(eq(usersTable.id, user.id));

      await db
        .update(verificationCodes)
        .set({ isUsed: true })
        .where(eq(verificationCodes.id, codeEntry.id));

      return successResponse(res, 200, "Email verified successfully");
    } catch (error: any) {
      console.error(`Email verification failed: ${error.message}`);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }
}

export default new AuthController();
