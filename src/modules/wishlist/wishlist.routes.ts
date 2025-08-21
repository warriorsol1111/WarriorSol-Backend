import { Router } from "express";
import authenticateJwt from "../../common/middlewares/auth.middleware";
import wishlistController from "./wishlist.controller";

const wishlistRouter = Router();

// Get all wishlist items
wishlistRouter.get("/", authenticateJwt, wishlistController.getWishlistItems);

// Add item to wishlist
wishlistRouter.post("/", authenticateJwt, wishlistController.addItemToWishlist);

// Remove a specific variant from wishlist (using route param for variantId)
wishlistRouter.delete(
  "/",
  authenticateJwt,
  wishlistController.removeItemFromWishlist
);

// Clear entire wishlist
wishlistRouter.delete(
  "/clear",
  authenticateJwt,
  wishlistController.clearWishlist
);

// Get wishlist count
wishlistRouter.get(
  "/count",
  authenticateJwt,
  wishlistController.getWishlistCount
);

// Check if a variant is in wishlist
wishlistRouter.get(
  "/check",
  authenticateJwt,
  wishlistController.isItemInWishlist
);

export default wishlistRouter;
