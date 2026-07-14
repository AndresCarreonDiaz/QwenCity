/**
 * A character's current mood, derived deterministically from the sentiment of
 * their most recent memories. Pure and side-effect-free so the snapshot, the
 * tests, and any replay agree — no model call, no randomness. This is what lets
 * the spectator read the emotional weather of the town at a glance (the reality-
 * TV hook: you can see someone is troubled before they say a word).
 */
export type MoodKey = "happy" | "warm" | "excited" | "worried" | "tense" | "sad" | "neutral";

/** keyword → mood. Explicit emotion words dominate topic words via WEIGHTS. */
const LEXICON: Array<[MoodKey, string[]]> = [
  ["happy", ["happy", "smile", "smiling", "laugh", "glad", "joy", "grateful", "wonderful", "delight", "cheer", "content", "bright", "proud", "relief", "relieved"]],
  ["warm", ["friend", "companionship", "kind", "support", "comfort", "caring", "hug", "together", "welcome", "greet", "neighbo", "gentle", "fond", "reassur"]],
  ["excited", ["excite", "thrilled", "eager", "hopeful", "look forward", "can't wait", "cannot wait", "inspired", "buzzing", "energ", "spark", "thrill"]],
  ["worried", ["worry", "worried", "anxious", "anxiet", "afraid", "scared", "nervous", "dread", "uneasy", "fear", "afford", "rent", "landlord", "secret", "threat", "trouble", "bills"]],
  ["tense", ["angry", "upset", "argue", "argument", "snap", "hurt", "frustrat", "rival", "jealous", "jealousy", "defensive", "competit", "resent", "clash", "cold", "bitter", "tense"]],
  ["sad", ["sad", "lonely", "alone", "misses", "missing", "cry", "tears", "sigh", "unsent", "invisible", "empty", "ache", "regret", "wistful", "heavy", "sorrow", "quietly"]],
];

/** later memories weigh more (a recency ramp over the window) */
function recencyWeight(i: number, n: number): number {
  return 1 + (i / Math.max(1, n - 1)) * 2; // oldest ×1 → newest ×3
}

/**
 * Score the given memory descriptions (oldest→newest) and return the dominant
 * mood, or "neutral" when nothing registers. `texts` is typically the last
 * ~12-14 memories for one agent.
 */
export function moodFor(texts: string[]): MoodKey {
  const score: Record<string, number> = {};
  texts.forEach((raw, i) => {
    const t = raw.toLowerCase();
    const w = recencyWeight(i, texts.length);
    for (const [mood, words] of LEXICON) {
      for (const kw of words) {
        if (t.includes(kw)) score[mood] = (score[mood] ?? 0) + w;
      }
    }
  });
  let best: MoodKey = "neutral";
  let bestScore = 0;
  // deterministic tie-break: LEXICON order (emotional > topical, roughly)
  for (const [mood] of LEXICON) {
    const s = score[mood] ?? 0;
    if (s > bestScore) {
      bestScore = s;
      best = mood;
    }
  }
  return best;
}
