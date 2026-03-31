// GameContext provides all real-time game state to the component tree.
// It subscribes to Socket.io events and exposes typed action dispatchers.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import { useSocket } from "../hooks/useSocket.js";
import type {
  ClientGameState,
  GameEndPayload,
  GamePhase,
  GuessResultPayload,
  Player,
  Question,
} from "../../server/types.js";

// ─── State shape ─────────────────────────────────────────────────────────────

interface GameState {
  roomCode: string | null;
  mySocketId: string | null;
  myName: string | null;
  phase: GamePhase;
  players: Player[];
  scores: Record<string, number>;
  currentQuestion: Question | null;
  currentGuesserSocketId: string | null;
  answeredPlayerIds: string[];
  matchedPlayerIds: string[];
  lastGuessResult: GuessResultPayload | null;
  /** Answer text for matched players accumulated during guessing; persisted server-side */
  revealedAnswers: Record<string, string>;
  /** Revealed at round_end: socketId → answer text (full set) */
  roundAnswers: Record<string, string> | null;
  /** Guesses made so far this round; populated during guessing and at round_end */
  roundGuesses: { guesserId: string; guess: string; matched: boolean; matchedPlayerIds: string[] }[] | null;
  /** Revealed at round_end: score change per player for this round */
  roundScoreDeltas: Record<string, number> | null;
  roundNumber: number;
  hostId: string | null;
  gameEnd: GameEndPayload | null;
  answerDeadline: number | null;
  guessDeadline: number | null;
  error: string | null;
}

const initialState: GameState = {
  roomCode: null,
  mySocketId: null,
  myName: null,
  phase: "waiting",
  players: [],
  scores: {},
  currentQuestion: null,
  currentGuesserSocketId: null,
  answeredPlayerIds: [],
  matchedPlayerIds: [],
  lastGuessResult: null,
  revealedAnswers: {},
  roundAnswers: null,
  roundGuesses: null,
  roundScoreDeltas: null,
  roundNumber: 0,
  hostId: null,
  gameEnd: null,
  answerDeadline: null,
  guessDeadline: null,
  error: null,
};

// ─── Context value ────────────────────────────────────────────────────────────

interface GameContextValue {
  state: GameState;
  createLobby: (playerName: string) => void;
  joinLobby: (code: string, playerName: string) => void;
  leaveGame: () => void;
  startGame: (questionSet: string, customTheme?: string) => void;
  submitAnswer: (answer: string) => void;
  submitGuess: (guess: string) => void;
  nextRound: () => void;
  clearError: () => void;
  playAgain: () => void;
  addBot: () => void;
  removeBot: (botId: string) => void;
  updateBotPersonality: (botId: string, personality: string) => void;
  renameBot: (botId: string, name: string) => void;
  kickPlayer: (playerId: string) => void;
  requestSync: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(initialState);
  const navigate = useNavigate();
  const socket = useSocket();

  // Track the room code and name in refs so event handlers always see the latest value
  const roomCodeRef = useRef<string | null>(null);
  const myNameRef = useRef<string | null>(null);

  // Helper to apply a ClientGameState update
  const applyRoomState = useCallback((roomState: ClientGameState) => {
    setState((prev) => ({
      ...prev,
      roomCode: roomState.code,
      phase: roomState.phase,
      players: roomState.players,
      scores: roomState.scores,
      currentQuestion: roomState.currentQuestion,
      currentGuesserSocketId: roomState.currentGuesserSocketId,
      answeredPlayerIds: roomState.answeredPlayerIds,
      matchedPlayerIds: roomState.matchedPlayerIds,
      hostId: roomState.hostId,
      answerDeadline: roomState.answerDeadline,
      guessDeadline: roomState.guessDeadline,
      currentRound: roomState.currentRound,
      roundNumber: roomState.currentRound,
      // Restore server-persisted revealed answers and guess history (non-null during guessing)
      revealedAnswers: roomState.revealedAnswers,
      roundGuesses: roomState.guessHistory.length > 0 ? roomState.guessHistory : prev.roundGuesses,
      // Clear round-end-only data; roundAnswers is only set via the round_end event
      roundAnswers: null,
      roundScoreDeltas: null,
      lastGuessResult: null,
      error: null,
    }));
    roomCodeRef.current = roomState.code;
  }, []);

