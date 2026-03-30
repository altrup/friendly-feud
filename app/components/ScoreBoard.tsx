import type { Player } from "../../server/types.js";

interface Props {
  players: Player[];
  scores: Record<string, number>;
  currentPlayerId: string | null;
  /** Score change per player for the current round */
  roundScoreDeltas?: Record<string, number> | null;
  /** All guesses from the round, used to show what each player guessed */
  roundGuesses?: { guesserId: string; guess: string; matched: boolean }[] | null;
}

export function ScoreBoard({ players, scores, currentPlayerId, roundScoreDeltas, roundGuesses }: Props) {
  // Sort by score descending, ties keep join order
  const sorted = [...players].sort(
    (a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0)
  );

  // Build map of guesserId → their guesses for this round
  const guessesByPlayer = new Map<string, { guess: string; matched: boolean }[]>();
  for (const entry of roundGuesses ?? []) {
    const list = guessesByPlayer.get(entry.guesserId) ?? [];
    list.push({ guess: entry.guess, matched: entry.matched });
    guessesByPlayer.set(entry.guesserId, list);
  }

  return (
    <div className="bg-game-surface border border-game-border rounded-xl p-4">
      <h3 className="text-game-muted text-xs font-semibold uppercase tracking-widest mb-3">
        Scores
      </h3>
      <ul className="flex flex-col gap-1">
        {sorted.map((player, i) => {
          const delta = roundScoreDeltas?.[player.id];
          const guesses = guessesByPlayer.get(player.id) ?? [];
          return (
            <li
              key={player.id}
              className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${
                player.id === currentPlayerId
                  ? "bg-game-card ring-1 ring-game-gold/40"
                  : ""
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-game-muted text-xs w-4 shrink-0">{i + 1}.</span>
                <span
                  className={`text-sm font-medium shrink-0 ${
                    player.id === currentPlayerId ? "text-game-gold" : "text-game-text"
                  }`}
                >
                  {player.name}
                </span>
                {/* Guesses made this round */}
                {guesses.length > 0 && (
                  <div className="flex flex-wrap gap-1 min-w-0">
                    {guesses.map((g, j) => (
                      <span
                        key={j}
                        className={`text-xs px-1.5 py-0.5 rounded border truncate ${
                          g.matched
                            ? "border-game-success text-game-success"
                            : "border-game-border text-game-muted"
                        }`}
                      >
                        {g.guess}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {delta !== undefined && delta > 0 && (
                  <span className="text-game-success text-xs font-semibold">+{delta}</span>
                )}
                <span className="text-game-gold font-bold text-sm">
                  {scores[player.id] ?? 0}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
