import { Request, Response } from "express";
import { eq, desc } from "drizzle-orm";
import db from "../../common/database/index.js";
import {
  supportApplicationsTable,
  usersTable,
} from "../../common/database/schema.js";
import {
  successResponse,
  failureResponse,
} from "../../common/utils/responses.js";
import { publishToQueue } from "../email/producers/email.producers.js";
import { uuid } from "drizzle-orm/gel-core";

class SupportApplicationsController {
  async createSupportApplication(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      if (!userID) return failureResponse(res, 401, "Unauthorized");

      if (!req.body || Object.keys(req.body).length === 0) {
        return failureResponse(res, 400, "Request body cannot be empty");
      }

      const {
        familyName,
        contactEmail,
        contactPhone,
        familySize,
        supportType,
        requestedAmount,
        situation,
      } = req.body;

      if (
        !familyName ||
        !contactEmail ||
        !familySize ||
        !supportType ||
        !requestedAmount ||
        !situation
      ) {
        return failureResponse(res, 400, "All required fields must be filled");
      }

      await db.transaction(async (tx) => {
        const [application] = await tx
          .insert(supportApplicationsTable)
          .values({
            userId: userID,
            familyName,
            contactEmail,
            contactPhone,
            familySize,
            supportType,
            requestedAmount,
            situation,
          })
          .returning();

        // Send confirmation email
        try {
          if (contactEmail) {
            await publishToQueue({
              email: contactEmail,
              subject: "We've Received Your Support Application",
              templatePath: "application-submitted.ejs",
              templateData: {
                familyName,
                supportType,
                frontendUrl:
                  process.env.WARRIOR_SOL_FOUNDATION_URL ||
                  "https://warriorsol.org",
              },
            });
          }
        } catch (err) {
          throw new Error("Email sending failed: " + (err as Error).message);
        }

        return successResponse(
          res,
          201,
          "Support application submitted successfully",
          application
        );
      });
    } catch (err) {
      console.error("Error creating support application:", err);
      return failureResponse(
        res,
        500,
        (err as Error).message || "Internal Server Error"
      );
    }
  }

  async getAllSupportApplications(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      if (!userID) return failureResponse(res, 401, "Unauthorized");

      const apps = await db
        .select()
        .from(supportApplicationsTable)
        .orderBy(desc(supportApplicationsTable.createdAt));

      return successResponse(
        res,
        200,
        "Applications fetched successfully",
        apps
      );
    } catch (err) {
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async getUserSupportApplications(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      if (!userID) return failureResponse(res, 401, "Unauthorized");

      const applications = await db
        .select()
        .from(supportApplicationsTable)
        .where(eq(supportApplicationsTable.userId, userID))
        .orderBy(desc(supportApplicationsTable.createdAt));

      return successResponse(
        res,
        200,
        "Your support applications fetched",
        applications
      );
    } catch (err) {
      console.error("Error fetching user applications:", err);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async approveSupportApplication(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userID = req.user?.id;
      if (!userID) return failureResponse(res, 401, "Unauthorized");

      await db.transaction(async (tx) => {
        const [application] = await tx
          .select()
          .from(supportApplicationsTable)
          .where(eq(supportApplicationsTable.id, parseInt(id)))
          .limit(1);

        if (!application)
          return failureResponse(res, 404, "Support application not found");
        if (application.status === "approved")
          return failureResponse(res, 400, "Application is already approved");
        if (application.status === "rejected")
          return failureResponse(res, 400, "Application is already rejected");

        const [updated] = await tx
          .update(supportApplicationsTable)
          .set({ status: "approved" })
          .where(eq(supportApplicationsTable.id, parseInt(id)))
          .returning();

        const [user] = await tx
          .select({ email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.id, updated.userId));

        // Send approval email
        try {
          if (user?.email) {
            await publishToQueue({
              email: user.email,
              subject: "Your Support Application Was Approved",
              templatePath: "application-approved.ejs",
              templateData: {
                familyName: updated.familyName,
                supportType: updated.supportType,
                frontendUrl:
                  process.env.WARRIOR_SOL_FOUNDATION_URL ||
                  "http://localhost:3000",
              },
            });
          }
        } catch (err) {
          throw new Error("Email sending failed: " + (err as Error).message);
        }

        return successResponse(res, 200, "Application approved", updated);
      });
    } catch (err) {
      console.error("Error approving support application:", err);
      return failureResponse(
        res,
        500,
        (err as Error).message || "Internal Server Error"
      );
    }
  }

  async rejectSupportApplication(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userID = req.user?.id;
      if (!userID) return failureResponse(res, 401, "Unauthorized");

      await db.transaction(async (tx) => {
        const [application] = await tx
          .select()
          .from(supportApplicationsTable)
          .where(eq(supportApplicationsTable.id, parseInt(id)))
          .limit(1);

        if (!application)
          return failureResponse(res, 404, "Support application not found");
        if (application.status === "rejected")
          return failureResponse(res, 400, "Application is already rejected");
        if (application.status === "approved")
          return failureResponse(res, 400, "Application is already approved");

        const [updated] = await tx
          .update(supportApplicationsTable)
          .set({ status: "rejected" })
          .where(eq(supportApplicationsTable.id, parseInt(id)))
          .returning();

        const [user] = await tx
          .select({ email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.id, updated.userId));

        // Send rejection email
        try {
          if (user?.email) {
            await publishToQueue({
              email: user.email,
              subject: "Support Application Update",
              templatePath: "application-rejected.ejs",
              templateData: {
                familyName: updated.familyName,
                supportType: updated.supportType,
                frontendUrl:
                  process.env.WARRIOR_SOL_FOUNDATION_URL ||
                  "http://localhost:3000",
              },
            });
          }
        } catch (err) {
          throw new Error("Email sending failed: " + (err as Error).message);
        }

        return successResponse(res, 200, "Application rejected", updated);
      });
    } catch (err) {
      console.error("Error rejecting support application:", err);
      return failureResponse(
        res,
        500,
        (err as Error).message || "Internal Server Error"
      );
    }
  }
}

export default new SupportApplicationsController();
