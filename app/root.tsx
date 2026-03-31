import { useEffect } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { GameProvider } from "./context/GameContext.js";
import { ThemeToggle } from "./components/ThemeToggle.js";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

// Runs synchronously before CSS is applied to prevent flash of wrong theme.
// If a manual override is stored, apply it; otherwise leave data-theme unset
// so the CSS prefers-color-scheme media query handles it automatically.
const themeScript = `(function(){try{var t=localStorage.getItem('feud-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: server renders no data-theme attr; the inline
    // script sets it on the client before hydration, causing a benign mismatch
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Must be first — sets data-theme before stylesheets are parsed */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeToggle />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  // Add data-keyboard-open to <body> when an input/textarea is focused so CSS
  // can add bottom padding, keeping content clear of the on-screen keyboard.
  useEffect(() => {
    const open = () => document.body.setAttribute("data-keyboard-open", "true");
    const close = () => document.body.removeAttribute("data-keyboard-open");
    document.addEventListener("focusin", (e) => {
      if (e.target instanceof HTMLElement && e.target.matches("input, textarea, [contenteditable]")) {
        open();
      }
    });
    document.addEventListener("focusout", close);
    return () => {
      document.removeEventListener("focusin", open);
      document.removeEventListener("focusout", close);
    };
  }, []);

  return (
    <GameProvider>
      <Outlet />
    </GameProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
