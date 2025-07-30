import { Request, Response } from "express";
import { publishToQueue } from "../email/producers/email.producers";
import { successResponse, failureResponse } from "../../common/utils/responses";
import { usersTable } from "../../common/database/schema";
import db from "../../common/database";
import { eq } from "drizzle-orm";

class ContactController {
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { fullName, email, message } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return failureResponse(res, 401, "Unauthorized");
      }

      if (!fullName || !email || !message) {
        return failureResponse(res, 400, "All fields are required");
      }

      const admins = await db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.role, "admin"));

      if (admins.length === 0) {
        await publishToQueue({
          email: process.env.EMAIL_USER || "support@warriorsol.com",
          subject: "New Customer Inquiry from Website",
          templatePath: "contact-email.ejs",
          templateData: {
            fullName,
            email,
            message,
          },
        });
      } else {
        await Promise.all(
          admins.map((admin) =>
            publishToQueue({
              email: admin.email,
              subject: "New Customer Inquiry from Website",
              templatePath: "contact-email.ejs",
              templateData: {
                fullName,
                email,
                message,
              },
            })
          )
        );
      }
      await publishToQueue({
  email,
  subject: "We've received your message!",
  templatePath: "contact-email-confirmation.ejs",
  templateData: {
    fullName,
    email,
    message,
  },
});

      return successResponse(res, 200, "Message sent successfully.");
    } catch (error: any) {
      console.error("Failed to send contact message:", error.message);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }
}

export default new ContactController();