  // ── Attempt session recovery on mount ───────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = sessionStorage.getItem("feud_session");
    if (!saved) return;

    let session: { sessionId: string; roomCode: string; playerName: string };
    try {
      session = JSON.parse(saved);
    } catch {
      sessionStorage.removeItem("feud_session");
      return;
    }
    if (!session?.sessionId || !session?.roomCode) {
      sessionStorage.removeItem("feud_session");
      return;
    }

    myNameRef.current = session.playerName;
    setState((prev) => ({ ...prev, myName: session.playerName }));

    const doRejoin = () => {
      socket.emit("rejoin_session", {
        sessionId: session.sessionId,
        roomCode: session.roomCode,
      });
    };

    if (socket.connected) {
      doRejoin();
    } else {
      socket.once("connect", doRejoin);
      socket.connect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount only

  useEffect(() => {
    // Store socket ID once connected
    socket.on("connect", () => {
      setState((prev) => ({ ...prev, mySocketId: socket.id ?? null }));
    });

    // ── session_created: save session token to sessionStorage ──
    // roomCode isn't known yet (lobby_update hasn't arrived), so we store a
    // partial entry; lobby_update will fill in the roomCode below.
    socket.on("session_created", ({ sessionId }) => {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          "feud_session",
          JSON.stringify({
            sessionId,
            roomCode: null,
            playerName: myNameRef.current,
          })
        );
      }
    });

    // ── session_restored: reconnected to an existing game session ──
    socket.on("session_restored", (roomState) => {
      applyRoomState(roomState);
      setState((prev) => ({ ...prev, mySocketId: socket.id ?? null }));
      if (roomState.phase === "waiting") {
        navigate(`/lobby/${roomState.code}`);
      } else {
        navigate(`/game/${roomState.code}`);
      }
    });

    // ── kicked: host removed this player from the room ──
    socket.on("kicked", () => {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("feud_session");
      }
      setState(initialState);
      navigate("/");
    });

