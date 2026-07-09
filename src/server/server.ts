import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, join, resolve } from "node:path";
import { renderAppHtml } from "../view/app.ts";
import { LiveWorld } from "./liveworld.ts";

const APP_HTML = renderAppHtml();
const WEB_ROOT = resolve(process.cwd(), "web");
const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".json": "application/json" };

function serveStatic(pathname: string, res: ServerResponse): void {
  const rel = decodeURIComponent(pathname.replace(/^\/assets\/?/, ""));
  const full = resolve(WEB_ROOT, "assets", rel);
  if (!full.startsWith(join(WEB_ROOT, "assets")) || !existsSync(full) || !statSync(full).isFile()) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end('{"ok":false,"reason":"asset not found"}');
    return;
  }
  res.writeHead(200, {
    "Content-Type": MIME[extname(full).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": "public, max-age=86400",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(readFileSync(full));
}

/**
 * The spectator server — dependency-free (Node's built-in http), so it drops
 * onto a bare ECS box with just `tsx`. Reads are cheap (cached snapshot/HTML),
 * so unlimited viewers cost ~nothing; the only write path is a moderated,
 * rate-capped audience reply.
 *
 *   GET  /              → the rendered spectator viewer (HTML)
 *   GET  /snapshot.json → the current world snapshot (for polling / a SPA)
 *   GET  /health        → liveness + heartbeat
 *   POST /reply         → {agentId, handle, text} → moderated → into memory
 */
export function createFeedServer(world: LiveWorld): Server {
  return createServer((req, res) => void handle(req, res, world));
}

async function handle(req: IncomingMessage, res: ServerResponse, world: LiveWorld): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const send = (status: number, type: string, body: string): void => {
    res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
    res.end(body);
  };
  const json = (status: number, obj: unknown): void => send(status, "application/json", JSON.stringify(obj));

  try {
    if (req.method === "GET" && url.pathname === "/") {
      return send(200, "text/html; charset=utf-8", APP_HTML);
    }
    if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
      return serveStatic(url.pathname, res);
    }
    if (req.method === "GET" && url.pathname === "/snapshot.json") {
      return json(200, world.snapshot() ?? { status: "starting" });
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return json(200, world.health());
    }
    if (req.method === "POST" && url.pathname === "/reply") {
      const body = await readBody(req);
      let parsed: { agentId?: string; handle?: string; text?: string };
      try {
        parsed = JSON.parse(body || "{}");
      } catch {
        return json(400, { ok: false, reason: "invalid JSON" });
      }
      if (!parsed.agentId || !parsed.text) return json(400, { ok: false, reason: "agentId and text are required" });
      const result = await world.ingestReply(parsed.agentId, parsed.handle ?? "guest", parsed.text);
      return json(result.ok ? 200 : 400, result);
    }
    return json(404, { ok: false, reason: "not found" });
  } catch (err) {
    return json(500, { ok: false, reason: err instanceof Error ? err.message : "server error" });
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 8192) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      data += chunk.toString();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// Standalone entry: `npm run serve` (add DASHSCOPE via .env for real Qwen).
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 8787);
  const world = new LiveWorld({
    logPath: "data/live.ndjson",
    // Slow ticks in production to conserve the token budget (env override).
    tickIntervalMs: Number(process.env.TICK_INTERVAL_MS ?? 4000),
  });
  world.init().then(() => {
    world.start();
    createFeedServer(world).listen(port, () => {
      console.log(`The Feed — spectator server on http://localhost:${port}`);
      console.log(`  GET /  ·  GET /snapshot.json  ·  GET /health  ·  POST /reply`);
    });
  });
}
