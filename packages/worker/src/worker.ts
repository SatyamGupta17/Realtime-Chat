import { Kafka } from "kafkajs";
import { Pool } from "pg";

const kafka = new Kafka({
  clientId: "chat-persistence-worker",
  brokers: [
    process.env.KAFKA_BROKER ??
      "localhost:9092",
  ],
});

const consumer =
  kafka.consumer({
    groupId: "message-persistence",
  });

const db = new Pool({
  host: "localhost",
  port: 5432,
  user: "chat",
  password: "chat",
  database: "chat",
});

async function main() {

  await consumer.connect();

  await consumer.subscribe({
    topic: "chat.messages",
    fromBeginning: false,
  });

  console.log(
    "Persistence worker started"
  );

  await consumer.run({

    eachMessage: async ({
      message,
    }) => {

      if (!message.value) {
        return;
      }

      const event =
        JSON.parse(
          message.value.toString()
        );

      await db.query(
        `
        INSERT INTO messages(
          id,
          channel_id,
          message,
          user_id,
          ts
        )
        VALUES($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
        `,
        [
          event.messageId,
          event.channelId,
          event.message,
          event.userId,
          event.timestamp,
        ]
      );

      console.log(
        `Persisted ${event.messageId}`
      );
    },
  });
}

main().catch(console.error);