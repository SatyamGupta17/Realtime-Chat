import { Pool } from "pg";
import "dotenv/config";

const shard1 = new Pool({
  host: process.env.SHARD1_DB_HOST ?? "localhost",
  port: Number(process.env.SHARD1_DB_PORT ?? 5433),
  user: process.env.DB_USER ?? "chat",
  password: process.env.DB_PASSWORD ?? "chat",
  database: "chat_shard_1",
});

const shard2 = new Pool({
  host: process.env.SHARD2_DB_HOST ?? "localhost",
  port: Number(process.env.SHARD2_DB_PORT ?? 5434),
  user: process.env.DB_USER ?? "chat",
  password: process.env.DB_PASSWORD ?? "chat",
  database: "chat_shard_2",
});


export function getDatabase(shard: 0 | 1): Pool {
  return shard === 0 ? shard1 : shard2;
}