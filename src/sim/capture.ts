/**
 * DEMO CAPTURE — a small live world for real footage (video / gallery).
 *
 * Deliberately bounded (3 agents, few ticks, reflection off) to conserve the
 * free token quota. Run against real Qwen:
 *   npx tsx --env-file-if-exists=.env src/sim/capture.ts
 * Writes web/viewer.html (open it) + data/snapshot.json with authentic content.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Agent } from "../agent/agent.ts";
import { MemoryStore } from "../memory/store.ts";
import { getModel } from "../model/index.ts";
import { renderSnapshotHtml } from "../view/render.ts";
import { buildSnapshot } from "../view/snapshot.ts";
import { World } from "../world/world.ts";

const START = Date.UTC(2026, 6, 10, 8, 0, 0);
const TICKS = 3;

function heading(s: string): void {
  console.log(`\n\x1b[1m${s}\x1b[0m`);
}

async function main(): Promise<void> {
  const model = getModel();
  heading(`Demo capture — backend: ${model.name}`);
  if (model.name === "mock") {
    console.log("  (mock backend — run with --env-file-if-exists=.env for real Qwen content)");
  }

  const store = new MemoryStore(model);
  const world = new World(store, START, {
    stepMinutes: 45,
    usePlans: true,
    enableConversations: true,
    conversationEveryTicks: 2,
  });
  const cast: Array<[string, string, string]> = [
    ["maya", "Maya", "Maya runs the corner café; warm, conflict-avoidant."],
    ["tom", "Tom", "Tom is a café regular and Maya's old friend; blunt, easily hurt."],
    ["ana", "Ana", "Ana runs the bakery next door; competitive, a bit of a gossip."],
  ];
  const agents = cast.map(([id, name, bio]) => {
    const a = new Agent({ id, name, bio }, store, model, { reflectionThreshold: 100000 }); // reflection off (budget)
    world.add(a);
    return a;
  });

  await agents[0]!.perceive("Maya and Tom argued last night at the café and it still stings.", START);
  await world.planAll();
  await world.run(TICKS);

  // Audience-coupling beat: a real reply steers Maya's next action.
  heading("AUDIENCE → MAYA");
  await agents[0]!.ingestAudienceReply("judge", "life's short — just go apologize to Tom", world.clock);
  const reaction = await agents[0]!.decideAction("What should Maya do next about the situation with Tom?", world.clock);
  console.log(`  reply: "life's short — just go apologize to Tom"`);
  console.log(`  Maya → ${reaction.text}`);

  const snap = buildSnapshot({ now: world.clock, agents, store, currentActions: world.currentActions() });

  heading("THOUGHT-TICKER (authentic, newest first)");
  for (const e of snap.ticker.slice(0, 8)) console.log(`  [${e.kind}·${e.importance}] ${e.agentName}: ${e.text.slice(0, 72)}`);

  mkdirSync("web", { recursive: true });
  mkdirSync("data", { recursive: true });
  writeFileSync("web/viewer.html", renderSnapshotHtml(snap));
  writeFileSync("data/snapshot.json", JSON.stringify(snap, null, 2));

  heading("SUMMARY");
  console.log(`  backend=${model.name} · clock=${snap.clock} · agents=${snap.agents.length} · memories=${store.size} · edges=${world.edges().length}`);
  console.log(`  approx model calls this run: decisions=${world.decisions}, perceptions=${world.perceptions}`);
  console.log(`  → web/viewer.html + data/snapshot.json written`);

  // light sanity (not mock-specific)
  const ok = snap.agents.length === 3 && store.size > 0 && snap.ticker.length > 0;
  console.log("");
  console.log(ok ? "\x1b[1m\x1b[32m✓ CAPTURE OK\x1b[0m" : "\x1b[1m\x1b[31m✗ CAPTURE FAILED\x1b[0m");
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`\n\x1b[31mCAPTURE ERROR:\x1b[0m`, err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
