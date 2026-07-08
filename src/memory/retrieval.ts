import type { MemoryNode } from "./types.ts";

/**
 * The retrieval scoring math, matching the shipped Generative Agents code:
 *
 *   I(m) = 0.5·recency + 3.0·relevance + 2.0·importance
 *
 * with each of the three components min-max normalized to [0,1] across the
 * candidate set before the weighted sum. relevance dominates (3×), which is the
 * real behavior of the released code (the paper's text used all-1 weights).
 */
export const RETRIEVAL_WEIGHTS = { recency: 0.5, relevance: 3.0, importance: 2.0 } as const;

/** per-sim-hour recency decay (paper: 0.995) */
export const RECENCY_DECAY = 0.995;

const MS_PER_HOUR = 3_600_000;

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`embedding dim mismatch: ${a.length} vs ${b.length}`);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i]!;
    const bv = b[i]!;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** recency = decay ^ (hours since the memory was last accessed), relative to `now` */
export function recencyRaw(node: MemoryNode, now: number): number {
  const hours = Math.max(0, (now - node.lastAccessed) / MS_PER_HOUR);
  return RECENCY_DECAY ** hours;
}

/**
 * Min-max normalize to [0,1]. When every value is equal (no spread), the
 * component carries no ranking signal, so we map all to 1.0 — matching the
 * released code's behavior and avoiding a divide-by-zero that would zero out a
 * whole component.
 */
export function minMaxNormalize(values: number[]): number[] {
  if (values.length === 0) return [];
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo;
  if (span === 0) return values.map(() => 1);
  return values.map((v) => (v - lo) / span);
}
