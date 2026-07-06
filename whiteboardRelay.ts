import type { Server as HttpServer } from "node:http";
import type { Plugin } from "vite";
import { WebSocketServer, WebSocket, type RawData } from "ws";

/**
 * Dumb in-memory whiteboard relay, attached to the Vite dev server's own
 * HTTP(S) server on /whiteboard-ws — same port and TLS cert as the app, so
 * phones on the LAN connect with zero extra setup.
 *
 * Rooms are keyed by the Whereby room name. The relay stores the latest
 * version of each Excalidraw element (higher version wins, lower versionNonce
 * breaks ties — same rule the clients use) so late joiners get a snapshot,
 * and broadcasts everything else verbatim.
 *
 * Contents are session-scoped: once the last client disconnects, the room is
 * wiped after a grace period. The grace matters because clients connect only
 * while their board panel is open — briefly closing it mid-call shouldn't
 * destroy the drawing, but ending the meeting should.
 */

const ROOM_CLEAR_GRACE_MS = 60_000;

interface StoredElement {
  id: string;
  version: number;
  versionNonce: number;
  [key: string]: unknown;
}

interface RelayRoom {
  elements: Map<string, StoredElement>;
  clients: Set<WebSocket>;
  clearTimer?: NodeJS.Timeout;
}

function isNewer(a: StoredElement, b: StoredElement): boolean {
  return (
    a.version > b.version ||
    (a.version === b.version && a.versionNonce < b.versionNonce)
  );
}

/** Attach the relay to any HTTP(S) server — used by the Vite dev plugin below
 * and by relay-server.ts for standalone production deployment. */
export function attachWhiteboardRelay(httpServer: HttpServer): void {
  const rooms = new Map<string, RelayRoom>();
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/whiteboard-ws",
  });

  wss.on("connection", (socket, request) => {
    const url = new URL(request.url ?? "/", "ws://relay");
    const roomName = url.searchParams.get("room") || "default";

    let room = rooms.get(roomName);
    if (!room) {
      room = { elements: new Map(), clients: new Set() };
      rooms.set(roomName, room);
    }
    clearTimeout(room.clearTimer);
    room.clearTimer = undefined;
    room.clients.add(socket);
    let userId: string | undefined;

    socket.send(
      JSON.stringify({
        type: "snapshot",
        elements: [...room.elements.values()],
      }),
    );

    const broadcast = (payload: string) => {
      for (const client of room.clients) {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      }
    };

    socket.on("message", (data: RawData) => {
      let message: {
        type?: string;
        userId?: string;
        elements?: StoredElement[];
      };
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }
      if (typeof message.userId === "string") userId = message.userId;

      if (message.type === "elements" && Array.isArray(message.elements)) {
        for (const element of message.elements) {
          if (typeof element?.id !== "string") continue;
          const existing = room.elements.get(element.id);
          if (!existing || isNewer(element, existing)) {
            room.elements.set(element.id, element);
          }
        }
        broadcast(JSON.stringify(message));
      } else if (message.type === "pointer" || message.type === "leave") {
        broadcast(JSON.stringify(message));
      }
    });

    socket.on("close", () => {
      room.clients.delete(socket);
      if (userId) {
        broadcast(JSON.stringify({ type: "leave", userId }));
      }
      if (room.clients.size === 0) {
        clearTimeout(room.clearTimer);
        room.clearTimer = setTimeout(() => {
          if (room.clients.size === 0) rooms.delete(roomName);
        }, ROOM_CLEAR_GRACE_MS);
      }
    });
  });
}

/** Vite dev-server integration: same port and TLS cert as the app. */
export function whiteboardRelay(): Plugin {
  return {
    name: "whiteboard-relay",
    configureServer(server) {
      if (!server.httpServer) return;
      // basic-ssl serves HTTP/1.1 over TLS; the Http2SecureServer union member
      // in Vite's type never occurs here
      attachWhiteboardRelay(server.httpServer as HttpServer);
    },
  };
}
