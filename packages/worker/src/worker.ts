import { Kafka } from "kafkajs";
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

function isValidUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

async function main() {
  await consumer.connect();

  await consumer.subscribe({
    topic: "chat.messages",
    fromBeginning: false,
  });

  console.log("Persistence worker started");

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }

      let event: any;

      try {
        event = JSON.parse(message.value.toString());
      } catch (error) {
        console.error("Invalid Kafka JSON message:", error);
        return;
      }

      /*
       * Validate every UUID BEFORE:
       * - getShard()
       * - any PostgreSQL query
       */
      if (!isValidUUID(event.workspaceId)) {
        console.error(
          `Invalid workspaceId: ${event.workspaceId}`
        );
        return;
      }

      if (!isValidUUID(event.channelId)) {
        console.error(
          `Invalid channelId: ${event.channelId}`
        );
        return;
      }

      if (!isValidUUID(event.messageId)) {
        console.error(
          `Invalid messageId: ${event.messageId}`
        );
        return;
      }

      if (!isValidUUID(event.userId)) {
        console.error(
          `Invalid userId: ${event.userId}`
        );
        return;
      }

      /*
       * Only calculate the shard after workspaceId
       * has passed validation.
       */
      const shard = getShard(event.workspaceId);
      const db = getDatabase(shard);

      /*
       * Make sure the channel actually belongs
       * to the supplied workspace.
       */
      const channelResult = await db.query(
        `
        SELECT
          w.id AS workspace_id,
          c.id AS channel_id
        FROM workspace w
        INNER JOIN channel c
          ON c.workspace_id = w.id
        WHERE w.id = $1
          AND c.id = $2
        `,
        [
          event.workspaceId,
          event.channelId,
        ]
      );

      if (channelResult.rowCount === 0) {
        console.error(
          `Invalid workspace/channel: ` +
            `workspace=${event.workspaceId}, ` +
            `channel=${event.channelId}`
        );

        return;
      }

      console.log(
        `Persisting message ${event.messageId} → shard ${shard}`
      );

      /*
       * userName is intentionally NOT stored here.
       *
       * messages stores user_id.
       * The API history query joins users to get the name.
       */
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

main().catch((error) => {
  console.error(
    "Persistence worker failed:",
    error
  );
  process.exit(1);
});