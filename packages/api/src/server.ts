import express from "express";
import { db } from "./db";

const app = express();

app.use(express.json());

app.get("/health", async (_req, res) => {
  const result = await db.query(`
     SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'workspace'
  `);
  res.json({
    status: "ok",
    workspace: result.rows,
  });
});

app.post("/workspaces", async (req, res) => {
  const { name } = req.body;

  const result = await db.query(
    `
    INSERT INTO workspace(name)
    VALUES($1)
    RETURNING *
    `,
    [name]
  );

  res.json(result.rows[0]);
});

app.get("/workspaces", async (req, res) => {
  const result = await db.query(
    `SELECT * FROM workspace`
  );

  res.json(result.rows);
});

app.get("/workspaces/:workspaceId/channels", async (req, res) => {
  const { workspaceId } = req.params;

  const result = await db.query(
    `
    SELECT *
    FROM channel
    WHERE workspace_id = $1
    `,
    [workspaceId]
  );
  res.json(result.rows);
});


app.post("/channels", async (req, res) => {
  const { workspace_id, name, type } = req.body;

  const result = await db.query(
    `
    INSERT INTO channel(workspace_id, name, type)
    VALUES($1, $2, $3)
    RETURNING *
    `,
    [workspace_id, name, type ?? "public"]
  );

  res.json(result.rows[0]);
});

app.get("/channels/:channelId/messages", async (req, res) => {
  const { channelId } = req.params;

  const result = await db.query(
    `
    SELECT *
    FROM messages
    WHERE channel_id = $1
    ORDER BY ts ASC
    LIMIT 100
    `,
    [channelId]
  );

  res.json(result.rows);
});

app.listen(3000, () => {
  console.log("API listening on :3000");
});