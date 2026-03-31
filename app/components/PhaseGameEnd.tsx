import { useGame } from "../context/GameContext.js";
import { ScoreBoard } from "./ScoreBoard.js";

export function PhaseGameEnd() {
  const { state, playAgain, leaveGame } = useGame();
  const winner = state.gameEnd?.winner;
  const isHost = state.hostId === state.sessionId;

  return (
    <div className="flex flex-col gap-8 items-center">
      {/* Winner announcement */}
      <div className="text-center">
        <p className="text-game-muted text-sm uppercase tracking-widest mb-2">
          Game Over
        </p>
        {winner && (
          <>
            <div className="text-5xl mb-2">🏆</div>
            <h2 className="text-3xl font-black text-game-gold">
              {winner.name} wins!
            </h2>
            <p className="text-game-muted mt-1">
              {winner.score} point{winner.score !== 1 ? "s" : ""}
            </p>
          </>
        )}
      </div>

      {/* Final scoreboard */}
      <div className="w-full max-w-sm">
        <ScoreBoard
          players={state.players}
          scores={state.scores}
          currentPlayerId={state.sessionId}
        />
      </div>

      {isHost ? (
        <button
          onClick={playAgain}
          className="bg-game-accent hover:bg-game-accent-hover text-white font-bold rounded-xl px-8 py-3 text-lg transition-colors"
        >
          Play Again
        </button>
      ) : (
        <p className="text-game-muted animate-pulse">
          Waiting for the host to start a new game…
        </p>
      )}
      <button
        onClick={leaveGame}
        className="z-50 text-game-muted text-sm underline hover:text-game-text transition-colors"
      >
        Leave game
      </button>
    </div>
  );
}
