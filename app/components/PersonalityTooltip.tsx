import { useState, useEffect } from "react";

interface Props {
  personality: string;
}

/** Info icon that shows a bot's personality on hover (desktop) or tap (mobile). */
export function PersonalityTooltip({ personality }: Props) {
  const [open, setOpen] = useState(false);

  // Close on any document click after the icon tap opens it
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open]);

  return (
    <span className="relative group inline-flex items-center shrink-0">
      <svg
        className="w-3.5 h-3.5 text-game-muted cursor-default"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        // stopPropagation prevents the click from reaching the document listener
        // (and the collapsible parent), so the next outside click is what dismisses
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      >
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
      </svg>
      <span
        className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-game-surface border border-game-border text-game-text text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none transition-opacity z-10 ${
          open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {personality}
      </span>
    </span>
  );
}
