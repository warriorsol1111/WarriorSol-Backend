import { Router } from "express";
import applyForSupportController from "./apply-for-support.controller.ts";
import authenticateJwt from "../../../common/middlewares/auth.middleware.ts";
import applyForSupportRouter from "../../apply-for-support/apply-for-support.routes.ts";

const tashaSupportApplicationsRouter = Router();

tashaSupportApplicationsRouter.post(
  "/",
  authenticateJwt,
  applyForSupportController.createSupportApplication
);
tashaSupportApplicationsRouter.get(
  "/",
  authenticateJwt,
  applyForSupportController.getAllSupportApplications
);
tashaSupportApplicationsRouter.get(
  "/user-applications",
  authenticateJwt,
  applyForSupportController.getUserSupportApplications
);
tashaSupportApplicationsRouter.put(
  "/:id/accept",
  authenticateJwt,
  applyForSupportController.approveSupportApplication
);
applyForSupportRouter.put(
  "/:id/reject",
  authenticateJwt,
  applyForSupportController.rejectSupportApplication
);

export default tashaSupportApplicationsRouter;
