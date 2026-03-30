// GameManager is a singleton that manages all active game rooms.
// It is instantiated once and persisted via globalThis to survive Vite HMR reloads.

import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname, basename } from "path";
import { GameRoom } from "./GameRoom.js";
import type { Question } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class GameManager {
  private rooms: Map<string, GameRoom> = new Map();
  private questionsByCategory: Map<string, Question[]> = new Map();
  private allQuestions: Question[] = [];

  constructor() {
    // Load all category JSON files from data/categories/ at startup
    const categoriesDir = join(__dirname, "data", "categories");
    const files = readdirSync(categoriesDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      const categoryKey = basename(file, ".json");
      const questions = JSON.parse(
        readFileSync(join(categoriesDir, file), "utf-8")
      ) as Question[];
      this.questionsByCategory.set(categoryKey, questions);
      this.allQuestions.push(...questions);
    }
  }

  /** Sorted list of available category keys (file names without .json). */
  get categoryNames(): string[] {
    return Array.from(this.questionsByCategory.keys()).sort();
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
      room.clearAllDisconnectTimers();
      this.rooms.delete(code);
    }
  }

  // ─── Question selection ──────────────────────────────────────────────────────

  /**
   * Generate a single custom question via Claude Haiku based on the host's theme.
   * previousPrompts are passed so Claude avoids repeating questions within a session.
   * Falls back to the "all" pool if the API call fails.
   */
  async getCustomQuestion(
    theme: string,
    previousPrompts: string[]
  ): Promise<Question> {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic();

      const avoidSection =
        previousPrompts.length > 0
          ? `\n\nDo NOT repeat any of these already-used questions:\n${previousPrompts.map((p) => `- ${p}`).join("\n")}`
          : "";

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 60,
        messages: [
          {
            role: "user",
            content:
              `Generate a single Family Feud-style question on the theme "${theme}". ` +
              `Rules: direct it at the player using "you" (e.g. "Name something you..."), ` +
              `it should invite many different answers, keep it fun and conversational, ` +
              `and return ONLY the question text with no extra commentary.` +
              avoidSection,
          },
        ],
      });

      const prompt =
        response.content[0].type === "text"
          ? response.content[0].text.trim()
          : null;

      if (prompt) {
        return { id: `custom-${Date.now()}`, prompt, category: theme };
      }
    } catch (e) {
      console.error("Custom question generation failed, falling back:", e);
    }

    // Fallback: pick a random question from the full pool
    const fallback =
      this.allQuestions[Math.floor(Math.random() * this.allQuestions.length)];
    return fallback;
  }

  /** Pick a random question from the given set that hasn't been used yet. */
  getRandomQuestion(usedIds: Set<string>, questionSet: string): Question {
    const pool =
      questionSet === "all"
        ? this.allQuestions
        : (this.questionsByCategory.get(questionSet) ?? this.allQuestions);

    const available = pool.filter((q) => !usedIds.has(q.id));
    if (available.length === 0) {
      // All questions in this set exhausted — reset and reuse
      return pool[Math.floor(Math.random() * pool.length)];
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
