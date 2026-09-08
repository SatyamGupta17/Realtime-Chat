import { Pool } from "pg";

export const shard1 = new Pool({
  host: "localhost",
  port: 5433,
  user: "chat",
  password: "chat",
  database: "chat_shard_1",
});

export const shard2 = new Pool({
  host: "localhost",
  port: 5434,
  user: "chat",
  password: "chat",
  database: "chat_shard_2",
});

export function getDatabase(shard: 0 | 1): Pool {
  return shard === 0 ? shard1 : shard2;
}