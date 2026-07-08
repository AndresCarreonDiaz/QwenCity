import type { MemoryKind } from "../memory/types.ts";
import type { WorldSnapshot } from "./snapshot.ts";

/**
 * Render a WorldSnapshot into a single self-contained HTML page — the spectator
 * view: a 2D town with the relationship graph, the color-coded thought-ticker
 * ("watch the mind"), and the social feed. No external assets (CSP-safe), no
 * client JS required for the static view; the deployed dashboard re-fetches a
 * fresh snapshot on an interval, but the markup is identical.
 *
 * All model-generated text is HTML-escaped — memory/dialogue content is
 * untrusted and must never be able to inject markup into the viewer.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const KIND_COLOR: Record<MemoryKind, string> = {
  observation: "#57B6CE",
  dialogue: "#5FC28E",
  reflection: "#9E8CFF",
  plan: "#E8B23A",
  injection: "#F0A020",
};

function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}

/** deterministic node position on a circle in a 100×100 viewBox */
function nodePos(i: number, n: number): { x: number; y: number } {
  if (n === 1) return { x: 50, y: 50 };
  const angle = (2 * Math.PI * i) / n - Math.PI / 2;
  return { x: 50 + 34 * Math.cos(angle), y: 50 + 34 * Math.sin(angle) };
}

