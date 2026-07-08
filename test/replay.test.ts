import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { FastForwardBuffer, groupIntoFrames, readTickLog, writeTickLog } from "../src/world/replay.ts";
import type { TickEntry } from "../src/world/world.ts";

function entry(t: number, agentId: string): TickEntry {
  return { t, agentId, name: agentId.toUpperCase(), action: "doing something", reflected: false, decided: true };
}

test("groupIntoFrames buckets entries by timestamp, in time order", () => {
  const frames = groupIntoFrames([entry(200, "a"), entry(100, "a"), entry(100, "b")]);
  assert.equal(frames.length, 2);
  assert.equal(frames[0]!.t, 100);
  assert.equal(frames[0]!.entries.length, 2);
  assert.equal(frames[1]!.t, 200);
});

test("tick log round-trips through NDJSON", () => {
  const path = join(tmpdir(), `thefeed-replay-${process.pid}.ndjson`);
  const entries = [entry(100, "a"), entry(100, "b"), entry(200, "a")];
  try {
    writeTickLog(path, entries);
    assert.deepEqual(readTickLog(path), entries);
  } finally {
    if (existsSync(path)) rmSync(path);
  }
});

test("reading a missing tick log yields an empty array", () => {
  assert.deepEqual(readTickLog(join(tmpdir(), "thefeed-does-not-exist.ndjson")), []);
});

test("FastForwardBuffer: playhead trails frontier and never overtakes it", () => {
  const buf = new FastForwardBuffer();
  for (let i = 0; i < 3; i++) buf.push({ t: i, entries: [] });
  assert.equal(buf.frontier, 3);
  assert.equal(buf.lead, 3);

  let seen = 0;
  while (!buf.caughtUp) {
    buf.advance();
    seen++;
    assert.ok(buf.position <= buf.frontier); // invariant
  }
  assert.equal(seen, 3);
  assert.equal(buf.advance(), null); // caught up → no phantom frame
});

test("FastForwardBuffer.visible grows as the playhead advances", () => {
  const buf = new FastForwardBuffer();
  for (let i = 0; i < 2; i++) buf.push({ t: i, entries: [] });
  assert.equal(buf.visible().length, 0);
  buf.advance();
  assert.equal(buf.visible().length, 1);
});
