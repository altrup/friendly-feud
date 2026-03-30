import { useState } from "react";
import { useGame } from "../context/GameContext.js";

export function meta() {
  return [
    { title: "Friendly Feud" },
    { name: "description", content: "Play Family Feud with your friends!" },
  ];
}

export default function Home() {
  const { createLobby, joinLobby, state } = useGame();

  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (createName.trim()) createLobby(createName.trim());
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (joinName.trim() && joinCode.trim()) joinLobby(joinCode.trim(), joinName.trim());
  }

  return (
    <main className="min-h-screen bg-game-bg flex flex-col items-center justify-center p-6 gap-8">
      {/* Title */}
      <div className="text-center">
        <h1 className="text-5xl font-black text-game-gold tracking-tight mb-2">
          Friendly Feud
        </h1>
        <p className="text-game-muted text-lg">
          Play Family Feud with your friends as the survey!
        </p>
      </div>

      {/* Error banner */}
      {state.error && (
        <div className="w-full max-w-md bg-game-accent/20 border border-game-accent text-game-text px-4 py-3 rounded-lg text-sm">
          {state.error}
        </div>
      )}

      <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create a game */}
        <form
          onSubmit={handleCreate}
          className="bg-game-surface border border-game-border rounded-2xl p-6 flex flex-col gap-4"
        >
          <h2 className="text-xl font-bold text-game-text">Create a Game</h2>
          <p className="text-game-muted text-sm">
            Start a new lobby and invite your friends with the room code.
          </p>
          <input
            type="text"
            placeholder="Your name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            maxLength={24}
            className="bg-game-card border border-game-border rounded-lg px-4 py-2 text-game-text placeholder-game-muted focus:outline-none focus:border-game-accent"
          />
          <button
            type="submit"
            disabled={!createName.trim()}
            className="bg-game-accent hover:bg-game-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-2 transition-colors"
          >
            Create Lobby
          </button>
        </form>

        {/* Join a game */}
        <form
          onSubmit={handleJoin}
          className="bg-game-surface border border-game-border rounded-2xl p-6 flex flex-col gap-4"
        >
          <h2 className="text-xl font-bold text-game-text">Join a Game</h2>
          <p className="text-game-muted text-sm">
            Enter the room code from your host to join their lobby.
          </p>
          <input
            type="text"
            placeholder="Your name"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            maxLength={24}
            className="bg-game-card border border-game-border rounded-lg px-4 py-2 text-game-text placeholder-game-muted focus:outline-none focus:border-game-accent"
          />
          <input
            type="text"
            placeholder="Room code (e.g. WXYZ)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={4}
            autoComplete="off"
            className="bg-game-card border border-game-border rounded-lg px-4 py-2 text-game-text placeholder-game-muted focus:outline-none focus:border-game-accent tracking-widest placeholder:tracking-normal"
          />
          <button
            type="submit"
            disabled={!joinName.trim() || joinCode.trim().length !== 4}
            className="bg-game-card hover:bg-game-card-hover disabled:opacity-40 disabled:cursor-not-allowed border border-game-accent text-game-accent font-semibold rounded-lg px-4 py-2 transition-colors"
          >
            Join Lobby
          </button>
        </form>
      </div>
    </main>
  );
}
