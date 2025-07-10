import { Router } from "express";
import userStoriesController from "./user-stories.controller.js";
import authenticateJwt from "../../common/middlewares/auth.middleware.js";
import multer from "multer";

const userStoriesRouter = Router();
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});
userStoriesRouter.get(
  "/",
  authenticateJwt,
  userStoriesController.getAllUserStories
);
userStoriesRouter.get(
  "/approved",
  authenticateJwt,
  userStoriesController.getApprovedUserStories
);
userStoriesRouter.get(
  "/:id",
  authenticateJwt,
  userStoriesController.getUserStoryById
);
userStoriesRouter.post(
  "/",
  authenticateJwt,
  upload.single("attachment"),
  userStoriesController.createUserStory
);
userStoriesRouter.put(
  "/:id/approve",
  authenticateJwt,
  userStoriesController.approveUserStory
);
userStoriesRouter.put(
  "/:id/reject",
  authenticateJwt,
  userStoriesController.rejectUserStory
);
userStoriesRouter.delete(
  "/:id",
  authenticateJwt,
  userStoriesController.deleteUserStory
);

export default userStoriesRouter;
