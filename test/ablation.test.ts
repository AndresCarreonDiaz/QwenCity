import assert from "node:assert/strict";
import { test } from "node:test";
import { actionDivergence, countKnowers, graphDensity } from "../src/eval/metrics.ts";
import { runScenario } from "../src/eval/scenario.ts";

test("graphDensity: 0 when no edges, 1 when fully connected", () => {
  assert.equal(graphDensity(0, 4), 0);
  assert.equal(graphDensity(6, 4), 1); // 4 agents → 6 possible pairs
});

test("countKnowers counts agents whose memories match", () => {
  const mems = [["it rained"], ["the landlord raised rent"], ["nothing"]];
  assert.equal(countKnowers(mems, /rent/i), 1);
});

test("actionDivergence: identical → 0, one differing of four → 0.25", () => {
  assert.equal(actionDivergence(["a", "b", "c"], ["a", "b", "c"]), 0);
  assert.equal(actionDivergence(["a", "b", "c", "d"], ["a", "X", "c", "d"]), 0.25);
});

test("dialogue drives information diffusion (full > ablated)", async () => {
  const full = await runScenario({ n: 4, dialogue: true, audience: false });
  const ablated = await runScenario({ n: 4, dialogue: false, audience: false });
  assert.ok(full.knowersRumor > ablated.knowersRumor);
  assert.equal(ablated.knowersRumor, 1); // rumor stays with its origin
  assert.ok(full.edges > ablated.edges);
});

test("scenario is deterministic (same config → identical actions)", async () => {
  const a = await runScenario({ n: 4, dialogue: true, audience: false });
  const b = await runScenario({ n: 4, dialogue: true, audience: false });
  assert.equal(actionDivergence(a.actions, b.actions), 0);
});

test("an audience reply causally changes the trajectory", async () => {
  const control = await runScenario({ n: 4, dialogue: true, audience: false });
  const perturbed = await runScenario({ n: 4, dialogue: true, audience: true });
  assert.ok(actionDivergence(control.actions, perturbed.actions) > 0);
});
