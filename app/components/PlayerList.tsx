import { useState } from "react";
import type { Player } from "../../server/types.js";

interface Props {
  players: Player[];
  currentPlayerId: string | null;
  scores?: Record<string, number>;
  isHost?: boolean;
  onRemoveBot?: (botId: string) => void;
  onUpdateBotPersonality?: (botId: string, personality: string) => void;
}

export function PlayerList({
  players,
  currentPlayerId,
  scores,
  isHost,
  onRemoveBot,
  onUpdateBotPersonality,
}: Props) {
  const [expandedBots, setExpandedBots] = useState<Set<string>>(new Set());
  // Track pending edits locally so the input doesn't wait for a round-trip
  const [pendingPersonalities, setPendingPersonalities] = useState<
    Record<string, string>
  >({});

  function toggleBot(id: string) {
    setExpandedBots((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handlePersonalityChange(botId: string, value: string) {
    setPendingPersonalities((prev) => ({ ...prev, [botId]: value }));
  }

  function handlePersonalityBlur(botId: string) {
    const value = pendingPersonalities[botId];
    if (value !== undefined && onUpdateBotPersonality) {
      onUpdateBotPersonality(botId, value);
    }
  }

  return (
    <ul className="flex flex-col gap-2">
      {players.map((player) => {
        const isExpanded = expandedBots.has(player.id);
        const personality =
          pendingPersonalities[player.id] ?? player.botPersonality ?? "";

        return (
          <div className="bg-game-card rounded-lg flex-1">
            {/* Main row */}

            <li
              key={player.id}
              className={`flex items-center gap-2 -ml-5 ${player.isBot ? "cursor-pointer" : ""}`}
              onClick={player.isBot ? () => toggleBot(player.id) : undefined}
            >
              <div className="w-3 flex-shrink-0 flex items-center justify-center">
                {player.isBot && (
                  <svg
                    className={`w-3 h-3 text-game-muted transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </div>
              <div
                className={`flex items-center grow gap-2 px-4 py-2 ${player.isBot ? "cursor-pointer" : ""}`}
              >
                {/* Name + badges */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span
                    className={`font-medium ${
                      player.id === currentPlayerId
                        ? "text-game-gold"
                        : "text-game-text"
                    }`}
                  >
                    {player.name}
                    {player.id === currentPlayerId && (
                      <span className="ml-1 text-xs text-game-muted">
                        (you)
                      </span>
                    )}
                  </span>
                  {player.isHost && (
                    <span className="text-xs bg-game-accent/20 text-game-accent px-2 py-0.5 rounded-full">
                      host
                    </span>
                  )}
                  {player.isBot && (
                    <span className="text-xs bg-game-surface border border-game-border text-game-muted px-2 py-0.5 rounded-full">
                      bot
                    </span>
                  )}
                </div>

                {/* Score + remove button on the right */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {scores && (
                    <span className="text-game-gold font-semibold">
                      {scores[player.id] ?? 0}
                    </span>
                  )}
                  {player.isBot && onRemoveBot && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveBot(player.id);
                      }}
                      aria-label="Remove bot"
                      className="text-game-muted hover:text-red-400 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </li>

            {/* Expanded personality section */}
            {player.isBot && isExpanded && (
              <div className="px-4 pb-3 border-t border-game-border">
                <p className="text-xs text-game-muted uppercase tracking-widest mt-2 mb-1">
                  Personality
                </p>
                {isHost && onUpdateBotPersonality ? (
                  <input
                    type="text"
                    value={personality}
                    onChange={(e) =>
                      handlePersonalityChange(player.id, e.target.value)
                    }
                    onBlur={() => handlePersonalityBlur(player.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    placeholder="Describe the bot's personality…"
                    className="w-full bg-game-surface border border-game-border text-game-text placeholder:text-game-muted rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-game-accent"
                  />
                ) : (
                  <p className="text-sm text-game-text">
                    {personality || (
                      <span className="text-game-muted italic">
                        No personality set
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </ul>
  );
}
