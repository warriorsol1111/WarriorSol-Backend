import { Router } from "express";
import authController from "./auth.controller.ts";
import authenticateJwt from "../../common/middlewares/auth.middleware.ts";

const authRouter = Router();

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

authRouter.post("/validate-token", authController.validateToken);

export default authRouter;
