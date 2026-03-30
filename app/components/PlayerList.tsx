import { useState } from "react";
import type { Player } from "../../server/types.js";

interface Props {
  players: Player[];
  currentPlayerId: string | null;
  scores?: Record<string, number>;
  isHost?: boolean;
  onRemoveBot?: (botId: string) => void;
  onUpdateBotPersonality?: (botId: string, personality: string) => void;
  onKickPlayer?: (playerId: string) => void;
}

export function PlayerList({
  players,
  currentPlayerId,
  scores,
  isHost,
  onRemoveBot,
  onUpdateBotPersonality,
  onKickPlayer,
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

  const sorted = [...players].sort((a, b) => {
    if (!!a.isBot !== !!b.isBot) return a.isBot ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((player) => {
        const isExpanded = expandedBots.has(player.id);
        const personality =
          pendingPersonalities[player.id] ?? player.botPersonality ?? "";
        // Host can expand bots to edit personality; non-host can also expand bots to view
        const canExpand = player.isBot;
        const canKick = isHost && player.id !== currentPlayerId;

        return (
          <div key={player.id} className="bg-game-card rounded-lg flex-1">
            {/* Main row */}
            <li
              className={`flex items-center gap-2 -ml-5 ${canExpand && isHost ? "cursor-pointer" : ""}`}
              onClick={canExpand && isHost ? () => toggleBot(player.id) : undefined}
            >
              <div className="w-3 flex-shrink-0 flex items-center justify-center">
                {player.isBot && isHost && (
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
              <div className="flex items-center grow gap-2 px-4 py-2">
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
                  {/* Personality info tooltip — shown to non-host for bots */}
                  {player.isBot && !isHost && personality && (
                    <PersonalityTooltip personality={personality} />
                  )}
                </div>

                {/* Score + action buttons on the right */}
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
                  {!player.isBot && canKick && onKickPlayer && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onKickPlayer(player.id);
                      }}
                      aria-label="Kick player"
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

            {/* Expanded personality section — host only */}
            {player.isBot && isHost && isExpanded && (
              <div className="px-4 pb-3 border-t border-game-border">
                <p className="text-xs text-game-muted uppercase tracking-widest mt-2 mb-1">
                  Personality
                </p>
                {onUpdateBotPersonality ? (
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

function PersonalityTooltip({ personality }: { personality: string }) {
  return (
    <span className="relative group inline-flex items-center">
      <svg
        className="w-3.5 h-3.5 text-game-muted cursor-default"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
      </svg>
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-game-surface border border-game-border text-game-text text-xs rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
        {personality}
      </span>
    </span>
  );
}
