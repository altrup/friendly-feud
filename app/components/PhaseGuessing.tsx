import { useState, useEffect } from "react";
import { useGame } from "../context/GameContext.js";
import { AnswerBoard } from "./AnswerBoard.js";

export function PhaseGuessing() {
  const { state, submitGuess, passTurn } = useGame();
  const [guess, setGuess] = useState("");
  // Brief highlight when a guess result comes in
  const [flashResult, setFlashResult] = useState<{
    correct: boolean;
    text: string;
  } | null>(null);

  const isMyTurn = state.currentGuesserSocketId === state.mySocketId;
  const currentGuesser = state.players.find(
    (p) => p.id === state.currentGuesserSocketId
  );

  // Show guess result flash for 2 seconds
  useEffect(() => {
    if (!state.lastGuessResult) return;
    const r = state.lastGuessResult;
    if (r.matched) {
      setFlashResult({ correct: true, text: `✓ "${r.matchedAnswer}" — matched!` });
    } else {
      setFlashResult({ correct: false, text: `✗ "${r.guess}" — no match` });
    }
    const t = setTimeout(() => setFlashResult(null), 2500);
    return () => clearTimeout(t);
  }, [state.lastGuessResult]);

  function handleGuess(e: React.FormEvent) {
    e.preventDefault();
    if (guess.trim() && isMyTurn) {
      submitGuess(guess.trim());
      setGuess("");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Question */}
      <div className="bg-game-card rounded-2xl px-6 py-6 text-center">
        <p className="text-game-muted text-sm uppercase tracking-widest mb-2">
          Round {state.roundNumber} — Guessing
        </p>
        <h2 className="text-xl font-bold text-game-text">
          {state.currentQuestion?.prompt}
        </h2>
      </div>

      {/* Guess result flash */}
      {flashResult && (
        <div
          className={`text-center font-semibold py-3 px-4 rounded-lg transition-all ${
            flashResult.correct
              ? "bg-game-success/20 text-game-success border border-game-success/30"
              : "bg-game-accent/20 text-game-accent border border-game-accent/30"
          }`}
        >
          {flashResult.text}
        </div>
      )}

      {/* Answer board */}
      <AnswerBoard
        players={state.players}
        matchedPlayerIds={state.matchedPlayerIds}
        lastScoreDeltas={
          state.lastGuessResult?.matched
            ? state.lastGuessResult.scoreDeltas
            : undefined
        }
      />

      {/* Guesser indicator */}
      <div className="text-center">
        {isMyTurn ? (
          <p className="text-game-gold font-bold text-lg animate-pulse">
            It&apos;s your turn to guess!
          </p>
        ) : (
          <p className="text-game-muted">
            <span className="text-game-text font-semibold">
              {currentGuesser?.name ?? "Someone"}
            </span>{" "}
            is guessing…
          </p>
        )}
      </div>

      {/* Guess input — only for the active guesser */}
      {isMyTurn && (
        <div className="flex flex-col gap-2">
          <form onSubmit={handleGuess} className="flex gap-3">
            <input
              type="text"
              placeholder="Type a guess…"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              maxLength={80}
              autoFocus
              className="flex-1 bg-game-card border border-game-border rounded-lg px-4 py-2 text-game-text placeholder-game-muted focus:outline-none focus:border-game-accent"
            />
            <button
              type="submit"
              disabled={!guess.trim()}
              className="bg-game-accent hover:bg-game-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-5 py-2 transition-colors"
            >
              Guess
            </button>
          </form>
          <button
            onClick={passTurn}
            className="text-game-muted text-sm underline hover:text-game-text transition-colors self-start"
          >
            Pass turn
          </button>
        </div>
      )}
    </div>
  );
}
