/**
 * ABLATION — the measured claim that wins the Agent Society track.
 *
 * The track rewards a demonstrable multi-agent-vs-baseline gain. We run the same
 * deterministic world under three configs and report three numbers:
 *   • information diffusion  — does a rumor spread?         (needs dialogue)
 *   • relationship density   — do connections form?          (needs dialogue)
 *   • audience-causal divergence — does a human reply change the trajectory?
 *                                   (the metric a closed sandbox CANNOT report)
 *
 * Run: npm run sim:ablation
 */
import { actionDivergence, graphDensity } from "../eval/metrics.ts";
import { runScenario } from "../eval/scenario.ts";

const N = 4;

function heading(s: string): void {
  console.log(`\n\x1b[1m${s}\x1b[0m`);
}
function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

async function main(): Promise<void> {
  heading(`ABLATION — ${N}-agent society, deterministic offline runs`);

  const full = await runScenario({ n: N, dialogue: true, audience: false });
  const fullAgain = await runScenario({ n: N, dialogue: true, audience: false }); // determinism / control
  const noDialogue = await runScenario({ n: N, dialogue: false, audience: false });
  const withAudience = await runScenario({ n: N, dialogue: true, audience: true });

  heading("MULTI-AGENT GAIN (full society vs. dialogue-ablated)");
  console.log("  metric                     full        ablated");
  console.log(
    `  rumor diffusion            ${full.knowersRumor}/${N}         ${noDialogue.knowersRumor}/${N}`,
  );
  console.log(
    `  relationship density       ${pct(graphDensity(full.edges, N))}        ${pct(graphDensity(noDialogue.edges, N))}`,
  );

  const divControl = actionDivergence(full.actions, fullAgain.actions); // identical configs → must be 0
  const divAudience = actionDivergence(full.actions, withAudience.actions); // one injected reply

  heading("AUDIENCE-CAUSAL DIVERGENCE (the Stanford-impossible metric)");
  console.log(`  control (no audience, run twice):   ${pct(divControl)} of agents' next action changed`);
  console.log(`  one audience reply injected:        ${pct(divAudience)} of agents' next action changed`);

  heading("HEADLINE");
  console.log(
    `  A dialogue-coupled society diffuses a rumor to ${full.knowersRumor}/${N} agents where an ablated one reaches ${noDialogue.knowersRumor}/${N};`,
  );
  console.log(
    `  a single audience reply changed ${pct(divAudience)} of the society's next actions, versus ${pct(divControl)} with no audience.`,
  );

  // ---- ASSERTIONS ----
  const checks: Array<[string, boolean]> = [
    ["dialogue increases rumor diffusion", full.knowersRumor > noDialogue.knowersRumor],
    ["dialogue increases relationship density", full.edges > noDialogue.edges],
    ["ablated society does not spread the rumor", noDialogue.knowersRumor === 1],
    ["runs are deterministic (control divergence is exactly 0)", divControl === 0],
    ["an audience reply causally changes the trajectory (divergence > 0)", divAudience > 0],
  ];

  heading("CHECKS");
  let allPass = true;
  for (const [label, ok] of checks) {
    allPass &&= ok;
    console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${label}`);
  }
  console.log("");
  if (allPass) {
    console.log("\x1b[1m\x1b[32m✓ ABLATION: PASS\x1b[0m — multi-agent gain and audience-causal effect are both measured, not asserted.");
  } else {
    console.log("\x1b[1m\x1b[31m✗ ABLATION: FAIL\x1b[0m");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
