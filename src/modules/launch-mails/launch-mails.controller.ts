import { Request, Response } from "express";
import { successResponse, failureResponse } from "../../common/utils/responses";
import db from "../../common/database/index";
import { launchMailsTable } from "../../common/database/schema";
import { publishToQueue } from "../email/producers/email.producers";
import { count, eq, and } from "drizzle-orm";
import { addContactToHubSpot } from "../../utils/hubspot";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export const addUserToLaunchMails = async (req: Request, res: Response) => {
  const { email, site } = req.body;
  if (!email || !site)
    return failureResponse(res, 400, "Email and site are required");
  try {
    // Check if email already exists for this site
    const existingEmail = await db
      .select()
      .from(launchMailsTable)
      .where(
        and(eq(launchMailsTable.email, email), eq(launchMailsTable.site, site))
      );
    if (existingEmail.length > 0) {
      return failureResponse(
        res,
        400,
        "Email already subscribed for this site"
      );
    }
    await db.transaction(async (tx) => {
      // Insert email
      await tx.insert(launchMailsTable).values({ email, site });
      // Map site to signupSource with proper type safety
      let signupSource: "warriorsol" | "foundation" | "tasha";
      if (site === "warrior_sol") {
        signupSource = "warriorsol";
      } else if (site === "foundation") {
        signupSource = "foundation";
      } else if (site === "tasha_mellett") {
        signupSource = "tasha";
      } else {
        // If site doesn't match any expected values, return an error
        throw new Error("Invalid site");
      }

      await addContactToHubSpot(email, site, signupSource);

      // try {
      //   // Pick template depending on site
      //   let subject, templatePath;

      //   if (site === "warrior_sol") {
      //     subject = "Welcome to the Warrior Sol Waitlist!";
      //     templatePath = "warrior-waitlist-confirmation.ejs";
      //   } else if (site === "foundation") {
      //     subject = "Welcome to the Warrior Sol Foundation Waitlist!";
      //     templatePath = "foundation-waitlist-confirmation.ejs";
      //   } else if (site === "tasha_mellett") {
      //     subject = "Welcome to the Tasha Mellett Foundation Waitlist!";
      //     templatePath = "tasha-waitlist-confirmation.ejs";
      //   } else {
      //     return failureResponse(res, 400, "Invalid site");
      //   }

      //   await publishToQueue({
      //     email,
      //     subject,
      //     templatePath,
      //     templateData: { frontendUrl: FRONTEND_URL },
      //   });
      // } catch (err) {
      //   console.error(
      //     "Failed to send waitlist confirmation email:",
      //     (err as Error).message
      //   );

      //   return failureResponse(res, 500, "Failed to send confirmation email");
      // }
    });
    return successResponse(res, 200, "Email added successfully");
  } catch (error: any) {
    console.error("Error adding email to launch list:", error.message);
    return failureResponse(res, 500, "Failed to add email");
  }
};

export const getCountOfLaunchMails = async (req: Request, res: Response) => {
  const { site } = req.query;

  if (!site) return failureResponse(res, 400, "Site is required");

  try {
    const launchMailsCount = await db
      .select({ count: count() })
      .from(launchMailsTable)
      .where(eq(launchMailsTable.site, site as string));

    return successResponse(
      res,
      200,
      `Count of launch mails for ${site}`,
      launchMailsCount[0].count
    );
  } catch (error: any) {
    console.error("Failed to get count of launch mails:", error.message);
    return failureResponse(res, 500, "Failed to get count of launch mails");
  }
};
