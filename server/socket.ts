// Socket.io event handlers — all game events are registered here.
// Called once from server/app.ts with the Socket.io server and GameManager instances.

import { randomUUID } from "crypto";
import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  GameEndPayload,
  Question,
  ServerToClientEvents,
} from "./types.js";
import type { GameManager } from "./GameManager.js";
import type { GameRoom } from "./GameRoom.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerSocketHandlers(
  io: TypedServer,
  gameManager: GameManager,
): void {
  io.on("connection", (socket: TypedSocket) => {
    // ─── create_lobby ──────────────────────────────────────────────────────────
    socket.on("create_lobby", ({ playerName }) => {
      if (!playerName?.trim()) {
        socket.emit("error", { message: "Player name is required." });
        return;
      }

      const room = gameManager.createRoom(socket.id, playerName.trim());
      socket.join(room.code);
      const sessionId = randomUUID();
      room.registerSession(sessionId, socket.id);
      socket.emit("session_created", { sessionId });
      socket.emit("lobby_update", room.toClientState());
    });

    // ─── join_lobby ────────────────────────────────────────────────────────────
    socket.on("join_lobby", ({ code, playerName }) => {
      if (!playerName?.trim() || !code?.trim()) {
        socket.emit("error", { message: "Name and room code are required." });
        return;
      }

      const room = gameManager.getRoom(code.trim().toUpperCase());
      if (!room) {
        socket.emit("error", { message: "Room not found." });
        return;
      }
      if (!room.canJoin()) {
        socket.emit("error", {
          message:
            room.phase !== "waiting"
              ? "Game already in progress."
              : "Room is full.",
        });
        return;
      }

      room.addPlayer(socket.id, playerName.trim());
      socket.join(room.code);
      const sessionId = randomUUID();
      room.registerSession(sessionId, socket.id);
      socket.emit("session_created", { sessionId });
      // Broadcast updated player list to everyone in the room
      io.to(room.code).emit("lobby_update", room.toClientState());
    });

    // ─── rejoin_session ────────────────────────────────────────────────────────
    socket.on("rejoin_session", ({ sessionId, roomCode }) => {
      const room = gameManager.getRoom(roomCode);
      if (!room || !room.sessionToSocket.has(sessionId)) {
        socket.emit("session_expired");
        return;
      }

      room.cancelDisconnectTimer(sessionId);
      room.updateSessionSocket(sessionId, socket.id);
      socket.join(room.code);
      socket.emit("session_restored", room.toClientState());
    });

    // ─── start_game ────────────────────────────────────────────────────────────
    socket.on("start_game", async ({ questionSet, customTheme }) => {
      const room = gameManager.getRoomBySocketId(socket.id);
      if (!room) return;
      if (room.hostId !== socket.id) {
        socket.emit("error", { message: "Only the host can start the game." });
        return;
      }
      if (room.players.size < 2) {
        socket.emit("error", { message: "Need at least 2 players to start." });
        return;
      }
      if (room.phase !== "waiting") {
        socket.emit("error", { message: "Game already started." });
        return;
      }

      room.questionSet = questionSet ?? "all";
      room.customTheme = customTheme?.trim() || null;
      // Advance phase immediately so concurrent start_game events are rejected
      room.phase = "starting";

      let question: Question;
      if (room.questionSet === "custom" && room.customTheme) {
        question = await gameManager.getCustomQuestion(room.customTheme, room.generatedQuestionPrompts);
        room.generatedQuestionPrompts.push(question.prompt);
      } else {
        question = gameManager.getRandomQuestion(room.usedQuestionIds, room.questionSet);
      }
      room.startAnsweringPhase(question);
      generateAndSubmitBotAnswers(io, room, gameManager); // fire-and-forget

      // Start a 60-second timer; auto-advance to guessing if time runs out
      room.setAnswerTimer(() => {
        if (room.phase === "answering") {
          startGuessingPhase(io, room, gameManager);
        }
      });

      io.to(room.code).emit("phase_change", room.toClientState());
    });

    // ─── submit_answer ─────────────────────────────────────────────────────────
    socket.on("submit_answer", ({ answer }) => {
      const room = gameManager.getRoomBySocketId(socket.id);
      if (!room || room.phase !== "answering") return;
      if (!answer?.trim()) {
        socket.emit("error", { message: "Answer cannot be empty." });
        return;
      }
      // Prevent re-submission
      if (room.answers.has(socket.id)) return;

      const allAnswered = room.submitAnswer(socket.id, answer);

      if (allAnswered) {
        startGuessingPhase(io, room, gameManager);
      } else {
        // Broadcast updated answeredPlayerIds so everyone sees who has answered
        io.to(room.code).emit("phase_change", room.toClientState());
      }
    });

    // ─── submit_guess ──────────────────────────────────────────────────────────
    socket.on("submit_guess", async ({ guess }) => {
      const room = gameManager.getRoomBySocketId(socket.id);
      if (!room || room.phase !== "guessing") return;
      if (room.getCurrentGuesser() !== socket.id) {
        socket.emit("error", { message: "It is not your turn to guess." });
        return;
      }
      if (!guess?.trim()) {
        socket.emit("error", { message: "Guess cannot be empty." });
        return;
      }

      const result = await room.processGuess(socket.id, guess.trim());

      // Emit guess result to all players
      io.to(room.code).emit("guess_result", {
        guesserId: socket.id,
        guess: guess.trim(),
        matched: result.matched,
        matchedPlayerId: result.matchedPlayerId,
        matchedAnswer: result.matchedAnswer,
        scoreDeltas: Object.fromEntries(result.scoreDeltas),
      });

      if (room.allAnswersMatched()) {
        // All answers revealed — round is over
        endRound(io, room);
      } else {
        const outcome = room.advanceGuesser();
        if (outcome === "round_end" || room.allAnswersMatched()) {
          endRound(io, room);
        } else {
          io.to(room.code).emit("phase_change", room.toClientState());
        }
      }
    });

    // ─── pass_turn ─────────────────────────────────────────────────────────────
    socket.on("pass_turn", () => {
      const room = gameManager.getRoomBySocketId(socket.id);
      if (!room || room.phase !== "guessing") return;
      if (room.getCurrentGuesser() !== socket.id) return;

      const outcome = room.advanceGuesser();
      if (outcome === "round_end" || room.allAnswersMatched()) {
        endRound(io, room);
      } else {
        io.to(room.code).emit("phase_change", room.toClientState());
      }
    });

    // ─── next_round ────────────────────────────────────────────────────────────
    socket.on("next_round", async () => {
      const room = gameManager.getRoomBySocketId(socket.id);
      if (!room || room.hostId !== socket.id) return;
      if (room.phase !== "round_end") return;

      const outcome = room.advanceRound();
      if (outcome === "game_end") {
        emitGameEnd(io, room);
      } else {
        let question: Question;
        if (room.pendingQuestion) {
          // Use the question pre-generated during the guessing phase — no wait
          question = room.pendingQuestion;
          room.pendingQuestion = null;
        } else {
          // Prefetch didn't finish in time; generate now as fallback
          if (room.questionSet === "custom" && room.customTheme) {
            question = await gameManager.getCustomQuestion(room.customTheme, room.generatedQuestionPrompts);
            room.generatedQuestionPrompts.push(question.prompt);
          } else {
            question = gameManager.getRandomQuestion(room.usedQuestionIds, room.questionSet);
          }
        }
        room.startAnsweringPhase(question);
        generateAndSubmitBotAnswers(io, room, gameManager); // fire-and-forget

        room.setAnswerTimer(() => {
          if (room.phase === "answering") {
            startGuessingPhase(io, room, gameManager);
          }
        });

        io.to(room.code).emit("phase_change", room.toClientState());
      }
    });

    // ─── add_bot ──────────────────────────────────────────────────────────────
    socket.on("add_bot", ({ name, personality }) => {
      const room = gameManager.getRoomBySocketId(socket.id);
      if (!room || room.hostId !== socket.id || room.phase !== "waiting") return;
      const botId = `bot-${randomUUID()}`;
      room.addBot(botId, name, personality);
      io.to(room.code).emit("lobby_update", room.toClientState());
    });

    // ─── remove_bot ───────────────────────────────────────────────────────────
    socket.on("remove_bot", ({ botId }) => {
      const room = gameManager.getRoomBySocketId(socket.id);
      if (!room || room.hostId !== socket.id || room.phase !== "waiting") return;
      room.removeBot(botId);
      io.to(room.code).emit("lobby_update", room.toClientState());
    });

    // ─── update_bot_personality ───────────────────────────────────────────────
    socket.on("update_bot_personality", ({ botId, personality }) => {
      const room = gameManager.getRoomBySocketId(socket.id);
      if (!room || room.hostId !== socket.id || room.phase !== "waiting") return;
      room.updateBotPersonality(botId, personality);
      io.to(room.code).emit("lobby_update", room.toClientState());
    });

    // ─── leave_game ───────────────────────────────────────────────────────────
    socket.on("leave_game", () => {
      const room = gameManager.getRoomBySocketId(socket.id);
      if (!room) return;
      // Cancel any pending grace period and remove the session so the
      // subsequent disconnect event doesn't start a new grace period.
      const sessionId = room.socketToSession.get(socket.id);
      if (sessionId) room.cancelDisconnectTimer(sessionId);
      handlePlayerLeave(io, room, socket.id, gameManager);
      socket.disconnect(true);
    });

    // ─── disconnect ────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const room = gameManager.getRoomBySocketId(socket.id);
      if (!room) return;

      const sessionId = room.socketToSession.get(socket.id);
      if (sessionId) {
        // Give the player 30s to reconnect before removing them
        room.startDisconnectTimer(sessionId, () => {
          handlePlayerLeave(io, room, socket.id, gameManager);
        });
      } else {
        handlePlayerLeave(io, room, socket.id, gameManager);
      }
    });
  });
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

