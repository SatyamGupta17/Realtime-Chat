import { Kafka } from "kafkajs";
import crypto from "crypto";

const kafka = new Kafka({
  clientId: "test-producer",
  brokers: ["localhost:9092"],
});

const producer = kafka.producer();

async function main() {
  await producer.connect();

  const workspaceId =
    "22dc0877-627c-416a-a3df-c627127b561c";

  const event = {
    messageId: crypto.randomUUID(),
    workspaceId,
    channelId:
      "20bba97e-18dd-4cea-af0e-cda90912b228",
    userId:
      "22222222-2222-2222-2222-222222222222",
    message: "Hello from Kafka",
    timestamp: new Date().toISOString(),
  };

  await producer.send({
    topic: "chat.messages",
    messages: [
      {
        key: workspaceId,
        value: JSON.stringify(event),
      },
    ],
  });

  console.log("Kafka test message sent");

  await producer.disconnect();
}

main().catch(console.error);