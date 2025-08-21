import { Request, Response } from "express";
import { successResponse, failureResponse } from "../../common/utils/responses";
import db from "../../common/database/index";
import { eq, and, sql } from "drizzle-orm";
import { usersTable, wishlistTable } from "../../common/database/schema";

class WishlistController {
  async getWishlistItems(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      if (!userID) return failureResponse(res, 401, "Unauthorized");

      const wishlist = await db
        .select()
        .from(wishlistTable)
        .where(eq(wishlistTable.userId, userID));

      return successResponse(
        res,
        200,
        "Wishlist retrieved successfully",
        wishlist
      );
    } catch (error) {
      console.error("Error retrieving wishlist:", error);
      return failureResponse(res, 500, "Internal server error");
    }
  }

  async addItemToWishlist(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      const { variantId } = req.body;

      if (!userID) return failureResponse(res, 401, "Unauthorized");
      if (!variantId)
        return failureResponse(res, 400, "Variant ID is required");

      const existingItem = await db
        .select()
        .from(wishlistTable)
        .where(
          and(
            eq(wishlistTable.userId, userID),
            eq(wishlistTable.variantId, variantId)
          )
        );

      if (existingItem.length > 0) {
        return failureResponse(res, 409, "Item already exists in wishlist");
      }

      await db.insert(wishlistTable).values({
        userId: userID,
        variantId,
      });

      return successResponse(res, 201, "Item added to wishlist successfully");
    } catch (error) {
      console.error("Error adding item to wishlist:", error);
      return failureResponse(res, 500, "Internal server error");
    }
  }

  async removeItemFromWishlist(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      const { variantId } = req.body;

      if (!userID) return failureResponse(res, 401, "Unauthorized");
      if (!variantId)
        return failureResponse(res, 400, "Variant ID is required");

      await db
        .delete(wishlistTable)
        .where(
          and(
            eq(wishlistTable.userId, userID),
            eq(wishlistTable.variantId, variantId)
          )
        );

      return successResponse(
        res,
        200,
        "Item removed from wishlist successfully"
      );
    } catch (error) {
      console.error("Error removing item from wishlist:", error);
      return failureResponse(res, 500, "Internal server error");
    }
  }

  async clearWishlist(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      if (!userID) return failureResponse(res, 401, "Unauthorized");

      await db.delete(wishlistTable).where(eq(wishlistTable.userId, userID));

      return successResponse(res, 200, "Wishlist cleared successfully");
    } catch (error) {
      console.error("Error clearing wishlist:", error);
      return failureResponse(res, 500, "Internal server error");
    }
  }

  async getWishlistCount(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      if (!userID) return failureResponse(res, 401, "Unauthorized");

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(wishlistTable)
        .where(eq(wishlistTable.userId, userID));

      return successResponse(
        res,
        200,
        "Wishlist count retrieved successfully",
        countResult[0].count
      );
    } catch (error) {
      console.error("Error retrieving wishlist count:", error);
      return failureResponse(res, 500, "Internal server error");
    }
  }

  async isItemInWishlist(req: Request, res: Response) {
    try {
      const userID = req.user?.id;
      const { variantId } = req.query;

      if (!userID) return failureResponse(res, 401, "Unauthorized");
      if (!variantId || typeof variantId !== "string")
        return failureResponse(res, 400, "Variant ID is required");

      const item = await db
        .select()
        .from(wishlistTable)
        .where(
          and(
            eq(wishlistTable.userId, userID),
            eq(wishlistTable.variantId, variantId)
          )
        );

      const isInWishlist = item.length > 0;

      return successResponse(res, 200, "Item check completed", {
        isInWishlist,
      });
    } catch (error) {
      console.error("Error checking item in wishlist:", error);
      return failureResponse(res, 500, "Internal server error");
    }
  }
}

export default new WishlistController();
