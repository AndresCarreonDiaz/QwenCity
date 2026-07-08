# MEDIA + INTERACTION LAYER — Generative-Agent Truman Show

## 0. IDENTITY SPINE (the consistency glue — prerequisite for §1–4)

Every media surface derives from **one canonical anchor per character**, generated once at character creation. This is the differentiator that makes clips feel like a coherent "show" instead of random AI slop.

| Anchor | Artifact | Generated | Reused by |
|---|---|---|---|
| Visual seed | 1 canonical portrait (Flux/SDXL) + locked seed + text descriptor | Once, at spawn | 2D sprite base, Wan i2v **first frame**, social avatar, img2img reference (IP-Adapter) for scene posts |
| Voice seed | 1 reference clip 3–10s → CosyVoice2 zero-shot voiceprint | Once, at spawn | Every TTS call: live bubbles (opt), on-demand clips, highlight narration, "spoken" posts |
| Personality seed | trait vector + speaking-style tokens | Once | Post copy, dialogue, caption tone |

Rule: **no media call ever generates identity from scratch.** Wan always gets the canonical portrait as init frame; CosyVoice always gets the same reference audio. This guarantees visual + voice continuity across §2 clips with zero per-clip drift. Store as `character.identity{portrait_url, seed, voiceprint_ref_url, style_tokens}`.

---

## 1. LIVE VIEW — cheap default vs cinematic reserve

**RECOMMENDATION: stylized 2D map is the default; Wan is on-demand only (§2).** Do not render live video — it's cost-prohibitive and unnecessary for "aliveness."

