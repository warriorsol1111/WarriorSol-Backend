import cron from "node-cron";
import db from "../../common/database/index";
import { launchMailsTable } from "../../common/database/schema";
import { publishToQueue } from "../email/producers/email.producers";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export const scheduleNewsletterEmails = () => {
  // Schedule for the launch emails
  const monthlySchedule = "11 11 1 * *"; // 11:11 AM on the 1st of every month

  console.log(
    "Monthly newsletter cron job scheduled for 11:11 on the 1st of every month (America/New_York)"
  );

  cron.schedule(
    monthlySchedule,
    async () => {
      try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const november11 = new Date(`${currentYear}-11-11T00:00:00Z`);
        //dont send before 11 nov 2025
        if (now < november11) {
          console.log("Not time to send newsletter yet");
          return;
        }
        const subscribers = await db.select().from(launchMailsTable);

        if (subscribers.length === 0) {
          console.log("No subscribers found. Skipping...");
          return;
        }

        console.log(`Sending newsletter to ${subscribers.length} subscribers`);

        const monthName = now.toLocaleString("default", { month: "long" });

        for (const subscriber of subscribers) {
          await publishToQueue({
            email: subscriber.email,
            subject: `🔥 ${monthName} Newsletter – Warrior Sol Is Here!`,
            templatePath: "newsletter-mail.ejs",
            templateData: {
              heading: `You've unlocked the ${monthName} Transmission`,
              intro: `This month we drop heat, share behind-the-scenes moments, and celebrate YOU — the real warrior.`,
              content:
                "Introducing our latest drop: *Solar Surge*. Bold designs, ethically made, unapologetically strong. You’ll want to grab these before they vanish.",
              cta: {
                text: "Shop the Drop",
                link: `${FRONTEND_URL}/products`,
              },
            },
          });
        }

        console.log("Monthly newsletters sent successfully");
      } catch (error) {
        console.error("Error sending monthly newsletter:", error);
      }
    },
    {
      timezone: "America/New_York",
    }
  );
};
