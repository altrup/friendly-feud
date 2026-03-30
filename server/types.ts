// All shared TypeScript types for the Friendly Feud game.
// Used by both server logic and (via import) client-side socket typings.

export type GamePhase =
  | "waiting"
  | "starting"
  | "answering"
  | "guessing"
  | "round_end"
  | "game_end";

export interface Player {
  id: string; // socket ID
  name: string;
  isHost: boolean;
  isBot?: boolean;
  botPersonality?: string;
}

export interface Question {
  id: string;
  prompt: string;
  category: string;
}

// Serialized room state sent to clients.
// Maps are converted to plain objects; hidden data (answers) is omitted during answering phase.
export interface ClientGameState {
  code: string;
  phase: GamePhase;
  hostId: string;
  players: Player[];
  scores: Record<string, number>;
  currentRound: number;
  currentQuestion: Question | null;
  currentGuesserSocketId: string | null;
  /** Socket IDs of players who have submitted their answer (not the answers themselves) */
  answeredPlayerIds: string[];
  /** Which answers have already been matched (socket IDs of matched players) */
  matchedPlayerIds: string[];
  /** Unix ms timestamp when the answering phase ends; null outside answering phase */
  answerDeadline: number | null;
  /** The question set chosen by the host ("all" or a category name) */
  questionSet: string;
}

// ─── Socket Event Payload Types ───────────────────────────────────────────────

export interface GuessResultPayload {
  guesserId: string;
  guess: string;
  matched: boolean;
  matchedPlayerId: string | null;
  matchedAnswer: string | null; // revealed only on a successful match
  scoreDeltas: Record<string, number>;
}

export interface RoundEndPayload {
  state: ClientGameState;
  revealedAnswers: Record<string, string>; // socketId → answer text
  guessHistory: { guesserId: string; guess: string; matched: boolean; matchedPlayerId: string | null }[];
  roundScoreDeltas: Record<string, number>;
}

export interface GameEndPayload {
  scores: Record<string, number>;
  winner: { id: string; name: string; score: number };
  players: Player[];
}

export interface ErrorPayload {
  message: string;
}

// ─── Typed Socket Event Maps (used to construct typed Socket.io instances) ────

export interface ServerToClientEvents {
  lobby_update: (state: ClientGameState) => void;
  phase_change: (state: ClientGameState) => void;
  guess_result: (data: GuessResultPayload) => void;
  round_end: (data: RoundEndPayload) => void;
  game_end: (data: GameEndPayload) => void;
  error: (data: ErrorPayload) => void;
  session_created: (data: { sessionId: string }) => void;
  session_restored: (state: ClientGameState) => void;
  session_expired: () => void;
}

export interface ClientToServerEvents {
  create_lobby: (data: { playerName: string }) => void;
  join_lobby: (data: { code: string; playerName: string }) => void;
  rejoin_session: (data: { sessionId: string; roomCode: string }) => void;
  leave_game: () => void;
  start_game: (data: { questionSet: string; customTheme?: string }) => void;
  submit_answer: (data: { answer: string }) => void;
  /** targetPlayerId is optional for MVP — server matches against all unguessed answers */
  submit_guess: (data: { guess: string; targetPlayerId?: string }) => void;
  next_round: () => void;
  pass_turn: () => void;
  add_bot: (data: { name: string; personality: string }) => void;
  remove_bot: (data: { botId: string }) => void;
  update_bot_personality: (data: { botId: string; personality: string }) => void;
}