### Default: Phaser/PixiJS top-down town (Sims/Stardew aesthetic)
- **Cost: ~$0** — client-side canvas render; no per-frame inference. Sprites = tinted/re-posed variants of the canonical portrait (or a fixed 8-direction sprite atlas keyed to the portrait's palette).
- **Aliveness signals (all reuse data the sim already produces):**
  - **Speech bubbles**: dialogue events → floating bubble above sprite, 3–5s TTL. Text only by default (free). Optional CosyVoice audio on hover/click (streaming, 150ms first-packet — cheap enough for interaction, not for ambient).
  - **Thought-stream ticker**: a scrolling side panel bound directly to the **memory stream** — each new observation/reflection prints as it's written, color-coded by type (observation / plan / reflection / dialogue) and sized by **importance score** (§3 reuse). This is the "Truman" voyeur hook: you literally watch the mind.
  - **Action-state overlay**: sprite emoji/pose from current action node ("🍳 making breakfast"), plus a low pill showing the agent's current plan step.
  - **Relationship threads**: faint lines between co-located agents when a conversation fires.
- **Time controls**: 1×/4×/instant "skip to next notable event" (jump to next importance≥7 event) — lets judges fast-forward to drama.

### Reserve for Wan: "cinematic moments" only
Trigger cinematic render (§2 premium) on: user click, a milestone importance-spike (≥8, e.g. a fight/confession/death), or the daily hero shot (§3). Everything else stays 2D. This keeps GPU spend bounded and makes video feel like an *event*.

**Why this wins:** the 2D map + live thought-ticker is the "watchable at a glance, runs 24/7, costs nothing" substrate that a hackathon can actually keep online through Aug 11. Video is the garnish, not the meal.

---

## 2. ON-DEMAND VIDEO — "show me what my character is living now"

Two-tier compile pipeline off a shared **Scene Descriptor** built from current sim state.

### Scene Descriptor (the compile input — assembled from sim, not authored)
```
{ char_id, location, time, co_present[], current_action,
  dialogue_lines[] (last N, in-character),
  retrieved_memories[] (top-k by importance×recency×relevance),
  mood, backdrop_key }
```

### Tier A — HyperFrames Animatic (CHEAP DEFAULT, ~seconds, pennies)
The builder's core engine. Compile the Scene Descriptor into an HTML composition:
- **Keyframes**: 3–6 stills = canonical portrait (IP-Adapter img2img into `backdrop_key` scene) + pre-generated location plates. Cache scene plates per location → most clips need **zero new image gen**.
- **Motion**: GSAP Ken-Burns pans/zooms, parallax, transitions between keyframes → reads as an animatic, not a slideshow.
- **Voice**: CosyVoice2 (`chenxwh/cosyvoice2-0.5b`) speaks `dialogue_lines[]` in the **character's cloned voice** (voiceprint anchor). 150ms first-packet, streaming.
- **Captions**: HyperFrames auto-caption synced to the TTS track.
- **Output**: 8–20s MP4. Cost ≈ TTS + (mostly cached) image ops — cents. Latency: near-real-time, good for interactive clicks.

### Tier B — Wan i2v Premium (RESERVE, queued)
For "cinematic moment" clicks and hero shots:
- **Wan 2.2 i2v** on Replicate, **canonical portrait as init frame** (identity lock), motion prompt from Scene Descriptor.
- **Cost/latency (verified):** ~$0.02–0.045 per 5s 720p clip; gen ≈ 39s @480p / ≈150s @720p. → **Async job + progress toast**, never blocking. Default 480p for speed, 720p for the daily hero.
- Composite Wan shots **into HyperFrames** as scenes → get the same CosyVoice VO + captions + transitions layer on top. Wan supplies the moving image; HyperFrames supplies voice/edit/branding.

### Consistency contract across clips
- Visual: always Wan-from-canonical-portrait / IP-Adapter-from-canonical-portrait.
- Voice: always same voiceprint ref → same timbre in clip #1 and clip #50.
- Brand: HyperFrames intro/outro sticker + lower-third character nameplate on every export → cohesive "channel" identity.

**UX**: button on each character = "▶ What are they living right now?" → Tier A instantly; a "Make it cinematic 🎬" upgrade re-renders that scene via Tier B.

---

## 3. DAILY HIGHLIGHTS — the editor agent (highest ROI feature)

An **Editor Agent** that reuses the memory stream's **importance scores** (the Stanford generative-agents design: each memory gets an LLM poignancy rating 1–10 at write time). No new scoring model needed — the selection signal already exists.

### Selection algorithm (cheap, deterministic-ish)
1. Pull the day's memories for the character (or all characters for a town episode).
2. **Score each event** = `importance` (primary) boosted by: novelty (new relationship/first-time action), reflection-linkage (events that triggered a reflection are inherently pivotal), and social-reaction weight (§4 replies bump it). 
3. **Diversify**: greedy pick top events with a max-per-location / max-per-relationship cap so the recap isn't 6 breakfast scenes.
4. Target 5–8 beats → 60–90s.

### Compile (HyperFrames, ~$0.05–0.15/episode)
- Editor Agent writes a **narrative arc** (cold-open hook → beats → cliffhanger button) as VO script in a narrator or the character's own voice (CosyVoice).
- Each beat = a Tier-A animatic scene; optionally **1 Wan hero shot** for the day's single biggest moment (importance max).
- HyperFrames stitches: title card ("Isabella — Day 12"), captioned scenes, transitions, recap music bed, "Tomorrow…" teaser card.
- **Two formats**: per-character episode (personal, shareable) and per-town episode (ensemble drama, the "show").

### Cadence
Auto-fires once/sim-day (cron). Because it's mostly HyperFrames + cached plates + a few TTS calls, a full town's daily episodes cost cents and render unattended → **the recurring content engine that keeps the product alive through judging without human effort.** Push the episode to the user (and to judges who follow a character).

**Why it's high-impact:** it converts an opaque simulation into an *episodic narrative* automatically — the single clearest embodiment of "generative sim → watchable product," and it directly demonstrates the memory-stream architecture doing double duty.

---

## 4. SOCIAL MEDIA LAYER — the autonomous post ⇄ reply ⇄ memory loop

This is the engagement flywheel and the judge-retention mechanic. Design the loop precisely:

### 4a. Autonomous posting (character → feed)
- **Trigger**: during the agent's action loop, when a just-written memory has `importance ≥ 6`, OR on a cadence cap (1–3 posts/sim-day) to avoid spam.
- **Compose**: LLM writes a first-person caption in `style_tokens` voice, referencing the triggering event. Optional image: IP-Adapter img2img placing the **canonical avatar** into the scene → avatar-consistent "selfie/scene" post. Optional "voice note" = CosyVoice clip.
- **Store**: `feed_post{id, char_id, ts, text, image_url, source_memory_id, importance}`. Render in an in-app feed (Twitter/IG-style), grouped by character = each agent has a followable "account."

### 4b. User/judge replies (human → character)
- User replies/DMs on a post: `reply{id, post_id, user_handle, text, ts}`.
- **Moderation gate** (before ingestion): profanity/injection/PII filter + per-user rate limit + importance cap → prevents prompt-injection and abuse from steering agents.

### 4c. Ingestion into memory stream (the causal bridge)
- Each accepted reply is **transduced into an observation memory**:
  `"On {date}, {user_handle} replied to my post: '{text}'"`
- Insert into that character's **memory stream** with a normal LLM poignancy score, then **+2 bias** (direct external human interaction = salient) so it competes strongly in retrieval.
- Because retrieval = **recency × importance × relevance** (unchanged Stanford pipeline), the reply surfaces in the **next planning + reflection cycle**:
  - Reflection may synthesize a higher-order belief ("people think I should pursue the café job") → alters plans.
  - Next action loop retrieves it → agent references it in dialogue, changes a decision, or writes a responsive post.

### 4d. Guaranteed visible causality (demo-critical)
The loop is real, but to make the causal chain *legible* to a judge on a schedule:
- Tag ingested replies `addressed_to=char_id`; make the **morning planning prompt guaranteed to retrieve ≥1 fresh external observation** and the day's first post explicitly reflect on yesterday's replies.
- Surface the chain in UI: on the character's next post/episode, show a "💬 responding to @judge" citation linking back to the reply → the judge *sees their own tweet caused this*.

### 4e. Timing contract (this is the Aug-11 retention engine)
```
Day T evening  → characters post (importance-gated)
Overnight      → users/judges reply
Day T+1 morning→ batch-ingest replies as observations → planning/reflection
Day T+1        → character visibly reacts (post + appears in daily highlight §3)
```
A judge who tweets at a character tonight gets a **notification tomorrow** with a recap clip of the character reacting in its own cloned voice. That's a reason to come back daily from now through Aug 11 — the loop *is* the retention mechanic, not a bolt-on.

---

## 5. RUBRIC MAPPING + most clippable moment

| Feature | Innovation | Presentation | Impact |
|---|---|---|---|
| §1 2D live view + thought-ticker | Memory-stream visualized live (novel) | ★★★ always-on, glanceable | Runs 24/7 at ~$0 → product actually stays up |
| §2 On-demand HyperFrames/Wan | Two-tier cheap↔cinematic w/ identity lock | ★★★ instant "living now" payoff | Interactive; low cost keeps it usable |
| §3 Editor-agent daily highlights | **Reusing importance scores as an edit signal** = the standout technical idea | ★★★ episodic narrative, auto-produced | Content engine w/o human labor = scalable, judge-facing |
| §4 Social post⇄reply⇄memory loop | **Closed human→memory→behavior loop** = the true innovation | ★★ feed UI | ★★★ engagement flywheel + Aug-11 retention |

**Weight your pitch:** §4 (loop) + §3 (editor agent) carry **Innovation**; §1+§2 carry **Presentation**; §4's retention loop + §3's zero-labor content carry **Impact**. All four are unified by the identity spine (§0) and powered by HyperFrames — reinforce "the media engine is *why* this sim became a show."

### Single most clippable 3-minute demo moment
**"The judge tweeted; the character answered."** — it fuses all four systems into one causal reveal.

**Beat sheet (≈3:00):**
1. **0:00–0:30** — Live 2D town, thought-ticker scrolling; narrate "these agents live 24/7." Click a character → click "What are they living now?" → instant HyperFrames animatic in the character's **cloned voice** (proves §1+§2 + voice identity).
2. **0:30–1:15** — Cut to the feed: character autonomously posted last night (avatar-consistent image). On screen, **type a live reply as "the judge."** Show the reply landing in the memory stream with its importance score (proves §4 ingestion + §0).
3. **1:15–2:15** — "Advance one day." Show planning/reflection retrieving the reply → character changes a decision. The character posts back, **citing @judge** (proves §4 causality).
4. **2:15–3:00** — Play the **auto-generated daily highlight episode** (§3): 60–90s, editor-agent-selected by importance, opening on a **Wan cinematic hero shot** of the character reacting, VO in its cloned voice, captions, transitions — a finished mini-episode. Close on the "Tomorrow…" teaser.

That clip demonstrates: live sim → identity-consistent media → cloned voice → human-in-the-loop behavior change → auto-produced episode. It is the whole thesis in one take, and the "you talk to it, it remembers you tomorrow" reveal is the shareable hook.

---
**Verified specs:** Wan 2.2 i2v (Replicate) ≈$0.02–0.045 / 5s 720p, ~39s@480p / ~150s@720p gen. CosyVoice2-0.5b (`chenxwh/cosyvoice2-0.5b`) zero-shot cloning, streaming 150ms first-packet, multilingual. Importance/recency/relevance retrieval + poignancy 1–10 scoring = Park et al. 2023 generative-agents memory stream (reused directly in §3/§4).