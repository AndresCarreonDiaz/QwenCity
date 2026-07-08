/**
 * DAY-2 GO/NO-GO
 *
 * The cheapest possible proof of the load-bearing mechanic. One agent must:
 *   1. perceive events and store each as a memory with an importance score + embedding
 *   2. retrieve the top-8 relevant memories by I(m) for a new situation
 *   3. produce a next action that visibly references a retrieved memory
 * ...entirely offline, deterministically, for $0.
 *
 * Run: npm run sim:day2   (or: npx tsx src/sim/day2.ts)
 * Exits non-zero if any check fails, so it doubles as CI.
 */
import { Agent } from "../agent/agent.ts";
import { MemoryStore } from "../memory/store.ts";
import { getModel } from "../model/index.ts";

const SIM_START = Date.UTC(2026, 6, 9, 8, 0, 0); // sim-day 2, 08:00
const HOUR = 3_600_000;

function heading(s: string): void {
  console.log(`\n\x1b[1m${s}\x1b[0m`);
}

const KIND_COLOR: Record<string, string> = {
  observation: "\x1b[36m", // cyan
  dialogue: "\x1b[32m", // green
  reflection: "\x1b[35m", // violet
  plan: "\x1b[33m", // amber
  injection: "\x1b[33m\x1b[1m", // bright amber
};
const RESET = "\x1b[0m";

async function main(): Promise<void> {
  const model = getModel();
  const store = new MemoryStore(model);
  const maya = new Agent(
    {
      id: "maya",
      name: "Maya",
      bio: "Maya Okafor runs the corner café. Warm, a little conflict-avoidant; values her friendships.",
    },
    store,
    model,
  );

  heading(`Backend: ${model.name} (embedDim=${model.embedDim}) — running fully offline`);

  // 1. PERCEIVE + STORE — a mix of poignant and mundane events over the morning.
  const events = [
    "Tom said last night he felt ignored at the café opening.",
    "The bakery down the street has its lights on early.",
    "It rained a little this morning.",
    "Maya bought fresh coffee beans yesterday.",
    "Maya realized she values her friendship with Tom more than being right.",
  ];
  heading("1) PERCEIVE → STORE (memory stream)");
  let t = SIM_START;
  for (const e of events) {
    const node = await maya.perceive(e, t);
    const c = KIND_COLOR[node.kind] ?? "";
    console.log(
      `  ${c}[${node.kind.padEnd(11)}]${RESET} imp=${String(node.importance).padStart(2)}  ` +
        `dim=${node.embedding.length}  ${node.description}`,
    );
    t += 10 * 60 * 1000; // 10 sim-minutes apart
  }

  // 2. RETRIEVE — a new situation; expect Tom/friendship memories to surface, mundane to sink.
  const situation = "Maya is deciding whether to apologize to Tom.";
  const now = SIM_START + 2 * HOUR;
  heading(`2) RETRIEVE top-8 by I(m)  —  situation: "${situation}"`);
  const action = await maya.decideAction(situation, now, 8);
  action.retrieved.forEach((s, i) => {
    const c = KIND_COLOR[s.node.kind] ?? "";
    console.log(
      `  #${i + 1} score=${s.score.toFixed(3)}  ` +
        `[rec ${s.parts.recency.toFixed(2)} · rel ${s.parts.relevance.toFixed(2)} · imp ${s.parts.importance.toFixed(2)}]  ` +
        `${c}${s.node.description}${RESET}`,
    );
  });

  // 3. ACT — the produced action must reference a retrieved memory.
  heading("3) ACT (conditioned on retrieval)");
  console.log(`  Maya → ${action.text}`);
  console.log(`  cited memory ids: ${action.citedMemoryIds.join(", ")}`);

  // ---- ASSERTIONS ----
  const checks: Array<[string, boolean]> = [];

  const mayaMems = store.forAgent("maya");
  checks.push([
    "every memory has importance in 1..10 and a non-empty embedding",
    mayaMems.length === events.length &&
      mayaMems.every((n) => n.importance >= 1 && n.importance <= 10 && n.embedding.length === model.embedDim),
  ]);
  checks.push(["retrieved between 1 and 8 memories", action.retrieved.length > 0 && action.retrieved.length <= 8]);

  const topDesc = action.retrieved[0]?.node.description ?? "";
  checks.push([
    "the top-ranked memory is about Tom (relevance + importance win over mundane)",
    /tom/i.test(topDesc),
  ]);

  const retrievedIds = new Set(action.retrieved.map((s) => s.node.id));
  checks.push([
    "action cites at least one memory, and every cited id was actually retrieved",
    action.citedMemoryIds.length > 0 && action.citedMemoryIds.every((id) => retrievedIds.has(id)),
  ]);

  const actionReferencesAMemory = action.retrieved.some((s) => action.text.includes(s.node.description));
  checks.push(["action text quotes the content of a retrieved memory", actionReferencesAMemory]);

  const mundane = mayaMems.find((n) => n.description.includes("rained"))!;
  const tomMem = mayaMems.find((n) => n.description.includes("ignored"))!;
  checks.push(["poignant memory outscores mundane on importance", tomMem.importance > mundane.importance]);

  heading("GO/NO-GO CHECKS");
  let allPass = true;
  for (const [label, ok] of checks) {
    allPass &&= ok;
    console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${label}`);
  }

  console.log("");
  if (allPass) {
    console.log("\x1b[1m\x1b[32m✓ DAY-2 GO/NO-GO: PASS\x1b[0m — perceive→store→retrieve→act chain works offline.");
  } else {
    console.log("\x1b[1m\x1b[31m✗ DAY-2 GO/NO-GO: FAIL\x1b[0m");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
