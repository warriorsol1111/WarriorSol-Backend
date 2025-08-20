import { Router } from "express";
import donationsController from "./donations.controller";
import authenticateJwt from "../../../common/middlewares/auth.middleware";

const tashaDonationsRouter = Router();

tashaDonationsRouter.post("/", donationsController.createDonation);
tashaDonationsRouter.get(
  "/user-donations",
  authenticateJwt,
  donationsController.getUserDonations
);
tashaDonationsRouter.get(
  "/top-donations",
  authenticateJwt,
  donationsController.getTop5HighestDonations
);
tashaDonationsRouter.get(
  "/recent",
  authenticateJwt,
  donationsController.getRecentDonations
);

tashaDonationsRouter.put(
  "/update-receipt-by-session/:id",
  donationsController.updateReceiptUrl
);

tashaDonationsRouter.put(
  "/update-receipt-by-subscription/:id",
  donationsController.updateReceiptBySubscriptionId
);

export default tashaDonationsRouter;