    // ── session_expired: grace period elapsed, session no longer valid ──
    socket.on("session_expired", () => {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("feud_session");
      }
    });

    // ── lobby_update: received when player list changes ──
    socket.on("lobby_update", (roomState) => {
      applyRoomState(roomState);
      // Patch roomCode into the session entry now that we know it
      if (typeof window !== "undefined") {
        const saved = sessionStorage.getItem("feud_session");
        if (saved) {
          try {
            const entry = JSON.parse(saved);
            if (!entry.roomCode) {
              sessionStorage.setItem(
                "feud_session",
                JSON.stringify({ ...entry, roomCode: roomState.code })
              );
            }
          } catch { /* ignore */ }
        }
      }
      // Navigate to lobby if we just joined/created
      if (roomCodeRef.current) {
        navigate(`/lobby/${roomState.code}`);
      }
    });

    // ── phase_change: game state machine advanced ──
    socket.on("phase_change", (roomState) => {
      applyRoomState(roomState);
      if (roomState.phase !== "waiting") {
        navigate(`/game/${roomState.code}`);
      }
    });

    // ── guess_result: outcome of a guess attempt ──
    socket.on("guess_result", (data) => {
      setState((prev) => ({
        ...prev,
        lastGuessResult: data,
        // Merge in all matched player IDs and their answer text immediately
        matchedPlayerIds: data.matched && data.matchedPlayerIds.length
          ? [...prev.matchedPlayerIds, ...data.matchedPlayerIds]
          : prev.matchedPlayerIds,
        revealedAnswers: data.matched
          ? { ...prev.revealedAnswers, ...data.matchedAnswers }
          : prev.revealedAnswers,
        // Append this guess to the running history
        roundGuesses: [
          ...(prev.roundGuesses ?? []),
          {
            guesserId: data.guesserId,
            guess: data.guess,
            matched: data.matched,
            matchedPlayerIds: data.matchedPlayerIds,
          },
        ],
      }));
    });

    // ── round_end: all answers revealed ──
    socket.on("round_end", ({ state: roomState, revealedAnswers, guessHistory, roundScoreDeltas }) => {
      applyRoomState(roomState);
      setState((prev) => ({
        ...prev,
        phase: "round_end",
        roundAnswers: revealedAnswers,
        roundGuesses: guessHistory,
        roundScoreDeltas,
        scores: roomState.scores,
      }));
    });

    // ── game_end: final results ──
    socket.on("game_end", (data) => {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("feud_session");
      }
      setState((prev) => ({
        ...prev,
        phase: "game_end",
        scores: data.scores,
        gameEnd: data,
      }));
    });

    // ── error: server sent an error message ──
    socket.on("error", ({ message }) => {
      setState((prev) => ({ ...prev, error: message }));
    });

    return () => {
      socket.off("connect");
      socket.off("kicked");
      socket.off("session_created");
      socket.off("session_restored");
      socket.off("session_expired");
      socket.off("lobby_update");
      socket.off("phase_change");
      socket.off("guess_result");
      socket.off("round_end");
      socket.off("game_end");
      socket.off("error");
    };
  }, [socket, navigate, applyRoomState]);

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const createLobby = useCallback(
    (playerName: string) => {
      myNameRef.current = playerName;
      setState((prev) => ({ ...prev, myName: playerName, error: null }));
      if (!socket.connected) socket.connect();
      socket.emit("create_lobby", { playerName });
    },
    [socket]
  );

  const joinLobby = useCallback(
    (code: string, playerName: string) => {
      myNameRef.current = playerName;
      setState((prev) => ({ ...prev, myName: playerName, error: null }));
      if (!socket.connected) socket.connect();
      socket.emit("join_lobby", { code, playerName });
    },
    [socket]
  );

  const leaveGame = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("feud_session");
    }
    socket.emit("leave_game");
    setState(initialState);
    navigate("/");
  }, [socket, navigate]);

  const startGame = useCallback(
    (questionSet: string, customTheme?: string) => {
      socket.emit("start_game", { questionSet, customTheme });
    },
    [socket]
  );

  const submitAnswer = useCallback(
    (answer: string) => {
      socket.emit("submit_answer", { answer });
    },
    [socket]
  );

  const submitGuess = useCallback(
    (guess: string) => {
      socket.emit("submit_guess", { guess });
    },
    [socket]
  );

  const nextRound = useCallback(() => {
    socket.emit("next_round");
  }, [socket]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const playAgain = useCallback(() => {
    socket.emit("play_again");
  }, [socket]);

  const addBot = useCallback(() => {
    socket.emit("add_bot");
  }, [socket]);

  const removeBot = useCallback(
    (botId: string) => {
      socket.emit("remove_bot", { botId });
    },
    [socket]
  );

  const updateBotPersonality = useCallback(
    (botId: string, personality: string) => {
      socket.emit("update_bot_personality", { botId, personality });
    },
    [socket]
  );

  const renameBot = useCallback(
    (botId: string, name: string) => {
      socket.emit("rename_bot", { botId, name });
    },
    [socket]
  );

  const kickPlayer = useCallback(
    (playerId: string) => {
      socket.emit("kick_player", { playerId });
    },
    [socket]
  );

  const requestSync = useCallback(() => {
    socket.emit("request_sync");
  }, [socket]);

  return (
    <GameContext.Provider
      value={{
        state,
        createLobby,
        joinLobby,
        leaveGame,
        startGame,
        submitAnswer,
        submitGuess,
        nextRound,
        clearError,
        playAgain,
        addBot,
        removeBot,
        updateBotPersonality,
        renameBot,
        kickPlayer,
        requestSync,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside <GameProvider>");
  return ctx;
}
