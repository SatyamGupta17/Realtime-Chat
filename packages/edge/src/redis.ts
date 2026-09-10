import { createClient } from "redis";
import "dotenv/config";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redisPublisher = createClient({
  url: REDIS_URL,
});


export const redisSubscriber = redisPublisher.duplicate();

export async function connectRedis() {
  await redisPublisher.connect();
  await redisSubscriber.connect();

  console.log("Redis connected");
}