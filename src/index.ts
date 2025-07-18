import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import cors from "cors";
import express from "express";
import launchMailsRouter from "./modules/launch-mails/launch-mails.routes.js";
import authRouter from "./modules/auth/auth.routes.js";
import { consumeEmails } from "./modules/email/consumers/email.consumers.js";
import userStoriesRouter from "./modules/user-stories/user-stories.routes.js";
import passport from "./common/strategies/jwt-strategy.js";
import { scheduleLaunchEmails } from "./modules/launch-mails/launch-mail.cron.js";
import cartRouter from "./modules/cart/cart.routes.js";
import wishlistRouter from "./modules/wishlist/wishlist.routes.js";
import newsletterMailsRouter from "./modules/newsletter-mails/newsletter-mails.routes.js";
import { scheduleNewsletterEmails } from "./modules/newsletter-mails/newsletter-mail.cron.js";
import contactController from "./modules/contact/contact.controller.js";
import contactRouter from "./modules/contact/contact.routes.js";
import donationsRouter from "./modules/donations/donations.route.js";

async function main() {
  const app = express();
  const port = process.env.PORT || 8000;
  const corsOptions = {
    credentials: true,
    origin: "*",
  };
  app.use(express.json());
  app.use(cors(corsOptions));
  app.use(passport.initialize());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  app.use("/api/v1/launch-mails/", launchMailsRouter);
  app.use("/api/v1/newsletter-mails/", newsletterMailsRouter);
  app.use("/api/v1/auth/", authRouter);
  app.use("/api/v1/user-stories/", userStoriesRouter);
  app.use("/api/v1/cart", cartRouter);
  app.use("/api/v1/wishlist", wishlistRouter);
  app.use("/api/v1/contact", contactRouter);
  app.use("/api/v1/donations", donationsRouter);
  // Initialize the launch email cron job
  scheduleLaunchEmails();
  // Initilaize the newsletter email cron job
  scheduleNewsletterEmails();

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

main();

consumeEmails();
