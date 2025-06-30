import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import cors from "cors";
import express from "express";
import launchMailsRouter from "./modules/launch-mails/launch-mails.routes.ts";
import authRouter from "./modules/auth/auth.routes.ts";
import { consumeEmails } from "./modules/email/consumers/email.consumers.js";

async function main() {
  const app = express();
  const port = process.env.PORT || 8000;
  const corsOptions = {
    credentials: true,
    origin: "*",
  };
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors(corsOptions));
  app.use("/api/v1/launch-mails/", launchMailsRouter);
  app.use("/api/v1/auth/", authRouter);
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

main();

consumeEmails();
