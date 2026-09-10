import crypto from "crypto";

export type Shard = 0 | 1;

export function getShard(workspaceId: string): Shard {
  const hash = crypto
    .createHash("sha256")
    .update(workspaceId)
    .digest();

  const number = hash.readUInt32BE(0);

  return (number % 2) as Shard;
}