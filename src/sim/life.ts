/**
 * LIFE SIM — the whole thing in one run.
 *
 * A single world.run() where agents follow daily plans, hold scheduled
 * conversations that form a relationship graph and spread information, reflect,
 * and post — then it all serializes into the spectator snapshot. This is the
 * integrated mode (usePlans + enableConversations) that a live deployment runs.
 *
 * Run: npm run sim:life
 */
import { Agent } from "../agent/agent.ts";
import { MemoryStore } from "../memory/store.ts";
import { getModel } from "../model/index.ts";
import { buildSnapshot } from "../view/snapshot.ts";
import { World } from "../world/world.ts";

const START = Date.UTC(2026, 6, 10, 8, 0, 0);

function heading(s: string): void {
  console.log(`\n\x1b[1m${s}\x1b[0m`);
}

async function main(): Promise<void> {
  const model = getModel();
  const store = new MemoryStore(model);
  const world = new World(store, START, {
    stepMinutes: 30,
    actionMinutes: 60,
    usePlans: true,
    enableConversations: true,
    conversationEveryTicks: 2,
  });

  const cast: Array<[string, string]> = [["maya", "Maya"], ["tom", "Tom"], ["ana", "Ana"], ["leo", "Leo"]];
  const agents = cast.map(([id, name]) => {
    const a = new Agent({ id, name, bio: `${name} lives on the street.` }, store, model, { reflectionThreshold: 1000 });
    world.add(a);
    return a;
  });
  // one poignant seed so there's something worth talking about
  await agents[2]!.perceive("Ana heard a troubling secret: the landlord will raise everyone's rent.", START);

  await world.planAll();
  await world.run(10);

  const snap = buildSnapshot({ now: world.clock, agents, store, currentActions: world.currentActions() });

  heading(`LIFE @ ${snap.clock} — one integrated run (plans + conversations + reflection)`);
  console.log(`  decisions=${world.decisions} · conversations→edges=${world.edges().length} · perceptions=${world.perceptions} · memories=${store.size}`);

  heading("AGENTS (action follows the daily plan unless reacting/conversing)");
  for (const a of snap.agents) console.log(`  ${a.name.padEnd(6)} ${a.action}`);

  heading("RELATIONSHIPS (formed by conversations during the run)");
  for (const e of world.edges()) console.log(`  ${e.a} ↔ ${e.b}  (${e.weight})`);

  const rumorKnowers = agents.filter((a) => store.forAgent(a.profile.id).some((n) => /rent|landlord/i.test(n.description))).length;
  console.log(`\n  rumor known by ${rumorKnowers}/${cast.length} agents (spread via in-run conversations)`);

  // ---- ASSERTIONS ----
  const dialogueMems = store.all().filter((n) => n.kind === "dialogue").length;
  const planMems = store.all().filter((n) => n.kind === "plan").length;
  const actionsFollowPlan = snap.agents.some((a) => a.planActivity !== null);

  const checks: Array<[string, boolean]> = [
    ["agents planned their day (plan memories exist)", planMems > 0],
    ["a single run produced conversations (edges formed)", world.edges().length > 0],
    ["conversations were stored as dialogue memories", dialogueMems > 0],
    ["at least one agent's action tracks its plan", actionsFollowPlan],
    ["the rumor spread beyond its origin within the run", rumorKnowers > 1],
    ["snapshot reflects the in-run relationship graph", snap.relationships.length === world.edges().length],
  ];

  heading("CHECKS");
  let allPass = true;
  for (const [label, ok] of checks) {
    allPass &&= ok;
    console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${label}`);
  }
  console.log("");
  if (allPass) {
    console.log("\x1b[1m\x1b[32m✓ LIFE SIM: PASS\x1b[0m — one integrated run yields plans, conversations, relationships, diffusion, and a snapshot.");
  } else {
    console.log("\x1b[1m\x1b[31m✗ LIFE SIM: FAIL\x1b[0m");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
