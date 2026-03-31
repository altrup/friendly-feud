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

  /** sessionId → submitted answer (hidden from clients during answering phase) */
  answers: Map<string, string> = new Map();

  /** All guesses made during the guessing phase, in order */
  guessHistory: { guesserId: string; guess: string; matched: boolean; matchedPlayerIds: string[] }[] = [];

  /** Accumulated score deltas for the current round */
  roundScoreDeltas: Map<string, number> = new Map();

  /** Index into playerOrder for whose turn it is during guessing */
  currentGuesserIndex: number = 0;

  /** Socket IDs of players whose answers have already been matched */
  matchedPlayerIds: Set<string> = new Set();

  scores: Map<string, number> = new Map();

  /** Questions used in this game session (to avoid repeats) */
  usedQuestionIds: Set<string> = new Set();

  /** IDs of bot players (excluded from guesser rotation; their answers are auto-generated) */
  botIds: Set<string> = new Set();

  /** The question set chosen by the host ("all", a category name, or "custom") */
  questionSet: string = "all";

  /** Custom theme text entered by the host (only used when questionSet === "custom") */
  customTheme: string | null = null;

  /** Prompts already generated for this room's custom theme (to avoid repeats) */
  generatedQuestionPrompts: string[] = [];

  /** Pre-generated question for the next round (fetched during the guessing phase) */
  pendingQuestion: Question | null = null;
  /** True while a prefetch is in-flight, to prevent duplicate fetches */
  prefetchingQuestion: boolean = false;

  /** Server-side timer for the answering phase timeout */
  private answerTimer: ReturnType<typeof setTimeout> | null = null;
  /** Unix ms timestamp when the answering phase ends; null outside answering phase */
  answerDeadline: number | null = null;

  /** Server-side timer for the current guesser's turn (30s per turn) */
  private guessTimer: ReturnType<typeof setTimeout> | null = null;
  /** Unix ms timestamp when the current guesser's turn ends; null outside guessing phase */
  guessDeadline: number | null = null;

  /** Grace period timers: sessionId → timer (30s before player is removed on disconnect) */
  private disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(code: string, hostSessionId: string, hostName: string) {
    this.code = code;
    this.hostId = hostSessionId;
    this.addPlayer(hostSessionId, hostName, true);
  }

  // ─── Player management ──────────────────────────────────────────────────────

  addPlayer(sessionId: string, name: string, isHost = false): void {
    this.players.set(sessionId, { id: sessionId, name, isHost });
    this.playerOrder.push(sessionId);
    this.scores.set(sessionId, 0);
  }

  hasPlayer(sessionId: string): boolean {
    return this.players.has(sessionId);
  }

  addBot(botId: string, name: string, personality: string): void {
    this.players.set(botId, { id: botId, name, isHost: false, isBot: true, botPersonality: personality });
    // Bots are NOT added to playerOrder — they answer but don't guess
    this.botIds.add(botId);
    this.scores.set(botId, 0);
  }

  removeBot(botId: string): void {
    this.players.delete(botId);
    this.botIds.delete(botId);
    this.scores.delete(botId);
    this.answers.delete(botId);
  }

  updateBotPersonality(botId: string, personality: string): void {
    const bot = this.players.get(botId);
    if (bot && bot.isBot) {
      this.players.set(botId, { ...bot, botPersonality: personality });
    }
  }

  renameBot(botId: string, name: string): void {
    const bot = this.players.get(botId);
    if (bot && bot.isBot) {
      this.players.set(botId, { ...bot, name: name.trim() });
    }
  }

  removePlayer(sessionId: string): void {
    this.players.delete(sessionId);
    this.playerOrder = this.playerOrder.filter((id) => id !== sessionId);
    this.answers.delete(sessionId);
    // Keep score entry — score history is still meaningful
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

  /** Reset all game state so the same players can play again from the lobby. */
  resetToLobby(): void {
    this.phase = "waiting";
    this.currentRound = 0;
    this.currentQuestion = null;
    this.answers = new Map();
    this.guessHistory = [];
    this.roundScoreDeltas = new Map();
    this.currentGuesserIndex = 0;
    this.matchedPlayerIds = new Set();
    this.usedQuestionIds = new Set();
    this.generatedQuestionPrompts = [];
    this.pendingQuestion = null;
    this.prefetchingQuestion = false;
    this.questionSet = "all";
    this.customTheme = null;
    this.answerDeadline = null;
    if (this.answerTimer) {
      clearTimeout(this.answerTimer);
      this.answerTimer = null;
    }
    this.clearGuessTimer();
    // Reset scores for all players and bots
    for (const id of this.players.keys()) {
      this.scores.set(id, 0);
    }
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
  submitAnswer(sessionId: string, answer: string): boolean {
    if (this.phase !== "answering") return false;
    this.answers.set(sessionId, answer.trim());
    return this.answers.size >= this.playerOrder.length + this.botIds.size;
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

  /** Set a 30-second timeout for the current guesser's turn. */
  setGuessTimer(callback: () => void): void {
    this.clearGuessTimer();
    this.guessDeadline = Date.now() + 30_000;
    this.guessTimer = setTimeout(callback, 30_000);
  }

  clearGuessTimer(): void {
    if (this.guessTimer !== null) {
      clearTimeout(this.guessTimer);
      this.guessTimer = null;
    }
    this.guessDeadline = null;
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
    const matchedIds = await matchGuessAsync(this.currentQuestion?.prompt ?? "", guess, this.answers, excludedIds);

    if (matchedIds.length === 0) {
      this.guessHistory.push({ guesserId, guess, matched: false, matchedPlayerIds: [] });
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
    // One entry per guess, carrying all matched player IDs
    this.guessHistory.push({ guesserId, guess, matched: true, matchedPlayerIds: matchedIds });
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
    // Only count players who actually submitted an answer (bots may not have if phase advanced early)
    return this.matchedPlayerIds.size >= this.answers.size;
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
      currentGuesserSessionId:
        this.phase === "guessing"
          ? (this.playerOrder[this.currentGuesserIndex] ?? null)
          : null,
      answeredPlayerIds: Array.from(this.answers.keys()),
      matchedPlayerIds: Array.from(this.matchedPlayerIds),
      answerDeadline: this.answerDeadline,
      guessDeadline: this.guessDeadline,
      questionSet: this.questionSet,
      // Include revealed answers for matched players — safe to send since answers
      // are only added to matchedPlayerIds after a successful guess, not during answering.
      revealedAnswers: Object.fromEntries(
        [...this.matchedPlayerIds]
          .filter(id => this.answers.has(id))
          .map(id => [id, this.answers.get(id)!])
      ),
      guessHistory: [...this.guessHistory],
    };
  }

  /** Returns the full answers map — only emitted at round_end. */
  getRevealedAnswers(): Record<string, string> {
    return Object.fromEntries(this.answers);
  }

  /** Returns all guesses made during the round — only emitted at round_end. */
  getGuessHistory(): { guesserId: string; guess: string; matched: boolean; matchedPlayerIds: string[] }[] {
    return [...this.guessHistory];
  }

  /** Returns score deltas accumulated during the round — only emitted at round_end. */
  getRoundScoreDeltas(): Record<string, number> {
    return Object.fromEntries(this.roundScoreDeltas);
  }
}
