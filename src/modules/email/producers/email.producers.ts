import { connectRabbitMQ } from "../../../providers/rabbitmq.provider.js";

const QUEUE_NAME = "email_queue";

export async function publishToQueue(message: object) {
  const channel = await connectRabbitMQ();
  channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
}
