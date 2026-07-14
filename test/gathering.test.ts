import assert from "node:assert/strict";
import { test } from "node:test";
import { Agent } from "../src/agent/agent.ts";
import { MemoryStore } from "../src/memory/store.ts";
import { MockAdapter } from "../src/model/mock.ts";
import { locationForAction } from "../src/view/places.ts";
import { World } from "../src/world/world.ts";

const START = Date.UTC(2026, 6, 10, 8, 0, 0); // 08:00

function makeWorld() {
  const model = new MockAdapter();
  const store = new MemoryStore(model);
  const world = new World(store, START, {
    stepMinutes: 30,
    dailyGathering: { hour: 12, durationMin: 90 },
  });
  for (const [id, name] of [["maya", "Maya"], ["tom", "Tom"], ["ana", "Ana"], ["leo", "Leo"]] as const) {
    world.add(new Agent({ id, name, bio: `${name} lives here.` }, store, model));
  }
  return world;
}

test("the daily town meeting gathers the whole cast at the plaza, once", async () => {
  const world = makeWorld();
  // 08:00 → step to just before noon (7 ticks → 11:30): no event yet.
  for (let i = 0; i < 7; i++) await world.tick();
  assert.equal(world.activeEvent(world.clock), null, "no meeting before noon");

  // tick into noon → the meeting fires.
  await world.tick(); // 12:00
  const ev = world.activeEvent(world.clock);
  assert.ok(ev && ev.kind === "gathering", "meeting active at noon");
  const actions = world.currentActions();
  for (const [id, action] of Object.entries(actions)) {
    assert.match(action, /town meeting/i, `${id} should be at the meeting`);
    assert.equal(locationForAction(id, action), "plaza", `${id} should be placed at the plaza`);
  }

  // run past the 90-min window → the meeting ends and the cast disperses.
  await world.tick(); // 12:30
  await world.tick(); // 13:00
  await world.tick(); // 13:30 (window [12:00,13:30) closed)
  assert.equal(world.activeEvent(world.clock), null, "meeting over after its window");
});

test("the town meeting's topic escalates by sim-day", async () => {
  const model = new MockAdapter();
  const store = new MemoryStore(model);
  const world = new World(store, START, {
    stepMinutes: 30,
    dailyGathering: {
      hour: 12,
      durationMin: 90,
      topics: ["the RUMOR-STAGE about rent", "the NOTICE-STAGE about rent"],
    },
  });
  world.add(new Agent({ id: "maya", name: "Maya", bio: "Maya lives here." }, store, model));
  // through noon of day 2 (08:00 start, 30-min steps → 24h ≈ 48 ticks + 8 to first noon)
  for (let i = 0; i < 56; i++) await world.tick();
  const seeded = store.all().map((n) => n.description);
  assert.ok(seeded.some((d) => d.includes("RUMOR-STAGE")), "day 1 meeting used the first topic");
  assert.ok(seeded.some((d) => d.includes("NOTICE-STAGE")), "day 2 meeting escalated to the second topic");
});

test("gathering is off by default (opt-in only)", async () => {
  const model = new MockAdapter();
  const store = new MemoryStore(model);
  const world = new World(store, START, { stepMinutes: 30 });
  world.add(new Agent({ id: "maya", name: "Maya", bio: "x" }, store, model));
  for (let i = 0; i < 10; i++) await world.tick(); // through noon
  assert.equal(world.activeEvent(world.clock), null, "no meeting without the opt-in option");
});
