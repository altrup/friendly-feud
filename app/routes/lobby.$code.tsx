import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useGame } from "../context/GameContext.js";
import { PlayerList } from "../components/PlayerList.js";

export function meta() {
  return [{ title: "Friendly Feud | Lobby" }];
}

export default function LobbyRoute() {
  const { code } = useParams<{ code: string }>();
  const { state, startGame, leaveGame } = useGame();
  const navigate = useNavigate();

  // SSR guard: socket is browser-only
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [categories, setCategories] = useState<string[]>([]);
  const [selectedQuestionSet, setSelectedQuestionSet] = useState("all");

  // Fetch available categories from the server
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: { categories: string[] }) => setCategories(data.categories))
      .catch(() => {/* silently fall back to "all" only */});
  }, []);

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

  const CATEGORY_META: Record<string, { emoji: string; label: string }> = {
    all:           { emoji: "🎲", label: "All" },
    "daily-life":  { emoji: "🏠", label: "Daily Life" },
    entertainment: { emoji: "🎬", label: "Entertainment" },
    family:        { emoji: "👨‍👩‍👧", label: "Family" },
    food:          { emoji: "🍕", label: "Food" },
    sports:        { emoji: "🏆", label: "Sports" },
    technology:    { emoji: "💻", label: "Technology" },
    travel:        { emoji: "✈️", label: "Travel" },
    work:          { emoji: "💼", label: "Work" },
  };

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

      {/* Start controls (host only) */}
      <div className="text-center flex flex-col items-center gap-6">
        {isHost ? (
          <>
            {/* Question set selector */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-game-muted text-xs uppercase tracking-widest">
                Question Set
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                {/* "All" tile always first */}
                {[{ key: "all" }, ...categories.map((c) => ({ key: c }))].map(({ key }) => {
                  const meta = CATEGORY_META[key] ?? { emoji: "❓", label: key };
                  const selected = selectedQuestionSet === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedQuestionSet(key)}
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                        selected
                          ? "bg-game-accent/20 border-game-accent text-game-text"
                          : "bg-game-surface border-game-border text-game-muted hover:border-game-accent hover:text-game-text"
                      }`}
                    >
                      <span className="text-xl leading-none">{meta.emoji}</span>
                      <span className="text-xs">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => startGame(selectedQuestionSet)}
              disabled={!canStart}
              className="bg-game-accent hover:bg-game-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl px-10 py-4 text-xl transition-colors"
            >
              Start Game
            </button>
            {!canStart && (
              <p className="text-game-muted text-sm">
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
      {/* Leave button — fixed bottom-left */}
      <button
        onClick={leaveGame}
        className="fixed bottom-4 left-4 text-game-muted text-sm underline hover:text-game-text transition-colors"
      >
        Leave game
      </button>
    </main>
  );
}
