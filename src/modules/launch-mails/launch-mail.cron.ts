import cron from "node-cron";
import db from "../../common/database/index";
import { launchMailsTable } from "../../common/database/schema";
import { publishToQueue } from "../email/producers/email.producers";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export const scheduleLaunchEmails = () => {
  const productionSchedule = "11 11 11 11 *"; // 11:11 AM, Nov 11
  let hasLaunched = false;

  cron.schedule(
    productionSchedule,
    async () => {
      if (hasLaunched) return;
      if (new Date().getFullYear() !== 2025) {
        console.log("Not 2025 — skipping launch job");
        return;
      }
      try {
        console.log("Running launch email cron job...");

        const subscribers = await db.select().from(launchMailsTable);

        console.log(
          `Sending launch emails to ${subscribers.length} subscribers`
        );

        for (const subscriber of subscribers) {
          await publishToQueue({
            email: subscriber.email,
            subject: "Warrior Sol Is Officially Live!",
            templatePath: "launch-email.ejs",
            templateData: {
              frontendUrl: FRONTEND_URL,
            },
          });
        }

        console.log("Launch emails sent successfully");
        hasLaunched = true;
      } catch (error) {
        console.error("Error sending launch emails:", error);
      }
    },
    {
      timezone: "America/New_York",
    }
  );

  console.log(
    "Launch email cron job scheduled for 11:11 on Nov 11th (America/New_York)"
  );
};
