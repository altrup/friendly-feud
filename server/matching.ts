// Answer matching logic.
// Basic: case-insensitive, whitespace-trimmed string equality.
// AI path: calls Claude API for semantic similarity (opt-in via USE_AI_MATCHING=true in .env).

import { checkGuessMatchBatch } from "./claude.js";

/** Normalize a string for comparison: trim and lowercase. */
export function normalize(str: string): string {
  return str.trim().toLowerCase();
}

/** Basic exact match (case-insensitive, trimmed). */
export function basicMatch(guess: string, answer: string): boolean {
  return normalize(guess) === normalize(answer);
}

/**
 * Groups a map of sessionId -> answer by their normalized form.
 * Returns Map<normalizedAnswer, sessionId[]>.
 * Used by scoring to detect shared answers (multiple players gave the same answer).
 */
export function groupAnswers(
  answers: Map<string, string>
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const [sessionId, answer] of answers) {
    const key = normalize(answer);
    const group = groups.get(key) ?? [];
    group.push(sessionId);
    groups.set(key, group);
  }
  return groups;
}

/**
 * Matches a guess against a map of candidate answers (sessionId → answer).
 * Only considers candidates whose socket IDs are NOT in the excludedIds set (already matched).
 *
 * Returns the normalized answer key that matched, or null if no match.
 */
export function matchGuess(
  guess: string,
  answers: Map<string, string>,
  excludedIds: Set<string>
): string | null {
  const normalizedGuess = normalize(guess);
  for (const [sessionId, answer] of answers) {
    if (excludedIds.has(sessionId)) continue;
    if (normalize(answer) === normalizedGuess) {
      return normalize(answer);
    }
  }
  return null;
}

// ─── Optional AI matching ──────────────────────────────────────────────────────

/**
 * Matches a guess against a map of candidate answers using the configured strategy.
 * In AI mode, checks all candidates in a single API call.
 *
 * Returns all matched socket IDs (empty array if none match).
 */
export async function matchGuessAsync(
  question: string,
  guess: string,
  answers: Map<string, string>,
  excludedIds: Set<string>
): Promise<string[]> {
  const useAI = process.env.USE_AI_MATCHING === "true";

  // Collect candidates (sessionId + answer) that haven't been matched yet
  const candidates: { sessionId: string; answer: string }[] = [];
  for (const [sessionId, answer] of answers) {
    if (!excludedIds.has(sessionId)) candidates.push({ sessionId, answer });
  }

  if (!useAI) {
    return candidates
      .filter(({ answer }) => basicMatch(guess, answer))
      .map(({ sessionId }) => sessionId);
  }

  // Single API call for all candidates
  try {
    const results = await checkGuessMatchBatch(
      question,
      guess,
      candidates.map((c) => c.answer),
    );
    if (results !== null) {
      return candidates
        .filter((_, i) => results[i])
        .map(({ sessionId }) => sessionId);
    }
  } catch (e) {
    console.log(e);
  }

  // Fall back to basic matching if AI call fails
  return candidates
    .filter(({ answer }) => basicMatch(guess, answer))
    .map(({ sessionId }) => sessionId);
}
