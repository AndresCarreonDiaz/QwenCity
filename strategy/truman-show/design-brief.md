# DESIGN BRIEF: "AI Truman Show" — Audience-Coupled Generative Agents
### Chief architect's decision for the Qwen Cloud hackathon · 12 days · must run live Jul 21 → Aug 11

---

## 1. THE VERDICT

**Take it. This is a comparable-risk swing with a higher ceiling than Sabi Studio — not a reckless passion indulgence — *provided* you accept two non-negotiable guardrails.** Sabi is an ~82/100 floor with low variance. This concept has an ~85–88 ceiling with meaningfully higher variance. Two things collapse that variance to "acceptable," and both are already answered by the research:

**Risk A — 24/7 cost through Aug 11: SOLVED.** The linchpin is a single architectural decision: **do not run real-time.** Pre-generate the simulation in fast-forward into a buffer that stays ~1 day ahead of a 1× "live" playhead; spectators watch the buffer *as if* live. Consequence: 100% of generation is non-interactive, so **Batch API (50% off) applies to every call** and there is no latency SLA. At **N=15 agents, qwen-plus-workhorse routing, ~3.9M tokens/real-day → ~$0.69/day → ~$15 over the 21-day judging window** (~$34 if you route *all* dialogue+planning to qwen3-max). Both fit inside `1M×model free quota + ~$40 voucher + ~$50 out of pocket` with a **full 2× safety margin**. Compute is $0 on the 12-month free-tier ECS box. Cost is not a real risk anymore; it is a *credibility asset* ("it's been live since Jul 21 — open it and talk to a character right now").

**Risk B — "you cloned Smallville": SOLVED IN PRINCIPLE, must be REALIZED.** Reimplementing the Stanford memory→retrieval→reflection→planning loop is table stakes, not the contribution. The defensible delta is that **Stanford's town was a *closed* sandbox; yours is an *open, perturbable* society** — real human replies are ingested as first-class memories, scored on the *same* importance scale, and thereby causally rewrite agent trajectories. No prior system (Smallville, AI Town, Project Sid, Fable SHOW-1, Chirper, Neuro-sama, Truman AI Live) owns that loop around a single co-watched, video-rendered life. **But this only scores if you *prove* it with an ablation chart.** The novelty lives in the eval, not the vibe.

**The two guardrails (both are day-7 kill-checks):**
1. **The fast-forward buffer must be working by day 4.** It is what makes the run affordable and unblocks Batch. Without it you are running real-time at 15–40× the cost and you will go dark mid-judging — a dead URL zeroes Presentation and destroys the "it's live" thesis.
2. **A credible ablation eval must be in hand by day 8** (baseline vs. full, one chart, one number). If by ~day 7 you cannot see a path to it, **fall back to AI Showrunner** (thin competition + your HyperFrames render moat = guaranteed mid-pack), or ship Sabi. Commit to Agent Society, but protect the eval as the single highest-priority deliverable.

**Honest scope caveat:** this has more integration surface than Sabi (memory stream + social loop + media pipeline + 24/7 deploy). The mitigation is a hard cutline (§5) that ships the *causal money shot* first and treats everything else as garnish. The passion factor is not a tiebreaker footnote — over a 12-day solo grind, motivation is a real multiplier on execution quality. Net: **higher ceiling, manageable variance, take the swing.**

---

## 2. THE CONCEPT, SHARPENED

**One-sentence thesis:**
> *"Stanford built a town of AI minds you could only watch as a replay; we turned it into a 24/7 livestream you can talk to — and every message you send becomes a memory that rewires who these characters become."*

**Diagram tagline:** *"Generative agents, but the audience is inside the loop."*

**What a spectator actually sees, does, and interacts with:**

