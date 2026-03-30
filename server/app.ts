import "react-router";
import { createRequestHandler } from "@react-router/express";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { gameManager } from "./GameManager.js";
import { registerSocketHandlers } from "./socket.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./types.js";

declare module "react-router" {
  interface AppLoadContext {
    VALUE_FROM_EXPRESS: string;
  }
}

export const app = express();

app.use(
  createRequestHandler({
    build: () => import("virtual:react-router/server-build"),
    getLoadContext() {
      return {
        VALUE_FROM_EXPRESS: "Hello from Express",
      };
    },
  }),
);

/**
 * Attach Socket.io to the existing HTTP server.
 * Called from server.js after the HTTP server is created.
 * Uses a globalThis flag so it is only initialized once — safe across Vite HMR reloads.
 */
export function attachSocketIO(httpServer: HttpServer): void {
  if ((globalThis as Record<string, unknown>).__socketAttached) return;
  (globalThis as Record<string, unknown>).__socketAttached = true;

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      cors: {
        // In production, tighten this to your actual domain
        origin: "*",
      },
    }
  );

  registerSocketHandlers(io, gameManager);
}
