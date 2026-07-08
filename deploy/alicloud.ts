/**
 * PROOF OF ALIBABA CLOUD DEPLOYMENT
 * =================================
 * This is the single file a judge can open to trace one request across the
 * Alibaba Cloud services this project runs on:
 *
 *     spectator/agent request
 *        → DashScope (Qwen Cloud / Alibaba Cloud Model Studio)   [LLM + embeddings]
 *        → Alibaba Cloud OSS                                      [rendered media + tick log]
 *        → Alibaba Cloud RDS PostgreSQL + pgvector                [memory stream + world state]
 *
 * The DashScope path is fully implemented and tested (src/model/dashscope.ts) —
 * that is the core Alibaba Cloud AI service the whole app depends on. OSS and
 * pgvector are wired here behind env guards; their SDKs are loaded lazily (so
 * this module imports and `deploymentInfo()` runs on any host, with or without
 * `ali-oss` / `pg` installed). Install them on the deploy host: `npm i ali-oss pg`.
 *
 * Run `npm run deploy:info` (add --env-file for real values) to print the manifest.
 */
import { DashScopeAdapter } from "../src/model/dashscope.ts";

export interface ServiceStatus {
  service: string;
  configured: boolean;
  detail: string;
  role: string;
}

export interface DeploymentManifest {
  services: { qwenCloud: ServiceStatus; oss: ServiceStatus; rds: ServiceStatus };
  allConfigured: boolean;
  trace: string;
}

/** Report which Alibaba Cloud services are configured, from env — no secrets, no SDKs. */
export function deploymentInfo(): DeploymentManifest {
  const dashKey = !!process.env.DASHSCOPE_API_KEY;
  const dashEndpoint = process.env.DASHSCOPE_BASE_URL ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

  const ossBucket = process.env.OSS_BUCKET;
  const ossRegion = process.env.OSS_REGION;
  const ossConfigured = !!(ossBucket && ossRegion && process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET);

  const pgUrl = process.env.PG_URL;
  const pgHost = process.env.PG_HOST ?? (pgUrl ? safeHost(pgUrl) : undefined);
  const pgConfigured = !!(pgUrl || (pgHost && process.env.PG_DATABASE));

  const services = {
    qwenCloud: {
      service: "DashScope · Qwen Cloud (Alibaba Cloud Model Studio)",
      configured: dashKey,
      detail: dashEndpoint,
      role: "all LLM completions + text-embedding-v4 embeddings",
    },
    oss: {
      service: "Alibaba Cloud OSS (object storage)",
      configured: ossConfigured,
      detail: ossConfigured ? `${ossBucket} @ ${ossRegion}` : "set OSS_BUCKET / OSS_REGION / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET",
      role: "rendered media (Wan/CosyVoice) + tick-log persistence; Wan URLs expire in 24h so bytes are copied here immediately",
    },
    rds: {
      service: "Alibaba Cloud RDS PostgreSQL + pgvector",
      configured: pgConfigured,
      detail: pgConfigured ? String(pgHost) : "set PG_URL (or PG_HOST + PG_DATABASE)",
      role: "memory stream (HNSW vector index) + relational world state",
    },
  };
  return {
    services,
    allConfigured: services.qwenCloud.configured && services.oss.configured && services.rds.configured,
    trace: "request → DashScope(Qwen) → OSS(put media) → RDS/pgvector(store memory) — all Alibaba Cloud",
  };
}

/** Live proof that the Qwen Cloud leg works: one embedding via DashScope. */
export async function verifyDashScope(): Promise<{ ok: boolean; dim?: number; error?: string }> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) return { ok: false, error: "DASHSCOPE_API_KEY not set" };
  try {
    const adapter = new DashScopeAdapter({ apiKey, baseUrl: process.env.DASHSCOPE_BASE_URL });
    const vec = await adapter.embed("Alibaba Cloud deployment proof.");
    return { ok: vec.length > 0, dim: vec.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Persist bytes to Alibaba Cloud OSS and return the durable OSS URL. Loads the
 * `ali-oss` SDK lazily via an indirect specifier so this module has no hard
 * dependency on it (install on the deploy host). Wan/CosyVoice outputs must be
 * copied here immediately — their DashScope URLs expire in 24h.
 */
export async function persistToOSS(objectKey: string, bytes: Uint8Array): Promise<string> {
  const { OSS_BUCKET, OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET } = process.env;
  if (!(OSS_BUCKET && OSS_REGION && OSS_ACCESS_KEY_ID && OSS_ACCESS_KEY_SECRET)) {
    throw new Error("OSS not configured (OSS_BUCKET/OSS_REGION/OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET)");
  }
  const pkg: string = "ali-oss"; // `: string` so tsc won't resolve the (optional, deploy-host) module
  const OSS = (await import(pkg)).default as any;
  const client = new OSS({ region: OSS_REGION, accessKeyId: OSS_ACCESS_KEY_ID, accessKeySecret: OSS_ACCESS_KEY_SECRET, bucket: OSS_BUCKET });
  const result = await client.put(objectKey, Buffer.from(bytes));
  return result.url as string;
}

/** Open an RDS PostgreSQL client (pgvector). Lazy `pg` load; caller runs queries/migrations. */
export async function pgClient(): Promise<any> {
  const conn = process.env.PG_URL;
  if (!conn) throw new Error("RDS not configured (set PG_URL)");
  const pkg: string = "pg";
  const { Client } = (await import(pkg)) as any;
  const client = new Client({ connectionString: conn });
  await client.connect();
  return client;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(configured)";
  }
}

// Print the manifest when run directly: `npm run deploy:info`
if (import.meta.url === `file://${process.argv[1]}`) {
  const info = deploymentInfo();
  console.log("\nAlibaba Cloud deployment manifest\n");
  for (const s of Object.values(info.services)) {
    console.log(`  [${s.configured ? "✓" : " "}] ${s.service}`);
    console.log(`        ${s.detail}`);
    console.log(`        ↳ ${s.role}`);
  }
  console.log(`\n  trace: ${info.trace}`);
  console.log(`  all configured: ${info.allConfigured}\n`);
}
