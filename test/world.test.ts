import assert from "node:assert/strict";
import { test } from "node:test";
import { Agent } from "../src/agent/agent.ts";
import { MemoryStore } from "../src/memory/store.ts";
import { MockAdapter } from "../src/model/mock.ts";
import { World } from "../src/world/world.ts";

const START = Date.UTC(2026, 6, 9, 8, 0, 0);

function buildWorld() {
  const model = new MockAdapter();
  const store = new MemoryStore(model);
  const world = new World(store, START, { stepMinutes: 15, actionMinutes: 60 });
  for (const [id, name] of [["a", "Ana"], ["b", "Bo"]] as const) {
    world.add(new Agent({ id, name, bio: `${name} lives here.` }, store, model, { reflectionThreshold: 1000 }));
  }
  return { world, store };
}

test("tick log has exactly one entry per agent per tick", async () => {
  const { world } = buildWorld();
  await world.run(5);
  assert.equal(world.tickLog.length, 5 * 2);
});

test("sim clock advances by the configured step", async () => {
  const { world } = buildWorld();
  await world.tick();
  assert.equal(world.clock, START + 15 * 60_000);
});

test("event-driven scheduling leaves some agent-ticks idle (no decision call)", async () => {
  const { world } = buildWorld();
  await world.run(6); // actionMinutes 60 > step 15 → agents can't decide every tick
  assert.ok(world.idleAgentTicks > 0);
  assert.ok(world.decisions > 0);
});

test("agents perceive each other (co-presence memories accumulate)", async () => {
  const { world, store } = buildWorld();
  await world.run(4);
  assert.ok(store.size > 0);
  // at least one memory should reference the other agent by name
  const names = store.all().map((n) => n.description);
  assert.ok(names.some((d) => /Ana|Bo/.test(d)));
});
