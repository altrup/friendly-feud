// Client-side Socket.io singleton.
// The socket instance is created once at module level and reused across all components.
// autoConnect: false — the socket connects only when the player joins or creates a lobby.

import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../server/types.js";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socketInstance: GameSocket | null = null;

function getSocket(): GameSocket {
  if (!socketInstance) {
    socketInstance = io({
      autoConnect: false,
      // Connects to the same origin that served the page
    });
  }
  return socketInstance;
}

export function useSocket(): GameSocket {
  return getSocket();
}
