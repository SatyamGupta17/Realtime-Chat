import http from "http";
import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";
import { addConnection, removeConnection, broadcast } from "./connections";
import { redisPublisher, redisSubscriber, connectRedis } from "./redis";
import {connectKafka, publishMessage} from "./kafka";

const EDGE_ID = process.env.EDGE_ID ?? `edge-${randomUUID()}`;

const PORT = Number(process.env.PORT) || 4001;

const server = http.createServer();

const wss = new WebSocketServer({server,});

async function main() {

  await connectRedis();
  await connectKafka();
  await redisSubscriber.subscribe(
    "chat:messages.realtime",
    (rawMessage) => {
      const event = JSON.parse(rawMessage);
      broadcast(
        event.channelId,
        event
      );
    }
  );

  wss.on("connection", (socket, request) => {

    const url = new URL(
      request.url ?? "",
      `http://${request.headers.host}`
    );

    const workspaceId = url.searchParams.get("workspaceId");
    const channelId = url.searchParams.get("channelId");
    const userId = url.searchParams.get("userId");

    if (!workspaceId || !channelId || !userId) {
      socket.close();
      return;
    }

    addConnection(channelId, socket);

    console.log(`${userId} connected to ${channelId} on ${EDGE_ID}`);

    socket.on("message", async (raw) => {
      try {
        const input = JSON.parse(raw.toString());

        if (input.type !== "message.send") {return;}

        const event = {
          eventId: randomUUID(),
          type: "message.created",
          workspaceId,
          channelId,
          messageId: randomUUID(),
          userId,
          message: input.message,
          timestamp:
            new Date().toISOString(),
          edgeId: EDGE_ID,
        };

        // Realtime delivery
        await redisPublisher.publish(
          "chat:messages.realtime",
          JSON.stringify(event)
        );
        await publishMessage(event);
      } catch (error) {
        console.error(
          "Failed to process WebSocket message:",
          error
        );
      }
    });

    socket.on("close", () => {
      removeConnection(
        channelId,
        socket
      );
    });
  });

  server.listen(PORT, () => {
    console.log(`${EDGE_ID} listening on :${PORT}`);
  });
}

main().catch(console.error);