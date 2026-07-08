VERDICT: Enter **AGENT SOCIETY** as primary track. Do not enter AI Showrunner. Rationale, algorithm, impact framing, thesis, demo, and the budget/deploy plan below.

## 1. Track decision — Agent Society, decisively

**Why not Showrunner (despite thinner competition + higher token allowance):** Showrunner's rubric core is "autonomously handle the ENTIRE short-drama pipeline: scriptwriting → storyboarding → video → editing." Judged there, you compete against specialists on *pipeline completeness and video polish*, and your concept's actual innovation — persistent memory, multi-agent emergence, audience-in-the-loop — becomes **off-rubric noise that doesn't score**. Worse, emergent agent behavior is *messy* (agents wander, plots don't resolve); in a drama-pipeline track messiness reads as a defect, not a feature. You'd be entering your weakest surface against the field's strongest. Thin competition only helps if you fit the track; you don't.

**Why Agent Society wins:** The concept literally IS the track definition — "agents with distinct capabilities collaborate through task division, dialogue, negotiation." The 30% Innovation tie-breaker rewards exactly what makes Truman Show novel-vs-Stanford (audience-coupled memory). The "measurable multi-agent-vs-single-agent gain" requirement is not a threat — it's a *gift*, because the Stanford Generative Agents paper already established the exact eval protocol and you can replicate + extend it (details in §6). The video layer doesn't disappear — it becomes your Presentation (15%) and demo weapon, where HyperFrames gives you an unfair edge over other Agent Society entrants who will submit ugly log dumps.

**Net:** Agent Society aligns your true innovation with the highest-weighted, tie-breaking criterion; Showrunner would force you to hide it. Higher ceiling, and the "less competition" of Showrunner is illusory because you don't fit its rubric.

**Fallback trigger (state explicitly to the builder):** IF by ~day 7 you cannot produce a credible ablation eval (baseline + metric + chart), pivot to Showrunner as the safe floor — thin competition + your render moat guarantees a mid-pack finish there. But that caps you out of a win. Commit to Agent Society and protect the eval as the highest-priority deliverable.

## 2. The nameable algorithm (the 30% Innovation headline)

Headline ONE contribution. Do not list three. The winner:

**"Audience-Coupled Salience Memory" — a single unified importance function I(m) that scores every memory event on one scale and drives three subsystems at once.**

- **The novelty vs Stanford:** Stanford's retrieval = recency + importance + relevance, over *internally generated* observations/reflections/plans. It had **no external audience**. Your extension: social-media replies from real humans are ingested as first-class memories, scored by the same I(m), and thereby **causally alter agent trajectories**. Stanford's town was a closed sandbox; yours is an *open, perturbable* society. That open-loop-vs-closed-loop distinction is a genuine, defensible research delta — not a reskin.
- **Why it's elegant (sells Technical Depth 30% too):** ONE score, THREE uses:
  1. **Retrieval** — feeds the agent's next-action context (as Stanford).
  2. **Highlight selection** — top-salience events of the day auto-assemble the daily recap. No separate editing model; the memory importance *is* the edit decision.
  3. **Render budget gating** — only the single highest-salience beat earns an expensive Wan video; everything else renders as cheap HyperFrames HTML. Innovation and cost-control are the *same mechanism*.
- **Naming:** call it the **Salience Engine** in the repo/diagram; "audience-coupled memory consolidation" in the writeup. Judges remember one crisp name tied to one crisp diagram.

This beats "novel memory-consolidation" (too generic, Stanford-adjacent) and "importance-driven highlight editing" alone (a presentation trick, not a society contribution). The audience-coupling is the moat because it's the one thing the seminal prior work provably lacks.

## 3. Impact framing (the 25%) — lead with "instrument," not "toy"

Do NOT lead with entertainment/IP; judges discount spectacle. Rank of framings by Impact score:

1. **STRONGEST — controllable social-simulation testbed / research instrument.** Position it as a sandbox to study *information diffusion, social contagion, coordination, and — uniquely — how human feedback perturbs an agent society* (misinformation seeding, intervention A/Bs, parasocial/recommendation-loop dynamics) with zero human-subjects risk. The audience-in-the-loop layer is what makes it a *novel instrument*, not just a replay of Stanford. This reframes the whole thing from "AI toy" to "the first testbed where you can measure how a live audience reshapes a synthetic society."
2. Synthetic user research / behavioral prototyping (adjacent, name it as an application).
3. Living-world NPC engine for games (commercial go-to-market — mention as traction path).
4. Entertainment/IP (the *reach* mechanism that makes 1–3 accessible; keep as go-to-market, not the headline).

**Framing sentence for the writeup:** "A perturbable social-simulation sandbox — the entertainment layer is how we get thousands of real perturbations for free." That turns the spectator gimmick into the data-collection engine, which is a *serious* impact story.

## 4. Differentiation thesis (one sentence a judge remembers)

> **"Stanford built a town of AI minds you could only watch through a replay; we turned it into a 24/7 livestream you can talk to — and every message you send becomes a memory that rewires who these characters become."**

Shorter tagline for the diagram/title card: **"Generative agents, but the audience is inside the loop."**

## 5. The single best 3-minute demo narrative

Structure for one causal "money shot," not a feature tour:

