import { useEffect, useState } from "react";

const STORAGE_KEY = "feud-theme";

type Theme = "light" | "dark";

function getOsTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  // null = not yet mounted; avoids hydration mismatch with SSR
  const [state, setState] = useState<{
    theme: Theme;
    isAuto: boolean;
  } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const osTheme = getOsTheme();
    if (stored === "light" || stored === "dark") {
      setState({ theme: stored, isAuto: false });
    } else {
      setState({ theme: osTheme, isAuto: true });
    }

    // When in auto mode, follow OS theme changes in real time
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function onOsChange(e: MediaQueryListEvent) {
      setState((prev) => {
        if (!prev?.isAuto) return prev;
        const newTheme: Theme = e.matches ? "dark" : "light";
        // No data-theme attr in auto mode — CSS handles it; just update React state
        return { theme: newTheme, isAuto: true };
      });
    }
    mq.addEventListener("change", onOsChange);
    return () => mq.removeEventListener("change", onOsChange);
  }, []);

  function toggle() {
    if (!state) return;
    const osTheme = getOsTheme();
    const nextTheme: Theme = state.theme === "light" ? "dark" : "light";

    if (nextTheme === osTheme) {
      // Toggling back to what OS would give — clear override, return to auto
      localStorage.removeItem(STORAGE_KEY);
      document.documentElement.removeAttribute("data-theme");
      setState({ theme: osTheme, isAuto: true });
    } else {
      // Setting a manual override
      localStorage.setItem(STORAGE_KEY, nextTheme);
      document.documentElement.setAttribute("data-theme", nextTheme);
      setState({ theme: nextTheme, isAuto: false });
    }
  }

  if (!state) return null;

  return (
    <button
      onClick={toggle}
      aria-label={
        state.theme === "light" ? "Switch to dark mode" : "Switch to light mode"
      }
      className="fixed top-4 right-4 z-50 bg-game-surface border border-game-border text-game-muted hover:text-game-text rounded-full w-9 h-9 flex items-center justify-center transition-colors"
    >
      {state.theme === "light" ? "☀️" : "🌙"}
    </button>
  );
}
