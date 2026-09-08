import WebSocket from "ws";

const port = process.argv[2];
const userId = process.argv[3];
const shouldSend = process.argv[4] === "send";

const workspaceId =
  "22dc0877-627c-416a-a3df-c627127b561c";

const channelId =
  "20bba97e-18dd-4cea-af0e-cda90912b228";

const ws = new WebSocket(
  `ws://localhost:${port}` +
  `?workspaceId=${workspaceId}` +
  `&channelId=${channelId}` +
  `&userId=${userId}`
);

ws.on("open", () => {
  console.log(
    `${userId} connected to Edge ${port}`
  );
   if (shouldSend) {
    ws.send(
      JSON.stringify({
        type: "message.send",
        message: "Hello from User A",
      })
    );

    console.log(
      `${userId} sent message`
    );
  }
});

ws.on("message", (data) => {
  console.log(
    `${userId} received:`,
    data.toString()
  );
});

ws.on("close", () => {
  console.log(`${userId} disconnected`);
});

ws.on("error", (error) => {
  console.error(error);
});