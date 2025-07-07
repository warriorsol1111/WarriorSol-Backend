import { Router } from "express";
import authController from "./auth.controller.ts";

const authRouter = Router();

authRouter.post("/register", authController.registerUser);
authRouter.post("/resend-otp", authController.resendOtp);
authRouter.post("/login", authController.loginUser);
authRouter.post("/forgot-password", authController.forgotPassword);
authRouter.post("/reset-password", authController.resetPassword);
authRouter.post("/verify-email", authController.verifyEmail);
authRouter.post("/google-sync", authController.googleSyncUser);

export default authRouter;
