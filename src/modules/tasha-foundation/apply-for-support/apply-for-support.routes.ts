import { Router } from "express";
import applyForSupportController from "./apply-for-support.controller";
import authenticateJwt from "../../../common/middlewares/auth.middleware";
import applyForSupportRouter from "../../apply-for-support/apply-for-support.routes";

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
tashaSupportApplicationsRouter.put(
  "/:id/reject",
  authenticateJwt,
  applyForSupportController.rejectSupportApplication
);

export default tashaSupportApplicationsRouter;
