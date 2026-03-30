// Main game view. Acts as a thin shell that renders the correct phase component.
// All game state comes from GameContext via Socket.io — no loader needed.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useGame } from "../context/GameContext.js";
import { ScoreBoard } from "../components/ScoreBoard.js";
import { PhaseAnswering } from "../components/PhaseAnswering.js";
import { PhaseGuessing } from "../components/PhaseGuessing.js";
import { PhaseRoundEnd } from "../components/PhaseRoundEnd.js";
import { PhaseGameEnd } from "../components/PhaseGameEnd.js";

export function meta() {
  return [{ title: "Friendly Feud — Game" }];
}

export default function GameRoute() {
  const { state, leaveGame } = useGame();
  const navigate = useNavigate();

  // SSR guard
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Redirect to home if we're not in a game
  useEffect(() => {
    if (mounted && !state.mySocketId) {
      navigate("/");
    }
  }, [mounted, state.mySocketId, navigate]);

  if (!mounted) {
    return (
      <main className="min-h-screen bg-game-bg flex items-center justify-center">
        <p className="text-game-muted">Loading…</p>
      </main>
    );
  }

  const showSidebar =
    state.phase !== "game_end" && state.players.length > 0;

  return (
    <main className="min-h-screen bg-game-bg flex flex-col lg:flex-row">
      {/* Main game area */}
      <div className="flex-1 p-6 flex flex-col justify-center max-w-2xl mx-auto w-full">
        {/* Leave button */}
        {state.phase !== "game_end" && (
          <div className="mb-4">
            <button
              onClick={leaveGame}
              className="text-game-muted text-sm underline hover:text-game-text transition-colors"
            >
              Leave game
            </button>
          </div>
        )}

        {/* Error banner */}
        {state.error && (
          <div className="mb-4 bg-game-accent/20 border border-game-accent text-game-text px-4 py-3 rounded-lg text-sm">
            {state.error}
          </div>
        )}

        {state.phase === "answering" && <PhaseAnswering />}
        {state.phase === "guessing" && <PhaseGuessing />}
        {state.phase === "round_end" && <PhaseRoundEnd />}
        {state.phase === "game_end" && <PhaseGameEnd />}

        {/* Fallback during brief transitions */}
        {state.phase === "waiting" && (
          <p className="text-game-muted text-center animate-pulse">
            Starting game…
          </p>
        )}
      </div>

      {/* Score sidebar — hidden on game_end since PhaseGameEnd has its own scoreboard */}
      {showSidebar && (
        <aside className="lg:w-64 p-6 lg:pt-16">
          <ScoreBoard
            players={state.players}
            scores={state.scores}
            currentPlayerId={state.mySocketId}
          />
        </aside>
      )}
    </main>
  );
}
