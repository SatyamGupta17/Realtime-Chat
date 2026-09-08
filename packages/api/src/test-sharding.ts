import { getShard } from "./sharding";

const workspaces = [
  "11111111-1111-1111-1111-111111111111",
  "22222222-2222-2222-2222-222222222222",
  "33333333-3333-3333-3333-333333333333",
  "44444444-4444-4444-4444-444444444444",
];

for (const workspaceId of workspaces) {
  console.log(
    workspaceId,
    "-> Shard",
    getShard(workspaceId)
  );
}