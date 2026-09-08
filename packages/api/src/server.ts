import express from "express";
// import { db } from "./db";
import { v4 as uuidv4 } from "uuid";
import { getShard } from "./sharding";
import { getDatabase } from "./shard-db";
const app = express();

app.use(express.json());

app.get("/health", async (_req, res) => {
  const result = await getDatabase(0).query(`
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
  try {
    const { name } = req.body;

    if(!name){
      res.status(400).json({ error: "Name is required" });
      return;
    }
    const workspaceId = uuidv4();
    const shard = getShard(workspaceId);
    const db = getDatabase(shard);
    const result = await db.query(
      `
      INSERT INTO workspace(id, name)
      VALUES($1, $2)
      RETURNING *
      `,
      [workspaceId, name]
    );

    res.json({ shard, workspace: result.rows[0] });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "failed to create workspace",
    });
  }
});

app.get("/workspaces", async (req, res) => {
  const shard0Db = getDatabase(0);
  const shard1Db = getDatabase(1);

  const result1 = await shard0Db.query(
    `SELECT * FROM workspace`
  );
  const result2 = await shard1Db.query(
    `SELECT * FROM workspace`
  );

  res.json([...result1.rows, ...result2.rows]);
});

app.get("/workspaces/:workspaceId/channels", async (req, res) => {
  const { workspaceId } = req.params;

  const shard = getShard(workspaceId);
  const db = getDatabase(shard);

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
  try{
    const { workspace_id, name, type } = req.body;
    if (!workspace_id || !name) {
      return res.status(400).json({
        error: "workspace_id and name are required",
      });
    }

    const shard = getShard(workspace_id);
    const db = getDatabase(shard);
    // Make sure the workspace exists on this shard
    const workspaceResult = await db.query(
      `SELECT id FROM workspace WHERE id = $1`,
      [workspace_id]
    );

    if (workspaceResult.rowCount === 0) {
      return res.status(404).json({
        error: "workspace not found",
      });
    }
    const channelId = uuidv4();
    const result = await db.query(
      `
      INSERT INTO channel(id, workspace_id, name, type)
      VALUES($1, $2, $3, $4)
      RETURNING *
      `,
      [channelId, workspace_id, name, type ?? "public"]
    );

    res.json({shard, channel: result.rows[0]});
  }catch (error) {
    console.error(error);

    res.status(500).json({
      error: "failed to create channel",
    });
  }

});

// Update message creation endpoint to insert messages into the correct shard based on workspace_id
app.post("/messages", async (req, res) => {
  try {
    const { workspace_id, channel_id, message, user_id } = req.body;
    if(!workspace_id || !channel_id || !message || !user_id){
      return res.status(400).json({
        error: "workspace_id, channel_id, message and user_id are required",
      });
    }

    const shard = getShard(workspace_id);
    const db = getDatabase(shard);
    // Make sure the channel belongs to this workspace
    const channelResult = await db.query(
      `
      SELECT id
      FROM channel
      WHERE id = $1
        AND workspace_id = $2
      `,
      [channel_id, workspace_id]
    );

    if (channelResult.rowCount === 0) {
      return res.status(404).json({
        error: "channel not found in workspace",
      });
    }


    const messageId = uuidv4();
    const result = await db.query(
      `
      INSERT INTO messages(id, workspace_id, channel_id, message, user_id)
      VALUES($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [messageId, workspace_id, channel_id, message, user_id]
    );

    res.json({shard, message: result.rows[0]});
  
  }catch (error) {
    console.error(error);
    res.status(500).json({
      error: "failed to create message",
    });
  }
});

// Update message history endpoint to fetch messages from the correct shard based on workspace_id
app.get("/channels/:channelId/messages", async (req, res) => {
  try{

    const { channelId } = req.params;
    const { workspace_id } = req.query;
    if(!workspace_id || typeof workspace_id !== "string"){
      return res.status(400).json({
        error: "workspace_id is required and must be a string",
      });
    }
    const shard = getShard(workspace_id);
    const db = getDatabase(shard);

    const result = await db.query(
      `
      SELECT *
      FROM messages
      WHERE workspace_id = $1
        AND
      channel_id = $2
      ORDER BY ts ASC
      LIMIT 100
      `,
      [workspace_id, channelId]
    );
    
    res.json({shard, messages: result.rows});
  } catch(error){
    console.error(error);
    res.status(500).json({
        error: "failed to fetch messages",
      });
  }
});

app.listen(3000, () => {
  console.log("API listening on :3000");
});