/**
 * TOWN SIM — a small multi-agent world running the full tick loop offline.
 *
 * Shows: event-driven scheduling (idle agents make no model calls), co-presence
 * perception, and reflection firing as poignancy accumulates. Prints a live
 * "ticker" of the run, then the instrumentation that backs the cost story.
 *
 * Run: npm run sim:town   (or: npx tsx src/sim/town.ts)
 */
import { Agent } from "../agent/agent.ts";
import { MemoryStore } from "../memory/store.ts";
import { getModel } from "../model/index.ts";
import { World } from "../world/world.ts";

const START = Date.UTC(2026, 6, 9, 8, 0, 0);

function heading(s: string): void {
  console.log(`\n\x1b[1m${s}\x1b[0m`);
}

async function main(): Promise<void> {
  const model = getModel();
  const store = new MemoryStore(model);
  // low reflection threshold so reflection is observable within a short demo run
  const world = new World(store, START, { stepMinutes: 15, actionMinutes: 45, reactThreshold: 7 });

  const cast: Array<[string, string, string, string[]]> = [
    [
      "maya", "Maya", "Maya Okafor runs the corner café; warm, conflict-avoidant, values friendships.",
      [
        "Maya had an argument with Tom last night at the café opening and it still hurts.",
        "Maya realized she values her friendship with Tom more than being right.",
      ],
    ],
    [
      "tom", "Tom", "Tom Reyes is a café regular and Maya's old friend; blunt, easily hurt.",
      [
        "Tom felt ignored and hurt when Maya brushed him off at the opening.",
        "Tom confessed to himself that he misses how close he and Maya used to be.",
      ],
    ],
    [
      "ana", "Ana", "Ana Silva runs the bakery next door; ambitious, competitive with the café.",
      [
        "Ana is afraid her bakery is losing its regulars to Maya's café.",
        "Ana heard a rumor the café landlord might raise everyone's rent.",
      ],
    ],
  ];

  const agents = cast.map(([id, name, bio]) => {
    const a = new Agent({ id, name, bio }, store, model, { reflectionThreshold: 12, reflectionWindow: 20 });
    world.add(a);
    return { id, a };
  });
  // Seed each character's backstory as memories (poignant → gives reflection something to work on).
  for (const [id, , , backstory] of cast) {
    const a = agents.find((x) => x.id === id)!.a;
    for (const m of backstory) await a.perceive(m, START);
  }

  heading(`Backend: ${model.name} — 3 agents, offline, ${16} ticks (4 sim-hours)`);
  const ticks = 16;

  heading("TICKER (● decided · ○ idle · ✦ reflected)");
  const startLen = 0;
  for (let i = 0; i < ticks; i++) {
    await world.tick();
    for (const e of world.tickLog.slice(startLen + i * cast.length)) {
      const mark = e.reflected ? "✦" : e.decided ? "●" : "○";
      const clock = new Date(e.t).toISOString().slice(11, 16);
      console.log(`  ${clock} ${mark} ${e.name.padEnd(5)} ${e.action}`);
    }
  }

  heading("RUN STATS");
  const agentTicks = ticks * cast.length;
  const skippedPct = ((world.idleAgentTicks / agentTicks) * 100).toFixed(0);
  console.log(`  agent-ticks:        ${agentTicks}`);
  console.log(`  decisions (LLM):    ${world.decisions}`);
  console.log(`  perceptions:        ${world.perceptions}`);
  console.log(`  reflections:        ${world.reflections}`);
  console.log(`  idle agent-ticks:   ${world.idleAgentTicks}  (${skippedPct}% made NO decision call — event-driven saving)`);
  console.log(`  total memories:     ${store.size}`);

  // ---- ASSERTIONS ----
  const checks: Array<[string, boolean]> = [
    ["tick log has one entry per agent per tick", world.tickLog.length === agentTicks],
    ["at least one decision was made", world.decisions > 0],
    ["some agent-ticks were idle (event-driven scheduling works)", world.idleAgentTicks > 0],
    ["at least one reflection fired", world.reflections > 0],
    ["memories accumulated across agents", store.size > cast.length],
    [
      "every reflection cites evidence and sits above depth 0",
      store.all().filter((n) => n.kind === "reflection").every((n) => n.filling.length > 0 && n.depth >= 1),
    ],
  ];

  heading("CHECKS");
  let allPass = true;
  for (const [label, ok] of checks) {
    allPass &&= ok;
    console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${label}`);
  }
  console.log("");
  if (allPass) {
    console.log("\x1b[1m\x1b[32m✓ TOWN SIM: PASS\x1b[0m — multi-agent tick loop + event-driven scheduling + reflection all working.");
  } else {
    console.log("\x1b[1m\x1b[31m✗ TOWN SIM: FAIL\x1b[0m");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
