import assert from "node:assert/strict";
import { test } from "node:test";
import { deploymentInfo } from "../deploy/alicloud.ts";

/** run `fn` with specific env keys temporarily set/cleared, then restore */
function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(overrides)) saved[k] = process.env[k];
  try {
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("module imports without the optional SDKs and returns the three Alibaba services", () => {
  const info = deploymentInfo();
  assert.ok(info.services.qwenCloud && info.services.oss && info.services.rds);
  assert.match(info.trace, /DashScope/);
  assert.match(info.services.qwenCloud.service, /Qwen Cloud|DashScope/);
  assert.match(info.services.rds.service, /pgvector/);
});

test("qwenCloud.configured tracks DASHSCOPE_API_KEY", () => {
  withEnv({ DASHSCOPE_API_KEY: undefined }, () => assert.equal(deploymentInfo().services.qwenCloud.configured, false));
  withEnv({ DASHSCOPE_API_KEY: "sk-x" }, () => assert.equal(deploymentInfo().services.qwenCloud.configured, true));
});

test("oss.configured needs all four OSS vars and echoes bucket@region (no secrets)", () => {
  withEnv({ OSS_BUCKET: undefined, OSS_REGION: undefined, OSS_ACCESS_KEY_ID: undefined, OSS_ACCESS_KEY_SECRET: undefined }, () => {
    assert.equal(deploymentInfo().services.oss.configured, false);
  });
  withEnv({ OSS_BUCKET: "the-feed", OSS_REGION: "oss-ap-southeast-1", OSS_ACCESS_KEY_ID: "id", OSS_ACCESS_KEY_SECRET: "sec" }, () => {
    const oss = deploymentInfo().services.oss;
    assert.equal(oss.configured, true);
    assert.match(oss.detail, /the-feed @ oss-ap-southeast-1/);
    assert.ok(!oss.detail.includes("sec"), "must not leak the secret");
  });
});

test("rds.configured tracks PG_URL and reports only the host", () => {
  withEnv({ PG_URL: undefined, PG_HOST: undefined, PG_DATABASE: undefined }, () => assert.equal(deploymentInfo().services.rds.configured, false));
  withEnv({ PG_URL: "postgres://u:secretpw@db.example.com:5432/thefeed", PG_HOST: undefined }, () => {
    const rds = deploymentInfo().services.rds;
    assert.equal(rds.configured, true);
    assert.match(rds.detail, /db\.example\.com/);
    assert.ok(!rds.detail.includes("secretpw"), "must not leak the password");
  });
});
