// Answer matching logic.
// Basic: case-insensitive, whitespace-trimmed string equality.
// AI path: calls Claude API for semantic similarity (opt-in via USE_AI_MATCHING=true in .env).

/** Normalize a string for comparison: trim and lowercase. */
export function normalize(str: string): string {
  return str.trim().toLowerCase();
}

/** Basic exact match (case-insensitive, trimmed). */
export function basicMatch(guess: string, answer: string): boolean {
  return normalize(guess) === normalize(answer);
}

/**
 * Groups a map of socketId→answer by their normalized form.
 * Returns Map<normalizedAnswer, socketId[]>.
 * Used by scoring to detect shared answers (multiple players gave the same answer).
 */
export function groupAnswers(
  answers: Map<string, string>
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const [socketId, answer] of answers) {
    const key = normalize(answer);
    const group = groups.get(key) ?? [];
    group.push(socketId);
    groups.set(key, group);
  }
  return groups;
}

/**
 * Matches a guess against a map of candidate answers (socketId → answer).
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
  for (const [socketId, answer] of answers) {
    if (excludedIds.has(socketId)) continue;
    if (normalize(answer) === normalizedGuess) {
      return normalize(answer);
    }
  }
  return null;
}

// ─── Optional AI matching ──────────────────────────────────────────────────────

/**
 * AI-powered semantic matching using the Claude API.
 * Only called when USE_AI_MATCHING=true is set in the environment.
 * Falls back to basicMatch if the API call fails.
 */
async function aiMatch(guess: string, answer: string): Promise<boolean> {
  try {
    // Dynamic import so the Anthropic SDK is only loaded when needed
    // @ts-ignore — optional dependency, only required when USE_AI_MATCHING=true
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: `Are these two answers semantically equivalent for a Family Feud-style game? Typos or misspellings should be ignored if the intent is clear. Answer only "yes" or "no".\nAnswer 1: "${answer}"\nAnswer 2: "${guess}"`,
        },
      ],
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text.toLowerCase().trim()
        : "";
    return text.startsWith("yes");
  } catch (e) {
    console.log(e);
    // If AI is unavailable, fall back to basic matching
    return basicMatch(guess, answer);
  }
}

/**
 * Matches a guess against a map of candidate answers using the configured strategy.
 * In AI mode, checks each candidate individually (slower but more forgiving).
 *
 * Returns the first matched socket ID, or null.
 */
export async function matchGuessAsync(
  guess: string,
  answers: Map<string, string>,
  excludedIds: Set<string>
): Promise<string | null> {
  const useAI = process.env.USE_AI_MATCHING === "true";

  for (const [socketId, answer] of answers) {
    if (excludedIds.has(socketId)) continue;

    const matched = useAI
      ? await aiMatch(guess, answer)
      : basicMatch(guess, answer);

    if (matched) return socketId;
  }
  return null;
}
