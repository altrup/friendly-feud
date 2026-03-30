// GameManager is a singleton that manages all active game rooms.
// It is instantiated once and persisted via globalThis to survive Vite HMR reloads.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import { GameRoom } from "./GameRoom.js";
import type { Question } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class GameManager {
  private rooms: Map<string, GameRoom> = new Map();
  private questions: Question[];

  constructor() {
    // Load questions once at startup
    const questionsPath = join(__dirname, "data", "questions.json");
    this.questions = JSON.parse(readFileSync(questionsPath, "utf-8")) as Question[];
  }

  // ─── Room management ────────────────────────────────────────────────────────

  createRoom(hostSocketId: string, hostName: string): GameRoom {
    const code = this.generateCode();
    const room = new GameRoom(code, hostSocketId, hostName);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  /** Find the room a socket belongs to (for disconnect handling). */
  getRoomBySocketId(socketId: string): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.has(socketId)) return room;
    }
    return undefined;
  }

  deleteRoom(code: string): void {
    const room = this.rooms.get(code);
    if (room) {
      room.clearAnswerTimer();
      this.rooms.delete(code);
    }
  }

  // ─── Question selection ──────────────────────────────────────────────────────

  /** Pick a random question that hasn't been used yet in this room's session. */
  getRandomQuestion(usedIds: Set<string>): Question {
    const available = this.questions.filter((q) => !usedIds.has(q.id));
    if (available.length === 0) {
      // If all questions are exhausted, reset and reuse (unlikely with 20 questions / 3 rounds)
      return this.questions[Math.floor(Math.random() * this.questions.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Generate a unique 4-letter uppercase room code. */
  private generateCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // omit I and O to avoid confusion
    let code: string;
    do {
      code = Array.from(
        { length: 4 },
        () => chars[Math.floor(Math.random() * chars.length)]
      ).join("");
    } while (this.rooms.has(code));
    return code;
  }
}

// ─── HMR-safe singleton ──────────────────────────────────────────────────────
// Using globalThis ensures the same GameManager instance persists across
// Vite hot-module reloads in development.
declare global {
  // eslint-disable-next-line no-var
  var __gameManager: GameManager | undefined;
}

export const gameManager: GameManager =
  globalThis.__gameManager ?? (globalThis.__gameManager = new GameManager());
