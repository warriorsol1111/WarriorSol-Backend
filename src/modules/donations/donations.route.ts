import { Router } from "express";
import donationsController from "./donations.controller";
import authenticateJwt from "../../common/middlewares/auth.middleware";

const donationsRouter = Router();

donationsRouter.post("/", donationsController.createDonation);
donationsRouter.get(
  "/user-donations",
  authenticateJwt,
  donationsController.getUserDonations
);
donationsRouter.get(
  "/top-donations",
  authenticateJwt,
  donationsController.getTop5HighestDonations
);
donationsRouter.get(
  "/recent",
  authenticateJwt,
  donationsController.getRecentDonations
);

donationsRouter.put(
  "/update-receipt-by-session/:id",
  donationsController.updateReceiptUrl
);

donationsRouter.put(
  "/update-receipt-by-subscription/:id",
  donationsController.updateReceiptBySubscriptionId
);

export default donationsRouter;
