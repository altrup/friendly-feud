import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useGame } from "../context/GameContext.js";
import { PlayerList } from "../components/PlayerList.js";

export function meta() {
  return [{ title: "Friendly Feud — Lobby" }];
}

export default function LobbyRoute() {
  const { code } = useParams<{ code: string }>();
  const { state, startGame, leaveGame } = useGame();
  const navigate = useNavigate();

  // SSR guard: socket is browser-only
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Redirect to home if we're not actually in a room (e.g. direct URL visit)
  useEffect(() => {
    if (mounted && !state.mySocketId) {
      navigate("/");
    }
  }, [mounted, state.mySocketId, navigate]);

  // Advance to game when phase leaves waiting
  useEffect(() => {
    if (mounted && state.phase !== "waiting" && state.roomCode) {
      navigate(`/game/${state.roomCode}`);
    }
  }, [mounted, state.phase, state.roomCode, navigate]);

  if (!mounted) {
    return (
      <main className="min-h-screen bg-game-bg flex items-center justify-center">
        <p className="text-game-muted">Loading…</p>
      </main>
    );
  }

  const isHost = state.hostId === state.mySocketId;
  const canStart = state.players.length >= 2;

  return (
    <main className="min-h-screen bg-game-bg flex flex-col items-center justify-center p-6 gap-8">
      {/* Room code */}
      <div className="text-center">
        <p className="text-game-muted text-sm uppercase tracking-widest mb-1">
          Room Code
        </p>
        <h1 className="text-6xl font-black text-game-gold tracking-[0.2em]">
          {code}
        </h1>
        <p className="text-game-muted text-sm mt-2">
          Share this code with your friends!
        </p>
      </div>

      {/* Player list */}
      <div className="w-full max-w-md">
        <p className="text-game-muted text-sm mb-3">
          {state.players.length} player{state.players.length !== 1 ? "s" : ""} joined
        </p>
        <PlayerList
          players={state.players}
          currentPlayerId={state.mySocketId}
        />
      </div>

      {/* Leave button */}
      <button
        onClick={leaveGame}
        className="text-game-muted text-sm underline hover:text-game-text transition-colors"
      >
        Leave game
      </button>

      {/* Start button */}
      <div className="text-center">
        {isHost ? (
          <>
            <button
              onClick={startGame}
              disabled={!canStart}
              className="bg-game-accent hover:bg-game-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl px-10 py-4 text-xl transition-colors"
            >
              Start Game
            </button>
            {!canStart && (
              <p className="text-game-muted text-sm mt-2">
                Need at least 2 players to start.
              </p>
            )}
          </>
        ) : (
          <p className="text-game-muted animate-pulse">
            Waiting for the host to start…
          </p>
        )}
      </div>
    </main>
  );
}
