CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE workspace (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL
);

CREATE TABLE channel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'public'
);

CREATE TABLE messages (
    id UUID PRIMARY KEY,
    channel_id UUID NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    user_id UUID NOT NULL,
    -- workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE membership (
    channel_id UUID NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    checkpoint BIGINT NOT NULL DEFAULT 0,
    
    PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX idx_messages_channel_ts
ON messages(channel_id, ts);

CREATE INDEX idx_channel_workspace
ON channel(workspace_id);