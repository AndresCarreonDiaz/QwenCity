import assert from "node:assert/strict";
import { test } from "node:test";
import type { MemoryNode } from "../src/memory/types.ts";
import { buildRecap, selectHighlights } from "../src/view/highlights.ts";

const T0 = Date.UTC(2026, 6, 10, 8, 0, 0);
let seq = 0;
function mem(importance: number, tMin: number, description: string): MemoryNode {
  return {
    id: `m${seq++}`, agentId: "a", kind: "observation", description,
    importance, embedding: [], created: T0 + tMin * 60_000, lastAccessed: T0, filling: [], depth: 0,
  };
}

test("selectHighlights ranks by importance and caps at k", () => {
  const beats = selectHighlights(
    [mem(1, 0, "swept floor"), mem(9, 10, "a huge dramatic fight erupted"), mem(3, 20, "bought beans"), mem(7, 30, "a tearful reconciliation happened")],
    { k: 2, simThreshold: 0.5 },
  );
  assert.equal(beats.length, 2);
  assert.equal(beats[0]!.importance, 9); // highest first
  assert.equal(beats[1]!.importance, 7);
});

test("selectHighlights drops near-duplicates", () => {
  const beats = selectHighlights(
    [mem(8, 0, "Maya and Tom had a painful argument and she felt betrayed"), mem(8, 1, "Maya and Tom had a painful argument, she felt betrayed"), mem(2, 5, "it rained")],
    { k: 5, simThreshold: 0.5 },
  );
  // the two argument memories collapse to one; rain survives
  assert.equal(beats.filter((b) => /argument/i.test(b.text)).length, 1);
  assert.ok(beats.some((b) => /rained/i.test(b.text)));
});

test("buildRecap: cold open is hottest, beats are chronological", () => {
  const memories = [mem(2, 0, "morning routine"), mem(9, 120, "the big reveal"), mem(5, 60, "a quiet worry")];
  const recap = buildRecap("Ana", memories, { k: 5 });
  assert.equal(recap.coldOpen!.importance, 9);
  assert.deepEqual(recap.beats.map((b) => b.t), [...recap.beats.map((b) => b.t)].sort((a, b) => a - b));
  assert.equal(recap.cliffhanger!.t, T0 + 120 * 60_000); // latest selected
});

test("buildRecap handles an empty day", () => {
  const recap = buildRecap("Nobody", [], {});
  assert.equal(recap.coldOpen, null);
  assert.equal(recap.beats.length, 0);
  assert.equal(recap.cliffhanger, null);
});
