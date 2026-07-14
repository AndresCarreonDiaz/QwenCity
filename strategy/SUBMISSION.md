# The Feed — Devpost Submission Pack

Everything you need to finish the submission. Track: **Agent Society**.
Hard deadline: **2026-07-20, 2:00 PM PT** (no edits after). Demo must stay live + free through **Aug 11**.

---

## 1. Pass/fail checklist (do these — they gate the whole submission)

| Item | Status | Notes |
|---|---|---|
| Public GitHub repo | ⚠️ **verify** | `github.com/AndresCarreonDiaz/QwenCity` — open Settings → make sure visibility is **Public**. |
| OSS `LICENSE` detectable | ✅ | MIT `LICENSE` at repo root. |
| Link to a code file proving Alibaba Cloud deployment | ✅ | Paste this exact link in the Devpost form: `https://github.com/AndresCarreonDiaz/QwenCity/blob/main/deploy/alicloud.ts` |
| Architecture diagram | ✅ | Mermaid diagrams in `README.md` and `docs/ARCHITECTURE.md` (render on GitHub). Screenshot one for the Devpost gallery. |
| Public <3-min demo video | ❌ **YOU** | Upload to **YouTube / Vimeo / Youku** (NOT Facebook). Script in §3. Keep it under 3:00. |
| Alibaba Cloud Workbench "running resources" screenshot | ❌ **YOU** | Log into the Alibaba Cloud console → ECS → screenshot the running instance (+ Model Studio usage if visible). Add to the gallery. |
| English, no third-party music/trademarks in the video | ⚠️ | Use royalty-free/no music or a CC0 track; don't show other brands. The pixel assets are licensed LimeZu (owned) — fine. |
| Deployed demo live + free through Aug 11 | ✅ (keep it up) | `http://47.237.78.57` — don't take the ECS box down; memory is now bounded so it won't OOM over the window. |

---

## 2. Devpost writeup (ready to paste)

**Tagline:** A town of AI minds you can talk to — live. Every message you send becomes a memory that rewires who these characters become.

**Try it live:** http://47.237.78.57 · **Code:** https://github.com/AndresCarreonDiaz/QwenCity

### Inspiration
Stanford's *Generative Agents* (Smallville) built a believable little society of AI characters — but you could only watch it back as a replay. We wanted the opposite: a society you watch **live** and can **reach into**. What if the audience wasn't behind glass? What if a stranger's message could actually change what an AI character does next — and you could *measure* that it did?

### What it does
The Feed is a live, watchable town of generative agents, running 24/7 on Alibaba Cloud with real Qwen models. Four characters — Maya (café owner), Tom (her blunt old friend), Ana (rival baker), Leo (the delivery kid who gossips) — perceive each other, remember, reflect, plan their days, and talk. A rumor that the landlord will raise everyone's rent ripples through the town and you watch the drama unfold as a pixel-art soap opera: speech bubbles, moods, day/night and weather, a "town meeting," a news chyron, and broadcast-style scene labels.

The twist: **you're in the loop.** Click any character and send them a message. It enters the *same* memory stream the AI reasons from — with a salience boost — and steers their next decision. Your reply surfaces on the broadcast, and you watch their thoughts and actions shift.

### How we built it
- **Cognitive engine** (faithful to Park et al., 2023): a memory stream where each event is scored for poignancy and embedded; retrieval by `I(m) = 0.5·recency + 3·relevance + 2·importance`; a reflection tree; recursive daily planning; agent-to-agent dialogue that spreads information; and audience-reply ingestion.
- **The novel idea — Audience-Coupled Salience Memory:** one importance score per memory drives three subsystems at once — retrieval, the daily highlight editor, and render/compute gating. Human replies enter that same economy (+2 salience) and are force-surfaced to the next decision, making the audience a *causal* participant.
- **Qwen Cloud (Alibaba Cloud):** a `ModelAdapter` seam routes tasks across `qwen-flash` / `qwen-plus` / `qwen3-max` + `text-embedding-v4`. `deploy/alicloud.ts` traces one request from Qwen → OSS → DB, all on Alibaba Cloud. It runs on a single always-on ECS box (systemd), fast-forwarding the world so viewers watch "as if live."
- **Watchable frontend:** a self-contained, dependency-free canvas town (no build step) — click-to-follow broadcast camera, in-browser Kokoro TTS voices, per-character mood, relationship tone, weather, and a broadcast package (cold open, day cards, breaking-news flashes, scene lower-thirds).
- **Proof, not vibes:** a deterministic offline harness with **105 tests + 11 self-asserting sims**, including a controlled **ablation**.

