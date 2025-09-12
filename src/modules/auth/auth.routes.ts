import { Router } from "express";
import authController from "./auth.controller";
import authenticateJwt from "../../common/middlewares/auth.middleware";
import multer from "multer";

const authRouter = Router();
const userStoriesRouter = Router();
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});
authRouter.post("/register", authController.registerUser);
authRouter.post("/resend-otp", authController.resendOtp);
authRouter.post("/login", authController.loginUser);
authRouter.post("/forgot-password", authController.forgotPassword);
authRouter.post("/reset-password", authController.resetPassword);
authRouter.post("/verify-email", authController.verifyEmail);
authRouter.post("/google-sync", authController.googleSyncUser);
authRouter.post(
  "/verify-password",
  authenticateJwt,
  authController.verifyPassword
);
authRouter.post(
  "/change-password",
  authenticateJwt,
  authController.changePassword
);
authRouter.post(
  "/upload-photo",
  authenticateJwt,
  upload.single("photo"),
  authController.uploadProfilePhoto
);
authRouter.delete(
  "/delete-photo",
  authenticateJwt,
  authController.deleteProfilePhoto
);

export default authRouter;
