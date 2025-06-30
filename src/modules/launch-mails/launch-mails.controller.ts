import { Request, Response } from "express";
import {
  successResponse,
  failureResponse,
} from "../../common/utils/responses.ts";
import db from "../../common/database/index.ts";
import { launchMailsTable } from "../../common/database/schema.ts";
import { publishToQueue } from "../email/producers/email.producers.ts";
import { count, eq } from "drizzle-orm";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
export const addUserToLaunchMails = async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    //Find if email already exists
    const existingEmail = await db
      .select()
      .from(launchMailsTable)
      .where(eq(launchMailsTable.email, email));
    if (existingEmail.length > 0) {
      return failureResponse(res, 400, "Email already exists");
    }
    await db.insert(launchMailsTable).values({ email });
    await publishToQueue({
      email,
      subject: "Warrior Sol Is Officially Live!",
      templatePath: "launch-email.ejs",
      templateData: {
        frontendUrl: FRONTEND_URL,
      },
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
      .from(launchMailsTable);
    successResponse(
      res,
      200,
      "Count of launch mails",
      launchMailsCount[0].count
    );
  } catch (error) {
    console.log(error);
    failureResponse(res, 500, "Failed to get count of launch mails");
  }
};