- **SEES (default, ~$0):** a stylized 2D top-down town (Phaser/PixiJS, Stardew aesthetic) where sprite characters live 24/7. A **live thought-ticker** side panel prints each new memory as it's written — observation / plan / reflection / dialogue — color-coded by type and *sized by importance score*. This is the voyeur hook: you literally watch the mind. Speech bubbles on dialogue, an action-emoji + current-plan-step pill over each sprite, faint relationship threads between conversing agents, and a "skip to next notable event (importance ≥ 7)" fast-forward so a judge can jump straight to drama.
- **FOLLOWS:** each character has a followable social account. Characters **autonomously post** (first-person, in their voice, with an avatar-consistent image) whenever they live something salient (importance ≥ 6), capped 1–3 posts/sim-day.
- **INTERACTS:** the spectator **replies to a character's post**. That reply is moderated, transduced into an observation memory (`"On {date}, @user replied to my post: '…'"`), scored, given a **+2 salience bias**, and dropped into the character's memory stream — where it competes in the next planning + reflection cycle and **visibly changes what the character does next**. The character replies back tomorrow, *citing you*.
- **REQUESTS VIDEO:** a "▶ What are they living right now?" button compiles the character's *current* state into an 8–20s captioned clip in the character's cloned voice (HyperFrames, seconds, pennies); a "Make it cinematic 🎬" upgrade re-renders the hero beat via Wan.
- **CATCHES UP:** an **auto-produced daily highlight episode** (60–90s) per character and per town, edited by importance score, pushed to followers.

The unit is a **live life**, not a finished show. The chat is the plot.

---

## 3. TRACK & RUBRIC STRATEGY

**Enter AGENT SOCIETY. Do not enter AI Showrunner.**

Showrunner's rubric core is "autonomously handle the *entire* short-drama pipeline: scriptwriting → storyboarding → video → editing." Judged there, your real innovation (persistent memory, multi-agent emergence, audience-in-the-loop) becomes **off-rubric noise**, and emergent-agent messiness (agents wander, plots don't resolve) reads as a *defect* against video specialists. Thin competition only helps if you fit the track. You don't.

Agent Society *is* the concept's definition — "agents with distinct capabilities collaborate through task division, dialogue, negotiation." The 30% Innovation tie-breaker rewards exactly the audience-coupling delta. The track's dreaded "measurable multi-agent-vs-single-agent gain" requirement is a **gift**: Stanford already published the exact eval protocol; you replicate it and add one metric Stanford could never report. Your video layer doesn't vanish — it becomes your Presentation (15%) weapon, where HyperFrames buries competitors who submit log dumps.

**The nameable algorithm (the 30% Innovation headline — name ONE thing):**

> **"Audience-Coupled Salience Memory" — a single unified importance function `I(m)` that scores every memory event on one scale and drives three subsystems at once. In the repo/diagram it is the *Salience Engine*.**

- **Novelty vs. Stanford:** their retrieval = recency + importance + relevance over *internally generated* memories, in a closed sandbox. Yours ingests **real human replies as first-class memories, scored by the same `I(m)`,** turning a closed loop into an open, perturbable one. That closed-vs-open distinction is a genuine research delta, not a reskin.
- **Why it's elegant (sells Technical Depth 30% too) — ONE score, THREE uses:**
  1. **Retrieval** — feeds the agent's next-action context (as Stanford).
  2. **Highlight selection** — the day's top-salience events auto-assemble the recap. The memory importance *is* the edit decision; no separate editor model.
  3. **Render-budget gating** — only the single highest-salience beat earns an expensive Wan clip; everything else is cheap HyperFrames. **Innovation and cost-control are the same mechanism.**

**Impact framing (the 25% — lead with "instrument," not "toy"):**
Position it as a **controllable social-simulation testbed** for studying information diffusion, social contagion, coordination, and — uniquely — *how human feedback perturbs an agent society* (misinformation seeding, intervention A/Bs, parasocial dynamics), with zero human-subjects risk. Framing sentence: *"A perturbable social-simulation sandbox — the entertainment layer is how we get thousands of real perturbations for free."* That converts the spectator gimmick into the data-collection engine. Entertainment/games/synthetic-user-research are the go-to-market reach, not the headline.

---

## 4. ARCHITECTURE

### 4.1 Memory stream + retrieval formula

