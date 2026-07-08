import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { graphDensity } from "../src/eval/metrics.ts";
import { runScenario } from "../src/eval/scenario.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readme = readFileSync(join(root, "README.md"), "utf8");
const arch = readFileSync(join(root, "docs", "ARCHITECTURE.md"), "utf8");
const deploy = readFileSync(join(root, "docs", "DEPLOY.md"), "utf8");

test("DEPLOY.md covers the deploy essentials", () => {
  for (const needle of ["systemd", "npm run serve", "deploy/alicloud.ts", "DASHSCOPE_API_KEY", "Judge-safety"]) {
    assert.ok(deploy.includes(needle), `DEPLOY.md missing "${needle}"`);
  }
});

test("README has the submission-critical sections", () => {
  for (const heading of ["## Architecture", "rubric", "Measured results", "Qwen Cloud services", "## Quickstart", "Built during the hackathon"]) {
    assert.ok(readme.includes(heading), `README missing "${heading}"`);
  }
});

test("both docs contain a valid (balanced, typed) mermaid block", () => {
  for (const [name, doc] of [["README", readme], ["ARCHITECTURE", arch]] as const) {
    const fences = doc.match(/```mermaid/g) ?? [];
    assert.ok(fences.length >= 1, `${name} has no mermaid block`);
    // every ```mermaid opener has a matching ``` closer → total ``` count is even
    assert.equal((doc.match(/```/g) ?? []).length % 2, 0, `${name} has an unbalanced code fence`);
    assert.ok(/```mermaid\s+(flowchart|graph)/.test(doc), `${name} mermaid block isn't a flowchart/graph`);
  }
});

test("README's quoted ablation numbers match what the code actually produces", async () => {
  const N = 4;
  const full = await runScenario({ n: N, dialogue: true, audience: false });
  const ablated = await runScenario({ n: N, dialogue: false, audience: false });

  // the claims in the README, re-derived from the sim
  assert.equal(full.knowersRumor, 4, "full-society diffusion");
  assert.equal(ablated.knowersRumor, 1, "ablated diffusion");
  assert.equal(graphDensity(full.edges, N), 0.5, "full-society relationship density");
  assert.equal(graphDensity(ablated.edges, N), 0, "ablated relationship density");

  // and the README literally states those figures (drift guard)
  assert.ok(readme.includes("4/4"), 'README should state "4/4"');
  assert.ok(readme.includes("1/4"), 'README should state "1/4"');
  assert.ok(readme.includes("50%"), 'README should state "50%"');
  assert.ok(readme.includes("25%"), 'README should state "25%"');
});