### Measured results (the ablation)
Running the identical world with and without the audience:
- **Information diffusion:** a rumor reached **4/4** agents with dialogue vs **1/4** without.
- **Relationship density:** **50%** of possible bonds formed vs **0%**.
- **Audience-causal divergence:** a single moderated reply changed **25% of the society's next actions** vs **0%** with no audience — something a closed sandbox structurally cannot report.

### Challenges
Making an emergent, 24/7 society **watchable** without scripting it; keeping it **affordable** (fast-forward + batching so ~15 agents run ~$15–34 over the judging window); and keeping it **honest** — every claim in the UI and docs is derived from the code, and the demo is bounded so it survives weeks of continuous running.

### Accomplishments we're proud of
A real, live, talk-to-it society on Qwen Cloud — with a *measured*, not hand-wavy, audience effect — that also happens to be genuinely fun to watch all day.

### What we learned
That the interesting frontier of generative agents isn't a bigger sandbox — it's opening the sandbox to real people and proving the coupling is causal.

### What's next
A larger cast, multi-day story arcs that escalate and resolve, and on-demand hero renders (Wan) gated by the same salience score.

### Built With
`qwen` · `alibaba-cloud` · `ecs` · `dashscope` · `typescript` · `node` · `kokoro-tts` · `html-canvas`

---

## 3. Three-minute video script (shot list)

Record at 1280×800, desktop. Keep total ≤ 2:55. Speak plainly; let the world do the work.

| Time | Shot | On screen | Voiceover (tight) |
|---|---|---|---|
| 0:00–0:12 | Live wide shot of the town (open `http://47.237.78.57`) | The pixel city, people walking, a speech bubble | "This is a town of AI characters — running live, right now, on Alibaba Cloud with Qwen. Nobody scripted what they're about to do." |
| 0:12–0:35 | Sidebar "THE STORY" + roster; a scene lower-third pops ("THE RIVALRY" / "OLD FRIENDS") | Story card, moods, a live scene | "There's a rumor the landlord's raising the rent. Maya runs the café, Ana the rival bakery, Tom's her old friend, Leo hears everything. Watch the drama play out — you can even see how each of them feels." |
| 0:35–1:05 | Click a character → follow-cam glides in; toggle 🔊 voices; a line plays aloud | CAM 02 following, speech bubble + audio | "Click anyone and follow their life. They speak — that's Kokoro TTS running in your browser. Read their thoughts, their plan, who they know." |
| 1:05–1:45 | **The money shot.** In the follow panel, type a reply and Send; show the confirmation; cut to the character's next action shifting + the 📨 bubble on the map | Reply box → "✓ …entered the loop" → map bubble | "Here's the difference. Send them a message. It becomes a memory they reason from — and it changes what they do next. You're not watching behind glass. You're in the story." |
| 1:45–2:05 | Sidebar "⚡ Why this is different" card; overlay the ablation numbers | The measured stat 25% vs 0% | "And we can prove it. In a controlled test, one reply shifted twenty-five percent of the town's next actions — versus zero with no audience. We call it Audience-Coupled Salience Memory: one importance score drives retrieval, the highlights, and your influence." |
| 2:05–2:30 | Quick montage: town meeting banner, day/night, breaking-news flash, the news chyron | Broadcast package beats | "It's built to watch all day — a daily town meeting, weather, day and night, breaking-news moments, all emergent." |
| 2:30–2:50 | Cut to the repo: `docs/ARCHITECTURE.md` mermaid diagram + `deploy/alicloud.ts` + the Alibaba Cloud console screenshot | Architecture + Alibaba Cloud proof | "Real Qwen models behind a clean adapter, deployed on Alibaba Cloud ECS, a hundred-plus tests, a full architecture. It's open source." |
| 2:50–2:55 | Back to the live URL on screen | `http://47.237.78.57` | "The Feed. Come talk to the town." |

**Tips:** Pre-load the page so the cold-open recap plays. Do the reply live on camera (it's the whole point). If a real Qwen reaction is slow, you can pre-stage by sending the reply ~30s before you start that segment and show the resulting thought.
