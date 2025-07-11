import { Request, Response } from "express";
import {
  successResponse,
  failureResponse,
} from "../../common/utils/responses.ts";
import db from "../../common/database/index.ts";
import { newsletterMailsTable } from "../../common/database/schema.ts";
import { publishToQueue } from "../email/producers/email.producers.ts";
import { count, eq } from "drizzle-orm";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
export const addUserToLaunchMails = async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    //Find if email already exists
    const existingEmail = await db
      .select()
      .from(newsletterMailsTable)
      .where(eq(newsletterMailsTable.email, email));
    if (existingEmail.length > 0) {
      return failureResponse(res, 400, "Email already exists");
    }
    await db.insert(newsletterMailsTable).values({ email });
    await publishToQueue({
      email,
      subject: "Welcome to the Warrior Sol Waitlist!",
      templatePath: "newsletter-confirmation.ejs",
    });
    successResponse(res, 200, "Email added successfully");
  } catch (error) {
    failureResponse(res, 500, "Failed to add email");
  }
};

export const getCountOfLaunchMails = async (req: Request, res: Response) => {
  try {
    const launchMailsCount = await db
      .select({ count: count() })
      .from(newsletterMailsTable);
    successResponse(
      res,
      200,
      "Count of launch mails",
      launchMailsCount[0].count
    );
  } catch (error) {
    failureResponse(res, 500, "Failed to get count of launch mails");
  }
};
