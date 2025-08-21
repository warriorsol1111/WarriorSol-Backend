import { Request, Response } from "express";
import { successResponse, failureResponse } from "../../common/utils/responses";
import db from "../../common/database/index";
import { launchMailsTable } from "../../common/database/schema";
import { publishToQueue } from "../email/producers/email.producers";
import { count, eq } from "drizzle-orm";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export const addUserToLaunchMails = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) return failureResponse(res, 400, "Email is required");

  try {
    // Check if email already exists
    const existingEmail = await db
      .select()
      .from(launchMailsTable)
      .where(eq(launchMailsTable.email, email));

    if (existingEmail.length > 0) {
      return failureResponse(res, 400, "Email already exists");
    }

    // Insert email first
    await db.insert(launchMailsTable).values({ email });

    try {
      // Send confirmation email
      await publishToQueue({
        email,
        subject: "Welcome to the Warrior Sol Waitlist!",
        templatePath: "waitlist-confirmation.ejs",
        templateData: { frontendUrl: FRONTEND_URL },
      });
    } catch (err) {
      console.error(
        "Failed to send waitlist confirmation email:",
        (err as Error).message
      );
      // ❌ Rollback not possible with simple insert, but indicate failure
      return failureResponse(res, 500, "Failed to send confirmation email");
    }

    return successResponse(res, 200, "Email added successfully");
  } catch (error: any) {
    console.error("Error adding email to launch list:", error.message);
    return failureResponse(res, 500, "Failed to add email");
  }
};

export const getCountOfLaunchMails = async (req: Request, res: Response) => {
  try {
    const launchMailsCount = await db
      .select({ count: count() })
      .from(launchMailsTable);

    return successResponse(
      res,
      200,
      "Count of launch mails",
      launchMailsCount[0].count
    );
  } catch (error: any) {
    console.error("Failed to get count of launch mails:", error.message);
    return failureResponse(res, 500, "Failed to get count of launch mails");
  }
};
