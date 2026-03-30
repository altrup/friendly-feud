// GameRoom encapsulates all mutable state for a single game session.
// All phase transitions and game logic go through this class; socket.ts calls
// methods here and emits events based on the returned values.

import type { ClientGameState, GamePhase, Player, Question } from "./types.js";
import { matchGuessAsync } from "./matching.js";
import { computeScoreDeltas } from "./scoring.js";

export interface GuessResult {
  matched: boolean;
  matchedPlayerId: string | null;
  matchedAnswer: string | null;
  /** All socket IDs whose answer was matched (≥1 for shared answers) */
  matchedIds: string[];
  scoreDeltas: Map<string, number>;
}

export class GameRoom {
  readonly code: string;
  hostId: string;
  phase: GamePhase = "waiting";

  /** Ordered list of socket IDs (join order preserved for guesser rotation) */
  playerOrder: string[] = [];
  players: Map<string, Player> = new Map();

  currentRound: number = 0;
  currentQuestion: Question | null = null;

  /** socketId → submitted answer (hidden from clients during answering phase) */
  answers: Map<string, string> = new Map();

  /** All guesses made during the guessing phase, in order */
  guessHistory: { guesserId: string; guess: string; matched: boolean; matchedPlayerId: string | null }[] = [];

  /** Accumulated score deltas for the current round */
  roundScoreDeltas: Map<string, number> = new Map();

  /** Index into playerOrder for whose turn it is during guessing */
  currentGuesserIndex: number = 0;

  /** Socket IDs of players whose answers have already been matched */
  matchedPlayerIds: Set<string> = new Set();

  scores: Map<string, number> = new Map();

  /** Questions used in this game session (to avoid repeats) */
  usedQuestionIds: Set<string> = new Set();

  /** The question set chosen by the host ("all", a category name, or "custom") */
  questionSet: string = "all";

  /** Custom theme text entered by the host (only used when questionSet === "custom") */
  customTheme: string | null = null;

  /** Prompts already generated for this room's custom theme (to avoid repeats) */
  generatedQuestionPrompts: string[] = [];

  /** Server-side timer for the answering phase timeout */
  private answerTimer: ReturnType<typeof setTimeout> | null = null;
  /** Unix ms timestamp when the answering phase ends; null outside answering phase */
  answerDeadline: number | null = null;

  /** sessionId → socketId (for reconnection) */
  sessionToSocket: Map<string, string> = new Map();
  /** socketId → sessionId (for disconnect lookup) */
  socketToSession: Map<string, string> = new Map();
  /** Grace period timers: sessionId → timer (30s before player is removed on disconnect) */
  private disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(code: string, hostSocketId: string, hostName: string) {
    this.code = code;
    this.hostId = hostSocketId;
    this.addPlayer(hostSocketId, hostName, true);
  }

  // ─── Player management ──────────────────────────────────────────────────────

  addPlayer(socketId: string, name: string, isHost = false): void {
    this.players.set(socketId, { id: socketId, name, isHost });
    this.playerOrder.push(socketId);
    this.scores.set(socketId, 0);
  }

  removePlayer(socketId: string): void {
    this.players.delete(socketId);
    this.playerOrder = this.playerOrder.filter((id) => id !== socketId);
    this.answers.delete(socketId);
    const sessionId = this.socketToSession.get(socketId);
    if (sessionId) {
      this.sessionToSocket.delete(sessionId);
      this.socketToSession.delete(socketId);
    }
    // Keep score entry — score history is still meaningful
  }

  /** Register a session token for a connected player. */
  registerSession(sessionId: string, socketId: string): void {
    this.sessionToSocket.set(sessionId, socketId);
    this.socketToSession.set(socketId, sessionId);
  }

  /**
   * Remap all game state references from the old socket ID to the new one
   * when a player reconnects with an existing session.
   * Returns the old socket ID, or null if the session wasn't found.
   */
  updateSessionSocket(sessionId: string, newSocketId: string): string | null {
    const oldSocketId = this.sessionToSocket.get(sessionId);
    if (!oldSocketId) return null;

    this.socketToSession.delete(oldSocketId);
    this.sessionToSocket.set(sessionId, newSocketId);
    this.socketToSession.set(newSocketId, sessionId);

    const player = this.players.get(oldSocketId);
    if (player) {
      this.players.delete(oldSocketId);
      this.players.set(newSocketId, { ...player, id: newSocketId });
    }

    this.playerOrder = this.playerOrder.map((id) =>
      id === oldSocketId ? newSocketId : id
    );

    const score = this.scores.get(oldSocketId) ?? 0;
    this.scores.delete(oldSocketId);
    this.scores.set(newSocketId, score);

    const answer = this.answers.get(oldSocketId);
    if (answer !== undefined) {
      this.answers.delete(oldSocketId);
      this.answers.set(newSocketId, answer);
    }

    if (this.matchedPlayerIds.has(oldSocketId)) {
      this.matchedPlayerIds.delete(oldSocketId);
      this.matchedPlayerIds.add(newSocketId);
    }

    if (this.hostId === oldSocketId) this.hostId = newSocketId;

    return oldSocketId;
  }

