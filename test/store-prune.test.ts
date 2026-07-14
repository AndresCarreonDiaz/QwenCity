import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryStore } from "../src/memory/store.ts";
import { MockAdapter } from "../src/model/mock.ts";

test("store prunes to maxNodes, keeping the most important + most recent", async () => {
  const store = new MemoryStore(new MockAdapter(), { maxNodes: 50 });
  // one clearly high-importance memory, added first (oldest)
  const vip = await store.add({
    agentId: "a",
    kind: "reflection",
    description: "A pivotal, dramatic betrayal that changes everything.",
    now: 0,
    importanceBias: 10,
  });
  // flood with 200 mundane observations
  for (let i = 0; i < 200; i++) {
    await store.add({ agentId: "a", kind: "observation", description: `mundane note ${i}`, now: i + 1 });
  }
  assert.ok(store.size <= 50, `size ${store.size} should be capped at 50`);
  assert.ok(store.all().some((n) => n.id === vip.id), "the high-importance memory survives even though it is oldest");
  assert.ok(store.all().some((n) => n.description === "mundane note 199"), "the most recent memory survives");
  assert.ok(!store.all().some((n) => n.description === "mundane note 0"), "the oldest mundane memory is forgotten");
});

test("store is unbounded by default (sims + ablation stay deterministic)", async () => {
  const store = new MemoryStore(new MockAdapter());
  for (let i = 0; i < 120; i++) {
    await store.add({ agentId: "a", kind: "observation", description: `n${i}`, now: i });
  }
  assert.equal(store.size, 120);
});
