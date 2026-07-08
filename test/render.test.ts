import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeHtml, renderSnapshotHtml } from "../src/view/render.ts";
import type { WorldSnapshot } from "../src/view/snapshot.ts";

const SNAP: WorldSnapshot = {
  t: Date.UTC(2026, 6, 10, 9, 30),
  clock: "09:30",
  agents: [
    { id: "a", name: "Ana", action: "opening the shop", planActivity: "work", top: [] },
    { id: "b", name: "Bo", action: "reading", planActivity: null, top: [] },
  ],
  ticker: [
    { t: 2, agentId: "a", agentName: "Ana", kind: "reflection", importance: 8, text: "I value my friends" },
    { t: 1, agentId: "b", agentName: "Bo", kind: "observation", importance: 3, text: "it rained" },
  ],
  relationships: [{ a: "a", b: "b", weight: 2 }],
  feed: [{ id: "p0", agentId: "a", text: "rough day", replies: 1 }],
  stats: { agents: 2, memories: 2, posts: 1, edges: 1 },
};

test("escapeHtml neutralizes markup characters", () => {
  assert.equal(escapeHtml(`<script>"&'`), "&lt;script&gt;&quot;&amp;&#39;");
});

test("renders a complete HTML document", () => {
  const html = renderSnapshotHtml(SNAP);
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("</html>"));
});

test("renders every agent, one edge line, and one ticker row per entry", () => {
  const html = renderSnapshotHtml(SNAP);
  assert.ok(html.includes("Ana") && html.includes("Bo"));
  assert.equal(html.match(/<line /g)!.length, 1);
  assert.equal(html.match(/class="tk"/g)!.length, 2);
  assert.ok(html.includes("rough day")); // feed post
});

test("HTML-escapes model-generated memory text (no injection)", () => {
  const evil: WorldSnapshot = {
    ...SNAP,
    ticker: [{ t: 1, agentId: "a", agentName: "Ana", kind: "observation", importance: 5, text: "<script>alert(1)</script>" }],
  };
  const html = renderSnapshotHtml(evil);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
});

test("empty feed still renders without error", () => {
  const html = renderSnapshotHtml({ ...SNAP, feed: [], stats: { ...SNAP.stats, posts: 0 } });
  assert.ok(html.includes("no posts yet"));
});
