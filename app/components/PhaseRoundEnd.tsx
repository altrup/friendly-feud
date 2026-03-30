import { useGame } from "../context/GameContext.js";
import { AnswerBoard } from "./AnswerBoard.js";
import { ScoreBoard } from "./ScoreBoard.js";

export function PhaseRoundEnd() {
  const { state, nextRound } = useGame();
  const isHost = state.hostId === state.mySocketId;
  const isLastRound = state.roundNumber >= 3;

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-black text-game-gold">
          Round {state.roundNumber} Complete!
        </h2>
        {state.currentQuestion && (
          <p className="text-game-muted mt-1 text-sm">
            "{state.currentQuestion.prompt}"
          </p>
        )}
      </div>

      {/* Revealed answers */}
      <AnswerBoard
        players={state.players}
        matchedPlayerIds={state.players.map((p) => p.id)}
        revealedAnswers={state.roundAnswers}
      />

      {/* Scores */}
      <ScoreBoard
        players={state.players}
        scores={state.scores}
        currentPlayerId={state.mySocketId}
      />

      {/* Advance button */}
      <div className="text-center">
        {isHost ? (
          <button
            onClick={nextRound}
            className="bg-game-accent hover:bg-game-accent-hover text-white font-bold rounded-xl px-8 py-3 text-lg transition-colors"
          >
            {isLastRound ? "See Final Results" : "Next Round"}
          </button>
        ) : (
          <p className="text-game-muted">Waiting for host to continue…</p>
        )}
      </div>
    </div>
  );
}