export function renderSnapshotHtml(snap: WorldSnapshot): string {
  const posById = new Map(snap.agents.map((a, i) => [a.id, nodePos(i, snap.agents.length)]));

  const edges = snap.relationships
    .map((e) => {
      const pa = posById.get(e.a);
      const pb = posById.get(e.b);
      if (!pa || !pb) return "";
      const w = Math.min(4, 0.6 + e.weight * 0.5);
      return `<line x1="${pa.x.toFixed(1)}" y1="${pa.y.toFixed(1)}" x2="${pb.x.toFixed(1)}" y2="${pb.y.toFixed(1)}" stroke="#3b4757" stroke-width="${w.toFixed(2)}" />`;
    })
    .join("");

  const nodes = snap.agents
    .map((a) => {
      const p = posById.get(a.id)!;
      return `<g>
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.4" fill="#E8B23A" stroke="#0b0e13" stroke-width="0.6"/>
        <text x="${p.x.toFixed(1)}" y="${(p.y - 4.6).toFixed(1)}" text-anchor="middle" class="nname">${escapeHtml(a.name)}</text>
        <text x="${p.x.toFixed(1)}" y="${(p.y + 6.8).toFixed(1)}" text-anchor="middle" class="nact">${escapeHtml(truncate(a.action, 26))}</text>
      </g>`;
    })
    .join("");

  const ticker = snap.ticker
    .map((e) => {
      const color = KIND_COLOR[e.kind] ?? "#8a93a0";
      const barW = Math.round((e.importance / 10) * 100);
      return `<li class="tk">
        <span class="kind" style="color:${color}">${escapeHtml(e.kind)}</span>
        <span class="who">${escapeHtml(e.agentName)}</span>
        <span class="txt">${escapeHtml(e.text)}</span>
        <span class="impbar"><i style="width:${barW}%;background:${color}"></i></span>
      </li>`;
    })
    .join("");

  const highlights = snap.highlights.length
    ? snap.highlights
        .map((b) => {
          const color = KIND_COLOR[b.kind] ?? "#8a93a0";
          const clock = new Date(b.t).toISOString().slice(11, 16);
          return `<li class="hl"><span class="hlt">${clock}</span><span class="hlk" style="color:${color}">${escapeHtml(b.kind)}·${b.importance}</span><span class="hltx">${escapeHtml(b.text)}</span></li>`;
        })
        .join("")
    : `<li class="hl empty">nothing notable yet</li>`;

  const feed = snap.feed.length
    ? snap.feed
        .map(
          (p) =>
            `<li class="post"><span class="handle">@${escapeHtml(p.agentId)}</span> ${escapeHtml(p.text)} <span class="rc">${p.replies} ${p.replies === 1 ? "reply" : "replies"}</span></li>`,
        )
        .join("")
    : `<li class="post empty">no posts yet</li>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>The Feed — live @ ${escapeHtml(snap.clock)}</title>
<style>
  :root{--bg:#0b0e13;--panel:#141922;--line:#232b37;--ink:#e9ecf1;--dim:#9aa4b2;--amber:#e8b23a;}
  *{box-sizing:border-box;} html,body{margin:0;background:var(--bg);color:var(--ink);
    font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}
  .wrap{max-width:1100px;margin:0 auto;padding:18px 20px 40px;}
  header{display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--line);padding-bottom:12px;flex-wrap:wrap;}
  .live{color:#f04a54;font-weight:700;letter-spacing:.14em;font-size:12px;display:inline-flex;align-items:center;gap:7px;}
  .dot{width:8px;height:8px;border-radius:50%;background:#f04a54;}
  h1{font-size:18px;margin:0;letter-spacing:.02em;} h1 b{color:var(--amber);}
  .clock{margin-left:auto;color:var(--dim);font-size:13px;}
  .stats{color:var(--dim);font-size:12px;width:100%;margin-top:4px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;}
  @media(max-width:760px){.grid{grid-template-columns:1fr;}}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px 16px;}
  .card h2{font-size:11px;letter-spacing:.14em;color:var(--dim);text-transform:uppercase;margin:0 0 10px;}
  svg{width:100%;height:auto;display:block;background:radial-gradient(circle at 50% 45%,#171d27,#0f131a);border-radius:6px;}
  .nname{fill:var(--ink);font-size:3.4px;font-weight:700;} .nact{fill:var(--dim);font-size:2.6px;}
  ul{list-style:none;margin:0;padding:0;}
  .tk{display:grid;grid-template-columns:78px 52px 1fr 46px;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #1b212c;font-size:12px;}
  .tk .kind{font-weight:700;font-size:10px;text-transform:uppercase;}
  .tk .who{color:var(--dim);} .tk .txt{color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .impbar{height:6px;background:#222922;border-radius:3px;overflow:hidden;} .impbar i{display:block;height:100%;}
  .post{padding:7px 0;border-bottom:1px solid #1b212c;font-size:13px;} .post .handle{color:var(--amber);font-weight:700;}
  .post .rc{color:var(--dim);font-size:11px;margin-left:6px;} .post.empty{color:var(--dim);}
  .hl{display:grid;grid-template-columns:46px 96px 1fr;gap:8px;align-items:baseline;padding:6px 0;border-bottom:1px solid #1b212c;font-size:12px;}
  .hl .hlt{color:var(--dim);} .hl .hlk{font-weight:700;font-size:10px;text-transform:uppercase;} .hl .hltx{color:var(--ink);}
  .hl.empty{color:var(--dim);}
  footer{color:#626c7a;font-size:11px;margin-top:18px;}
</style></head>
<body><div class="wrap">
  <header>
    <span class="live"><span class="dot"></span>LIVE</span>
    <h1>The <b>Feed</b></h1>
    <span class="clock">sim ${escapeHtml(snap.clock)}</span>
    <div class="stats">${snap.stats.agents} agents · ${snap.stats.memories} memories · ${snap.stats.edges} relationships · ${snap.stats.posts} posts</div>
  </header>
  <div class="grid">
    <div class="card"><h2>The Town</h2>
      <svg viewBox="0 0 100 100" role="img" aria-label="agent town and relationship graph">${edges}${nodes}</svg>
    </div>
    <div class="card"><h2>Thought-ticker — watch the mind</h2>
      <ul>${ticker}</ul>
    </div>
  </div>
  <div class="grid" style="margin-top:16px">
    <div class="card"><h2>Today's highlights — editor picks by salience</h2><ol>${highlights}</ol></div>
    <div class="card"><h2>The Feed</h2><ul>${feed}</ul></div>
  </div>
  <footer>The Feed — audience-coupled generative agents · rendered from a world snapshot · the deployed dashboard re-fetches this on an interval.</footer>
</div></body></html>`;
}
