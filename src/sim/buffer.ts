/**
 * BUFFER SIM — the fast-forward buffer + persistence, offline.
 *
 * 1. Generate a world run in fast-forward, recording each tick.
 * 2. Persist the tick log to NDJSON and reload it (proving restart-resume /
 *    golden-run replay round-trips exactly).
 * 3. Play it back through the FastForwardBuffer, showing the playhead trailing
 *    the generated frontier — "as if live" — and never overtaking it.
 *
 * Run: npm run sim:buffer
 */
import { Agent } from "../agent/agent.ts";
import { MemoryStore } from "../memory/store.ts";
import { getModel } from "../model/index.ts";
import { World } from "../world/world.ts";
import { FastForwardBuffer, groupIntoFrames, readTickLog, writeTickLog } from "../world/replay.ts";

const START = Date.UTC(2026, 6, 10, 8, 0, 0);
const LOG_PATH = "data/run.ndjson";
const TICKS = 8;

function heading(s: string): void {
  console.log(`\n\x1b[1m${s}\x1b[0m`);
}

async function main(): Promise<void> {
  const model = getModel();
  const store = new MemoryStore(model);
  const world = new World(store, START, { stepMinutes: 15, actionMinutes: 45 });
  for (const [id, name] of [["a", "Ana"], ["b", "Bo"]] as const) {
    world.add(new Agent({ id, name, bio: `${name} lives here.` }, store, model, { reflectionThreshold: 1000 }));
  }

  heading(`Backend: ${model.name} — generating ${TICKS} ticks in fast-forward`);
  await world.run(TICKS);
  const frames = groupIntoFrames(world.tickLog);
  console.log(`  generated ${world.tickLog.length} entries across ${frames.length} frames`);

  // Persist + reload (restart-resume / golden-run replay).
  heading("PERSIST + RELOAD (NDJSON tick log)");
  writeTickLog(LOG_PATH, world.tickLog);
  const reloaded = readTickLog(LOG_PATH);
  const roundTrips = JSON.stringify(reloaded) === JSON.stringify(world.tickLog);
  console.log(`  wrote ${world.tickLog.length} entries → ${LOG_PATH}, reloaded ${reloaded.length} (round-trip ${roundTrips ? "OK" : "MISMATCH"})`);

  // Play back through the buffer: frontier is fully generated; playhead trails it.
  heading("PLAYBACK (playhead trails the generated frontier)");
  const buf = new FastForwardBuffer();
  for (const f of groupIntoFrames(reloaded)) buf.push(f);

  let everOvertook = false;
  const leads: number[] = [];
  while (!buf.caughtUp) {
    leads.push(buf.lead);
    const frame = buf.advance();
    if (buf.position > buf.frontier) everOvertook = true;
    const clock = new Date(frame!.t).toISOString().slice(11, 16);
    console.log(`  ▶ ${clock}  playhead ${buf.position}/${buf.frontier}  (buffer lead: ${buf.lead})`);
  }
  console.log(`  caught up: advance() now returns ${buf.advance() === null ? "null (waits for generation)" : "a frame (BUG)"}`);

  // ---- ASSERTIONS ----
  const checks: Array<[string, boolean]> = [
    ["run produced frames", frames.length > 0],
    ["tick log round-trips through NDJSON exactly", roundTrips],
    ["reloaded frame count equals generated", groupIntoFrames(reloaded).length === frames.length],
    ["playhead never overtakes the generated frontier", !everOvertook],
    ["playback reveals every generated frame", buf.position === buf.frontier],
    ["buffer starts fully generated (lead == frame count)", leads[0] === frames.length],
    ["a caught-up buffer yields null (never a phantom frame)", buf.advance() === null],
  ];

  heading("CHECKS");
  let allPass = true;
  for (const [label, ok] of checks) {
    allPass &&= ok;
    console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${label}`);
  }
  console.log("");
  if (allPass) {
    console.log("\x1b[1m\x1b[32m✓ BUFFER SIM: PASS\x1b[0m — offline generation + persistence + as-if-live playback all work.");
  } else {
    console.log("\x1b[1m\x1b[31m✗ BUFFER SIM: FAIL\x1b[0m");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
