import { useState, useEffect, useRef } from "react";
import { useGame } from "../context/GameContext.js";
import { AnswerBoard } from "./AnswerBoard.js";
import { TimerBorder } from "./TimerBorder.js";

export function PhaseGuessing() {
  const { state, submitGuess } = useGame();
  const [guess, setGuess] = useState("");
  const questionCardRef = useRef<HTMLDivElement>(null);
  // Brief highlight when a guess result comes in
  const [flashResult, setFlashResult] = useState<{
    correct: boolean;
    text: string;
  } | null>(null);

  const isMyTurn = state.currentGuesserSessionId === state.sessionId;
  const currentGuesser = state.players.find(
    (p) => p.id === state.currentGuesserSessionId
  );

  // Show a brief flash when a guess result comes in (UI-only, no persistence needed)
  useEffect(() => {
    if (!state.lastGuessResult) return;
    const r = state.lastGuessResult;
    if (r.matched && r.matchedPlayerIds.length) {
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
      <div ref={questionCardRef} className="relative bg-game-card rounded-2xl px-6 py-6 text-center">
        <TimerBorder
          containerRef={questionCardRef}
          deadline={state.guessDeadline}
          totalDuration={30}
          color={isMyTurn ? "var(--color-game-accent)" : "var(--color-game-muted)"}
          strokeWidth={isMyTurn ? 3 : 1.5}
        />
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
        revealedAnswers={state.revealedAnswers}
        guessHistory={state.roundGuesses}
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
        </div>
      )}
    </div>
  );
}
