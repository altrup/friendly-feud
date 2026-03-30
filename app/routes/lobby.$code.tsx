import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useGame } from "../context/GameContext.js";
import { PlayerList } from "../components/PlayerList.js";

export function meta() {
  return [{ title: "Friendly Feud | Lobby" }];
}

export default function LobbyRoute() {
  const { code } = useParams<{ code: string }>();
  const { state, startGame, leaveGame, addBot, removeBot, updateBotPersonality, kickPlayer } = useGame();
  const navigate = useNavigate();

  // SSR guard: socket is browser-only
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [categories, setCategories] = useState<string[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [selectedQuestionSet, setSelectedQuestionSet] = useState("all");
  const [customTheme, setCustomTheme] = useState("");
  const customThemePlaceholder = "Enter a custom theme…";
  const inputMirrorRef = useRef<HTMLSpanElement>(null);
  const questionSetContainerRef = useRef<HTMLDivElement>(null);
  const [inputWidth, setInputWidth] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  // Re-measure whenever the text changes so the input tracks actual rendered width
  useEffect(() => {
    if (inputMirrorRef.current) {
      setInputWidth(inputMirrorRef.current.offsetWidth);
    }
  }, [customTheme, mounted]);

  // Measure parent container width for input max-width
  useEffect(() => {
    if (!questionSetContainerRef.current) return;
    setContainerWidth(questionSetContainerRef.current.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(questionSetContainerRef.current);
    return () => observer.disconnect();
  }, [mounted]);

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
    custom:        { emoji: "🪄", label: "" },
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
          isHost={isHost}
          onRemoveBot={isHost ? removeBot : undefined}
          onUpdateBotPersonality={isHost ? updateBotPersonality : undefined}
          onKickPlayer={isHost ? kickPlayer : undefined}
        />
        {/* Add bot button — host only, lobby only */}
        {isHost && (
          <button
            onClick={() => addBot()}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-dashed border-game-border text-game-muted hover:border-game-accent hover:text-game-text text-sm transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            Add Bot
          </button>
        )}
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
              <div ref={questionSetContainerRef} className="flex flex-col items-center gap-2 max-w-sm">
                {/* Regular category buttons */}
                <div className="flex flex-wrap justify-center gap-2">
                  {[{ key: "all" }, ...categories.map((c) => ({ key: c }))].map(({ key }) => {
                    const meta = CATEGORY_META[key] ?? { emoji: "❓", label: key };
                    const selected = selectedQuestionSet === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedQuestionSet(key)}
                        className={`flex flex-col items-center justify-evenly px-3 py-2 h-16 rounded-xl border text-sm font-medium transition-colors ${
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
                {/* Custom button + inline theme input — label ties them together so clicking the button text focuses the input */}
                {(() => {
                  const selected = selectedQuestionSet === "custom";
                  const meta = CATEGORY_META["custom"] ?? { emoji: "❓", label: "Custom" };
                  return (
                    <label
                      htmlFor="custom-theme-input"
                      onClick={() => setSelectedQuestionSet("custom")}
                      className={`flex items-center gap-2 px-3 py-2 h-14 rounded-xl border text-sm font-medium transition-colors cursor-pointer overflow-hidden ${
                        selected
                          ? "bg-game-accent/20 border-game-accent text-game-text"
                          : "bg-game-surface border-game-border text-game-muted hover:border-game-accent hover:text-game-text"
                      }`}
                    >
                      {/* Hidden span mirrors input text to measure actual rendered width for proportional fonts */}
                      <span
                        ref={inputMirrorRef}
                        aria-hidden
                        className="fixed top-0 left-0 invisible pointer-events-none whitespace-pre text-sm"
                        style={{ fontFamily: "inherit" }}
                      >
                        {customTheme || customThemePlaceholder}
                      </span>
                      <span className="text-xl leading-none">{meta.emoji}</span>
                      {/* Wrapper animates width so the input never scrolls */}
                      <div style={{
                        width: inputWidth != null ? inputWidth + 4 : undefined,
                        maxWidth: containerWidth != null ? containerWidth - 100 : undefined,
                        transition: "width 0.15s ease",
                      }}>
                        <input
                          id="custom-theme-input"
                          type="text"
                          value={customTheme}
                          onFocus={() => setSelectedQuestionSet("custom")}
                          onChange={(e) => setCustomTheme(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                          placeholder={customThemePlaceholder}
                          style={{ width: inputWidth != null ? inputWidth + 16 : undefined, maxWidth: containerWidth != null ? containerWidth - 100 : undefined }}
                          className="bg-transparent border-none outline-none text-game-text placeholder:text-game-muted text-sm"
                        />
                      </div>
                    </label>
                  );
                })()}
              </div>
            </div>

            <button
              onClick={() => {
                setIsStarting(true);
                startGame(selectedQuestionSet, selectedQuestionSet === "custom" ? customTheme : undefined);
                // Re-enable after 10s in case the server never responds
                setTimeout(() => setIsStarting(false), 10_000);
              }}
              disabled={!canStart || (selectedQuestionSet === "custom" && !customTheme.trim()) || isStarting}
              className="bg-game-accent hover:bg-game-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl px-10 py-4 text-xl transition-colors"
            >
              {isStarting ? "Starting…" : "Start Game"}
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
