import { Router } from "express";
import reviewsController from "./reviews.controller";
import authenticateJwt from "../../common/middlewares/auth.middleware.js";

const reviewsRouter = Router();

reviewsRouter.post("/", authenticateJwt, reviewsController.createReview);
reviewsRouter.put("/", authenticateJwt, reviewsController.updateProductReview);
reviewsRouter.get(
  "/:productId",
  authenticateJwt,
  reviewsController.getProductReviews
);
reviewsRouter.get(
  "/:productId/totalCountAndAverageRating",
  reviewsController.getTotalCountAndAverageRatingForProduct
);
export default reviewsRouter;
