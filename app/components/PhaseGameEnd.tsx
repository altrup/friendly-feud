import { useNavigate } from "react-router";
import { useGame } from "../context/GameContext.js";
import { ScoreBoard } from "./ScoreBoard.js";

export function PhaseGameEnd() {
  const { state } = useGame();
  const navigate = useNavigate();
  const winner = state.gameEnd?.winner;

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
          currentPlayerId={state.mySocketId}
        />
      </div>

      <button
        onClick={() => navigate("/")}
        className="bg-game-accent hover:bg-game-accent-hover text-white font-bold rounded-xl px-8 py-3 text-lg transition-colors"
      >
        Play Again
      </button>
    </div>
  );
}
