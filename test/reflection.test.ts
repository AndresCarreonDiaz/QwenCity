import assert from "node:assert/strict";
import { test } from "node:test";
import { Agent } from "../src/agent/agent.ts";
import { parseFocalQuestions, parseInsights } from "../src/agent/reflection.ts";
import { MemoryStore } from "../src/memory/store.ts";
import { MockAdapter } from "../src/model/mock.ts";

const T0 = Date.UTC(2026, 6, 9, 8, 0, 0);

test("parseFocalQuestions strips numbering/bullets and caps at max", () => {
  const q = parseFocalQuestions("1. First?\n2) Second?\n- Third?\n4. Fourth?", 3);
  assert.deepEqual(q, ["First?", "Second?", "Third?"]);
});

test("parseInsights extracts text + clamped, de-duplicated evidence indices", () => {
  const out = parseInsights("1. Klaus cares about research (because of 1, 3, 3, 99)", 3);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.text, "Klaus cares about research");
  assert.deepEqual(out[0]!.evidenceIdx, [1, 3]); // 99 clamped out, dup removed
});

test("parseInsights skips lines with no evidence clause", () => {
  assert.equal(parseInsights("Just a floating claim with no citation", 5).length, 0);
});

test("the threshold gate stays closed after only mundane input", async () => {
  const model = new MockAdapter();
  const store = new MemoryStore(model);
  const agent = new Agent({ id: "k", name: "Klaus", bio: "Klaus studies cities." }, store, model, {
    reflectionThreshold: 100,
  });
  await agent.perceive("It rained this morning.", T0); // mundane, importance 1
  // needsReflection() is the gate the World checks; a single mundane memory
  // must not open it. (reflect() itself is unconditional by design — the caller
  // gates it — so we assert the gate, not reflect()'s output.)
  assert.equal(agent.needsReflection(), false);
});

test("reflection fires past threshold and builds tree nodes with evidence", async () => {
  const model = new MockAdapter();
  const store = new MemoryStore(model);
  const agent = new Agent({ id: "k", name: "Klaus", bio: "Klaus studies cities." }, store, model, {
    reflectionThreshold: 12,
  });
  // poignant events accumulate importance quickly
  await agent.perceive("Klaus had an argument with his advisor and felt hurt.", T0);
  await agent.perceive("Klaus loves his research but feels rejected by the department.", T0 + 6e5);
  await agent.perceive("Klaus confessed he is afraid his promotion was betrayed.", T0 + 12e5);

  assert.equal(agent.needsReflection(), true);
  const reflections = await agent.reflect(T0 + 2e6);

  assert.ok(reflections.length > 0, "should produce at least one reflection");
  for (const r of reflections) {
    assert.equal(r.kind, "reflection");
    assert.ok(r.depth >= 1, "reflection sits above raw observations");
    assert.ok(r.filling.length > 0, "reflection cites evidence");
    // evidence ids must be real memories in the store
    const ids = new Set(store.all().map((n) => n.id));
    assert.ok(r.filling.every((id) => ids.has(id)));
  }
  // accumulator reset after reflecting
  assert.equal(agent.needsReflection(), false);
});
