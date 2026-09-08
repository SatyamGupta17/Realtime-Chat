import { Kafka } from "kafkajs";

export const kafka = new Kafka({
  clientId: "chat-edge",
  brokers: [
    process.env.KAFKA_BROKER ??
      "localhost:9092",
  ],
});

export const producer = kafka.producer();

export async function connectKafka() {
  await producer.connect();
  console.log("Kafka producer connected");
}

export async function publishMessage(
  event: unknown
) {
  await producer.send({
    topic: "chat.messages",
    messages: [
      {
        key : (event as { workspaceId: string }).workspaceId,
        value: JSON.stringify(event)
      },
    ],
  });
}