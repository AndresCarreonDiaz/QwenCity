/**
 * HIGHLIGHTS SIM — the importance-driven daily recap, offline.
 *
 * A day of mixed events (mundane + poignant) plus an audience reply; the editor
 * picks the day's top beats purely from the stored importance scores — no extra
 * model call — and assembles a recap. Shows the audience's message earning a
 * place in the reel exactly because it carried high salience.
 *
 * Run: npm run sim:highlights
 */
import { Agent } from "../agent/agent.ts";
import { MemoryStore } from "../memory/store.ts";
import { getModel } from "../model/index.ts";
import { buildRecap } from "../view/highlights.ts";

const START = Date.UTC(2026, 6, 10, 8, 0, 0);
const min = (m: number) => START + m * 60_000;

function heading(s: string): void {
  console.log(`\n\x1b[1m${s}\x1b[0m`);
}

async function main(): Promise<void> {
  const model = getModel();
  const store = new MemoryStore(model);
  const maya = new Agent({ id: "maya", name: "Maya", bio: "Maya runs the café." }, store, model);

  // A day: mostly mundane, a few poignant, plus a near-duplicate to test dedupe.
  const day: Array<[number, string]> = [
    [0, "Maya wiped down the tables."],
    [30, "Maya restocked the pastry case."],
    [90, "Maya had a painful argument with Tom and felt betrayed."],
    [95, "Maya had a painful argument with Tom, she felt betrayed and upset."], // near-duplicate of the above
    [150, "It drizzled a little outside."],
    [240, "Maya realized she values her friendship with Tom more than being right."],
    [360, "Maya swept the floor before closing."],
  ];
  for (const [m, text] of day) await maya.perceive(text, min(m));
  // An audience reply (high salience via +2) lands mid-afternoon.
  await maya.ingestAudienceReply("fan", "please just apologize to Tom, you'll regret it if you don't", min(300));

  const memories = store.forAgent("maya");
  const recap = buildRecap("Maya", memories, { k: 5, simThreshold: 0.5 });

  heading(`DAILY RECAP — ${recap.title}`);
  console.log(`  COLD OPEN  [imp ${recap.coldOpen?.importance}] ${recap.coldOpen?.text}`);
  heading("REEL (chronological)");
  for (const b of recap.beats) {
    const clock = new Date(b.t).toISOString().slice(11, 16);
    console.log(`  ${clock}  [${b.kind}·${b.importance}]  ${b.text}`);
  }
  console.log(`\n  CLIFFHANGER  [imp ${recap.cliffhanger?.importance}] ${recap.cliffhanger?.text}`);

  // ---- ASSERTIONS ----
  const beats = recap.beats;
  const maxImp = Math.max(...memories.map((m) => m.importance));
  const injection = memories.find((m) => m.kind === "injection")!;
  const dupCount = beats.filter((b) => /argu(ment|ed)/i.test(b.text)).length;

  const checks: Array<[string, boolean]> = [
    ["recap has beats", beats.length > 0 && beats.length <= 5],
    ["cold open is the highest-importance memory of the day", recap.coldOpen!.importance === maxImp],
    ["reel is in chronological order", beats.every((b, i) => i === 0 || b.t >= beats[i - 1]!.t)],
    ["near-duplicate argument memories were de-duplicated to one beat", dupCount === 1],
    ["a mundane beat was dropped (mundane count < total events)", beats.filter((b) => b.importance <= 1).length < 3],
    ["the audience reply earned a beat on salience alone", beats.some((b) => b.text.includes(injection.description.slice(-30)) || /apolog/i.test(b.text))],
  ];

  heading("CHECKS");
  let allPass = true;
  for (const [label, ok] of checks) {
    allPass &&= ok;
    console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${label}`);
  }
  console.log("");
  if (allPass) {
    console.log("\x1b[1m\x1b[32m✓ HIGHLIGHTS SIM: PASS\x1b[0m — the importance score doubles as the edit decision (one score, three uses).");
  } else {
    console.log("\x1b[1m\x1b[31m✗ HIGHLIGHTS SIM: FAIL\x1b[0m");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
