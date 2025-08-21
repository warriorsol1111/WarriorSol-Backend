import { Router } from "express";
import {
  addUserToNewsletterMails,
  getCountOfNewsletterMails,
} from "./newsletter-mails.controller";

const newsletterMailsRouter = Router();

newsletterMailsRouter.post("/register", addUserToNewsletterMails);
newsletterMailsRouter.get("/count", getCountOfNewsletterMails);
export default newsletterMailsRouter;
``;
