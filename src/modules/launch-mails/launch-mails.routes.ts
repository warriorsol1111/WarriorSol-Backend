import { Router } from "express";
import {
  addUserToLaunchMails,
  getCountOfLaunchMails,
} from "./launch-mails.controller.ts";

const launchMailsRouter = Router();

launchMailsRouter.post("/register", addUserToLaunchMails);
launchMailsRouter.get("/count", getCountOfLaunchMails);
export default launchMailsRouter;
``;
