import { useState, useEffect, useRef } from "react";
import { useGame } from "../context/GameContext.js";

export function PhaseAnswering() {
  const { state, submitAnswer } = useGame();
  const [answer, setAnswer] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  const [dashOffset, setDashOffset] = useState(0);
  const [transitionDuration, setTransitionDuration] = useState(0);

  const hasSubmitted = state.answeredPlayerIds.includes(state.mySocketId ?? "");

  // Measure the card so the SVG overlay matches exactly
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setCardSize({ width: el.offsetWidth, height: el.offsetHeight });
    });
    ro.observe(el);
    setCardSize({ width: el.offsetWidth, height: el.offsetHeight });
    return () => ro.disconnect();
  }, []);

  // Compute perimeter of the rounded rect (rounded-2xl = 1rem = 16px)
  const strokeWidth = 3;
  const inset = strokeWidth / 2;
  const rx = 16;
  const rw = Math.max(0, cardSize.width - strokeWidth);
  const rh = Math.max(0, cardSize.height - strokeWidth);
  const perimeter = rw > 0 && rh > 0 ? 2 * (rw + rh) + rx * (2 * Math.PI - 8) : 0;

  // When the deadline or perimeter becomes known (or the tab regains visibility),
  // snap to the wall-clock-correct drain position then kick off a CSS transition
  // to the fully-drained state. Re-syncing on visibilitychange prevents the
  // animation from drifting when the browser throttles background tabs.
  useEffect(() => {
    if (!state.answerDeadline || perimeter === 0) return;

    let raf1: number, raf2: number;

    function syncAnimation() {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);

      const remaining = Math.max(0, (state.answerDeadline! - Date.now()) / 1000);
      const startOffset = perimeter * (1 - remaining / 60);

      // Snap to current position with no transition
      setTransitionDuration(0);
      setDashOffset(startOffset);

      // Two rAFs: first lets React commit the snap, second starts the transition
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setTransitionDuration(remaining);
          setDashOffset(perimeter);
        });
      });
    }

    syncAnimation();

    function handleVisibilityChange() {
      if (!document.hidden) syncAnimation();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [state.answerDeadline, perimeter]);

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
        {/* Timer border — drains via a single CSS transition, no JS polling */}
        {perimeter > 0 && state.answerDeadline && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={cardSize.width}
            height={cardSize.height}
          >
            <rect
              x={inset}
              y={inset}
              width={rw}
              height={rh}
              rx={rx}
              fill="none"
              stroke="var(--color-game-accent)"
              strokeWidth={strokeWidth}
              strokeDasharray={perimeter}
              strokeDashoffset={dashOffset}
              style={{ transition: `stroke-dashoffset ${transitionDuration}s linear` }}
            />
          </svg>
        )}
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
