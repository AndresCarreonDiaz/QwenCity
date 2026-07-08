import assert from "node:assert/strict";
import { test } from "node:test";
import { Agent } from "../src/agent/agent.ts";
import { MemoryStore } from "../src/memory/store.ts";
import { MockAdapter } from "../src/model/mock.ts";
import { World, type WorldOptions } from "../src/world/world.ts";

const START = Date.UTC(2026, 6, 10, 8, 0, 0);

function buildWorld(opts: WorldOptions) {
  const model = new MockAdapter();
  const store = new MemoryStore(model);
  const world = new World(store, START, opts);
  for (const [id, name] of [["a", "Ana"], ["b", "Bo"], ["c", "Cy"]] as const) {
    world.add(new Agent({ id, name, bio: `${name} lives here.` }, store, model, { reflectionThreshold: 1000 }));
  }
  return { store, world };
}

test("default world (flags off) forms no conversational edges — behavior unchanged", async () => {
  const { store, world } = buildWorld({ stepMinutes: 15, actionMinutes: 60 });
  await world.run(6);
  assert.equal(world.edges().length, 0);
  assert.equal(store.all().filter((n) => n.kind === "dialogue").length, 0);
});

test("enableConversations forms edges and stores dialogue within one run", async () => {
  const { store, world } = buildWorld({ stepMinutes: 15, actionMinutes: 60, enableConversations: true, conversationEveryTicks: 2 });
  await world.run(6);
  assert.ok(world.edges().length > 0, "edges should form");
  assert.ok(store.all().filter((n) => n.kind === "dialogue").length > 0, "dialogue stored");
});

test("usePlans makes idle actions track the daily plan", async () => {
  const { store, world } = buildWorld({ stepMinutes: 30, actionMinutes: 600, usePlans: true });
  await world.planAll();
  assert.ok(store.all().filter((n) => n.kind === "plan").length > 0, "plans stored");
  await world.run(4);
  // with a long actionMinutes, agents mostly idle → their action should be a plan activity, not the initial label
  const actions = Object.values(world.currentActions());
  assert.ok(actions.every((a) => a !== "starting the day"), "actions advanced past the initial label via the plan");
});

test("edges() reports sorted, de-duplicated pairs with weights", async () => {
  const { world } = buildWorld({ stepMinutes: 15, actionMinutes: 60, enableConversations: true, conversationEveryTicks: 1 });
  await world.run(4);
  for (const e of world.edges()) {
    assert.ok(e.a < e.b, "pair key is sorted");
    assert.ok(e.weight >= 1);
  }
});
