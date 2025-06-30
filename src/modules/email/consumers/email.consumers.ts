import ejs from "ejs";
import amqp from "amqplib";
import { sendEmail } from "../../../providers/email.provider.js";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory path (ES Modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to template
const templates = path.join(__dirname, "../../../templates/");

const RABBITMQ_URL =
  process.env.MESSAGE_BROKER_URL || "amqp://guest:guest@localhost:5672";
const QUEUE_NAME = "email_queue";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
interface EmailTemplateData {
  subject: string;
  frontendUrl: string;
}

export async function consumeEmails() {
  let connected = false;
  while (!connected) {
    try {
      const connection = await amqp.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();
      await channel.assertQueue(QUEUE_NAME, { durable: true });

      console.log("Waiting for messages in", QUEUE_NAME);

      channel.consume(
        QUEUE_NAME,
        async (msg) => {
          if (msg) {
            const emailData = JSON.parse(msg.content.toString());
            const { email, subject, templatePath, templateData } = emailData;

            console.log("Received message:", emailData);

            try {
              let template;

              template = await ejs.renderFile(templates + templatePath, {
                frontendUrl: FRONTEND_URL,
                ...templateData,
              });

              await sendEmail(email, subject, template);
              console.log("Email sent successfully to:", email);
              channel.ack(msg);
            } catch (error) {
              console.error("Email sending failed:", error);
              // Retry logic could be added here
              channel.nack(msg);
            }
          }
        },
        { noAck: false }
      );

      connected = true;
    } catch (error) {
      console.error("RabbitMQ consumer error:", error);
      console.log("Retrying connection in 5 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
