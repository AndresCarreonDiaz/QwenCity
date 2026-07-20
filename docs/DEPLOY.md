# Deploying Qwen City to Alibaba Cloud

The spectator server is dependency-free (Node's built-in `http`), so it runs on a bare ECS box with
just Node + `tsx`. This is the path to the judge-visitable URL and satisfies the hackathon's
"proof of Alibaba Cloud deployment" requirement — see [`deploy/alicloud.ts`](../deploy/alicloud.ts).

## What you need
- An **Alibaba Cloud (International)** account and a **DashScope API key** (`sk-…`) — see the README.
- An **ECS** instance (the 12-month individual free tier is enough) running Ubuntu 22.04+.
- Optional but recommended for persistence: **RDS PostgreSQL** (enable the `pgvector` extension) and an
  **OSS** bucket. Without them, the world still runs and persists its tick log to a local NDJSON file.

## 1. Provision + prepare the ECS box
```bash
# on the ECS instance
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -   # Node 22
sudo apt-get install -y nodejs git
git clone https://github.com/AndresCarreonDiaz/QwenCity.git
cd QwenCity
npm install                 # tsx + typescript + @types/node (from the committed lockfile)
npm install ali-oss pg      # deploy-host extras for OSS + RDS (lazy-loaded by deploy/alicloud.ts)
```

## 2. Configure the environment
```bash
cp .env.example .env
# edit .env — at minimum:
#   MODEL_BACKEND=dashscope
#   DASHSCOPE_API_KEY=sk-...
#   (International region is the default; set DASHSCOPE_BASE_URL only for China)
# and, if using managed persistence:
#   OSS_BUCKET / OSS_REGION / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET
#   PG_URL=postgres://user:pass@your-rds-host:5432/thefeed
npm run deploy:info    # should show ✓ for each service you configured
npm run smoke:live     # confirms Qwen is reachable with your key
```

## 3. Run it as an always-on service (systemd)
Create `/etc/systemd/system/thefeed.service`:
```ini
[Unit]
Description=Qwen City — spectator server
After=network-online.target

[Service]
WorkingDirectory=/home/ubuntu/QwenCity
ExecStart=/usr/bin/npm run serve
EnvironmentFile=/home/ubuntu/QwenCity/.env
Restart=always
RestartSec=3
User=ubuntu

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now thefeed
sudo systemctl status thefeed        # active (running)
curl -s localhost:8787/health        # {"status":"alive",...}
```

## 4. Expose it
- Open the server port (default **8787**) in the ECS **security group**, or put **nginx** in front on
  :80/:443 proxying to `localhost:8787` (recommended, and needed for HTTPS).
- The judge-facing URL is then `http://<ecs-ip>:8787/` (or your domain). Endpoints:
  `GET /` (viewer) · `GET /snapshot.json` · `GET /health` · `POST /reply`.

## Judge-safety (keep it live and cheap through Aug 11)
- **Reads are cached** (snapshot + HTML regenerate once per tick), so unlimited viewers cost ~nothing.
- **The only write path** is `POST /reply`: every reply is moderated (`src/social/moderation.ts`) and the
  process enforces a hard reply cap (`maxReplies`) — a visitor can't drain your token budget.
- **Cost:** the world runs in **fast-forward** (generate-ahead), so all model calls are Batch-eligible;
  ~15 agents ≈ $15–34 over the judging window (see `strategy/truman-show/cost.md`). Set a spend cap on the
  account and keep `tickIntervalMs` conservative.
- **Never goes dark:** the tick log is appended to NDJSON; if the live generator stalls, serve a
  **golden-run replay** from that log (`data/live.ndjson`) so the URL always shows a coherent world.
- **Proof of deployment:** point the judges at [`deploy/alicloud.ts`](../deploy/alicloud.ts) and
  `npm run deploy:info` — the trace is `request → DashScope(Qwen) → OSS → RDS/pgvector`, all Alibaba Cloud.

## Minimal option (no RDS/OSS)
Skip step's OSS/PG vars. The world keeps memory in-process and persists the tick log locally; the
DashScope (Qwen Cloud) leg alone still satisfies "uses Alibaba Cloud services." Add RDS/OSS later for
durability across restarts.
