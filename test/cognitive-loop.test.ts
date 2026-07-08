import assert from "node:assert/strict";
import { test } from "node:test";
import { Agent } from "../src/agent/agent.ts";
import { MemoryStore } from "../src/memory/store.ts";
import { MockAdapter } from "../src/model/mock.ts";

const T0 = Date.UTC(2026, 6, 9, 8, 0, 0);

function newAgent() {
  const model = new MockAdapter();
  const store = new MemoryStore(model);
  const agent = new Agent(
    { id: "maya", name: "Maya", bio: "Maya runs the café; values friendships." },
    store,
    model,
  );
  return { model, store, agent };
}

test("perceive stores a memory with importance 1..10 and a full-dim embedding", async () => {
  const { model, store, agent } = newAgent();
  const node = await agent.perceive("Tom said he felt ignored.", T0);
  assert.equal(store.size, 1);
  assert.ok(node.importance >= 1 && node.importance <= 10);
  assert.equal(node.embedding.length, model.embedDim);
});

test("importance is deterministic and ranks poignant above mundane", async () => {
  const { agent } = newAgent();
  const poignant = await agent.perceive("Tom and Maya had an argument and she wants to apologize.", T0);
  const mundane = await agent.perceive("It rained a little this morning.", T0);
  assert.ok(poignant.importance > mundane.importance);
});

test("retrieval surfaces the relevant memory to the top and caps at k", async () => {
  const { agent, store } = newAgent();
  await agent.perceive("Tom said he felt ignored at the opening.", T0);
  await agent.perceive("The bakery has its lights on early.", T0 + 6e5);
  await agent.perceive("Maya values her friendship with Tom.", T0 + 12e5);
  await agent.perceive("It rained this morning.", T0 + 18e5);

  const top = await store.retrieve("maya", "Should Maya apologize to Tom?", T0 + 3.6e6, 2);
  assert.equal(top.length, 2); // k respected
  assert.match(top[0]!.node.description, /Tom/i); // relevant wins
});

test("full loop: action cites only retrieved memories and quotes one of them", async () => {
  const { agent } = newAgent();
  await agent.perceive("Tom said he felt ignored.", T0);
  await agent.perceive("Maya values her friendship with Tom more than being right.", T0 + 6e5);
  await agent.perceive("It rained this morning.", T0 + 12e5);

  const action = await agent.decideAction("Maya is deciding whether to apologize to Tom.", T0 + 3.6e6, 8);
  const retrievedIds = new Set(action.retrieved.map((s) => s.node.id));

  assert.ok(action.citedMemoryIds.length > 0);
  assert.ok(action.citedMemoryIds.every((id) => retrievedIds.has(id)));
  assert.ok(action.retrieved.some((s) => action.text.includes(s.node.description)));
});

test("determinism: identical inputs produce identical action text (replayable buffer)", async () => {
  async function run() {
    const { agent } = newAgent();
    await agent.perceive("Tom said he felt ignored.", T0);
    await agent.perceive("Maya values her friendship with Tom.", T0 + 6e5);
    return (await agent.decideAction("Should Maya apologize?", T0 + 3.6e6)).text;
  }
  assert.equal(await run(), await run());
});
