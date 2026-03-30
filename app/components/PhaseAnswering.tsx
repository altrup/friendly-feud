import { useState, useRef } from "react";
import { useGame } from "../context/GameContext.js";
import { TimerBorder } from "./TimerBorder.js";

export function PhaseAnswering() {
  const { state, submitAnswer } = useGame();
  const [answer, setAnswer] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  const hasSubmitted = state.answeredPlayerIds.includes(state.mySocketId ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (answer.trim() && !hasSubmitted) {
      submitAnswer(answer.trim());
      setAnswer("");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Question */}
      <div ref={cardRef} className="relative bg-game-card rounded-2xl px-6 py-8 text-center">
        <TimerBorder containerRef={cardRef} deadline={state.answerDeadline} totalDuration={60} />
        <p className="text-game-muted text-sm uppercase tracking-widest mb-3">
          Round {state.roundNumber} — {state.currentQuestion?.category}
        </p>
        <h2 className="text-2xl font-bold text-game-text">
          {state.currentQuestion?.prompt}
        </h2>
      </div>

      {/* Answer input */}
      {hasSubmitted ? (
        <div className="text-center text-game-success font-semibold py-4">
          Answer submitted! Waiting for others…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            placeholder="Type your answer…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={80}
            autoFocus
            className="flex-1 bg-game-card border border-game-border rounded-lg px-4 py-2 text-game-text placeholder-game-muted focus:outline-none focus:border-game-accent"
          />
          <button
            type="submit"
            disabled={!answer.trim()}
            className="bg-game-accent hover:bg-game-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-5 py-2 transition-colors"
          >
            Submit
          </button>
        </form>
      )}

      {/* Who has answered */}
      <div>
        <p className="text-game-muted text-sm mb-2">
          {state.answeredPlayerIds.length} / {state.players.length} answered
        </p>
        <div className="flex flex-wrap gap-2">
          {state.players.map((p) => (
            <span
              key={p.id}
              className={`text-sm px-3 py-1 rounded-full border ${
                state.answeredPlayerIds.includes(p.id)
                  ? "border-game-success text-game-success bg-game-success/10"
                  : "border-game-border text-game-muted"
              }`}
            >
              {p.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
