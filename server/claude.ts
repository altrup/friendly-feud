// All Claude API calls are centralised here so prompts and model config are easy to find and change.

import Anthropic from "@anthropic-ai/sdk";
import type { Question } from "./types.js";

const client = new Anthropic();
const MODEL = "claude-haiku-4-5-20251001";

/**
 * Generate a Family Feud-style question for a given theme.
 * Returns null on failure so the caller can fall back to a preset question.
 */
export async function generateCustomQuestion(
  theme: string,
  previousPrompts: string[],
): Promise<string | null> {
  const avoidSection =
    previousPrompts.length > 0
      ? `\n\nDo NOT repeat any of these already-used questions:\n${previousPrompts.map((p) => `- ${p}`).join("\n")}`
      : "";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 60,
    messages: [
      {
        role: "user",
        content:
          `Generate a single Family Feud-style question on the theme "${theme}". ` +
          `Rules: direct it at the player using "you" (e.g. "Name a reason you...", ` +
          `"What's something you...", "Name a place where you...", "Name something you...", etc). ` +
          `Vary the phrasing each time; don't use the same phrase. ` +
          `It should invite many different answers, keep it fun and conversational, ` +
          `and return ONLY the question text with no extra commentary.` +
          avoidSection,
      },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text.trim() : null;
}

/**
 * Generate a bot answer in-character for the given personality.
 * Returns null on failure so the caller can use a fallback.
 */
export async function generateBotAnswer(
  question: Question,
  personality: string,
): Promise<string | null> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 20,
    messages: [
      {
        role: "user",
        content:
          `You are playing Family Feud. Your personality: "${personality}". ` +
          `Answer this question AS your character, in 1-5 words: "${question.prompt}". ` +
          `Reply with ONLY your answer — no explanation, no punctuation at the end.`,
      },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text.trim() : null;
}

/**
 * Ask Claude whether a guess semantically matches an answer for the given question.
 * Returns null on failure so the caller can fall back to basic string matching.
 */
export async function checkGuessMatch(
  question: string,
  guess: string,
  answer: string,
): Promise<boolean | null> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 10,
    messages: [
      {
        role: "user",
        content:
          `Are these semantically equivalent for Family Feud? Ignore typos, different grammatical forms (e.g., "gaming" vs "play games"), and allow broad synonyms or categories (e.g., "mobile device" vs "phone"). Answer only "yes" or "no".\nQuestion: "${question}"\nAnswer 1: "${answer}"\nAnswer 2: "${guess}"`,
      },
    ],
  });

  const text =
    response.content[0].type === "text"
      ? response.content[0].text.toLowerCase().trim()
      : "";
  return text.startsWith("yes");
}
