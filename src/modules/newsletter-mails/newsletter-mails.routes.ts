import { Router } from "express";
import {
  addUserToLaunchMails,
  getCountOfLaunchMails,
} from "./newsletter-mails.controller.ts";

const newsletterMailsRouter = Router();

newsletterMailsRouter.post("/register", addUserToLaunchMails);
newsletterMailsRouter.get("/count", getCountOfLaunchMails);
export default newsletterMailsRouter;
``;
