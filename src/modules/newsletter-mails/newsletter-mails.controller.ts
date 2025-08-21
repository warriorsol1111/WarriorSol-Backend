import { Request, Response } from "express";
import { successResponse, failureResponse } from "../../common/utils/responses";
import db from "../../common/database/index";
import { newsletterMailsTable } from "../../common/database/schema";
import { publishToQueue } from "../email/producers/email.producers";
import { count, eq } from "drizzle-orm";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export const addUserToNewsletterMails = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) return failureResponse(res, 400, "Email is required");

  try {
    // Check if email already exists
    const existingEmail = await db
      .select()
      .from(newsletterMailsTable)
      .where(eq(newsletterMailsTable.email, email));

    if (existingEmail.length > 0) {
      return failureResponse(res, 400, "Email already exists");
    }

    // Insert email first
    await db.insert(newsletterMailsTable).values({ email });

    try {
      // Send confirmation email
      await publishToQueue({
        email,
        subject: "Welcome to the Warrior Sol Newsletter!",
        templatePath: "newsletter-confirmation.ejs",
        templateData: { frontendUrl: FRONTEND_URL },
      });
    } catch (err) {
      console.error(
        "Failed to send newsletter confirmation email:",
        (err as Error).message
      );
      return failureResponse(res, 500, "Failed to send confirmation email");
    }

    return successResponse(res, 200, "Email added successfully");
  } catch (error: any) {
    console.error("Error adding email to newsletter list:", error.message);
    return failureResponse(res, 500, "Failed to add email");
  }
};

export const getCountOfNewsletterMails = async (
  req: Request,
  res: Response
) => {
  try {
    const newsletterCount = await db
      .select({ count: count() })
      .from(newsletterMailsTable);

    return successResponse(
      res,
      200,
      "Count of newsletter emails",
      newsletterCount[0].count
    );
  } catch (error: any) {
    console.error("Failed to get count of newsletter emails:", error.message);
    return failureResponse(
      res,
      500,
      "Failed to get count of newsletter emails"
    );
  }
};
