import type { Player } from "../../server/types.js";

interface Props {
  players: Player[];
  scores: Record<string, number>;
  currentPlayerId: string | null;
}

export function ScoreBoard({ players, scores, currentPlayerId }: Props) {
  // Sort by score descending, ties keep join order
  const sorted = [...players].sort(
    (a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0)
  );

  return (
    <div className="bg-game-surface border border-game-border rounded-xl p-4">
      <h3 className="text-game-muted text-xs font-semibold uppercase tracking-widest mb-3">
        Scores
      </h3>
      <ul className="flex flex-col gap-1">
        {sorted.map((player, i) => (
          <li
            key={player.id}
            className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${
              player.id === currentPlayerId
                ? "bg-game-card ring-1 ring-game-gold/40"
                : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-game-muted text-xs w-4">{i + 1}.</span>
              <span
                className={`text-sm font-medium ${
                  player.id === currentPlayerId
                    ? "text-game-gold"
                    : "text-game-text"
                }`}
              >
                {player.name}
              </span>
            </div>
            <span className="text-game-gold font-mono font-bold text-sm">
              {scores[player.id] ?? 0}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
