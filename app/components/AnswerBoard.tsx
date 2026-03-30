// Displays answer slots for all players.
// Unrevealed answers show "???" until they are matched or the round ends.

import type { Player } from "../../server/types.js";

interface Props {
  players: Player[];
  matchedPlayerIds: string[];
  revealedAnswers?: Record<string, string> | null;
  /** scoreDeltas from the last guess result, used to briefly highlight new reveals */
  lastScoreDeltas?: Record<string, number>;
  /** guessHistory from round_end, used to show who guessed each answer */
  guessHistory?: { guesserId: string; guess: string; matched: boolean; matchedPlayerId: string | null }[] | null;
}

export function AnswerBoard({
  players,
  matchedPlayerIds,
  revealedAnswers,
  lastScoreDeltas,
  guessHistory,
}: Props) {
  // Build a map from answerer's socket ID to the guesser who matched it
  const guesserForAnswer = new Map<string, string>();
  if (guessHistory) {
    for (const entry of guessHistory) {
      if (entry.matched && entry.matchedPlayerId) {
        guesserForAnswer.set(entry.matchedPlayerId, entry.guesserId);
      }
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {players.map((player) => {
        const isRevealed =
          matchedPlayerIds.includes(player.id) || !!revealedAnswers;
        const answer = revealedAnswers
          ? revealedAnswers[player.id]
          : isRevealed
            ? "✓"
            : null;
        const delta = lastScoreDeltas?.[player.id];
        const guesserId = guesserForAnswer.get(player.id);
        const guesserName = guesserId
          ? players.find((p) => p.id === guesserId)?.name
          : null;

        return (
          <div
            key={player.id}
            className={`relative rounded-xl border px-4 py-3 transition-all duration-300 ${
              isRevealed
                ? "bg-game-card border-game-success/50"
                : "bg-game-surface border-game-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-game-muted text-xs">{player.name}</span>
              {/* Score pop-up on reveal */}
              {delta !== undefined && (
                <span className="text-game-gold text-xs font-bold animate-bounce">
                  +{delta}
                </span>
              )}
            </div>
            <div
              className={`mt-1 text-lg font-bold ${
                isRevealed ? "text-game-text" : "text-game-muted tracking-widest"
              }`}
            >
              {isRevealed ? (answer ?? "✓") : "???"}
            </div>
            {/* Show who guessed this answer at round end */}
            {guesserName && (
              <div className="mt-1 text-xs text-game-success">
                guessed by {guesserName}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
