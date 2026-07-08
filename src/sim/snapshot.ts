/**
 * SNAPSHOT SIM — build the frontend-facing world snapshot, offline.
 *
 * Runs a small town, has a character post, then serializes the world into the
 * JSON the spectator dashboard renders: the thought-ticker, per-agent state, the
 * relationship graph, and the feed. Writes it to data/snapshot.json.
 *
 * Run: npm run sim:snapshot
 */
import { Agent } from "../agent/agent.ts";
import { MemoryStore } from "../memory/store.ts";
import { getModel } from "../model/index.ts";
import { Feed } from "../social/feed.ts";
import { buildSnapshot } from "../view/snapshot.ts";
import { World } from "../world/world.ts";
import { converse } from "../world/conversation.ts";
import { writeFileSync, mkdirSync } from "node:fs";

const START = Date.UTC(2026, 6, 10, 8, 0, 0);
const KIND_COLOR: Record<string, string> = {
  observation: "\x1b[36m", dialogue: "\x1b[32m", reflection: "\x1b[35m", plan: "\x1b[33m", injection: "\x1b[33m\x1b[1m",
};
const RESET = "\x1b[0m";

function heading(s: string): void {
  console.log(`\n\x1b[1m${s}\x1b[0m`);
}

async function main(): Promise<void> {
  const model = getModel();
  const store = new MemoryStore(model);
  const feed = new Feed();
  const world = new World(store, START, { stepMinutes: 15, actionMinutes: 45, reactThreshold: 7 });

  const cast: Array<[string, string]> = [["maya", "Maya"], ["tom", "Tom"], ["ana", "Ana"]];
  const agents = cast.map(([id, name]) => {
    const a = new Agent({ id, name, bio: `${name} lives on the street.` }, store, model, { reflectionThreshold: 1000 });
    world.add(a);
    return a;
  });

  await agents[0]!.perceive("Maya had an argument with Tom and feels bad about it.", START);
  await world.run(6);

  // A couple of conversations so the relationship graph is populated.
  await converse(agents[0]!, agents[1]!, world.clock, store, { maxTurns: 2, topic: "how things are going" });
  await converse(agents[1]!, agents[2]!, world.clock, store, { maxTurns: 2, topic: "how things are going" });

  const draft = await agents[0]!.composePost(world.clock);
  if (draft) {
    const post = feed.addPost("maya", draft.text, draft.sourceMemoryId, world.clock);
    feed.addReply(post.id, "fan", "talk to him, it'll be okay", world.clock);
  }

  const snap = buildSnapshot({ now: world.clock, agents, store, currentActions: world.currentActions(), feed });

  heading(`SNAPSHOT @ ${snap.clock}  (${snap.stats.agents} agents · ${snap.stats.memories} memories · ${snap.stats.edges} edges · ${snap.stats.posts} posts)`);

  heading("THOUGHT-TICKER (newest first)");
  for (const e of snap.ticker.slice(0, 10)) {
    const c = KIND_COLOR[e.kind] ?? "";
    console.log(`  ${c}[${e.kind.padEnd(11)}]${RESET} ${String(e.importance).padStart(2)} ${e.agentName.padEnd(5)} ${e.text.slice(0, 60)}`);
  }

  heading("AGENTS");
  for (const a of snap.agents) console.log(`  ${a.name.padEnd(6)} action="${a.action}"  plan=${a.planActivity ?? "-"}`);

  heading("RELATIONSHIPS");
  for (const e of snap.relationships) console.log(`  ${e.a} ↔ ${e.b}  (${e.weight})`);

  heading("FEED");
  for (const p of snap.feed) console.log(`  @${p.agentId}: ${p.text}  [${p.replies} replies]`);

  // Persist for the frontend to read.
  mkdirSync("data", { recursive: true });
  writeFileSync("data/snapshot.json", JSON.stringify(snap, null, 2));

  // ---- ASSERTIONS ----
  const json = JSON.stringify(snap);
  const roundTrips = JSON.stringify(JSON.parse(json)) === json;
  const checks: Array<[string, boolean]> = [
    ["one agent view per agent, each with an action", snap.agents.length === cast.length && snap.agents.every((a) => a.action.length > 0)],
    ["ticker is non-empty and sorted newest-first", snap.ticker.length > 0 && snap.ticker.every((e, i) => i === 0 || e.t <= snap.ticker[i - 1]!.t)],
    ["ticker entries carry kind + importance + text", snap.ticker.every((e) => e.kind && e.importance >= 1 && e.text.length > 0)],
    ["relationship edges reflect the conversations that happened", snap.relationships.length > 0],
    ["the post appears in the feed with its reply counted", snap.feed.length === 1 && snap.feed[0]!.replies === 1],
    ["snapshot is JSON-serializable and round-trips", roundTrips],
  ];

  heading("CHECKS");
  let allPass = true;
  for (const [label, ok] of checks) {
    allPass &&= ok;
    console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${label}`);
  }
  console.log("");
  if (allPass) {
    console.log("\x1b[1m\x1b[32m✓ SNAPSHOT SIM: PASS\x1b[0m — the world serializes into the frontend contract (→ data/snapshot.json).");
  } else {
    console.log("\x1b[1m\x1b[31m✗ SNAPSHOT SIM: FAIL\x1b[0m");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
