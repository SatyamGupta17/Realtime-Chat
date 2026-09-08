import { createClient } from "redis";

export const redisPublisher = createClient({
  url: "redis://localhost:6379",
});

export const redisSubscriber = redisPublisher.duplicate();

export async function connectRedis() {
  await redisPublisher.connect();
  await redisSubscriber.connect();

  console.log("Redis connected");
}