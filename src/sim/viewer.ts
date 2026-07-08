/**
 * VIEWER GENERATOR — render the world to a self-contained HTML page you can open
 * in a browser. Runs a small town, holds conversations and a post, builds the
 * snapshot, renders it, and writes web/viewer.html.
 *
 * Run: npm run sim:viewer   →   open web/viewer.html
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Agent } from "../agent/agent.ts";
import { MemoryStore } from "../memory/store.ts";
import { getModel } from "../model/index.ts";
import { Feed } from "../social/feed.ts";
import { escapeHtml, renderSnapshotHtml } from "../view/render.ts";
import { buildSnapshot } from "../view/snapshot.ts";
import { converse } from "../world/conversation.ts";
import { World } from "../world/world.ts";

const START = Date.UTC(2026, 6, 10, 8, 0, 0);
const OUT = "web/viewer.html";

async function main(): Promise<void> {
  const model = getModel();
  const store = new MemoryStore(model);
  const feed = new Feed();
  const world = new World(store, START, { stepMinutes: 15, actionMinutes: 45 });

  const cast: Array<[string, string, string]> = [
    ["maya", "Maya", "Maya runs the café; warm, conflict-avoidant."],
    ["tom", "Tom", "Tom is a regular and Maya's old friend."],
    ["ana", "Ana", "Ana runs the bakery next door."],
    ["leo", "Leo", "Leo delivers for both shops."],
  ];
  const agents = cast.map(([id, name, bio]) => {
    const a = new Agent({ id, name, bio }, store, model, { reflectionThreshold: 1000 });
    world.add(a);
    return a;
  });

  await agents[0]!.perceive("Maya had an argument with Tom and feels bad about it.", START);
  await agents[2]!.perceive("Ana heard the landlord might raise the rent.", START);
  await world.run(6);
  await converse(agents[0]!, agents[1]!, world.clock, store, { maxTurns: 2, topic: "clearing the air" });
  await converse(agents[2]!, agents[3]!, world.clock, store, { maxTurns: 2, topic: "the most important thing I heard" });
  await converse(agents[3]!, agents[0]!, world.clock, store, { maxTurns: 2, topic: "neighborhood news" });

  const draft = await agents[0]!.composePost(world.clock);
  if (draft) {
    const post = feed.addPost("maya", draft.text, draft.sourceMemoryId, world.clock);
    feed.addReply(post.id, "fan", "just talk to him, life's short", world.clock);
  }

  const snap = buildSnapshot({ now: world.clock, agents, store, currentActions: world.currentActions(), feed });
  const html = renderSnapshotHtml(snap);
  mkdirSync("web", { recursive: true });
  writeFileSync(OUT, html);

  // ---- verification (structural — no browser available) ----
  const checks: Array<[string, boolean]> = [
    ["output is a complete HTML document", html.startsWith("<!doctype html>") && html.includes("</html>")],
    ["every agent name is rendered", agents.every((a) => html.includes(a.profile.name))],
    ["the town SVG has one line per relationship", (html.match(/<line /g)?.length ?? 0) === snap.relationships.length],
    ["the ticker renders one row per entry", (html.match(/class="tk"/g)?.length ?? 0) === snap.ticker.length],
    ["the post appears in the feed", snap.feed.length > 0 && html.includes(escapeHtml(snap.feed[0]!.text))],
    ["model text is HTML-escaped (no raw < from content)", !containsUnescapedAngleFromContent(html)],
  ];

  console.log(`\n\x1b[1mVIEWER → ${OUT}\x1b[0m  (${html.length} bytes)`);
  console.log(`  ${snap.stats.agents} agents · ${snap.stats.memories} memories · ${snap.stats.edges} relationships · ${snap.stats.posts} posts`);
  let allPass = true;
  for (const [label, ok] of checks) {
    allPass &&= ok;
    console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${label}`);
  }
  console.log("");
  if (allPass) console.log(`\x1b[1m\x1b[32m✓ VIEWER: PASS\x1b[0m — open ${OUT} in a browser.`);
  else {
    console.log("\x1b[1m\x1b[31m✗ VIEWER: FAIL\x1b[0m");
    process.exitCode = 1;
  }
}

/** true if any content-bearing '<' survived unescaped (a crude injection check) */
function containsUnescapedAngleFromContent(html: string): boolean {
  // strip legitimate tags, then look for stray '<' that isn't part of a tag
  return /<(?![a-z/!])/i.test(html.replace(/<\/?[a-z][^>]*>/gi, ""));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
