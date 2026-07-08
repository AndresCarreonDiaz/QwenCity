import assert from "node:assert/strict";
import { test } from "node:test";
import { Agent } from "../src/agent/agent.ts";
import { parseUtterance } from "../src/agent/dialogue.ts";
import { MemoryStore } from "../src/memory/store.ts";
import { MockAdapter } from "../src/model/mock.ts";
import { converse } from "../src/world/conversation.ts";

const T0 = Date.UTC(2026, 6, 9, 9, 0, 0);

function pair() {
  const model = new MockAdapter();
  const store = new MemoryStore(model);
  const a = new Agent({ id: "a", name: "Ana", bio: "Ana lives here." }, store, model);
  const b = new Agent({ id: "b", name: "Bo", bio: "Bo lives here." }, store, model);
  return { model, store, a, b };
}

test("parseUtterance strips the SAY: prefix", () => {
  assert.equal(parseUtterance("SAY: Hello there."), "Hello there.");
  assert.equal(parseUtterance("no prefix here"), "no prefix here");
});

test("converse stores each utterance in BOTH agents' memories", async () => {
  const { store, a, b } = pair();
  await a.perceive("Ana saw a beautiful sunrise.", T0);
  const transcript = await converse(a, b, T0 + 1e6, store, { maxTurns: 2 });
  assert.equal(transcript.length, 2);
  const aChats = store.forAgent("a").filter((n) => n.kind === "dialogue").length;
  const bChats = store.forAgent("b").filter((n) => n.kind === "dialogue").length;
  assert.equal(aChats, 2); // both turns heard by both
  assert.equal(bChats, 2);
});

test("information transfers: a fact only Ana knew ends up in Bo's memory", async () => {
  const { store, a, b } = pair();
  const RUMOR = /festival/i;
  await a.perceive("Ana heard a secret: there will be a surprise festival on Friday.", T0);
  assert.equal(store.forAgent("b").some((n) => RUMOR.test(n.description)), false); // Bo doesn't know yet

  await converse(a, b, T0 + 1e6, store, { maxTurns: 2, topic: "the most important thing I heard" });

  assert.ok(store.forAgent("b").some((n) => RUMOR.test(n.description)), "Bo should now remember the festival");
});

test("conversation alternates speakers", async () => {
  const { store, a, b } = pair();
  const t = await converse(a, b, T0, store, { maxTurns: 4 });
  assert.deepEqual(t.map((u) => u.speakerId), ["a", "b", "a", "b"]);
});
