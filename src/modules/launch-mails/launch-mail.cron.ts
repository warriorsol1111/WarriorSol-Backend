import cron from "node-cron";
import db from "../../common/database/index";
import { launchMailsTable } from "../../common/database/schema";
import { publishToQueue } from "../email/producers/email.producers";

export const scheduleLaunchEmails = () => {
  const productionSchedule = "11 11 11 11 *"; // 11:11 AM, Nov 11
  let hasLaunched = false;
  let FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
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
          let subject, templatePath;

          if (subscriber.site === "warrior_sol") {
            subject = "Warrior Sol Is Officially Live!";
            templatePath = "warrior-launch.ejs";
            FRONTEND_URL = process.env.FRONTEND_URL!;
          } else if (subscriber.site === "foundation") {
            subject = "Warrior Sol Foundation Is Officially Live!";
            templatePath = "foundation-launch.ejs";
            FRONTEND_URL = process.env.WARRIOR_SOL_FOUNDATION_URL!;
          } else if (subscriber.site === "tasha_mellett") {
            subject = "Tasha Mellett Foundation Is Officially Live!";
            templatePath = "tasha-launch.ejs";
            FRONTEND_URL = process.env.TASHA_FOUNDATION_URL!;
          }

          await publishToQueue({
            email: subscriber.email,
            subject,
            templatePath,
            templateData: { frontendUrl: FRONTEND_URL },
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
