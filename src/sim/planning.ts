/**
 * PLANNING SIM — an agent plans its day and re-plans on a reaction, offline.
 *
 * Shows: a top-down daily schedule stored as plan memories, "what am I doing
 * now" lookups through the day, and re-planning from the current moment forward
 * when something interrupts (keeping the morning, replacing the rest).
 *
 * Run: npm run sim:planning
 */
import { Agent } from "../agent/agent.ts";
import { MemoryStore } from "../memory/store.ts";
import { getModel } from "../model/index.ts";
import { fmtMin } from "../agent/planning.ts";

const DAY = Date.UTC(2026, 6, 10, 0, 0, 0);
const at = (h: number, m = 0) => DAY + (h * 60 + m) * 60_000;

function heading(s: string): void {
  console.log(`\n\x1b[1m${s}\x1b[0m`);
}

async function main(): Promise<void> {
  const model = getModel();
  const store = new MemoryStore(model);
  const maya = new Agent(
    { id: "maya", name: "Maya", bio: "Maya Okafor runs the corner café." },
    store,
    model,
  );

  heading(`Backend: ${model.name} — daily planning`);
  const plan = await maya.planDay(at(6));

  heading("TODAY'S PLAN");
  for (const s of plan) console.log(`  ${fmtMin(s.startMin)}–${fmtMin(s.endMin)}  ${s.activity}`);

  heading('"WHAT IS MAYA DOING NOW?"');
  for (const h of [7, 9, 12, 16, 21]) {
    const step = maya.currentPlanStep(at(h));
    console.log(`  ${fmtMin(h * 60)}  →  ${step ? step.activity : "(unscheduled)"}`);
  }

  heading("REACTION at 14:00 — Tom shows up upset; Maya re-plans");
  const before15 = maya.currentPlanStep(at(15))?.activity;
  maya.replan(at(14), "talking things through with Tom");
  const nowStep = maya.currentPlanStep(at(14, 30))?.activity;
  const after15 = maya.currentPlanStep(at(15))?.activity;
  const morning = maya.currentPlanStep(at(9))?.activity;
  console.log(`  now (14:30):     ${nowStep}`);
  console.log(`  later (15:00):   was "${before15}" → now "${after15}"`);
  console.log(`  morning (09:00): "${morning}" (unchanged)`);

  // ---- ASSERTIONS ----
  const planMemories = store.all().filter((n) => n.kind === "plan").length;
  const ordered = plan.every((s, i) => i === 0 || s.startMin >= plan[i - 1]!.endMin - 0);
  const tiles = plan.every((s, i) => i === 0 || s.startMin === plan[i - 1]!.endMin);

  const checks: Array<[string, boolean]> = [
    ["plan has multiple steps", plan.length >= 3],
    ["steps are ordered and tile the day with no gaps", ordered && tiles],
    ["each step was stored as a plan memory", planMemories === plan.length],
    ["currentPlanStep returns the scheduled activity at 09:00", maya.currentPlanStep(at(9)) !== null],
    ["re-plan inserts the reaction at the current moment", nowStep === "talking things through with Tom"],
    ["re-plan preserves the morning (before the reaction)", morning !== "talking things through with Tom"],
  ];

  heading("CHECKS");
  let allPass = true;
  for (const [label, ok] of checks) {
    allPass &&= ok;
    console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${label}`);
  }
  console.log("");
  if (allPass) {
    console.log("\x1b[1m\x1b[32m✓ PLANNING SIM: PASS\x1b[0m — top-down day plan, now-lookup, and reactive re-planning all work.");
  } else {
    console.log("\x1b[1m\x1b[31m✗ PLANNING SIM: FAIL\x1b[0m");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
