/**
 * Unwrap a memory description back to the underlying fact it carries.
 *
 * Dialogue memories nest as they pass along a chain —
 *   `Ana said to Bo: "Did you hear? <fact>"`
 * and after another hop the whole thing gets quoted again. When an agent goes
 * to share what it heard, we want the *fact*, not the chain of attributions, so
 * a rumor stays legible (and keyword-detectable) no matter how many times it
 * has been retold. Peels attribution wrappers and "Did you hear?" openers until
 * it reaches a stable core.
 */
export function coreFact(s: string): string {
  let x = (s ?? "").trim();
  for (let i = 0; i < 6; i++) {
    const before = x;
    // peel one attribution layer: `… said to/told …: "INNER"` (closing quote optional)
    const m = x.match(/\b(?:said to|told)\b[^:]*:\s*"?(.+?)"?\s*$/i);
    if (m) x = m[1]!.trim();
    // drop a leading "Did you hear?" opener
    x = x.replace(/^did you hear\??\s*/i, "").trim();
    if (x === before) break;
  }
  // strip a single pair of surrounding quotes
  return x.replace(/^["'](.*)["']$/s, "$1").trim();
}
