import express, { Request, Response } from "express";
import crypto from "crypto";
import db from "../../../common/database/index.js";
import { ordersTable } from "../../../common/database/schema.js";
import {
  successResponse,
  failureResponse,
} from "../../../common/utils/responses.js";

const router = express.Router();

function verifyShopifyWebhook(req: Request, res: Response, buf: Buffer) {
  const shopifyHmac = req.get("X-Shopify-Hmac-Sha256") || "";
  const generatedHash = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET || "")
    .update(buf)
    .digest("base64");

  if (generatedHash !== shopifyHmac) {
    throw new Error("Invalid webhook signature");
  }
}

router.use(
  express.json({
    verify: (req: Request, res: Response, buf: Buffer) => {
      try {
        verifyShopifyWebhook(req, res, buf);
      } catch (err) {
        console.error(err);
      }
    },
  })
);

router.post("/orders/create", async (req: Request, res: Response) => {
  try {
    const orderData = req.body;

    if (!orderData?.id) {
      return failureResponse(res, 400, "No Shopify Order ID found");
    }

    // 1. Try from note_attributes (API-based orders)
    let userId =
      orderData.note_attributes?.find((attr: any) => attr.name === "user_id")
        ?.value || null;

    // 2. If not found, try parsing from plain note (manual orders)
    if (!userId && orderData.note) {
      const noteMatch = orderData.note.match(/userId\s*:\s*(\S+)/i);
      if (noteMatch) {
        userId = noteMatch[1];
      }
    }

    const newOrder = {
      userId,
      shopifyOrderId: orderData.id.toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [createdOrder] = await db
      .insert(ordersTable)
      .values(newOrder)
      .returning();

    return successResponse(res, 200, "Order webhook processed", createdOrder);
  } catch (error) {
    console.error("Error in Shopify order webhook:", error);
    return failureResponse(res, 500, "Internal Server Error");
  }
});

export default router;