Each memory node (following Park et al. `ConceptNode`) stores: `type` ∈ {event, thought, chat}, `created`/`last_accessed`, `(subject,predicate,object)` triple, `description`, `embedding` (`text-embedding-v4`, `text_type=document`), **`poignancy` 1–10** (LLM-scored once at write time), `keywords`, and `filling` (evidence node-ids for reflections). Stored as rows `{text, vector, agent_id, ts, poignancy, kind, source_ids}`.

**Retrieval (per decision):** embed the current situation (`text_type=query`) → ANN top-K≈50 filtered `WHERE agent_id=?` → score each candidate, each component min-max normalized to [0,1]:

```
I(m) = 0.5 · recency(exp-decay over last_accessed)
     + 3.0 · relevance(cosine(mem, query))
     + 2.0 · importance(poignancy/10)
```

(the code-shipped `gw=[0.5, 3, 2]` weighting — relevance dominates, which is the real Stanford behavior, not the paper's all-1s). Optional `gte-rerank-v2` on survivors → take **top-8** into the prompt (caps prompts at ~1–2.5K tokens instead of dumping the stream). **The audience coupling:** ingested human replies get **poignancy +2**, so they surface strongly in the very next planning + reflection cycle.

### 4.2 The sim loop (per agent, event-driven)

`perceive` (events within vision radius; attention-capped) → `store` (event nodes + LLM poignancy + embedding) → `retrieve` (top-8 by `I(m)`) → `plan or react` (follow the decomposed daily→hourly→5–15min plan; or if a salient observation triggers a reaction, **re-plan from the current moment forward**) → `reflect` (fires when accumulated poignancy since last reflection > **150**; generate 3 focal questions → retrieve → synthesize 5 insights with evidence pointers → store as `thought` nodes at `depth+1`) → `act` (emoji/pose + plan-step pill). **Event-driven scheduler:** the LLM fires only on state change (new perception, plan expiry, conversation start). Idle/sleeping agents cost **$0** — this alone avoids a 3–5× call multiplier vs. fixed cadence.

### 4.3 Time-compression & cost (the make-or-break lever)

Pre-generate in fast-forward into a buffer ~1 day ahead of the 1× playhead. Because generation is offline → **Batch API 50% on every bulk call.** The reduction ladder (N=25, 21 days): naive real-time full-fidelity on qwen3.7-max ≈ *thousands of $* → +event-driven +small retrieval prompts ≈ $300–500 → +3-tier routing ≈ $110 → **+fast-forward→Batch ≈ $24 (plus) / $56 (max)**. Net **15–40× reduction.**

**Committed target: N=15.** ~262K tokens/agent/sim-day; ~3.9M tokens/real-day; **~$0.69/day → ~$15 over 21 days** (conservative all-max ≈ $34). Cost is dominated by smart-model **dialogue turns** (~53% of spend) + reflection output; controls: hard-cap conversations at ~6 turns, throttle reflection to ~every 3 sim-hours, keep dialogue on qwen-plus not max. Sensitivity: dialogue is the swing variable — budget for 2× dialogue and N=15 still sits at ~2× margin.

| N | tokens/real-day | $/real-day | 21-day (plus) | 21-day (max) |
|---|---|---|---|---|
| 8 | ~2.1M | $0.37 | **$7.8** | $17.9 |
| **15** | ~3.9M | $0.69 | **$14.6** | $33.6 |
| 25 | ~6.5M | $1.15 | **$24.3** | $56.0 |

Free `1M×model` quota covers roughly the first real day at N=8 outright. Reserve ~25–30% of the $90 for dev/debug token burn during the build.

### 4.4 Tiered model routing (named Qwen services on Alibaba Cloud Model Studio / DashScope)

| Job | Model | Why |
|---|---|---|
| Routine action / reaction check / importance scoring (batched 10/prompt) | **qwen-flash** ($0.05/$0.40, →$0.025/$0.20 batched) | Workhorse, ~90% of calls |
| Dialogue turns, hourly plan/decompose | **qwen-plus** ($0.40/$1.20 → batched) | Quality where it shows |
| Daily plan, reflection/insight synthesis | **qwen3-max** ($1.20–2.40/$6.00) | Rare, deep reasoning |
| Hero-moment prose (optional) | **qwen3.7-max** | Reserve; premium only |
| Memory embeddings | **text-embedding-v4** (1024-dim, MRL) | ~$0; `query` vs `document` |
| Rerank | **gte-rerank-v2 / qwen3-rerank** | Cheap retrieval-quality win |
| Character voices | **CosyVoice** (clone once → `voice_id`; synth `cosyvoice-v2`) | Voice identity spine |
| On-demand video | **Wan i2v** (`wan2.2-i2v-flash` cheap / `wan2.6-i2v`) | ~$0.02–0.045/5s; async, gated |
| World perception / clip QA / moderation | **qwen3-vl-plus** | Caption scenes, moderate user images |
| "Talk to an agent" judge booth (optional) | **qwen3-omni-realtime** | Showcase only; cut first, never on the 24/7 hot path |

Verify exact snapshot IDs in-console (they drift monthly; "qwen3.7-max" and similar suffixes need confirming). Use `x-dashscope-session-cache` / implicit cache (20% on cached input, min 1024-token prefix) only on any *interactive* path you keep (cache and Batch cannot stack).

### 4.5 Media layer (identity spine → live view → on-demand → highlights)

**Identity spine (generated once per character, the consistency glue):** one canonical portrait (locked seed) + one 3–10s voiceprint (CosyVoice zero-shot) + a trait/style-token vector. **Rule: no media call ever generates identity from scratch** — Wan always gets the portrait as init frame; TTS always gets the same voiceprint. Zero per-clip drift across clip #1 and clip #50.

- **Live view (default, ~$0):** client-side Phaser/PixiJS town + thought-ticker + speech bubbles + relationship threads (all reuse data the sim already writes; no per-frame inference).
- **On-demand video — Tier A (default, seconds, pennies):** compile a **Scene Descriptor** (`char_id, location, time, co_present, current_action, dialogue_lines[], top-k memories, mood, backdrop_key`) into a **HyperFrames** HTML animatic — 3–6 keyframes (IP-Adapter portrait into cached location plates), GSAP Ken-Burns/parallax motion, CosyVoice VO in the cloned voice, auto-synced captions → 8–20s MP4.
- **On-demand video — Tier B (reserve, queued):** **Wan i2v** from the canonical portrait as init frame for milestone beats (importance ≥ 8) and the daily hero shot; composited *back into* HyperFrames for the same VO/caption/branding layer. Async job + progress toast, never blocking.
- **Daily highlights (highest ROI):** an **Editor Agent** selects the day's top events by `I(m)` (boosted by novelty, reflection-linkage, and social-reaction weight), diversifies with max-per-location caps, writes a cold-open→beats→cliffhanger VO, and HyperFrames stitches a 60–90s captioned episode (~$0.05–0.15) with one Wan hero shot. Fires once/sim-day via scheduler, unattended → **the recurring content engine that keeps the product alive through judging with zero human labor.**

### 4.6 The social-media interaction memory loop (the true innovation)

```
Day T evening   → characters post (importance ≥ 6, capped 1–3/day; avatar-consistent image)
Overnight       → users/judges reply to posts
Day T+1 morning → moderation gate (profanity/prompt-injection/PII + per-user rate limit + importance cap)
                  → accepted replies transduced to observation memories, poignancy +2
                  → batch-ingest → morning planning is GUARANTEED to retrieve ≥1 fresh external observation
Day T+1         → reflection may synthesize a higher-order belief → alters plans
                  → character visibly reacts: posts back CITING @user, appears in the daily highlight
```

**Guaranteed-visible causality (demo-critical):** tag ingested replies `addressed_to=char_id`; force the morning prompt to surface them; render a "💬 responding to @judge" citation linking back to the reply so **the judge sees their own message caused this.** A judge who tweets tonight gets a recap clip tomorrow of the character reacting in its cloned voice — that *is* the Aug-11 retention mechanic, not a bolt-on.

### 4.7 Alibaba Cloud deployment

- **Runner:** single **ECS** box (12-month individual free trial covers the whole window at $0; upgrade to a ~$3.50–10/mo burstable instance if 1 GB OOMs), a **Node worker as a systemd service** (`Restart=always`) holding world state in memory, ticking via an in-process scheduler / BullMQ. Slow, out-of-band jobs (Wan, reflection) run on a queue so the tick never stalls. A **heartbeat row** proves "sim is alive." (Not Function Compute — its trial credits expire around Aug 11 and it's stateless, fighting the "continuously running world" premise.)
- **Memory / state:** **RDS PostgreSQL + pgvector** (pragmatic solo pick: memory *and* relational state in one DB; HNSW index; SQL filters) — or **Tablestore vector** for lowest idle cost. Store the tick log + `jobs` table (DashScope task IDs) so a restart resumes in-flight Wan polls before the **24h output-URL expiry**.
- **Assets:** **OSS** for all binaries. On Wan/CosyVoice completion, **immediately download bytes and `PutObject` to OSS**, store the *OSS* URL — never persist the 24h DashScope URL.
- **Frontend:** Next.js spectator dashboard; **poll the DB every 3–5s** (zero-infra, hardest to break; doubles as the replay reader) or SSE. Spectator view = pure DB/OSS reads → unlimited judges cost ~nothing.
- **Proof-of-deployment file** (`deploy/alicloud.ts` + header comment): DashScope client init against `dashscope-intl.aliyuncs.com` from `DASHSCOPE_API_KEY`; `ali-oss` `PutObject`; the pgvector/Tablestore connection; ECS region/spec + systemd unit; redacted-but-present bucket/instance/endpoint IDs. A judge can trace request → Qwen model → OSS → DB, all on Alibaba.
- **Judge-safety:** hard daily token cap + "safe idle mode" that serves cached state if the sim pauses; a **`?mode=replay` golden-run fallback** (recorded NDJSON timeline played through the same components) that auto-engages on a stale heartbeat; **all Wan/CosyVoice disabled from any user-triggered path** (pre-rendered only); judge interactions routed to qwen-flash with per-IP token-bucket limits + a global daily budget + a kill-switch to read-only.

---

## 5. THE 12-DAY MVP CUTLINE (Jul 8–20)

**Ships (non-negotiable core):** memory stream + `I(m)` retrieval; 8–15 agents living with dialogue/reflection/planning; the fast-forward buffer + Batch; 2D live view + thought-ticker; the **social post→reply→memory→visible-reaction loop**; the **ablation eval + chart**; on-demand HyperFrames animatic; daily-highlight Editor Agent; Alibaba deploy + proof file + live URL; replay fallback.

**Cut order (first to go):** qwen3-omni "talk live" booth → Wan cinematic Tier B (fall back to HyperFrames-only hero shot) → per-town ensemble episodes (keep per-character) → autonomous post *images* (ship text-only posts) → agent count (drop N=15→8). **Never cut:** the audience-causal loop and the ablation chart — those are the win.

**Day-by-day:**
- **D1 (Jul 8):** Scaffold — ECS + RDS/pgvector + OSS + DashScope client; one qwen-flash round-trip. Generate 4–8 canonical portraits + voiceprints (identity spine).
- **D2 (Jul 9):** Memory stream + retrieval + single-agent loop. **→ GO/NO-GO test (below).**
- **D3:** Multi-agent + dialogue + reflection (poignancy-150 trigger) + recursive planning; 8 agents living.
- **D4:** **Fast-forward buffer + Batch API + tick-log persistence.** (Guardrail 1 checkpoint — must work.)
- **D5:** 2D live view (Phaser) + thought-ticker + speech bubbles + polling dashboard.
- **D6:** Social feed + autonomous posting (importance ≥ 6, capped).
- **D7:** Reply → moderation → ingest (+2 bias) → **visible causality citation**. *Guardrail 2 checkpoint: is a credible ablation reachable? If clearly not → pivot to Showrunner/Sabi now.*
- **D8:** **Ablation eval** — info-diffusion speed, relationship-graph density, audience-causal divergence; full vs. dialogue-ablated vs. no-audience; **produce the chart.**
- **D9:** HyperFrames on-demand animatic (Tier A) + daily-highlight Editor Agent.
- **D10:** Wan cinematic hero shot (Tier B, gated) + replay fallback + live-view polish.
- **D11:** Deploy hardening — proof file, architecture diagram, rate limits, kill-switch, cost caps; **start the live run.**
- **D12 (Jul 20):** Record <3-min demo, write README + license + docs, submit. Sim already live; keep buffer generating through Aug 11.

**Day-2 GO/NO-GO test:** *One agent must complete a full cognitive loop end-to-end — perceive an event, store it with an LLM poignancy score + embedding, retrieve the top-8 relevant memories on the next tick, and emit a plausible next action that visibly references a retrieved memory — persisted to the DB, on qwen-flash + text-embedding-v4, for < $0.05.* If the memory→retrieval→behavior chain doesn't demonstrably work for **one** agent by end of D2, the whole concept is at risk: descope to N=8, or fall back. This is the cheapest possible proof of the load-bearing mechanic.

---

## 6. THE 3-MINUTE DEMO (beat by beat)

Structure one causal *money shot*, not a feature tour.

- **0:00–0:20 — It's alive, right now.** Live 2D town with a real wall-clock timestamp on screen; thought-ticker scrolling. "This is Maya. Nothing here is scripted. Right now she's deciding whether to apologize to Tom after last night's argument."
- **0:20–0:50 — The society.** Pull back to the relationship graph + multiple agents; an emergent event in progress (a rumor, a party being planned). Ticker overlay: "info diffusion: 6/15 agents aware." Establishes multi-agent, not a chatbot.
- **0:50–1:35 — THE MONEY SHOT (audience in the loop).** Type a live reply to Maya's post on screen → the message drops into her memory stream **with a visible salience score** → her *next* action changes and she **cites your message** in her reasoning. *"That was a real message from outside the simulation, and it just changed what she does next."* The one beat no competitor — and not even Stanford — can show.
- **1:35–2:10 — The Salience Engine (one mechanism, three payoffs).** Same score → today's highlight reel auto-assembles from top-salience events → the single hottest beat renders as a Wan clip with HyperFrames captions + Maya's cloned voice. *"One importance function decides what she remembers, what the show highlights, and what we spend GPU on."*
- **2:10–2:40 — The measurable claim (wins the track).** Cut to the ablation chart: full multi-agent + audience vs. dialogue-ablated / no-audience baseline, on (a) information-diffusion speed, (b) relationship-graph density, (c) **audience-causal divergence** — the metric Stanford could never report. *"Multi-agent with audience coupling beats the ablated baseline by [X]."* That's the 30%+30% proof.
- **2:40–3:00 — It's been live the whole time.** *"This has run continuously on Alibaba Cloud since Jul 21 — open it and talk to Maya right now."* Close on the live URL + QR. The 24/7 constraint becomes a credibility asset judges can verify through Aug 11.

**Most clippable moment:** *"The judge tweeted; the character answered."* — live sim → identity-consistent media → cloned voice → human-in-the-loop behavior change → auto-produced episode, in one take.

---

## 7. DIFFERENTIATORS VS. PRIOR ART

| Project | Real-time spectator | Audience interaction (→ memory) | On-demand video of *current* life | Persistent social feed |
|---|---|---|---|---|
| Stanford Smallville | ✖ (sped-up replay) | ✖ | ✖ | ✖ |
| a16z AI Town | ✖ (replay) | ✖ | ✖ | ✖ |
| Fable SHOW-1 / Showrunner | ✖ (offline batch) | ✖ (solo author) | ⚠ (episodic, not "now") | ✖ |
| **This project** | ✔ (buffered "live") | ✔ (real replies → salience-scored memory → trajectory change) | ✔ (HyperFrames/Wan of the current state) | ✔ (followable per-character accounts) |

Every prior entry owns 1–2 legs; **none owns all four around a single, persistent, canonically-shared character whose current life is simultaneously spectated, video-rendered on demand, and steerable by a real crowd via a social feed.** The fusion is the invention — and the audience-coupled `I(m)` is the one thing the seminal prior work provably lacks. Name Smallville, AI Town, and Fable in the first 60 seconds to preempt the "clone" reflex, then show the money shot they cannot.