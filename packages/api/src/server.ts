import express, {
  Request,
  Response,
  NextFunction,
} from "express";

import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

import { db } from "./db";
import { getShard } from "./sharding";
import { getDatabase } from "./shard-db";
import "dotenv/config";

const app = express();
const PORT = Number(process.env.API_PORT ?? 3000);

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

const FRONTEND_URL =
  process.env.FRONTEND_URL ?? "http://localhost:5173";
// Types
type AuthUser = {
  id: string;
  name: string;
  email: string;
};

type AuthRequest = Request & {
  user?: AuthUser;
};
 
app.use(cors({origin: FRONTEND_URL,}));

app.use(express.json());

function createToken(user: AuthUser): string {
  return jwt.sign(
    {
      user,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

function getBearerToken(req: Request): string | null {
  const header =
    req.headers.authorization;

  if (!header) {
    return null;
  }
  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7);
}

function auth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    ) as {
      user?: AuthUser;
    };

    if (
      !decoded.user ||
      !decoded.user.id ||
      !decoded.user.name ||
      !decoded.user.email
    ) {
      return res.status(401).json({
        error: "Invalid authentication token",
      });
    }

    req.user = decoded.user; 
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

/* =========================================================
   HEALTH
   ========================================================= */

app.get(
  "/health",
  async (_req, res) => {
    try {
      await db.query("SELECT 1");

      res.json({
        status: "ok",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        status: "error",
      });
    }
  }
);

/* =========================================================
   AUTH - REGISTER
   ========================================================= */

app.post(
  "/auth/register",
  async (req, res) => {
    try {
      const name =
        typeof req.body.name === "string"
          ? req.body.name.trim()
          : "";

      const email =
        typeof req.body.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "";

      const password =
        typeof req.body.password === "string"
          ? req.body.password
          : "";

      if (!name) {
        return res.status(400).json({
          error: "Name is required",
        });
      }

      if (!email) {
        return res.status(400).json({
          error: "Email is required",
        });
      }

      if (!password) {
        return res.status(400).json({
          error: "Password is required",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          error:
            "Password must be at least 6 characters",
        });
      }

      /*
       * Users live in the global DB.
       * Therefore one query is enough to guarantee
       * global email uniqueness.
       */
      const existing =
        await db.query(
          `
          SELECT id
          FROM users
          WHERE lower(email) = lower($1)
          LIMIT 1
          `,
          [email]
        );

      if (existing.rowCount !== 0) {
        return res.status(409).json({
          error:
            "An account with this email already exists",
        });
      }

      const userId = randomUUID();

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const result =
        await db.query(
          `
          INSERT INTO users(
            id,
            name,
            email,
            password_hash
          )
          VALUES($1, $2, $3, $4)
          RETURNING
            id,
            name,
            email
          `,
          [
            userId,
            name,
            email,
            passwordHash,
          ]
        );

      const user: AuthUser =
        result.rows[0];

      const token =
        createToken(user);

      return res.status(201).json({
        token,
        user,
      });
    } catch (error) {
      console.error(
        "Registration failed:",
        error
      );

      return res.status(500).json({
        error: "Registration failed",
      });
    }
  }
);

/* =========================================================
   AUTH - LOGIN
   ========================================================= */

app.post(
  "/auth/login",
  async (req, res) => {
    try {
      const email =
        typeof req.body.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "";

      const password =
        typeof req.body.password === "string"
          ? req.body.password
          : "";

      if (!email || !password) {
        return res.status(400).json({
          error:
            "Email and password are required",
        });
      }

      const result =
        await db.query(
          `
          SELECT
            id,
            name,
            email,
            password_hash
          FROM users
          WHERE lower(email) = lower($1)
          LIMIT 1
          `,
          [email]
        );

      if (result.rowCount === 0) {
        return res.status(401).json({
          error:
            "Invalid email or password",
        });
      }

      const row = result.rows[0];

      const valid =
        await bcrypt.compare(
          password,
          row.password_hash
        );

      if (!valid) {
        return res.status(401).json({
          error:
            "Invalid email or password",
        });
      }

      const user: AuthUser = {
        id: row.id,
        name: row.name,
        email: row.email,
      };

      const token =
        createToken(user);

      return res.json({
        token,
        user,
      });
    } catch (error) {
      console.error(
        "Login failed:",
        error
      );

      return res.status(500).json({
        error: "Login failed",
      });
    }
  }
);

/* =========================================================
   AUTH - ME
   ========================================================= */

app.get(
  "/auth/me",
  auth,
  async (req: AuthRequest, res) => {
    return res.json({
      user: req.user,
    });
  }
);

/* =========================================================
   WORKSPACES - CREATE
   ========================================================= */

app.post(
  "/workspaces",
  auth,
  async (req: AuthRequest, res) => {
    try {
      const name =
        typeof req.body.name === "string"
          ? req.body.name.trim()
          : "";

      if (!name) {
        return res.status(400).json({
          error:
            "Workspace name is required",
        });
      }

      const workspaceId =
        randomUUID();

      const shard =
        getShard(workspaceId);

      const shardDb =
        getDatabase(shard);

      const result =
        await shardDb.query(
          `
          INSERT INTO workspace(
            id,
            name
          )
          VALUES($1, $2)
          RETURNING id, name
          `,
          [
            workspaceId,
            name,
          ]
        );

      return res.status(201).json({
        shard,
        workspace:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "Create workspace failed:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to create workspace",
      });
    }
  }
);

/* =========================================================
   WORKSPACES - LIST
   ========================================================= */

app.get(
  "/workspaces",
  auth,
  async (_req: AuthRequest, res) => {
    try {
      const results =
        await Promise.all([
          getDatabase(0).query(
            `
            SELECT id, name
            FROM workspace
            ORDER BY name ASC
            `
          ),

          getDatabase(1).query(
            `
            SELECT id, name
            FROM workspace
            ORDER BY name ASC
            `
          ),
        ]);

      const workspaces = [
        ...results[0].rows,
        ...results[1].rows,
      ];

      workspaces.sort(
        (a, b) =>
          a.name.localeCompare(
            b.name
          )
      );

      return res.json({
        workspaces,
      });
    } catch (error) {
      console.error(
        "Load workspaces failed:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to load workspaces",
      });
    }
  }
);

