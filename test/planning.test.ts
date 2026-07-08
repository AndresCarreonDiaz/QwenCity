import assert from "node:assert/strict";
import { test } from "node:test";
import { Agent } from "../src/agent/agent.ts";
import { fmtMin, parsePlan, replanFrom, stepAt } from "../src/agent/planning.ts";
import { MemoryStore } from "../src/memory/store.ts";
import { MockAdapter } from "../src/model/mock.ts";

const DAY = Date.UTC(2026, 6, 10, 0, 0, 0);
const at = (h: number, m = 0) => DAY + (h * 60 + m) * 60_000;

test("fmtMin formats minutes-since-midnight", () => {
  assert.equal(fmtMin(0), "00:00");
  assert.equal(fmtMin(9 * 60 + 5), "09:05");
});

test("parsePlan sorts, tiles the day, and ends at midnight", () => {
  const plan = parsePlan("10:00 - open shop\n07:00 - wake up\n22:00 - sleep");
  assert.deepEqual(plan.map((s) => s.activity), ["wake up", "open shop", "sleep"]);
  assert.equal(plan[0]!.startMin, 420);
  assert.equal(plan[0]!.endMin, 600); // next step's start
  assert.equal(plan[2]!.endMin, 1440); // midnight
});

test("stepAt finds the active step and returns null before the first", () => {
  const plan = parsePlan("08:00 - a\n12:00 - b");
  assert.equal(stepAt(plan, 9 * 60)!.activity, "a");
  assert.equal(stepAt(plan, 13 * 60)!.activity, "b");
  assert.equal(stepAt(plan, 6 * 60), null);
});

test("replanFrom keeps the past and replaces the current slot", () => {
  const plan = parsePlan("08:00 - open\n12:00 - lunch\n15:00 - restock");
  const replanned = replanFrom(plan, 13 * 60, "handle an emergency");
  assert.equal(stepAt(replanned, 9 * 60)!.activity, "open"); // morning preserved
  assert.equal(stepAt(replanned, 13 * 60 + 30)!.activity, "handle an emergency");
  assert.equal(stepAt(replanned, 16 * 60)!.activity, "restock"); // later resumes
});

test("planDay stores each step as a plan memory and sets currentPlanStep", async () => {
  const model = new MockAdapter();
  const store = new MemoryStore(model);
  const maya = new Agent({ id: "maya", name: "Maya", bio: "Maya runs the café." }, store, model);
  const plan = await maya.planDay(at(6));
  assert.ok(plan.length >= 3);
  assert.equal(store.all().filter((n) => n.kind === "plan").length, plan.length);
  assert.ok(maya.currentPlanStep(at(9)) !== null);
});
