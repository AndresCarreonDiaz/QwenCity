/**
 * Deterministic world weather. One pure function of sim time, so the engine
 * (decision prompts), the snapshot contract, and the spectator rendering all
 * agree on the same sky without any extra model calls or stored state — and
 * golden-run replays stay bit-identical (no Math.random anywhere).
 *
 * Weather changes in 3-sim-hour blocks: mostly clear, sometimes overcast,
 * occasionally a rain shower that the whole town experiences together.
 */
export type Weather = "clear" | "overcast" | "rain";

const BLOCK_MS = 3 * 60 * 60 * 1000;

/** integer hash → [0, 1), deterministic across runs and platforms */
function unitHash(n: number): number {
  let x = n | 0;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = (x >>> 16) ^ x;
  return (x >>> 0) / 4294967296;
}

export function weatherFor(t: number): Weather {
  const r = unitHash(Math.floor(t / BLOCK_MS));
  if (r < 0.16) return "rain";
  if (r < 0.38) return "overcast";
  return "clear";
}

/** a short sky phrase for decision prompts ("" when clear) */
export function weatherPhrase(t: number): string {
  const w = weatherFor(t);
  if (w === "rain") return "A light rain is falling over the town. ";
  if (w === "overcast") return "The sky is grey and overcast. ";
  return "";
}
