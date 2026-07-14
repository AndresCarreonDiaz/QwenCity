import assert from "node:assert/strict";
import { test } from "node:test";
import { Agent } from "../src/agent/agent.ts";
import { MemoryStore } from "../src/memory/store.ts";
import { MockAdapter } from "../src/model/mock.ts";
import { World } from "../src/world/world.ts";
import { SEASON, seasonSchedule } from "../src/server/liveworld.ts";

const START = Date.UTC(2026, 6, 10, 8, 0, 0); // day 10, 08:00 → dayOffset 0
const SEED = "ARC2-SEED: a mysterious stranger arrived in town.";

function worldWithSeed() {
  const model = new MockAdapter();
  const store = new MemoryStore(model);
  const world = new World(store, START, {
    stepMinutes: 30,
    arcSeeds: [{ onDay: 1, text: SEED, agentIndex: 2 }], // Ana perceives it on sim-day offset 1
  });
  for (const [id, name] of [["maya", "Maya"], ["tom", "Tom"], ["ana", "Ana"], ["leo", "Leo"]] as const) {
    world.add(new Agent({ id, name, bio: `${name} lives here.` }, store, model));
  }
  return { world, store };
}

function countSeed(store: MemoryStore) {
  return store.all().filter((n) => n.description.includes("ARC2-SEED")).length;
}

test("an arc seed does not fire before its sim-day", async () => {
  const { world, store } = worldWithSeed();
  // 08:00 + 31×30min = 23:30 the same day (still dayOffset 0)
  for (let i = 0; i < 31; i++) await world.tick();
  assert.equal(countSeed(store), 0, "seed must not fire on day 0");
});

test("an arc seed fires exactly once, on its day, for the named agent", async () => {
  const { world, store } = worldWithSeed();
  for (let i = 0; i < 31; i++) await world.tick(); // 23:30, dayOffset 0
  assert.equal(countSeed(store), 0);
  await world.tick(); // 00:00 next day → dayOffset 1 → fires
  assert.equal(countSeed(store), 1, "seed fires once it reaches its day");
  // it landed in the named agent's stream (agentIndex 2 = Ana)
  assert.ok(store.forAgent("ana").some((n) => n.description.includes("ARC2-SEED")), "Ana perceived the seed");
  // and stays fired-once across many further ticks (dedupe)
  for (let i = 0; i < 60; i++) await world.tick();
  assert.equal(countSeed(store), 1, "seed does not re-fire");
});

test("season schedule flattens topics and aligns each arc's seed to its start day", () => {
  const { topics, arcSeeds } = seasonSchedule(SEASON);
  // one topic schedule spanning every arc
  assert.equal(topics.length, SEASON.reduce((n, a) => n + a.topics.length, 0));
  // each seeded arc's onDay = cumulative topic count of the arcs before it, with the right agent
  let day = 0;
  const expected: Array<{ onDay: number; agentIndex: number }> = [];
  for (const a of SEASON) {
    if (a.seedText && a.seedAgent !== undefined) expected.push({ onDay: day, agentIndex: a.seedAgent });
    day += a.topics.length;
  }
  assert.deepEqual(arcSeeds.map((s) => ({ onDay: s.onDay, agentIndex: s.agentIndex })), expected);
  // arc 0 (the rent) is seeded at init, never via arcSeeds — no seed fires during it
  assert.ok(arcSeeds.every((s) => s.onDay >= SEASON[0]!.topics.length), "no seed lands inside the rent arc");
  // every seed is a real hook, and the season actually rotates (more than one arc)
  assert.ok(arcSeeds.length >= 3, "the season adds several arcs after the rent");
  assert.ok(arcSeeds.every((s) => s.text.length > 20));
});

test("arc seeds are off by default (opt-in only)", async () => {
  const model = new MockAdapter();
  const store = new MemoryStore(model);
  const world = new World(store, START, { stepMinutes: 30 });
  world.add(new Agent({ id: "maya", name: "Maya", bio: "x" }, store, model));
  for (let i = 0; i < 60; i++) await world.tick();
  assert.equal(countSeed(store), 0, "no seeds fire without the opt-in option");
});
