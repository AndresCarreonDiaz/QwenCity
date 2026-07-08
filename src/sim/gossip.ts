/**
 * GOSSIP SIM — emergent information diffusion, offline.
 *
 * One agent starts with a rumor. Through a chain of short conversations, the
 * rumor spreads: each listener stores what it hears and can pass it on. We track
 * how many agents "know" the rumor after each conversation — the information-
 * diffusion curve that becomes a headline metric in the ablation (full society
 * vs. a dialogue-ablated baseline where nothing can spread).
 *
 * Run: npm run sim:gossip
 */
import { Agent } from "../agent/agent.ts";
import { MemoryStore } from "../memory/store.ts";
import { getModel } from "../model/index.ts";
import { converse } from "../world/conversation.ts";

const START = Date.UTC(2026, 6, 9, 9, 0, 0);
const RUMOR = /rent|landlord/i;

function heading(s: string): void {
  console.log(`\n\x1b[1m${s}\x1b[0m`);
}

async function main(): Promise<void> {
  const model = getModel();
  const store = new MemoryStore(model);

  const cast: Array<[string, string]> = [
    ["ana", "Ana"],
    ["bo", "Bo"],
    ["cy", "Cy"],
    ["di", "Di"],
  ];
  const agents = new Map(
    cast.map(([id, name]) => [id, new Agent({ id, name, bio: `${name} lives on the same street.` }, store, model)]),
  );

  // Seed everyone with some mundane memories, and give ONLY Ana the rumor
  // (worded with a poignant word so it outranks the mundane on importance).
  for (const [id, name] of cast) {
    await agents.get(id)!.perceive(`${name} watered the plants this morning.`, START);
    await agents.get(id)!.perceive(`${name} noticed the weather is mild today.`, START);
  }
  await agents.get("ana")!.perceive(
    "Ana heard a troubling secret: the landlord will raise everyone's rent next month.",
    START,
  );

  const knows = (id: string): boolean => store.forAgent(id).some((n) => RUMOR.test(n.description));
  const knowerCount = (): number => cast.filter(([id]) => knows(id)).length;

  heading("Backend: " + model.name + " — rumor diffusion across 4 agents");
  console.log(`  seeded knowers: ${knowerCount()} (${cast.filter(([id]) => knows(id)).map(([, n]) => n).join(", ")})`);

  // A chain of conversations; measure diffusion after each.
  const chain: Array<[string, string]> = [
    ["ana", "bo"],
    ["bo", "cy"],
    ["cy", "di"],
  ];
  const curve: number[] = [knowerCount()];
  let t = START + 3_600_000;
  heading("CONVERSATIONS");
  for (const [x, y] of chain) {
    const transcript = await converse(agents.get(x)!, agents.get(y)!, t, store, {
      maxTurns: 2,
      topic: "the most important thing I heard recently",
    });
    for (const u of transcript) console.log(`  ${u.speakerName}: ${u.text}`);
    const n = knowerCount();
    curve.push(n);
    console.log(
      `  \x1b[2m→ after ${agents.get(x)!.profile.name}↔${agents.get(y)!.profile.name}: ` +
        `${n}/${cast.length} now know the rumor\x1b[0m`,
    );
    t += 3_600_000;
  }

  heading("DIFFUSION CURVE");
  console.log(`  knowers over time: ${curve.join(" → ")}  (of ${cast.length})`);

  // ---- ASSERTIONS ----
  const checks: Array<[string, boolean]> = [
    ["only Ana knew the rumor at the start", curve[0] === 1],
    ["the rumor spread beyond its origin", knowerCount() > 1],
    ["the rumor reached the far end of the chain (Di)", knows("di")],
    ["diffusion is monotonic non-decreasing", curve.every((v, i) => i === 0 || v >= curve[i - 1]!)],
    ["every agent's dialogue was stored in both parties' memories", store.all().filter((n) => n.kind === "dialogue").length >= chain.length * 2 * 2],
  ];

  heading("CHECKS");
  let allPass = true;
  for (const [label, ok] of checks) {
    allPass &&= ok;
    console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${label}`);
  }
  console.log("");
  if (allPass) {
    console.log("\x1b[1m\x1b[32m✓ GOSSIP SIM: PASS\x1b[0m — dialogue transfers information; the society diffuses a rumor end-to-end.");
  } else {
    console.log("\x1b[1m\x1b[31m✗ GOSSIP SIM: FAIL\x1b[0m");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
