# Qwen Cloud + Alibaba Cloud Deployment — "Living World" Multi-Agent Sim

All Qwen models run on **Alibaba Cloud Model Studio (Bailian)** via the **DashScope API** (OpenAI-compatible endpoint or native DashScope SDK). Pick ONE region and keep everything there — API keys, OSS, DB are region-scoped and cross-region calls add latency/egress. Recommended: **Singapore (ap-southeast-1)** for international access; Beijing (cn-beijing) has widest model availability. Each region needs its own API key.

⚠️ **VERIFY-IN-CONSOLE list** (model IDs drift monthly; the docs summarizer returned garbled suffixes like "qwen3.7-max" that do not exist — confirm exact snapshot IDs in Model Studio → Models before wiring): flagship ID, flash ID, VL ID, omni-realtime ID, rerank ID, embedding max-dims, Wan model per region, Wan 24h expiry, CosyVoice region support.

---

## 1. Service → Model mapping

| Job | Service / Model ID | Notes |
|---|---|---|
| **Agent planning, daily-goal setting, reflection/memory synthesis** | `qwen3-max` (flagship) or `qwen-max-latest` | Highest reasoning. Use sparingly — most expensive (~$1.6/1M in per earlier data). Batch API = 50% price if you can tolerate async. |
| **Mid-tier planning fallback** | `qwen-plus` | 1M context, ~$0.11/1M in. Good default if `qwen3-max` cost too high; use for reflection, keep max for rare deep planning. |
| **Routine per-tick actions, dialogue lines, importance scoring** | `qwen-flash` (replaces `qwen-turbo`) | Latency-optimized, cheapest text tier. This is your workhorse — 90%+ of calls. Importance-rating a memory (0–10 score) is a 1-token-ish output → flash is ideal. |
| **Memory embeddings** | `text-embedding-v4` | Configurable dimensions (MRL; commonly 1024, up to ~2048 — VERIFY max). Set `text_type=query` for retrieval queries vs `document` for stored memories. Multimodal-capable. |
| **Retrieval rerank** | `gte-rerank-v2` (or newer `qwen3-rerank`) | Rerank top-K vector hits before feeding to LLM context. Cheap, big quality win. |
| **Character voices** | **CosyVoice** — clone via **Voice Cloning API** (`cosyvoice-clone`), synth via `cosyvoice-v2` | Voice *creation is free*; you pay per synthesized character. Clone once per character → store returned `voice_id` in DB. Beijing + Singapore only (VERIFY). Supports streaming TTS. |
| **On-demand video (agent "memories"/cinematics)** | **Wan** — image-to-video `wan2.2-i2v-flash` (cheapest) or `wan2.6-i2v` (recommended); text-to-video `wan2.2-t2v-plus` / `wan2.6-t2v` | **Async: create task → poll task_id → get URL.** i2v takes 1–5 min. Feed agent's avatar image → i2v for consistency. Expensive per clip → gate behind rare events only. |
| **qwen3-vl (vision-language)** | `qwen3-vl-plus` | USE IT: let agents "perceive" the rendered world — caption a snapshot of the scene, read generated images, or let a "director" agent evaluate a Wan clip. Also good for moderating user-submitted images if judges can inject content. |
| **qwen3-omni realtime** | `qwen-omni-realtime` / `qwen3-omni-flash-realtime` (WebSocket/WebRTC) | OPTIONAL/showcase-only. Real value = a "talk to an agent live" demo booth for judges (streaming audio in/out). Do NOT put on the 24/7 hot path — it's a live socket, not a batch tick. Nice differentiator if time allows; cut first if not. |

**Cost-control principle:** flash for the loop, plus/max only for reflection, embeddings are cheap, Wan/CosyVoice are the budget sinks → gate them hard (§7).

---

## 2. Always-on simulation runner

**Recommendation: single ECS instance running a Node worker as a systemd service, with an internal `setInterval`/BullMQ tick loop (NOT OS cron, NOT Function Compute).**

| Option | Verdict for solo dev, cheap, alive→Aug 11 |
|---|---|
| **ECS + Node worker (systemd) + in-process scheduler** ✅ | **Best.** Individual accounts get a **12-month free ECS trial** (1 vCPU/1 GB, or 2c/2GB for 3 months) — covers the entire judging window at $0. Persistent process holds world state in memory, ticks every N seconds, writes deltas to DB/OSS. systemd `Restart=always` keeps it alive. One box = simplest mental model. 1 GB is tight for Node + world state → if it OOMs, upgrade to ~$3.50–10/mo burstable (`t6`/`e` shared-core) instance. |
| **Function Compute on a timer trigger** ⚠️ | Serverless cron works, but: **no permanent free tier** (trial credits expire in 60 days — they run out before/around Aug 11), cold starts, 10–15 min max duration per invoke, and **stateless** → you must rehydrate full world state from DB every tick = more DB reads + more code. Good only if you want scale-to-zero and the sim is truly episodic. Fights the "continuously-running living world" premise. |
| **Container (Serverless App Engine / ACK)** ⚠️ | SAE/ACK adds orchestration overhead and cost with no benefit at this scale. Overkill for one worker. Use a plain Docker container *on the ECS box* if you want reproducibility, but skip managed container platforms. |

