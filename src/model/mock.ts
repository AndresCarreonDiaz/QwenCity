import { coreFact } from "../agent/text.ts";
import type { CompleteOptions, ModelAdapter } from "./adapter.ts";

/**
 * MockAdapter — a fully deterministic, offline stand-in for Qwen Cloud.
 *
 * It is not a language model; it is a *faithful fixture*. Its job is to make
 * the cognitive loop observably correct without spending a token:
 *   - embed()          bag-of-words hashing → cosine similarity tracks real word overlap,
 *                      so relevance-based retrieval genuinely works offline.
 *   - scoreImportance()a poignancy heuristic on the paper's 1..10 scale.
 *   - complete()       conditions visibly on the retrieved-memory block it is given,
 *                      so we can prove the agent's action references what it recalled.
 *
 * Determinism (no Math.random, no Date.now inside outputs) keeps tests stable
 * and lets the fast-forward buffer replay identically.
 */
export class MockAdapter implements ModelAdapter {
  readonly name = "mock";
  readonly embedDim: number;

  // 1024 dims (matching Qwen text-embedding-v4) keeps hash collisions rare, so
  // cosine similarity faithfully tracks shared-token overlap. A tiny space (e.g.
  // 64) lets collisions swamp the real signal and scrambles relevance ranking.
  constructor(embedDim = 1024) {
    this.embedDim = embedDim;
  }

  async embed(text: string): Promise<number[]> {
    // Non-negative bag-of-words: each token bumps its hashed slot, so cosine
    // similarity tracks shared-token overlap and is always ≥ 0 (unrelated texts
    // land near 0, not spuriously negative). This keeps relevance-based
    // retrieval monotonic in word overlap — the property the sim relies on.
    const v = new Array<number>(this.embedDim).fill(0);
    for (const t of tokenize(text)) {
      v[hash(t) % this.embedDim]! += 1;
    }
    return l2normalize(v);
  }

  async scoreImportance(memoryText: string): Promise<number> {
    const tokens = new Set(tokenize(memoryText));
    let score = 1; // baseline: mundane
    for (const [word, weight] of POIGNANT) {
      if (tokens.has(word)) score += weight;
    }
    return clamp(Math.round(score), 1, 10);
  }

  async complete(prompt: string, _opts?: CompleteOptions): Promise<string> {
    // Reflection: focal-question generation.
    if (/high-level questions/i.test(prompt)) {
      return [
        "1. What matters most to them right now?",
        "2. Which relationships are changing?",
        "3. What are they likely to do next?",
      ].join("\n");
    }
    // Reflection: insight synthesis. Cites the first two statements as evidence
    // (clamped downstream to however many were actually provided).
    if (/high-level insights/i.test(prompt)) {
      return "1. A recurring concern connects the recent events (because of 1, 2).";
    }
    // Daily plan: a deterministic schedule, activities varied per agent by hash.
    if (/hh:mm - activity/i.test(prompt)) {
      const seed = hash(prompt);
      const skeleton: Array<[number, number]> = [
        [7, 0], [8, 30], [10, 0], [12, 0], [13, 0], [15, 30], [18, 0], [20, 0], [22, 0],
      ];
      return skeleton
        .map(([h, m], i) => {
          const act =
            i === 0
              ? "waking up and morning routine"
              : i === skeleton.length - 1
                ? "winding down and sleeping"
                : ACTIVITIES[(seed + i) % ACTIVITIES.length]!;
          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} - ${act}`;
        })
        .join("\n");
    }
    // Social post: first-person line about the salient memory in the prompt.
    if (/social post/i.test(prompt)) {
      const top = firstMemoryLine(prompt);
      const fact = top ? coreFact(top) : "";
      return fact ? `POST: I can't stop thinking about this — ${fact}` : `POST: Just another day.`;
    }
    // Dialogue: the speaker shares whatever is most on their mind (their top
    // relevant memory), so information demonstrably transfers to the listener.
    if (/say next/i.test(prompt) || /^\s*SAY:/im.test(prompt)) {
      const top = firstMemoryLine(prompt);
      const fact = top ? coreFact(top) : "";
      if (fact) return `SAY: Did you hear? ${fact}`;
      return `SAY: Good to see you — anything new with you?`;
    }
    // Action decision: two lines — REASON (quotes a retrieved memory) + ACT
    // (a short, clean present-tense label chosen deterministically so the town
    // reads as alive and never nests prior action strings).
    if (/^\s*ACT:/im.test(prompt) || /two lines/i.test(prompt)) {
      const top = firstMemoryLine(prompt);
      const reason = top
        ? `Because I recall that "${top}", I want to respond to it.`
        : `Nothing pressing comes to mind, so I continue my routine.`;
      const label = ACTIVITIES[hash(prompt) % ACTIVITIES.length]!;
      return `REASON: ${reason}\nACT: ${label}`;
    }
    // Bare completion fallback: if a retrieved-memory block is present, condition
    // on it visibly so the produced text demonstrably references recall.
    const top = firstMemoryLine(prompt);
    if (top) {
      return `Because I recall that "${top}", I will act on it now.`;
    }
    // Otherwise return a stable, prompt-derived stub.
    return `[mock:${hash(prompt).toString(16).slice(0, 6)}] acknowledged.`;
  }
}

/** deterministic pool of clean action labels for the offline ticker */
const ACTIVITIES: readonly string[] = [
  "opening up the café",
  "wiping down the tables",
  "greeting a regular at the counter",
  "stepping outside for some air",
  "reading by the window",
  "reorganizing the shelves",
  "brewing a fresh pot of coffee",
  "jotting notes in a journal",
  "chatting with a neighbor",
  "taking a slow walk around the block",
];

/** words that raise poignancy toward the "10 = break-up / acceptance" end of the scale */
const POIGNANT: ReadonlyArray<readonly [string, number]> = [
  ["apologize", 4], ["apology", 4], ["sorry", 3], ["argument", 5], ["fight", 4],
  ["ignored", 4], ["hurt", 4], ["love", 5], ["breakup", 8], ["broke", 4],
  ["died", 9], ["death", 8], ["accepted", 6], ["rejected", 6], ["promotion", 6],
  ["fired", 7], ["wedding", 6], ["birth", 7], ["betrayed", 7], ["friendship", 3],
  ["values", 3], ["afraid", 4], ["cried", 5], ["confessed", 5], ["secret", 4],
];

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** FNV-1a — small, fast, deterministic string hash → unsigned 32-bit */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function l2normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum);
  if (norm === 0) return v;
  return v.map((x) => x / norm);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Pull the first memory line out of a prompt that contains a block like:
 *   RELEVANT MEMORIES:
 *   - Tom said he felt ignored ...
 *   - ...
 */
function firstMemoryLine(prompt: string): string | null {
  const lines = prompt.split("\n");
  const start = lines.findIndex((l) => /relevant memories:/i.test(l));
  if (start === -1) return null;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i]!.match(/^\s*-\s+(.*\S)\s*$/);
    if (m) return m[1]!;
    if (lines[i]!.trim() === "") continue;
    break; // block ended
  }
  return null;
}
