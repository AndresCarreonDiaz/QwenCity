/**
 * SMOKE TEST — is the configured model backend live and sane?
 *
 * Backend-agnostic: runs against whatever MODEL_BACKEND resolves to. With the
 * mock it's a trivial pass; with `dashscope` (+ a key) it makes a handful of
 * real Qwen calls and checks the shapes are right — the go-live check.
 *
 * Run against real Qwen:  npx tsx --env-file=.env src/sim/smoke.ts
 */
import { getModel } from "../model/index.ts";

function heading(s: string): void {
  console.log(`\n\x1b[1m${s}\x1b[0m`);
}

async function main(): Promise<void> {
  const m = getModel();
  heading(`Backend: ${m.name} (embedDim=${m.embedDim})`);

  // 1. embeddings
  const vec = await m.embed("Maya opened the café this morning.");
  console.log(`  embed() → vector length ${vec.length}, e.g. [${vec.slice(0, 3).map((x) => x.toFixed(4)).join(", ")}, …]`);

  // 2. completion (see real output)
  const reply = await m.complete("In one short sentence, greet a regular walking into a café.", { task: "dialogue", maxTokens: 40, temperature: 0.3 });
  console.log(`  complete() → "${reply.trim()}"`);

  // 3. importance ordering: poignant should outrank mundane
  const hi = await m.scoreImportance("Maya and Tom had a terrible breakup and she is devastated.");
  const lo = await m.scoreImportance("Maya brushed her teeth.");
  console.log(`  scoreImportance() → poignant=${hi}  mundane=${lo}`);

  // ---- ASSERTIONS ----
  const checks: Array<[string, boolean]> = [
    ["embed returns a full-length numeric vector", Array.isArray(vec) && vec.length === m.embedDim && vec.every((x) => Number.isFinite(x))],
    ["complete returns non-empty text", typeof reply === "string" && reply.trim().length > 0],
    ["importance scores are in 1..10", hi >= 1 && hi <= 10 && lo >= 1 && lo <= 10],
    ["a poignant memory scores at least as high as a mundane one", hi >= lo],
  ];

  heading("CHECKS");
  let allPass = true;
  for (const [label, ok] of checks) {
    allPass &&= ok;
    console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${label}`);
  }
  console.log("");
  if (allPass) {
    console.log(`\x1b[1m\x1b[32m✓ SMOKE: PASS\x1b[0m — backend "${m.name}" is live and returning sane data.`);
  } else {
    console.log(`\x1b[1m\x1b[31m✗ SMOKE: FAIL\x1b[0m`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`\n\x1b[31mSMOKE ERROR:\x1b[0m`, err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
