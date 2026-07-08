import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { TickEntry } from "./world.ts";

/**
 * Recording, replay, and the fast-forward buffer — the mechanism that makes a
 * 24/7 run affordable.
 *
 * The world is generated in fast-forward into a buffer that stays AHEAD of a 1×
 * "live" playhead; spectators watch the buffered frames as if live. Because all
 * generation is therefore offline (never on a latency deadline), every model
 * call is Batch-eligible (50% off) and the demo can never "go dark" — if
 * generation stalls, the playhead simply waits, and a persisted tick log can be
 * replayed as a golden run.
 */

/** one sim-tick's worth of entries, grouped by timestamp */
export interface Frame {
  t: number;
  entries: TickEntry[];
}

export function groupIntoFrames(entries: TickEntry[]): Frame[] {
  const byT = new Map<number, TickEntry[]>();
  for (const e of entries) {
    const bucket = byT.get(e.t);
    if (bucket) bucket.push(e);
    else byT.set(e.t, [e]);
  }
  return [...byT.entries()].sort((a, b) => a[0] - b[0]).map(([t, es]) => ({ t, entries: es }));
}

// ---- persistence (NDJSON tick log) ----

export function writeTickLog(path: string, entries: TickEntry[]): void {
  mkdirSync(dirname(path), { recursive: true });
  const body = entries.map((e) => JSON.stringify(e)).join("\n");
  writeFileSync(path, entries.length ? body + "\n" : "");
}

export function appendTick(path: string, entry: TickEntry): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(entry) + "\n");
}

export function readTickLog(path: string): TickEntry[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as TickEntry);
}

// ---- fast-forward buffer ----

/**
 * Holds generated frames and a playhead. The core invariant — enforced by
 * advance() — is that the playhead never overtakes the generated frontier: you
 * can only watch what has already been produced.
 */
export class FastForwardBuffer {
  private readonly frames: Frame[] = [];
  private playhead = 0;

  /** append a freshly generated frame to the frontier */
  push(frame: Frame): void {
    this.frames.push(frame);
  }

  /** number of frames generated so far */
  get frontier(): number {
    return this.frames.length;
  }

  /** index of the next frame the viewer will see */
  get position(): number {
    return this.playhead;
  }

  /** how many frames generation is ahead of playback (the buffer depth) */
  get lead(): number {
    return this.frontier - this.playhead;
  }

  /** true when the viewer has caught up to the frontier and must wait for more generation */
  get caughtUp(): boolean {
    return this.playhead >= this.frontier;
  }

  /** reveal the next frame, or null if playback has caught up to the frontier */
  advance(): Frame | null {
    if (this.caughtUp) return null;
    return this.frames[this.playhead++] ?? null;
  }

  /** everything the viewer has seen so far */
  visible(): Frame[] {
    return this.frames.slice(0, this.playhead);
  }
}
