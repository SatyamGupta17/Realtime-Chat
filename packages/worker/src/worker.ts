import { Kafka } from "kafkajs";
import { Pool } from "pg";
import { getShard} from '../../api/src/sharding';
import { getDatabase} from '../../api/src/shard-db';

const kafka = new Kafka({
  clientId: "chat-persistence-worker",
  brokers: [
    process.env.KAFKA_BROKER ??
      "localhost:9092",
  ],
});

const consumer = kafka.consumer({
    groupId: "message-persistence",
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

      if (!message.value) { return; } 
      const event = JSON.parse(message.value.toString());

      if (!event.workspaceId) {
        console.error(
          "Message is missing workspaceId"
        );
        return;
      }
        
      const shard = getShard(event.workspaceId);
      const db = getDatabase(shard);

      const channelResult = await db.query(
        `
        SELECT w.id AS workspace_id, c.id AS channel_id
        FROM workspace w
        INNER JOIN channel c ON c.workspace_id = w.id
        WHERE w.id = $1 AND c.id = $2
        `,
        [event.workspaceId, event.channelId]
      );

      if (channelResult.rowCount === 0) {
        console.error(
          `Invalid workspace/channel: workspace=${event.workspaceId}, channel=${event.channelId}`
        );
        return;
      }
      console.log( `Persisting message ${event.messageId} → shard ${shard}`);
      await db.query(
        `
        INSERT INTO messages(
          id,
          workspace_id,
          channel_id,
          message,
          user_id,
          ts
        )
        VALUES($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING
        `,
        [
          event.messageId,
          event.workspaceId,
          event.channelId,
          event.message,
          event.userId,
          event.timestamp,
        ]
      );
    },
  });
}

main().catch(console.error);