/* =========================================================
   CHANNELS - LIST
   ========================================================= */

app.get(
  "/workspaces/:workspaceId/channels",
  auth,
  async (req: Request<{ workspaceId: string }>, res) => {
    try {
      const workspaceId =
        req.params.workspaceId;

      const shard =
        getShard(workspaceId);

      const shardDb =
        getDatabase(shard);

      const result =
        await shardDb.query(
          `
          SELECT
            id,
            workspace_id,
            name,
            type
          FROM channel
          WHERE workspace_id = $1
          ORDER BY name ASC
          `,
          [workspaceId]
        );

      return res.json({
        shard,
        channels:
          result.rows,
      });
    } catch (error) {
      console.error(
        "Load channels failed:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to load channels",
      });
    }
  }
);

/* =========================================================
   CHANNELS - CREATE
   ========================================================= */

app.post(
  "/channels",
  auth,
  async (req, res) => {
    try {
      const workspaceId =
        typeof req.body.workspace_id ===
        "string"
          ? req.body.workspace_id
          : "";

      const name =
        typeof req.body.name === "string"
          ? req.body.name.trim()
          : "";

      const type =
        typeof req.body.type === "string"
          ? req.body.type
          : "public";

      if (!workspaceId) {
        return res.status(400).json({
          error:
            "workspace_id is required",
        });
      }

      if (!name) {
        return res.status(400).json({
          error:
            "Channel name is required",
        });
      }

      const shard =
        getShard(workspaceId);

      const shardDb =
        getDatabase(shard);

      /*
       * Make sure the workspace exists
       * on the expected shard.
       */
      const workspace =
        await shardDb.query(
          `
          SELECT id
          FROM workspace
          WHERE id = $1
          `,
          [workspaceId]
        );

      if (workspace.rowCount === 0) {
        return res.status(404).json({
          error:
            "Workspace not found",
        });
      }

      const channelId =
        randomUUID();

      const result =
        await shardDb.query(
          `
          INSERT INTO channel(
            id,
            workspace_id,
            name,
            type
          )
          VALUES($1, $2, $3, $4)
          RETURNING
            id,
            workspace_id,
            name,
            type
          `,
          [
            channelId,
            workspaceId,
            name,
            type,
          ]
        );

      return res.status(201).json({
        shard,
        channel:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "Create channel failed:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to create channel",
      });
    }
  }
);

