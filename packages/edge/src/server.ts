import http from "http";
import {
  WebSocketServer,
} from "ws";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";

import {
  addConnection,
  removeConnection,
  broadcast,
} from "./connections";

import {
  redisPublisher,
  redisSubscriber,
  connectRedis,
} from "./redis";

import {
  connectKafka,
  publishMessage,
} from "./kafka";

import "dotenv/config";

/* =====================================================
   CONFIG
   ===================================================== */

const EDGE_ID = process.env.EDGE_ID ?? `edge-${randomUUID()}`;

const PORT = Number(process.env.PORT) || 4001;

const JWT_SECRET = process.env.JWT_SECRET ??  "dev-secret-change-me";

/* =====================================================
   HTTP / WEBSOCKET SERVER
   ===================================================== */

const server =
  http.createServer();

const wss =
  new WebSocketServer({
    server,
  });

/* =====================================================
   TYPES
   ===================================================== */

type AuthUser = {
  id: string;
  name: string;
  email: string;
};

/* =====================================================
   JWT
   ===================================================== */

function authenticateToken(
  token: string
): AuthUser | null {
  try {
    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      ) as{ 
      user? :{
        id: string;
        name: string;
        email: string;
      }
    };  
    if ( 
      !decoded.user ||
      !decoded.user?.id ||
      !decoded.user?.name ||
      !decoded.user?.email
    ) {
      return null;
    } 
    return {
      
      id: decoded.user?.id,
      name: decoded.user?.name,
      email: decoded.user?.email,
    };
  } catch (error) {
    console.error(
      "JWT verification failed:",
      error
    );

    return null;
  }
}

/* =====================================================
   MAIN
   ===================================================== */

async function main() {
  /*
   * Redis
   */

  await connectRedis();

  /*
   * Kafka
   */

  await connectKafka();

  /*
   * Redis realtime subscription.
   *
   * Every Edge receives realtime events
   * and broadcasts them to local sockets.
   */

  await redisSubscriber.subscribe(
    "chat:messages.realtime",
    (rawMessage) => {
      try {
        const event =
          JSON.parse(
            rawMessage
          );

        if (
          event.type !==
          "message.created"
        ) {
          return;
        }

        broadcast(
          event.channelId,
          event
        );
      } catch (error) {
        console.error(
          "Invalid Redis event:",
          error
        );
      }
    }
  );

  /* ===================================================
     WEBSOCKET CONNECTION
     =================================================== */

  wss.on(
    "connection",
    (
      socket,
      request
    ) => {
      try {
        const url =
          new URL(
            request.url ?? "",
            `http://${request.headers.host}`
          );

        const workspaceId =
          url.searchParams.get(
            "workspaceId"
          );

        const channelId =
          url.searchParams.get(
            "channelId"
          );

        /*
         * JWT is supplied by React.
         */

        const token =
          url.searchParams.get(
            "token"
          );

        if (
          !workspaceId ||
          !channelId ||
          !token
        ) {
          console.log(
            "Rejected WebSocket connection: missing parameters"
          );

          socket.close(
            1008,
            "Missing authentication or channel information"
          );

          return;
        }

        /*
         * Verify JWT.
         */

        const user =
          authenticateToken(
            token
          );

        if (!user) {
          console.log(
            "Rejected WebSocket connection: invalid token"
          );

          socket.close(
            1008,
            "Invalid authentication"
          );

          return;
        }

        /*
         * Register socket.
         */

        addConnection(
          channelId,
          socket
        );

        console.log(
          `${user.name} (${user.id}) connected to ${channelId} on ${EDGE_ID}`
        );

        /* ===============================================
           RECEIVE MESSAGE
           =============================================== */

        socket.on(
          "message",
          async (raw) => {
            try {
              const input =
                JSON.parse(
                  raw.toString()
                );

              if (
                input.type !==
                "message.send"
              ) {
                return;
              }

              if (
                typeof input.message !==
                  "string"
              ) {
                return;
              }

              const message =
                input.message.trim();

              if (!message) {
                return;
              }

              /*
               * IMPORTANT:
               *
               * user.id and user.name
               * come from the verified JWT.
               *
               * We do NOT take them
               * from the message payload.
               */

              const event = {
                eventId:
                  randomUUID(),

                type:
                  "message.created",

                workspaceId,

                channelId,

                messageId:
                  randomUUID(),

                userId:
                  user.id,

                userName:
                  user.name,

                message,

                timestamp:
                  new Date().toISOString(),

                edgeId:
                  EDGE_ID,
              };

              /*
               * Realtime fanout.
               */

              await redisPublisher.publish(
                "chat:messages.realtime",
                JSON.stringify(event)
              );

              /*
               * Durable persistence.
               */

              await publishMessage(
                event
              );
            } catch (error) {
              console.error(
                "Failed to process WebSocket message:",
                error
              );
            }
          }
        );

        /* ===============================================
           CLOSE
           =============================================== */

        socket.on(
          "close",
          () => {
            removeConnection(
              channelId,
              socket
            );

            console.log(
              `${user.name} disconnected from ${channelId} on ${EDGE_ID}`
            );
          }
        );

        socket.on(
          "error",
          (error) => {
            console.error(
              `WebSocket error for ${user.name}:`,
              error
            );
          }
        );
      } catch (error) {
        console.error(
          "WebSocket connection error:",
          error
        );

        socket.close(
          1011,
          "Internal server error"
        );
      }
    }
  );

  /* ===================================================
     START SERVER
     =================================================== */

  server.listen(
    PORT,
    () => {
      console.log(
        `${EDGE_ID} listening on :${PORT}`
      );
    }
  );
}

/* =====================================================
   START
   ===================================================== */

main().catch(
  (error) => {
    console.error(
      "Edge startup failed:",
      error
    );

    process.exit(1);
  }
);