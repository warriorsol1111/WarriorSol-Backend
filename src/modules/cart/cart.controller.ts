import { Request, Response } from "express";
import { successResponse, failureResponse } from "../../common/utils/responses";
import db from "../../common/database/index";
import jwt from "jsonwebtoken";
import { usersTable, verificationCodes } from "../../common/database/schema";
import bcrypt from "bcrypt";
import { eq, and, desc, or } from "drizzle-orm";
import { generateVerificationCode } from "../../common/utils/auth.util";
import { publishToQueue } from "../email/producers/email.producers";

class CartController {
  async getCartID(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      if (!userID) {
        return failureResponse(res, 401, "Unauthorized");
      }
      const cartID = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userID))
        .then((user) => user[0]?.cartId);
      if (!cartID) {
        return failureResponse(res, 404, "Cart ID not found for this user");
      }
      return successResponse(res, 200, "Cart ID retrieved successfully", {
        cartID,
      });
    } catch (error) {
      console.error("Error retrieving cart:", error);
      return failureResponse(res, 500, "Internal server error");
    }
  }

  async saveCartID(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      const { cartId } = req.body;
      if (!userID) {
        return failureResponse(res, 401, "Unauthorized");
      }
      if (!cartId) {
        return failureResponse(res, 400, "Cart ID is required");
      }
      await db
        .update(usersTable)
        .set({ cartId })
        .where(eq(usersTable.id, userID));
      return successResponse(res, 200, "Cart ID saved successfully");
    } catch (error) {
      console.error("Error saving cart ID:", error);
      return failureResponse(res, 500, "Internal server error");
    }
  }
  async deleteCartID(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      if (!userID) {
        return failureResponse(res, 401, "Unauthorized");
      }
      await db
        .update(usersTable)
        .set({ cartId: null })
        .where(eq(usersTable.id, userID));
      return successResponse(res, 200, "Cart ID deleted successfully");
    } catch (error) {
      console.error("Error deleting cart ID:", error);
      return failureResponse(res, 500, "Internal server error");
    }
  }
}
export default new CartController();
