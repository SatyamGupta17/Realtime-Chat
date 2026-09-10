import { Pool } from "pg";
import "dotenv/config";

export const db = new Pool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT) ?? 5432,
  user: process.env.DB_USER ?? "chat",
  password: process.env.DB_PASSWORD ?? "chat",
  database: process.env.DB_NAME ?? "chat",
});