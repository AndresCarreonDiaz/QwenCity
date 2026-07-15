import assert from "node:assert/strict";
import { test } from "node:test";
import { Agent } from "../src/agent/agent.ts";
import { MemoryStore } from "../src/memory/store.ts";
import { MockAdapter } from "../src/model/mock.ts";
import { locationForAction, placeById, PLACES } from "../src/view/places.ts";
import { buildSnapshot } from "../src/view/snapshot.ts";

test("locationForAction maps actions to believable places", () => {
  assert.equal(locationForAction("maya", "opening up the café"), "cafe");
  assert.equal(locationForAction("ana", "restocking the bakery pastry case"), "bakery");
  assert.equal(locationForAction("leo", "taking a slow walk in the park"), "park");
  assert.equal(locationForAction("tom", "showering and getting dressed at home"), "tom_home");
  assert.equal(locationForAction("maya", "talking with Tom"), "plaza");
  assert.equal(locationForAction("who", "doing something unclassifiable"), "plaza");
});

test("every place has coordinates in range and a unique id", () => {
  const ids = new Set<string>();
  for (const p of PLACES) {
    // x is always 0..100 (world width is fixed); y can extend past 100 into the
    // South Quarter (the world is taller than one screen — see WORLDH in app.ts).
    assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 140);
    assert.ok(!ids.has(p.id), `duplicate place ${p.id}`);
    ids.add(p.id);
    assert.equal(placeById(p.id)!.label, p.label);
  }
});

test("snapshot places each agent at a valid location and includes the map", async () => {
  const model = new MockAdapter();
  const store = new MemoryStore(model);
  const maya = new Agent({ id: "maya", name: "Maya", bio: "Maya runs the café." }, store, model);
  await maya.perceive("Maya opened the café.", Date.UTC(2026, 6, 10, 8));
  const snap = buildSnapshot({ now: Date.UTC(2026, 6, 10, 8), agents: [maya], store, currentActions: { maya: "opening up the café" } });
  assert.ok(snap.places.length >= 5);
  assert.equal(snap.agents[0]!.location, "cafe");
  assert.ok(placeById(snap.agents[0]!.location), "location must be a real place id");
});
