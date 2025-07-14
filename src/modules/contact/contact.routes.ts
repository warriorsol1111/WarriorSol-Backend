import { Router } from "express";
import ContactController from "./contact.controller";
import authenticateJwt from "../../common/middlewares/auth.middleware";

const contactRouter = Router();

contactRouter.post(
  "/send-message",
  authenticateJwt,
  ContactController.sendMessage
);

export default contactRouter;