- **0:00–0:20 — Hook (it's alive, right now).** Live view, real wall-clock timestamp on screen. One character mid-thought: "This is Maya. Nothing here is scripted. Right now she's deciding whether to apologize to Tom after last night's argument." Cursor over a live memory stream ticking.
- **0:20–0:50 — The society.** Pull back to the relationship graph + multiple agents. An emergent event visibly in progress (a rumor / a party being planned). On-screen ticker: "info diffusion: 6/25 agents aware." Establishes multi-agent, not a chatbot.
- **0:50–1:35 — THE MONEY SHOT (audience-in-the-loop).** You type a reply to Maya's social post on screen → the message drops into her memory stream **with a visible salience score** → her *next* action changes because of it (she cites your message in her reasoning). "That was a real message from outside the simulation, and it just changed what she does next." This is the one beat no competitor and not even Stanford can show.
- **1:35–2:10 — The Salience Engine (one mechanism, three payoffs).** Same score → today's highlight reel auto-assembles from top-salience events → the single hottest beat renders as a Wan video (HyperFrames captions/TTS). Show the rendered clip. "One importance function decides what the agent remembers, what the show highlights, and what we spend GPU on."
- **2:10–2:40 — The measurable claim (wins the track).** Cut to the ablation chart: full multi-agent + audience vs. single-agent / no-dialogue / no-audience baseline, on (a) believability TrueSkill, (b) information-diffusion speed, (c) relationship-graph density, (d) audience-causal-divergence. "Multi-agent with audience coupling beats the ablated baseline by [X]." This is the 30%+30% proof.
- **2:40–3:00 — It's been live the whole time.** "This has run continuously on Alibaba Cloud since [date] — you can open it and talk to Maya right now." Close on live URL + QR. Judges can verify through Aug 11, which turns the 24/7 constraint into a credibility asset.

## 6. The measurable "multi-agent gain" — exactly what to compute (protect this; it wins the track)

Verified from the Stanford paper — replicate its protocol, add your audience metric:

1. **Information diffusion speed.** Seed one fact in one agent (Stanford seeded Sam's mayoral run + Isabella's party). Measure fraction aware after N sim-days. Stanford: party invites spread **1→13 of 25 agents in 2 sim-days**. **Baseline ablation:** disable inter-agent dialogue → diffusion collapses. That delta IS your multi-agent-vs-single-agent gain, quantified.
2. **Relationship-graph formation.** Track edge density / new acquaintances over time; ablate dialogue → flat graph.
3. **Believability (TrueSkill).** Interview agents across five faculties (self-knowledge, memory, planning, reaction, reflection); rank full vs. ablated conditions. Stanford used 100 human raters + TrueSkill; you can approximate with a **qwen3-vl / qwen3.7-max LLM-judge** panel to stay in budget, human-spot-checked. Full architecture beats ablations "by large margins" in the paper — you're reproducing an established, defensible result on Qwen infra.
4. **Audience-causal divergence (YOUR novel metric).** A/B the same world state with vs. without an injected audience message; measure trajectory divergence (KL of action distribution / relationship-graph edit distance) over the next K ticks. Nonzero, controllable divergence = proof the audience loop is real and the system is a perturbable instrument. **This is the metric Stanford could never report** — headline it.

An emergent set-piece (a spontaneous party or a rumor cascade) is great *color* for the demo, but the **ablation deltas are the scoreable claim** — judges reward the chart, not the anecdote.

## 7. Budget + 24/7 survival (load-bearing — the deploy must live 3 weeks on ~$90+voucher)

The continuous-run requirement is both your credibility asset and your biggest failure risk. Concrete controls:

- **Event-driven / adaptive sim clock.** A "continuously running world" does NOT need per-second ticks. Tick on a scheduler (Function Compute cron); **accelerate ticks only when someone is watching**, idle-slow (e.g., 1 tick / 10–30 min) when unobserved. This is the single biggest token saver and keeps the world "live" 24/7 cheaply.
- **Model tiering.** qwen3.6-flash for the routine tick/perception loop; reserve qwen3.7-max for rare reflections + highlight synthesis only. Most ticks are cheap.
- **KV-cache reuse.** Use `x-dashscope-session-cache` so the *growing* memory context isn't re-billed every tick — memory streams balloon, this is essential at 24/7 scale.
- **Batch API (50% off)** for nightly memory consolidation + highlight assembly (non-realtime by definition).
- **Video is the budget killer — hard-gate Wan.** Never auto-render per tick. Rule: cheap **HyperFrames HTML** (TTS + word-synced captions — builder already owns this, near-zero API cost) for *all* highlights; spend Wan on exactly **one daily hero beat** (the day's max-salience event) plus **user-paid on-demand requests only**. The Salience Engine (§2) enforces this automatically.
- **Deployment artifact ("code file proving Alibaba deployment"):** Function Compute scheduled trigger drives ticks; **Tablestore** (or RDS) for the memory stream + relationship graph; **OSS** for rendered clips; ECS only if you need a persistent websocket for live spectating. The FC function + scheduler config is your proof-of-deploy file. Text-embedding-v4 + qwen3-rerank for memory retrieval.

**Risk to flag to the builder:** the top failure mode is a runaway token bill silently draining the voucher mid-judging and taking the demo offline. Add a hard daily token cap + a "safe idle mode" that keeps the site up (serving cached state) even if the live sim pauses. A dead URL during Jul 28–Aug 11 zeroes the Presentation score and undercuts the "it's live" thesis.

## Sources
- Stanford Generative Agents (Park et al., 2023): believability TrueSkill ablation (observation/reflection/planning), 100 raters, five-faculty interview; information-diffusion + Valentine's party emergence (1→13/25 in 2 days). https://arxiv.org/pdf/2304.03442 ; https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763