/* =========================================================
   MESSAGE - CREATE
   ========================================================= */

app.post(
  "/messages",
  auth,
  async (
    req: AuthRequest,
    res
  ) => {
    try {
      const workspaceId =
        typeof req.body.workspace_id ===
        "string"
          ? req.body.workspace_id
          : "";

      const channelId =
        typeof req.body.channel_id ===
        "string"
          ? req.body.channel_id
          : "";

      const message =
        typeof req.body.message ===
        "string"
          ? req.body.message.trim()
          : "";

      if (
        !workspaceId ||
        !channelId ||
        !message
      ) {
        return res.status(400).json({
          error:
            "workspace_id, channel_id and message are required",
        });
      }

      const shard =
        getShard(workspaceId);

      const shardDb =
        getDatabase(shard);

      /*
       * Verify channel belongs to
       * workspace.
       */
      const channel =
        await shardDb.query(
          `
          SELECT id
          FROM channel
          WHERE id = $1
            AND workspace_id = $2
          `,
          [
            channelId,
            workspaceId,
          ]
        );

      if (channel.rowCount === 0) {
        return res.status(404).json({
          error:
            "Channel not found in workspace",
        });
      }

      const messageId =
        randomUUID();

      const result =
        await shardDb.query(
          `
          INSERT INTO messages(
            id,
            workspace_id,
            channel_id,
            message,
            user_id
          )
          VALUES($1, $2, $3, $4, $5)
          RETURNING
            id,
            workspace_id,
            channel_id,
            message,
            user_id,
            ts
          `,
          [
            messageId,
            workspaceId,
            channelId,
            message,
            req.user!.id,
          ]
        );

      return res.status(201).json({
        shard,
        message:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "Create message failed:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to create message",
      });
    }
  }
);

/* =========================================================
   MESSAGE HISTORY
   ========================================================= */

app.get(
  "/channels/:channelId/messages",
  auth,
  async (req, res) => {
    try {
      const channelId =
        req.params.channelId;

      const workspaceId =
        typeof req.query.workspace_id ===
        "string"
          ? req.query.workspace_id
          : "";

      if (!workspaceId) {
        return res.status(400).json({
          error:
            "workspace_id is required",
        });
      }

      const shard =
        getShard(workspaceId);

      const shardDb =
        getDatabase(shard);

      /*
       * First get messages from the
       * workspace shard.
       *
       * There is intentionally NO
       * users JOIN here because users
       * live in another database.
       */
      const messageResult =
        await shardDb.query(
          `
          SELECT
            m.id,
            m.workspace_id,
            m.channel_id,
            m.message,
            m.user_id,
            m.ts
          FROM messages m
          WHERE m.channel_id = $1
            AND m.workspace_id = $2
          ORDER BY m.ts ASC
          LIMIT 100
          `,
          [
            channelId,
            workspaceId,
          ]
        );

      const messages =
        messageResult.rows;

      /*
       * Collect unique user IDs.
       */
      const userIds = [
        ...new Set(
          messages.map(
            (message) =>
              message.user_id
          )
        ),
      ];

      /*
       * Get all users in ONE global
       * database query.
       */
      let users: any[] = [];

      if (userIds.length > 0) {
        const userResult =
          await db.query(
            `
            SELECT
              id,
              name,
              email
            FROM users
            WHERE id = ANY($1::uuid[])
            `,
            [userIds]
          );

        users =
          userResult.rows;
      }

      /*
       * Convert users into a lookup map.
       */
      const userMap =
        new Map<
          string,
          {
            id: string;
            name: string;
            email: string;
          }
        >();

      for (const user of users) {
        userMap.set(
          user.id,
          user
        );
      }

      /*
       * Merge the global user data
       * into the messages.
       */
      const enrichedMessages =
        messages.map(
          (message) => {
            const user =
              userMap.get(
                message.user_id
              );

            return {
              ...message,

              userName:
                user?.name ??
                "Unknown user",

              userEmail:
                user?.email ??
                null,
            };
          }
        );

      return res.json({
        shard,
        messages:
          enrichedMessages,
      });
    } catch (error) {
      console.error(
        "Load message history failed:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to load message history",
      });
    }
  }
);

/* =========================================================
   SERVER
   ========================================================= */

app.listen(
  PORT,
  () => {
    console.log(
      `API listening on :${PORT}`
    );
  }
);