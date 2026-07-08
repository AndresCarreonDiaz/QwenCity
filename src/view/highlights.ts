import type { MemoryKind, MemoryNode } from "../memory/types.ts";

/**
 * The daily-highlight editor — USE 2 of the Salience Engine.
 *
 * The same importance score that decides what an agent *retrieves* also decides
 * what the day's recap *shows*: the memory poignancy IS the edit decision, so
 * there is no separate editor model to build or pay for. Selection is
 * importance-ranked with a near-duplicate filter (so the reel doesn't repeat the
 * same beat), then ordered chronologically for playback with the single hottest
 * beat flagged as the cold open.
 */
export interface HighlightBeat {
  t: number;
  kind: MemoryKind;
  importance: number;
  text: string;
}

export interface Recap {
  title: string;
  coldOpen: HighlightBeat | null;
  beats: HighlightBeat[];
  cliffhanger: HighlightBeat | null;
}

export interface HighlightOptions {
  /** max beats in the reel */
  k?: number;
  /** drop a candidate if its token-overlap with an already-picked beat exceeds this */
  simThreshold?: number;
}

function tokenSet(s: string): Set<string> {
  return new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** top memories by importance, near-duplicates removed, returned in importance order */
export function selectHighlights(memories: MemoryNode[], opts: HighlightOptions = {}): HighlightBeat[] {
  const k = opts.k ?? 5;
  const simThreshold = opts.simThreshold ?? 0.6;
  const ranked = [...memories].sort((a, b) => b.importance - a.importance || b.created - a.created);
  const picked: MemoryNode[] = [];
  for (const m of ranked) {
    if (picked.length >= k) break;
    const tm = tokenSet(m.description);
    if (picked.some((p) => jaccard(tokenSet(p.description), tm) > simThreshold)) continue;
    picked.push(m);
  }
  return picked.map((m) => ({ t: m.created, kind: m.kind, importance: m.importance, text: m.description }));
}

/** assemble a recap: cold open (hottest), chronological beats, and a cliffhanger (latest hot beat) */
export function buildRecap(subject: string, memories: MemoryNode[], opts: HighlightOptions = {}): Recap {
  const byImportance = selectHighlights(memories, opts);
  const coldOpen = byImportance[0] ?? null;
  const beats = [...byImportance].sort((a, b) => a.t - b.t);
  // Cliffhanger = the latest *notable* beat (leave the audience on something that
  // matters, not whatever happened to be last). Falls back to latest overall.
  const notable = byImportance.filter((b) => b.importance >= 5);
  const pool = notable.length ? notable : byImportance;
  const cliffhanger = pool.length ? [...pool].sort((a, b) => b.t - a.t)[0]! : null;
  const date = coldOpen ? new Date(coldOpen.t).toISOString().slice(0, 10) : "";
  return { title: `${subject} — ${date} in ${beats.length} beats`, coldOpen, beats, cliffhanger };
}
