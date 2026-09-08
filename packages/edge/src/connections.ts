import WebSocket from "ws";

const channelConnections =
  new Map<string, Set<WebSocket>>();

export function addConnection(
  channelId: string,
  socket: WebSocket
) {
  let connections = channelConnections.get(channelId);

  if (!connections) {
    connections = new Set();
    channelConnections.set(channelId, connections);
  }

  connections.add(socket);
}

export function removeConnection(
  channelId: string,
  socket: WebSocket
) {
  const connections = channelConnections.get(channelId);

  if (!connections) {
    return;
  }

  connections.delete(socket);

  if (connections.size === 0) {
    channelConnections.delete(channelId);
  }
}

export function broadcast(
  channelId: string,
  message: unknown
) {
  const connections = channelConnections.get(channelId);

  if (!connections) {
    return;
  }

  const payload = JSON.stringify(message);

  for (const socket of connections) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}