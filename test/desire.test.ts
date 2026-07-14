import assert from "node:assert/strict";
import { test } from "node:test";
import { Agent } from "../src/agent/agent.ts";
import { MemoryStore } from "../src/memory/store.ts";
import { MockAdapter } from "../src/model/mock.ts";
import type { CompleteOptions } from "../src/model/adapter.ts";
import { buildSnapshot } from "../src/view/snapshot.ts";

const T0 = Date.UTC(2026, 6, 10, 8, 0, 0);

/** Records every prompt it is asked to complete, then defers to the mock. */
class Capturing extends MockAdapter {
  readonly prompts: string[] = [];
  async complete(prompt: string, opts?: CompleteOptions): Promise<string> {
    this.prompts.push(prompt);
    return super.complete(prompt, opts);
  }
}

const DESIRE = "Tom secretly hopes to reconcile with Maya but is too proud to say so.";

test("a character's desire is woven into every cognitive module (act / plan / speak / reflect / post)", async () => {
  const model = new Capturing();
  const store = new MemoryStore(model);
  const tom = new Agent({ id: "tom", name: "Tom", bio: "Tom is a café regular.", desire: DESIRE }, store, model, {
    reflectionThreshold: 1,
  });
  const maya = new Agent({ id: "maya", name: "Maya", bio: "Maya runs the café." }, store, model);

  await tom.perceive("Tom saw Maya across the street and looked away.", T0);
  await tom.planDay(T0);
  await tom.decideAction("It is morning. What does Tom do?", T0 + 1000);
  await tom.speak(maya.profile, [], T0 + 2000, "the two of them");
  await tom.composePost(T0 + 3000, { threshold: 1 });
  if (tom.needsReflection()) await tom.reflect(T0 + 4000);

  // Each module's prompt should carry the standing desire, so behaviour is
  // motivated by the arc — not just the situation.
  const carries = (test: RegExp) => model.prompts.some((p) => test.test(p) && p.includes(DESIRE));
  assert.ok(carries(/ACT:/), "action prompt carries the desire");
  assert.ok(carries(/HH:MM - activity/i), "daily-plan prompt carries the desire");
  assert.ok(carries(/say next/i), "dialogue prompt carries the desire");
  assert.ok(carries(/social post/i), "post prompt carries the desire");
});

test("a plain profile adds no 'Deep down' line — deterministic mock stays byte-identical", async () => {
  const model = new Capturing();
  const store = new MemoryStore(model);
  const plain = new Agent({ id: "x", name: "X", bio: "X keeps a shop." }, store, model);
  await plain.decideAction("It is morning. What does X do?", T0);
  const actPrompt = model.prompts.find((p) => /ACT:/.test(p))!;
  assert.ok(actPrompt.includes("X keeps a shop."), "bio still present");
  assert.ok(!/Deep down/.test(actPrompt), "no desire line is injected when there is no desire");
});

test("buildSnapshot surfaces a character's desire so the viewer can root for it", async () => {
  const model = new MockAdapter();
  const store = new MemoryStore(model);
  const tom = new Agent({ id: "tom", name: "Tom", bio: "Tom is a café regular.", desire: DESIRE }, store, model);
  const plain = new Agent({ id: "x", name: "X", bio: "X keeps a shop." }, store, model);
  await tom.perceive("Tom opened the door.", T0);
  await plain.perceive("X swept up.", T0);

  const snap = buildSnapshot({ now: T0 + 1000, agents: [tom, plain], store, currentActions: {} });
  assert.equal(snap.agents.find((v) => v.id === "tom")!.desire, DESIRE);
  assert.equal(snap.agents.find((v) => v.id === "x")!.desire, undefined);
});
