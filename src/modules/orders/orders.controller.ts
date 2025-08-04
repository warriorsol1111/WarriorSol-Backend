import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import db from "../../common/database/index.js";
import {
  ordersTable,
  userStoriesTable,
  usersTable,
} from "../../common/database/schema.js";
import {
  successResponse,
  failureResponse,
} from "../../common/utils/responses.js";
import { uploadFile } from "../../common/utils/cloudinary.js";
import { desc } from "drizzle-orm";
import { publishToQueue } from "../email/producers/email.producers.js";

class OrdersController {
  async createOrder(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return failureResponse(res, 401, "Unauthorized");
      }

      const { shopifyOrderId } = req.body;

      if (!shopifyOrderId) {
        return failureResponse(res, 400, "Shopify Order ID is required");
      }

      const newOrder = {
        userId,
        shopifyOrderId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const [createdOrder] = await db
        .insert(ordersTable)
        .values(newOrder)
        .returning();

      return successResponse(
        res,
        201,
        "Order created successfully",
        createdOrder
      );
    } catch (error) {
      console.error("Error creating order:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async getUserOrders(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return failureResponse(res, 401, "Unauthorized");
      }

      const orders = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.userId, userId))
        .orderBy(desc(ordersTable.createdAt));

      return successResponse(
        res,
        200,
        "User orders fetched successfully",
        orders
      );
    } catch (error) {
      console.error("Error fetching user orders:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }
}

const ordersController = new OrdersController();
export default ordersController;
