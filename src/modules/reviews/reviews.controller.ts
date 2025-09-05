import { Request, Response } from "express";
import { eq, desc, count, avg, and } from "drizzle-orm";
import db from "../../common/database/index.js";
import { reviews, usersTable } from "../../common/database/schema.js";
import {
  successResponse,
  failureResponse,
} from "../../common/utils/responses.js";

class ReviewsController {
  async createReview(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return failureResponse(res, 401, "Unauthorized");
      }

      const { productId, rating, comment } = req.body;
      if (!productId || !rating) {
        return failureResponse(res, 400, "Product ID and rating are required");
      }

      const newReview = {
        userId,
        productId,
        score: rating,
        review: comment,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const [createdReview] = await db
        .insert(reviews)
        .values(newReview)
        .returning();

      return successResponse(
        res,
        201,
        "Review created successfully",
        createdReview
      );
    } catch (error) {
      console.error("Error creating review:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async updateProductReview(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return failureResponse(res, 401, "Unauthorized");
      }

      const { productId, rating, comment } = req.body;
      if (!productId || !rating) {
        return failureResponse(res, 400, "Product ID and rating are required");
      }

      const updatedReviewData = {
        userId,
        productId,
        score: rating,
        review: comment,
        updatedAt: new Date(),
      };

      await db
        .insert(reviews)
        .values(updatedReviewData)
        .onConflictDoUpdate({
          target: [reviews.userId, reviews.productId],
          set: {
            score: rating,
            review: comment,
            updatedAt: new Date(),
          },
        })
        .returning();

      return successResponse(
        res,
        200,
        "Review updated successfully",
        updatedReviewData
      );
    } catch (error) {
      console.error("Error updating review:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }
  async getProductReviews(req: Request, res: Response) {
    try {
      const { productId } = req.params;

      if (!productId) {
        return failureResponse(res, 400, "Product ID is required");
      }

      const reviewsList = await db
        .select({
          review: reviews,
          user: {
            id: usersTable.id,
            name: usersTable.name,
            profilePhoto: usersTable.profilePhoto,
          },
        })
        .from(reviews)
        .innerJoin(usersTable, eq(reviews.userId, usersTable.id))
        .where(eq(reviews.productId, productId))
        .orderBy(desc(reviews.createdAt));

      return successResponse(
        res,
        200,
        "Reviews fetched successfully",
        reviewsList
      );
    } catch (error) {
      console.error("Error fetching reviews:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }

  async getTotalCountAndAverageRatingForProduct(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { productId } = req.params;

      if (!productId) {
        return failureResponse(res, 400, "Product ID is required");
      }

      const [result] = await db
        .select({
          totalCount: count(reviews.id).as("totalCount"),
          averageRating: avg(reviews.score).as("averageRating"),
        })
        .from(reviews)
        .where(eq(reviews.productId, productId));

      return successResponse(
        res,
        200,
        "Total count and average rating fetched successfully",
        result
      );
    } catch (error) {
      console.error("Error fetching total count and average rating:", error);
      return failureResponse(res, 500, "Internal Server Error");
    }
  }
}

export default new ReviewsController();
