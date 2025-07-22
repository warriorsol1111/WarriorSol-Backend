import { Router } from "express";
import applyForSupportController from "./apply-for-support.controller.ts";
import authenticateJwt from "../../common/middlewares/auth.middleware.ts";

const applyForSupportRouter = Router();

applyForSupportRouter.post(
  "/",
  authenticateJwt,
  applyForSupportController.createSupportApplication
);
applyForSupportRouter.get(
  "/",
  authenticateJwt,
  applyForSupportController.getAllSupportApplications
);
applyForSupportRouter.get(
  "/user-applications",
  authenticateJwt,
  applyForSupportController.getUserSupportApplications
);
applyForSupportRouter.put(
  "/:id/accept",
  authenticateJwt,
  applyForSupportController.approveSupportApplication
);
applyForSupportRouter.put(
  "/:id/reject",
  authenticateJwt,
  applyForSupportController.rejectSupportApplication
);

export default applyForSupportRouter;
