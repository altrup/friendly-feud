import { useState } from "react";
import { useGame } from "../context/GameContext.js";
import { AnswerBoard } from "./AnswerBoard.js";
import { ScoreBoard } from "./ScoreBoard.js";

export function PhaseRoundEnd() {
  const { state, nextRound } = useGame();
  const isHost = state.hostId === state.sessionId;
  const isLastRound = state.roundNumber >= 3;
  const [isAdvancing, setIsAdvancing] = useState(false);

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

      {/* Revealed answers with who guessed each one */}
      <AnswerBoard
        players={state.players}
        matchedPlayerIds={state.matchedPlayerIds}
        revealedAnswers={state.revealedAnswers}
        guessHistory={state.roundGuesses}
      />

      {/* Scores with each player's guesses and round delta */}
      <ScoreBoard
        players={state.players}
        scores={state.scores}
        currentPlayerId={state.sessionId}
        roundScoreDeltas={state.roundScoreDeltas}
        roundGuesses={state.roundGuesses}
      />

      {/* Advance button */}
      <div className="text-center">
        {isHost ? (
          <button
            onClick={() => { setIsAdvancing(true); nextRound(); }}
            disabled={isAdvancing}
            className="bg-game-accent hover:bg-game-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl px-8 py-3 text-lg transition-colors"
          >
            {isAdvancing ? "Loading…" : isLastRound ? "See Final Results" : "Next Round"}
          </button>
        ) : (
          <p className="text-game-muted">Waiting for host to continue…</p>
        )}
      </div>
    </div>
  );
}
