import { Request, Response } from "express";
import db from "../../common/database";
import { donationsTable } from "../../common/database/schema";
import { eq } from "drizzle-orm";
import { successResponse, failureResponse } from "../../common/utils/responses";
import { desc } from "drizzle-orm";

class DonationController {
  async createDonation(req: Request, res: Response): Promise<void> {
    try {
      const {
        stripeSessionId,
        stripeReceiptUrl,
        stripeSubscriptionId,
        name,
        email,
        amount,
        currency = "usd",
        donationType = "one-time",
        status = "succeeded",
        userId = null,
      } = req.body;

      if (!stripeSessionId || !name || !email || !amount) {
        return failureResponse(res, 400, "Missing required fields");
      }

      await db.insert(donationsTable).values({
        stripeSessionId,
        stripeReceiptUrl,
        stripeSubscriptionId,
        name,
        email,
        amount,
        currency,
        donationType,
        status,
        userId,
      });

      return successResponse(res, 201, "Donation recorded successfully");
    } catch (error: any) {
      console.error("Failed to create donation:", error.message);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async getUserDonations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return failureResponse(res, 401, "Unauthorized");
      }

      const donations = await db
        .select()
        .from(donationsTable)
        .where(eq(donationsTable.userId, userId));

      return successResponse(res, 200, "Donations fetched", donations);
    } catch (error: any) {
      console.error("Failed to fetch donations:", error.message);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async updateRecieptUrl(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { stripeReceiptUrl } = req.body;
      if (!stripeReceiptUrl) {
        return failureResponse(res, 400, "Stripe receipt URL is required");
      }

      const donation = await db
        .update(donationsTable)
        .set({ stripeReceiptUrl })
        .where(eq(donationsTable.stripeSessionId, id))
        .returning();
      if (donation.length === 0) {
        return failureResponse(res, 404, "Donation not found");
      }
      return successResponse(
        res,
        200,
        "Receipt URL updated successfully",
        donation[0]
      );
    } catch (error: any) {
      console.error("Failed to update receipt URL:", error.message);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async updateRecieptBySubscriptionId(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { stripeReceiptUrl } = req.body;
      if (!stripeReceiptUrl) {
        return failureResponse(res, 400, "Stripe receipt URL is required");
      }

      const donation = await db
        .update(donationsTable)
        .set({ stripeReceiptUrl })
        .where(eq(donationsTable.stripeSubscriptionId, id))
        .returning();
      if (donation.length === 0) {
        return failureResponse(res, 404, "Donation not found");
      }
      return successResponse(
        res,
        200,
        "Receipt URL updated successfully",
        donation[0]
      );
    } catch (error: any) {
      console.error("Failed to update receipt URL:", error.message);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async getRecentDonations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return failureResponse(res, 401, "Unauthorized");
      }
      const donations = await db
        .select()
        .from(donationsTable)
        .orderBy(desc(donationsTable.createdAt))
        .where(eq(donationsTable.status, "paid"))
        .limit(5);

      return successResponse(res, 200, "Recent donations fetched", donations);
    } catch (error: any) {
      console.error("Failed to fetch recent donations:", error.message);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async getTop5HighestDonations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return failureResponse(res, 401, "Unauthorized");
      }
      const donations = await db
        .select()
        .from(donationsTable)
        .orderBy(desc(donationsTable.amount))
        .limit(5);

      return successResponse(
        res,
        200,
        "Top 5 highest donations fetched",
        donations
      );
    } catch (error: any) {
      console.error("Failed to fetch top 5 donations:", error.message);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }
}

export default new DonationController();
