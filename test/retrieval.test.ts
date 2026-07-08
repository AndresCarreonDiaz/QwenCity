import assert from "node:assert/strict";
import { test } from "node:test";
import { cosine, minMaxNormalize, recencyRaw, RECENCY_DECAY } from "../src/memory/retrieval.ts";
import type { MemoryNode } from "../src/memory/types.ts";

test("cosine: identical vectors → 1, orthogonal → 0", () => {
  assert.ok(Math.abs(cosine([1, 0, 0], [1, 0, 0]) - 1) < 1e-9);
  assert.ok(Math.abs(cosine([1, 0], [0, 1])) < 1e-9);
});

test("cosine: dimension mismatch throws", () => {
  assert.throws(() => cosine([1, 2], [1, 2, 3]));
});

test("minMaxNormalize: maps to [0,1] with endpoints hit", () => {
  const out = minMaxNormalize([2, 4, 6]);
  assert.deepEqual(out, [0, 0.5, 1]);
});

test("minMaxNormalize: all-equal values → all 1 (no false zeroing)", () => {
  assert.deepEqual(minMaxNormalize([5, 5, 5]), [1, 1, 1]);
});

test("minMaxNormalize: empty → empty", () => {
  assert.deepEqual(minMaxNormalize([]), []);
});

test("recencyRaw: fresh access ≈ 1, decays with elapsed hours", () => {
  const now = Date.UTC(2026, 6, 9, 12, 0, 0);
  const base: MemoryNode = {
    id: "a:0", agentId: "a", kind: "observation", description: "x",
    importance: 5, embedding: [1], created: now, lastAccessed: now, filling: [], depth: 0,
  };
  assert.ok(Math.abs(recencyRaw(base, now) - 1) < 1e-9);
  const oneHourAgo = { ...base, lastAccessed: now - 3_600_000 };
  assert.ok(Math.abs(recencyRaw(oneHourAgo, now) - RECENCY_DECAY) < 1e-9);
  // strictly decreasing with age
  const older = { ...base, lastAccessed: now - 5 * 3_600_000 };
  assert.ok(recencyRaw(older, now) < recencyRaw(oneHourAgo, now));
});
