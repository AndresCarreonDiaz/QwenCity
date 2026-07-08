import type { MemoryNode } from "../memory/types.ts";

/**
 * Reflection prompt builders + parsers, following Park et al. §3:
 * accumulate poignancy → when it crosses a threshold, ask for a few focal
 * questions → retrieve per question → synthesize insights that cite their
 * evidence → store each insight as a higher-depth "reflection" memory whose
 * `filling` points back at the memories it came from (the reflection tree).
 *
 * These are pure functions so they can be unit-tested and so any ModelAdapter
 * (mock now, Qwen later) plugs in unchanged.
 */

export function buildFocalPrompt(bio: string, name: string, recent: MemoryNode[]): string {
  const lines = recent.map((m, i) => `${i + 1}. ${m.description}`).join("\n");
  return [
    bio,
    `Recent memories about ${name}:`,
    lines,
    ``,
    `Given only the information above, what are the 3 most salient high-level questions we can answer about ${name}?`,
  ].join("\n");
}

/** parse a numbered/bulleted list into up to `max` trimmed questions */
export function parseFocalQuestions(text: string, max = 3): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/^\s*(?:\d+[.)]|[-*])\s*/, "").trim();
    if (line.length > 0) out.push(line);
    if (out.length >= max) break;
  }
  return out;
}

export function buildInsightPrompt(
  bio: string,
  name: string,
  question: string,
  mems: MemoryNode[],
): string {
  const lines = mems.map((m, i) => `${i + 1}. ${m.description}`).join("\n");
  return [
    bio,
    `Statements relevant to "${question}":`,
    lines,
    ``,
    `What high-level insights can you infer about ${name} from the above statements?`,
    `(example format: insight (because of 1, 5, 3))`,
  ].join("\n");
}

export interface ParsedInsight {
  text: string;
  /** 1-based indices into the statement list the insight was inferred from */
  evidenceIdx: number[];
}

/**
 * Parse lines shaped like `Klaus is dedicated to research (because of 1, 2, 8)`.
 * Indices are clamped to [1, maxIdx] and de-duplicated; lines without an
 * evidence clause are skipped (an insight must cite what produced it).
 */
export function parseInsights(text: string, maxIdx: number): ParsedInsight[] {
  const out: ParsedInsight[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/^\s*(?:\d+[.)]|[-*])\s*/, "").trim();
    // Match the "(because of 1, 2)" clause wherever it appears; tolerate any
    // trailing punctuation an LLM might append after the closing paren.
    const m = line.match(/^(.*?)\s*\(because of\s+([\d,\s]+)\)/i);
    if (!m) continue;
    const insightText = m[1]!.trim();
    if (!insightText) continue;
    const idx = Array.from(
      new Set(
        m[2]!
          .split(/[,\s]+/)
          .map((s) => parseInt(s, 10))
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= maxIdx),
      ),
    );
    if (idx.length === 0) continue;
    out.push({ text: insightText, evidenceIdx: idx });
  }
  return out;
}
