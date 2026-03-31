// Scoring logic for Friendly Feud.
//
// Rules:
//  - Unique answer match (only one player gave that answer):
//      guesser + matched player each earn 100 points.
//  - Shared answer match (N players gave the same answer):
//      guesser + all N matched players each earn floor(100 / N) points.

import { groupAnswers } from "./matching.js";

/**
 * Given a successful guess and the full answers map, compute the score deltas
 * for all affected players (guesser + everyone whose answer was matched).
 *
 * @param guess       The guessed string (already confirmed to match)
 * @param guesserId   Socket ID of the player who guessed
 * @param matchedIds  Socket IDs of all players whose answer was matched (1+ for shared answers)
 * @returns Map of sessionId → points earned this guess
 */
export function computeScoreDeltas(
  guesserId: string,
  matchedIds: string[]
): Map<string, number> {
  const deltas = new Map<string, number>();
  const points = Math.floor(100 / matchedIds.length);

  // All matched players earn points
  for (const id of matchedIds) {
    deltas.set(id, (deltas.get(id) ?? 0) + points);
  }

  // Guesser also earns the same points (added on top if guesser matched their own answer)
  deltas.set(guesserId, (deltas.get(guesserId) ?? 0) + points);

  return deltas;
}

/**
 * Given the full answer map and a matched normalized answer key, find all
 * socket IDs that gave that answer (handles shared answers).
 */
export function findMatchedIds(
  answers: Map<string, string>,
  matchedNormalizedAnswer: string
): string[] {
  const groups = groupAnswers(answers);
  return groups.get(matchedNormalizedAnswer) ?? [];
}
