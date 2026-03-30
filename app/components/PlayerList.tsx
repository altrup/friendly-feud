import type { Player } from "../../server/types.js";

interface Props {
  players: Player[];
  currentPlayerId: string | null;
  scores?: Record<string, number>;
}

export function PlayerList({ players, currentPlayerId, scores }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {players.map((player) => (
        <li
          key={player.id}
          className="flex items-center justify-between bg-game-card rounded-lg px-4 py-2"
        >
          <div className="flex items-center gap-2">
            {/* Highlight the current player */}
            <span
              className={`font-medium ${
                player.id === currentPlayerId
                  ? "text-game-gold"
                  : "text-game-text"
              }`}
            >
              {player.name}
              {player.id === currentPlayerId && (
                <span className="ml-1 text-xs text-game-muted">(you)</span>
              )}
            </span>
            {player.isHost && (
              <span className="text-xs bg-game-accent/20 text-game-accent px-2 py-0.5 rounded-full">
                host
              </span>
            )}
          </div>
          {scores && (
            <span className="text-game-gold font-semibold">
              {scores[player.id] ?? 0}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