**Loop shape (ECS):** `while true` isn't it — use a scheduler tick: every tick, select "active" agents (not all, to bound cost), run flash calls concurrently (small pool, e.g. p-limit 5 to respect DashScope QPS), persist state, emit event to frontend (§6). Use a **BullMQ/Redis** queue (or just an in-memory queue for solo scale) so slow jobs (Wan video, reflection) run out-of-band without stalling the tick. Add a lightweight **heartbeat row** in DB the frontend can read to prove "sim is alive."

---

## 3. Memory persistence (vector store)

**Recommendation: Tablestore vector for cheapest always-on; pgvector-on-RDS if you want SQL + vectors in one place and already know Postgres.**

| Option | Fit |
|---|---|
| **Tablestore (vector search)** ✅ cheapest | Serverless, pay-as-you-go, DiskANN-based, scales to billions of vectors at low cost. Zero idle cost — ideal for a 3-week judged demo. Stores memory text + embedding + metadata (agent_id, timestamp, importance, type) and does ANN + scalar filtering together. Best cost/alive tradeoff. |
| **RDS PostgreSQL + `pgvector`** ✅ simplest mental model | One DB for BOTH agent state (§4) AND memories → fewer moving parts for a solo dev. Great up to a few million vectors (you'll have far fewer). HNSW index. Filter by agent/importance in plain SQL. Slightly more $ than Tablestore (instance runs 24/7) but folds memory + relational into one bill. **This is the pragmatic solo pick.** |
| **AnalyticDB for PostgreSQL** ⚠️ | FastANN + HNSW, powerful, but it's an analytics warehouse — heavier and pricier than you need. Skip unless scaling big. |
| **OpenSearch (vector edition)** ⚠️ | Full search+analytics suite; more infra than warranted. Skip. |

**Retrieval query (Stanford "Generative Agents"–style memory):** on each agent decision:
1. Embed the current situation with `text-embedding-v4` (`text_type=query`).
2. ANN top-K (e.g. 50) from the store, filtered `WHERE agent_id = ?`.
3. Score each = `α·relevance(cosine) + β·recency(exp decay) + γ·importance` (importance was precomputed by `qwen-flash` at write time).
4. Optionally `gte-rerank-v2` the survivors.
5. Take top ~8 → inject into the planning/action prompt.

Store every observation/plan/reflection as a row {text, vector, agent_id, ts, importance, kind}. Reflections are generated by `qwen3-max`/`qwen-plus` when accumulated importance crosses a threshold.

---

## 4. Asset + state storage

**OSS (Object Storage Service) for all binaries; RDS PostgreSQL for relational state.**

- **OSS bucket(s):** rendered Wan videos, generated images, avatars, CosyVoice audio clips. Serve public-read assets via OSS URL or front with CDN. Organize `oss://world/agents/{id}/avatar.png`, `/memories/{id}.mp4`, `/voice/{id}.mp3`.
- 🚨 **Wan output URLs expire in 24h.** The generated `video_url`/`image_url` is a temporary DashScope URL. **On task completion, immediately download the bytes and `PutObject` to your OSS bucket**, then store the *OSS* URL in your DB — never persist the DashScope URL. Same discipline for any generated image. Wrap this in the poll-completion handler so it's automatic. (Confirmed: video_url expires after 24 hours.)
- **RDS PostgreSQL (or the pgvector instance from §3):** agent state (position, mood, relationships, inventory, current plan), the social-feed/timeline (posts, interactions), world clock/tick number, and asset-URL pointers into OSS. JSONB columns are fine for flexible agent blobs. Add the `heartbeat`/`world_status` table here for the frontend and for the replay fallback (§7).
- Keep DashScope task IDs + status in a `jobs` table so a worker restart can resume polling in-flight Wan jobs (otherwise you leak the 24h window).

---

## 5. "Proof of Alibaba Cloud deployment" code file

A single committed file (e.g. `alibaba_deployment.md` + the referenced code, or `deploy/alicloud.ts`) that demonstrably shows the app **runs on Alibaba Cloud infra + Qwen**, not just calls an API. Include:

1. **DashScope/Model Studio client init** using `DASHSCOPE_API_KEY` from env, pointing at the Alibaba base URL (`https://dashscope-intl.aliyuncs.com/compatible-mode/v1` for Singapore) — shows Qwen models are called on Alibaba Cloud, not a mirror.
2. **OSS SDK usage** (`ali-oss` / `oss2`): the `PutObject` that persists Wan output → proves Alibaba storage.
3. **The vector store / RDS connection** (Tablestore SDK or RDS Postgres DSN) → proves Alibaba data layer.
4. **Infra manifest**: ECS instance region/spec + systemd unit (or a Terraform/ROS snippet, or a `Dockerfile` + run command) → proves compute host.
5. A short **architecture header comment / diagram** naming each Alibaba service (ECS, OSS, RDS/Tablestore, Model Studio) and the models used.
6. **Region + resource IDs** (bucket name, instance id, endpoint) redacted-but-present, so a judge sees it's a real deployment.

Keep secrets in env vars / a `.env.example`, never committed. This one file should let a judge trace request → Qwen model → OSS → DB, all on Alibaba Cloud.

---

## 6. Frontend — Next.js live spectator dashboard

- **Hosting:** Deploy Next.js on **Vercel** (fastest for solo, generous free tier) OR, to keep everything inside Alibaba Cloud for the "deployed on Alibaba" story, serve the built Next.js from the **same ECS box** (Node) or as static export on **OSS static-website hosting + CDN**. For a live dashboard needing a server for the stream, run it on ECS alongside the worker (or a second small instance).
- **Streaming updates — recommendation: SSE (Server-Sent Events) for the spectator feed, WebSocket only if judges get to interact.**
  - **SSE** (one-way server→browser) fits a *spectator* view perfectly: simplest, auto-reconnect, works over plain HTTP, no socket infra. The worker pushes tick events → an SSE endpoint fans out. Best default.
  - **WebSocket** if the UI is bidirectional (judges nudge an agent, chat). More infra; use only where needed.
  - **Polling** as the zero-infra fallback: frontend polls `/api/world-state?since=tick` every few seconds off the DB `heartbeat`/feed tables. Robust, cache-friendly, and doubles as the replay reader (§7). For a hackathon, **polling the DB every 3–5s is completely acceptable and hardest to break.**
- **Architecture:** worker writes state + events → DB/Redis; Next.js API route reads and emits via SSE or serves polling responses. Decouples the sim from the UI so a frontend redeploy never disturbs the running world.

---

## 7. Judging-window strategy (3 weeks live, cheap, judge-safe)

**Keep it alive & cheap:**
- Run the 24/7 worker on the **free-tier ECS** → $0 compute through Aug 11. Frontend on Vercel free tier or same box.
- **Tick throttling:** slow the world clock (e.g. tick every 30–60s, or only advance N agents/tick) — spectators can't tell, and it linearly cuts LLM spend. Use `qwen-flash` for the loop; reserve `qwen3-max` for infrequent reflections.
- **Nightly cost cap:** a cron that pauses/slows the sim overnight, or a hard daily DashScope token budget enforced in the worker (stop calling paid models past $X/day).
- **Pre-generate assets:** create avatars, key voices, and a handful of Wan clips ONCE during setup and store in OSS. Do NOT generate video in the live loop except on rare scripted events — Wan + CosyVoice are the only real budget risks.

**Cached "showcase replay" fallback (critical):**
- Continuously log every tick's state+events to a DB table / an **OSS-hosted JSON (or NDJSON) timeline**. Record one strong ~5–10 min "golden run."
- Build the frontend so a `?mode=replay` flag reads the recorded timeline (from OSS/DB) and plays it back through the *same* rendering components at wall-clock speed. If the live sim is down/over-budget, the dashboard auto-detects a stale `heartbeat` and transparently switches to replay → a judge always sees a living world. This is your insurance for the whole window.

**Rate-limiting so judges can't drain credits:**
- If judges can interact (chat/nudge/omni-realtime booth), gate EVERY paid action behind: per-IP/session rate limit (e.g. N interactions/min via Redis token bucket), a **global daily interaction budget**, and a **hard kill-switch** that flips interactions to "read-only spectator + replay" when the budget is hit.
- Route judge interactions to `qwen-flash` (cheap), cap max output tokens, and **disable Wan/CosyVoice from any user-triggered path** entirely (pre-rendered only). Validate/moderate any user text/image (qwen3-vl or a moderation prompt) before it reaches a model.
- Spectator view = pure DB/OSS reads (no model calls) → unlimited judges cost ~nothing.

**Bottom line:** ECS free-tier worker (flash-driven, throttled) + pgvector-on-RDS or Tablestore for memory + OSS for assets (persist Wan output immediately) + SSE/polling Next.js spectator UI + an OSS-recorded replay fallback + hard-capped, flash-only, no-video judge interactions = live, cheap, and judge-proof through Aug 11.