  startDisconnectTimer(sessionId: string, onExpire: () => void): void {
    this.cancelDisconnectTimer(sessionId);
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(sessionId);
      onExpire();
    }, 30_000);
    this.disconnectTimers.set(sessionId, timer);
  }

  cancelDisconnectTimer(sessionId: string): void {
    const timer = this.disconnectTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(sessionId);
    }
  }

  clearAllDisconnectTimers(): void {
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
  }

  /** Returns true if the room can accept new players. */
  canJoin(): boolean {
    return this.phase === "waiting" && this.players.size < 10;
  }

  // ─── Phase transitions ──────────────────────────────────────────────────────

  /** Transition to the answering phase with the given question. */
  startAnsweringPhase(question: Question): void {
    this.currentQuestion = question;
    this.usedQuestionIds.add(question.id);
    this.phase = "answering";
    this.answers.clear();
    this.guessHistory = [];
    this.roundScoreDeltas.clear();
    this.matchedPlayerIds.clear();
    this.currentGuesserIndex = 0;
    this.currentRound++;
  }

  /**
   * Record a player's answer.
   * Returns true if ALL active players have now answered (caller should start guessing phase).
   */
  submitAnswer(socketId: string, answer: string): boolean {
    if (this.phase !== "answering") return false;
    this.answers.set(socketId, answer.trim());
    return this.answers.size >= this.playerOrder.length;
  }

  /** Set the 60-second timeout for the answering phase. Stored so it can be cancelled early. */
  setAnswerTimer(callback: () => void): void {
    this.clearAnswerTimer();
    this.answerDeadline = Date.now() + 60_000;
    this.answerTimer = setTimeout(callback, 60_000);
  }

  clearAnswerTimer(): void {
    if (this.answerTimer !== null) {
      clearTimeout(this.answerTimer);
      this.answerTimer = null;
    }
    this.answerDeadline = null;
  }

  /** Transition to the guessing phase. */
  startGuessingPhase(): void {
    this.clearAnswerTimer();
    this.phase = "guessing";
    this.currentGuesserIndex = 0;
  }

  // ─── Guessing ───────────────────────────────────────────────────────────────

  /** Returns the socket ID of the player whose turn it is. */
  getCurrentGuesser(): string {
    return this.playerOrder[this.currentGuesserIndex];
  }

  /**
   * Process a guess from the current guesser.
   * Handles matching, scoring, and marking answers as revealed.
   */
  async processGuess(guesserId: string, guess: string): Promise<GuessResult> {
    // Exclude already-matched answers and the guesser's own answer from candidates
    const excludedIds = new Set(this.matchedPlayerIds);
    excludedIds.add(guesserId);

    // Returns all socket IDs whose answer matches the guess (guesser already excluded)
    const matchedIds = await matchGuessAsync(guess, this.answers, excludedIds);

    if (matchedIds.length === 0) {
      this.guessHistory.push({ guesserId, guess, matched: false, matchedPlayerId: null });
      return {
        matched: false,
        matchedPlayerId: null,
        matchedAnswer: null,
        matchedIds: [],
        scoreDeltas: new Map(),
      };
    }

    // Mark all matched players so their answers can't be guessed again
    for (const id of matchedIds) {
      this.matchedPlayerIds.add(id);
    }

    // Compute and apply score deltas. The guesser is already absent from matchedIds
    // (excluded above), so no double-counting when they shared an answer.
    const scoreDeltas = computeScoreDeltas(guesserId, matchedIds);
    for (const [id, delta] of scoreDeltas) {
      this.scores.set(id, (this.scores.get(id) ?? 0) + delta);
      this.roundScoreDeltas.set(id, (this.roundScoreDeltas.get(id) ?? 0) + delta);
    }

    const matchedPlayerId = matchedIds[0];
    const matchedAnswer = this.answers.get(matchedPlayerId)!;
    this.guessHistory.push({ guesserId, guess, matched: true, matchedPlayerId });
    return {
      matched: true,
      matchedPlayerId,
      matchedAnswer,
      matchedIds,
      scoreDeltas,
    };
  }

  /**
   * Advance the guesser to the next player.
   * Returns 'round_end' if all players have had their turn, 'continue' otherwise.
   */
  advanceGuesser(): "continue" | "round_end" {
    this.currentGuesserIndex++;
    if (this.currentGuesserIndex >= this.playerOrder.length) {
      return "round_end";
    }
    return "continue";
  }

  /** Check whether all answers have been successfully matched. */
  allAnswersMatched(): boolean {
    return this.matchedPlayerIds.size >= this.playerOrder.length;
  }

  // ─── Round / game advancement ────────────────────────────────────────────────

  /**
   * Called by the host to advance after a round ends.
   * Returns 'game_end' after 3 rounds, 'next_round' otherwise.
   */
  advanceRound(): "next_round" | "game_end" {
    if (this.currentRound >= 3) {
      this.phase = "game_end";
      return "game_end";
    }
    this.phase = "answering"; // will be properly set by startAnsweringPhase
    return "next_round";
  }

  // ─── Serialization ──────────────────────────────────────────────────────────

  /**
   * Returns a plain object safe to JSON.stringify and emit to clients.
   * During the answering phase, actual answers are NOT included.
   */
  toClientState(): ClientGameState {
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      players: Array.from(this.players.values()),
      scores: Object.fromEntries(this.scores),
      currentRound: this.currentRound,
      currentQuestion: this.currentQuestion,
      currentGuesserSocketId:
        this.phase === "guessing"
          ? (this.playerOrder[this.currentGuesserIndex] ?? null)
          : null,
      answeredPlayerIds: Array.from(this.answers.keys()),
      matchedPlayerIds: Array.from(this.matchedPlayerIds),
      answerDeadline: this.answerDeadline,
      questionSet: this.questionSet,
    };
  }

  /** Returns the full answers map — only emitted at round_end. */
  getRevealedAnswers(): Record<string, string> {
    return Object.fromEntries(this.answers);
  }

  /** Returns all guesses made during the round — only emitted at round_end. */
  getGuessHistory(): { guesserId: string; guess: string; matched: boolean; matchedPlayerId: string | null }[] {
    return [...this.guessHistory];
  }

  /** Returns score deltas accumulated during the round — only emitted at round_end. */
  getRoundScoreDeltas(): Record<string, number> {
    return Object.fromEntries(this.roundScoreDeltas);
  }
}
