import assert from "node:assert/strict";
import { test } from "node:test";
import { DashScopeAdapter, type FetchLike } from "../src/model/dashscope.ts";

/** a fetch stub that records the last request and returns queued responses */
function stubFetch(responder: (url: string, init: any) => { ok: boolean; status: number; body: any }) {
  const calls: Array<{ url: string; init: any }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const { ok, status, body } = responder(url, init);
    return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
  };
  return { fetchImpl, calls };
}

test("embed posts to /embeddings with the embed model and returns the vector", async () => {
  const { fetchImpl, calls } = stubFetch(() => ({ ok: true, status: 200, body: { data: [{ embedding: [0.1, 0.2, 0.3] }] } }));
  const a = new DashScopeAdapter({ apiKey: "sk-test", fetchImpl });
  const v = await a.embed("hello");
  assert.deepEqual(v, [0.1, 0.2, 0.3]);
  assert.ok(calls[0]!.url.endsWith("/embeddings"));
  assert.equal(JSON.parse(calls[0]!.init.body).model, "text-embedding-v4");
  assert.equal(calls[0]!.init.headers.Authorization, "Bearer sk-test");
});

test("complete routes task→model and returns the message content", async () => {
  const { fetchImpl, calls } = stubFetch(() => ({ ok: true, status: 200, body: { choices: [{ message: { content: "hi there" } }] } }));
  const a = new DashScopeAdapter({ apiKey: "sk-test", fetchImpl });

  assert.equal(await a.complete("x", { task: "act" }), "hi there");
  assert.equal(JSON.parse(calls[0]!.init.body).model, "qwen-flash"); // act → flash

  await a.complete("y", { task: "plan" });
  assert.equal(JSON.parse(calls[1]!.init.body).model, "qwen3-max"); // plan → max

  await a.complete("z"); // no task → default chat model
  assert.equal(JSON.parse(calls[2]!.init.body).model, "qwen-plus");
  assert.ok(calls[0]!.url.endsWith("/chat/completions"));
});

test("scoreImportance parses an integer and clamps to 1..10", async () => {
  const responder = (_: string, init: any) => {
    // the poignancy prompt asks for an integer; echo one back
    void init;
    return { ok: true, status: 200, body: { choices: [{ message: { content: "  8 " } }] } };
  };
  const a = new DashScopeAdapter({ apiKey: "sk-test", fetchImpl: stubFetch(responder).fetchImpl });
  assert.equal(await a.scoreImportance("a painful breakup"), 8);
});

test("scoreImportance falls back to 1 on unparseable output", async () => {
  const a = new DashScopeAdapter({ apiKey: "sk-test", fetchImpl: stubFetch(() => ({ ok: true, status: 200, body: { choices: [{ message: { content: "no number here" } }] } })).fetchImpl });
  assert.equal(await a.scoreImportance("whatever"), 1);
});

test("retries on 500 then succeeds", async () => {
  let n = 0;
  const fetchImpl: FetchLike = async () => {
    n++;
    if (n === 1) return { ok: false, status: 500, json: async () => ({}), text: async () => "boom" };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "ok" } }] }), text: async () => "" };
  };
  const a = new DashScopeAdapter({ apiKey: "sk-test", fetchImpl, maxRetries: 2 });
  assert.equal(await a.complete("x"), "ok");
  assert.equal(n, 2);
});

test("does not retry on 400 and surfaces the error", async () => {
  const a = new DashScopeAdapter({ apiKey: "sk-test", fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({}), text: async () => "bad request" }) });
  await assert.rejects(() => a.complete("x"), /400/);
});

test("constructor rejects a missing key", () => {
  assert.throws(() => new DashScopeAdapter({ apiKey: "" }), /requires an apiKey/);
});