// Auto-generate and submit answers for all bots when the answering phase begins.
// Fire-and-forget; guards prevent late arrivals from disrupting a phase that has already advanced.
async function generateAndSubmitBotAnswers(io: TypedServer, room: GameRoom, gameManager: GameManager): Promise<void> {
  if (!room.currentQuestion || room.botIds.size === 0) return;
  const question = room.currentQuestion;

  await Promise.all(
    Array.from(room.botIds).map(async (botId) => {
      const bot = room.players.get(botId);
      if (!bot) return;
      const answer = await gameManager.getBotAnswer(question, bot.botPersonality ?? "");
      if (room.phase !== "answering" || room.currentQuestion?.id !== question.id) return;
      const allAnswered = room.submitAnswer(botId, answer);
      io.to(room.code).emit("phase_change", room.toClientState());
      if (allAnswered) {
        startGuessingPhase(io, room, gameManager);
      }
    })
  );
}

function startGuessingPhase(io: TypedServer, room: GameRoom, gameManager: GameManager): void {
  room.startGuessingPhase();
  io.to(room.code).emit("phase_change", room.toClientState());
  prefetchNextQuestion(gameManager, room); // fire-and-forget
}

// Pre-generate the next round's question during the guessing phase so next_round is instant.
async function prefetchNextQuestion(gameManager: GameManager, room: GameRoom): Promise<void> {
  if (room.currentRound >= 3 || room.prefetchingQuestion) return;
  room.prefetchingQuestion = true;
  try {
    let question: Question;
    if (room.questionSet === "custom" && room.customTheme) {
      // Snapshot prompts so mutations during the await don't affect deduplication
      question = await gameManager.getCustomQuestion(room.customTheme, [...room.generatedQuestionPrompts]);
      // Discard if the round advanced while we were waiting
      if (room.pendingQuestion === null && room.phase !== "game_end") {
        room.generatedQuestionPrompts.push(question.prompt);
        room.pendingQuestion = question;
      }
    } else {
      question = gameManager.getRandomQuestion(room.usedQuestionIds, room.questionSet);
      room.pendingQuestion = question;
    }
  } finally {
    room.prefetchingQuestion = false;
  }
}

function endRound(io: TypedServer, room: GameRoom): void {
  room.phase = "round_end";
  io.to(room.code).emit("round_end", {
    state: room.toClientState(),
    revealedAnswers: room.getRevealedAnswers(),
    guessHistory: room.getGuessHistory(),
    roundScoreDeltas: room.getRoundScoreDeltas(),
  });
}

function emitGameEnd(io: TypedServer, room: GameRoom): void {
  const scores = Object.fromEntries(room.scores);
  const players = Array.from(room.players.values());

  // Find the winner (highest score; ties go to earlier join order)
  let winner = players[0];
  for (const player of players) {
    const score = room.scores.get(player.id) ?? 0;
    const winnerScore = room.scores.get(winner.id) ?? 0;
    if (score > winnerScore) winner = player;
  }

  const payload: GameEndPayload = {
    scores,
    winner: {
      id: winner.id,
      name: winner.name,
      score: room.scores.get(winner.id) ?? 0,
    },
    players,
  };

  io.to(room.code).emit("game_end", payload);
}

function handlePlayerLeave(
  io: TypedServer,
  room: GameRoom,
  socketId: string,
  gameManager: GameManager
): void {
  room.removePlayer(socketId);

  if (room.players.size === 0) {
    gameManager.deleteRoom(room.code);
    return;
  }

  // If the host left, promote the next player
  if (room.hostId === socketId) {
    const newHostId = room.playerOrder[0];
    room.hostId = newHostId;
    const newHost = room.players.get(newHostId);
    if (newHost) {
      room.players.set(newHostId, { ...newHost, isHost: true });
    }
  }

  // If mid-guessing and the current guesser left, clamp the index
  if (room.phase === "guessing") {
    if (room.currentGuesserIndex >= room.playerOrder.length) {
      room.currentGuesserIndex = 0;
    }
    if (room.allAnswersMatched()) {
      endRound(io, room);
      return;
    }
  }

  io.to(room.code).emit("lobby_update", room.toClientState());
}
