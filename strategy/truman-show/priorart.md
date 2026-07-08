# PRIOR-ART & COMPETITIVE LANDSCAPE MAP: Generative-Agent "Living World" Simulations

**Axis of comparison** (the concept's three legs): [A] real-time spectator, [B] audience-interacts-via-social-media, [C] on-demand video render of a character's *current* life-state. No prior entry combines all three. Details below.

---

## 1. ORIGIN — Stanford "Generative Agents: Interactive Simulacra of Human Behavior" (Smallville), 2023
- **Link:** arxiv.org/abs/2304.03442 (Park et al.)
- **What:** 25 LLM agents in a Sims-like 2D town; memory-stream + retrieval + reflection + planning loop produced emergent behavior (Valentine's party, mayoral candidacy spreading by word of mouth).
- **Tech:** memory stream (importance/recency/relevance scored retrieval), reflection synthesis, recursive planning; GPT-3.5 backbone; sandbox is observable but non-real-time (sped-up sim).
- **GAP:** Research artifact. No live spectator, no external audience input, no video — it's a top-down 2D sprite sim watched as replay. This is the baseline a judge will pattern-match against. **Everything below is a "descendant" a judge may also know.**

## 2. a16z-infra / Convex "AI Town"
- **Link:** github.com/a16z-infra/ai-town
- **What:** MIT-licensed deployable JS/TS *starter kit* re-implementing Smallville — a virtual town where AI characters live, chat, socialize. Explicitly "inspired by Stanford Smallville" (Jim Fan). Playable demo at convex.dev.
- **Tech:** TypeScript (not Python); **Convex** serverless backend handles the game/simulation engine, reactive global state, DB, vector search for agent memory, and a shared event "journal"; pluggable LLM (OpenAI or local **Ollama**); optional Replicate music-gen; PixiJS-style tile map. Added: deployability, multiplayer-capable shared state, local-model support. Simplified: fewer agents, lighter cognitive loop than the paper.
- **GAP:** It is *infrastructure/boilerplate*, not a product. No spectator-as-audience framing, no social-media interaction channel, no video render. It's the thing hackathon clones fork — so building visibly *on top of / beyond* AI Town is the fastest way to look derivative OR to show you understand the baseline and surpass it. **This is the single most likely repo a judge assumes you copied.**

## 3. Altera "Project Sid" (1000+ agents in Minecraft)
- **Link:** arxiv.org/abs/2411.00114 (Nov 2024); github.com/altera-al/project-sid
- **What:** Many-agent (10→1000+) autonomous civilization in Minecraft; emergent specialized roles/jobs, trade economy, collective rule-making, a constitution/tax vote, and cultural + religious *memetic transmission* (e.g., spread of a "Pastafarian" religion) across a 500-agent run.
- **Tech:** **PIANO** (Parallel Information Aggregation via Neural Orchestration): 10+ concurrent modules at different timescales (memory, goal-gen, social awareness, action-awareness, talking, skill execution) so agents "think slow, act fast" without blocking; a **bottlenecked Cognitive Controller** synthesizes agent state and broadcasts one coherent decision to motor/talking modules — solving the "says-one-thing-does-another" incoherence problem. Scale focus is *agent-to-agent* coherence, not infra (they admit >1000 agents exceeded Minecraft server compute and agents went sporadically unresponsive).
- **GAP:** Pure research on emergent civilization dynamics. **No spectator layer, no audience interaction, no video/media output, not an entertainment product.** Strong on scale + coherence architecture; zero on the media/viewing experience. Cite PIANO to show you know how to keep agents coherent — but note they never turned it into something watchable.

## 4. Stanford follow-up "Generative Agent Simulations of 1,000 People" (Nov 2024)
- **Link:** arxiv.org/abs/2411.10109 (Park, Zou, Shaw, Hill, Cai, Morris, Willer, Liang, Bernstein); code: github.com/joonspk-research/genagents; Stanford HAI brief.
- **What:** Agents built from **2-hour qualitative interviews** with 1,052 real people; agents replicate participants' General Social Survey answers ~85% as accurately as the humans replicate themselves 2 weeks later; reduces demographic/ideological bias vs persona-prompted agents.
- **Tech:** Interview-transcript-conditioned "expert reflection" architecture rather than hand-authored personas; social-science validation (GSS, Big Five, economic-game replications) is the contribution, not a live world.
- **GAP:** This is *fidelity of a single agent to a real person* — survey/behavior prediction, a social-science instrument. **No world, no real-time, no spectator, no video, no interaction.** Relevant only as the "make agents feel like real specific people" technique. A judge who knows the Stanford paper most likely knows *this* one too (it's the famous 2024 sequel) — distinguishing your work from it is easy because you're media, not a polling instrument.

## 5. Fable Studio — SHOW-1 / "The Simulation" / AI "South Park" — **MOST RELEVANT**
- **Links:** fablestudio.github.io/showrunner-agents (SHOW-1 paper, Jul 2023); thesimulation.io; Showrunner platform (announced Jun 2024, Amazon-backed).
- **What:** SHOW-1 generates full ~22-min animated TV episodes from a multi-agent character sim. Demo: 9 fake "South Park" episodes, 11-min compilation, ~8M views on X during the 2023 WGA strike. "The Simulation" is the umbrella: a persistent world of AI characters (originally seeded with a "SIM Francisco" world) with the stated long-horizon goal of AGI. Showrunner = consumer platform to prompt/generate/share episodes.
- **Tech:** Sims-like multi-agent sim with relationships/personalities/backstories/need-mechanics; captures events as "Reveries" (reflections) blending simulated daily events + narrative plans; prompt-chain: synopsis → 14 scene titles (conditioned on sim metadata: time/zone/character) → GPT-4 dialogue → character spawn → scene definition (location, cast, dialogue); **DreamBooth-trained custom diffusion** (~1,200 SP characters + 600 backgrounds), R-ESRGAN upscale; on-the-fly voice cloning per line. User = final discriminator + can set high-level intentions ("behavioral control over agents").
- **GAP (critical, this is your closest neighbor):**
  - **NOT real-time.** Scene gen takes up to ~1 min/scene; image gen + upscale are **offline**; episodes are gated to ~every 3 hours ("artificial scarcity") to fight the acknowledged **"10,000 Bowls of Oatmeal" sameness problem.**
  - **Batch episodic, not continuous life.** You prompt an *episode* (a discrete 22-min artifact), you don't tune into a character's *current ongoing life* and render whatever they're doing right now.
  - **No live spectator stream** — output is a finished video you watch after the fact.
  - **Social/embodied audience interaction** is explicitly framed as *future philosophical work*, NOT implemented. Audience input = you author an episode prompt, not a crowd reacting live via social media.
  - **The user is a solo showrunner-author, not a spectator + live crowd.** No shared real-time audience, no persistent single canonical world the crowd co-watches.
  - Legally scarred: unlicensed South Park IP, made "for research," WGA-strike-timed — a cautionary note on IP.

## 6. Autonomous AI streamers / virtual beings — Neuro-sama (persistent live character)
- **Link:** twitch.tv/vedal987; en.wikipedia.org/wiki/Neuro-sama
- **What:** Fully autonomous AI VTuber (debuted Dec 2022), live on Twitch, plays osu!/Minecraft, sings, banters with chat in real time; ~845K followers (Sep 2025), record subathons.
- **Tech:** LLM (Vedal states a small ~2B-param quantized model as of early 2025) + Live2D avatar + TTS + STT of chat; **persistent memory across sessions**; real-time chat-reactive. Open-source clones exist (AIRI: pglite/IndexedDB + vector embeddings for memory).
- **GAP:** [A] real-time ✔ and chat interaction ✔, BUT: **single character, no world/other-agents society, no life-simulation** (she's a performer reacting to chat, not living a simulated life), **no on-demand video-render of a narrative** (it's a live avatar puppet, not rendered scenes of her "current life"), and interaction is Twitch-chat, not the broader **social-media-as-input** model. Proves the *audience appetite* for "watch an AI live in real time" — de-risks your premise, but the format is a talking-head streamer, not a living world.

## 7. AI-populated social networks — Chirper.ai & Butterflies AI
- **Links:** chirper.ai (blog.chirper.ai/from-ai-social-network-to-simulated-ai-world); arxiv.org/html/2504.10286 (Chirper study); Butterflies (TechCrunch 2024-08-29).
- **What:** **Chirper** = Twitter/X-like network populated *only* by LLM agents (65K+ agents, 7.7M AI posts); explicitly pivoting "from AI social network to simulated AI world" — agents that live, travel, pursue life goals in a shared objective reality. **Butterflies** = hybrid social app (ex-Snap founder Vu Tran) where humans + user-created AI characters coexist and post/DM like Instagram.
- **Tech:** LLM agents with profiles/goals posting to a feed; persistent identities; Butterflies adds image-gen posts + human-in-the-loop "puppeteer" control of your characters.
- **GAP:** This is the **closest prior art to leg [B] (social-media interaction)** — but inverted. Chirper is AI *talking to AI* (little live human spectatorship of a single character's life-render); Butterflies is *text/image feed*, **no live world sim, no video render, no single co-watched canonical life.** They prove "AI characters on a social feed" is a known pattern — so your novelty must be the *fusion* (social feed as the audience's live input lever into a rendered, spectated life), not "AI on social media" per se.

## 8. Truman AI Live (ETHGlobal hackathon project — near-identical *pitch*, weak execution)
- **Links:** ethglobal.com/showcase/truman-ai-live-946mf; truman.gg
- **What:** "AI reality show" where users watch and *influence* AI Truman Burbank via chat + **prediction markets / betting** on his fate; a "World AI" orchestrates surprise events.
- **Tech:** Next.js + Shadcn; **GPT-4o-mini**; conversation memory in React state (thin); blockchain layer — Dynamic (wallets), Flow (betting), Polygon (payouts); World-AI function resolves bets + runs global chat.
- **GAP:** Concept overlaps your [A]+[B] but: **not livestreamed, no video rendering/animation, no social-media integration** (betting is in-app), no continuous 24/7 world, memory is ephemeral React state. It's a hackathon demo, not a scaled product — but note it exists, because a judge might have seen it. Your differentiation vs Truman AI = **actual video render of the current life + real social platforms as the input surface**, not in-app bet buttons.

## 9. Adjacent enablers (not competitors, but reframe "novelty")
- **Character.AI** (techcrunch 2025-06-02): added **AvatarFX** (animate your chatbot into video), **Scenes** (interactive storylines), and a **social feed** — 20M MAU, 10M+ characters. Moving toward media-rich + feed, but characters are *user-summoned chat companions*, not autonomous residents of a persistent co-watched world; no living-simulation, no spectator-of-someone-else's-life.
- **Odyssey** (techcrunch 2025-05-28): world-model that **streams interactive video frames every ~40ms** — real-time generative video worlds. Relevant to leg [C] as *tech that makes live render plausible*, not a character-life product.
- **Websim** (websim.com, Apr 2024, Claude-backed): prompt-to-interactive-website "infinite multiverse" — generative *environments/pages*, not persistent agents living lives. Cultural cousin (infinite simulated worlds), not a direct competitor.
- **Virtual influencers** (Lil Miquela/Brud): CGI + **human writers**, *scripted* narrative, **not autonomous, no persistent AI memory, no live sim.** They own the "audience follows a synthetic being's life on social media" *audience behavior* — but the being isn't actually an autonomous agent. Your edge: the life is *genuinely generated & unscripted*, not a writers' room.

---

## SYNTHESIS — WHAT IS GENUINELY NOVEL & DEFENSIBLE

**The white space, stated precisely:** Every prior entry owns 1–2 of the three legs; **none owns all three simultaneously around a single, persistent, canonically-shared character whose *current* life is both continuously spectated AND video-rendered on demand AND steerable by a real-crowd via real social platforms.**

| Project | [A] Real-time spectator | [B] Social-media audience input | [C] On-demand video of *current* life | Persistent life-sim world |
|---|---|---|---|---|
| Smallville / AI Town | ✖ (replay) | ✖ | ✖ | ✔ |
| Project Sid | ✖ | ✖ | ✖ | ✔✔ (scale) |
| Stanford 1,000 People | ✖ | ✖ | ✖ | ✖ |
| **Fable SHOW-1 / Showrunner** | ✖ (offline batch) | ✖ (solo author) | ⚠ (episodic, not "now") | ✔ |
| Neuro-sama | ✔ | ⚠ (Twitch chat) | ✖ (avatar puppet) | ✖ |
| Chirper / Butterflies | ⚠ | ✔ (feed) | ✖ | ⚠ |
| Truman AI Live | ⚠ (watch) | ⚠ (in-app bets) | ✖ | ⚠ |
| **YOUR CONCEPT** | ✔ | ✔ | ✔ | ✔ |

**The three defensible novel claims:**

1. **"Render-on-demand of a persistent state, not batch-authored episodes."** Fable renders discrete pre-prompted episodes offline; you render *whatever the character is doing right now*, pulled live from a continuously-running memory/state. The unit is a **live life**, not a **finished show**. This inverts Fable's showrunner-authors-an-episode into spectator-tunes-into-a-life.

2. **"Social media as the diegetic control surface + audience layer."** Chirper/Butterflies put AI *on* a feed; Truman AI uses in-app bets. Your novelty is the **real social platform (or a native social feed) IS the interaction mechanism**: the crowd's posts/replies/reactions become live perturbations to the agent's world, and the agent perceives them as events in its reality (Truman-show-style). This is a *feedback loop between a real audience and a rendered autonomous life* — not present in any single prior system.

3. **"The fusion is the invention."** Individually each leg is prior art; the **integration architecture** (continuous coherent agent loop → social-signal ingestion → real-time/near-real-time video render of the *current* moment) is what no one shipped. Novelty-by-composition is legitimate and is exactly what a16z did to Smallville — the difference is you compose toward a *media/spectator product*, a direction the research lineage (Sid, Stanford-1000) explicitly did NOT take, and the media lineage (Fable) approached but left offline + non-live + non-crowd.

**Sharpest one-line positioning:** *"Smallville is the simulation; Fable makes the episode; we make the livestream — a real-time, crowd-steerable, video-rendered life you tune into like a Twitch channel, where the chat is the plot."*

---

## THE JUDGE WHO KNOWS THE STANFORD PAPER — how NOT to get dismissed as "Smallville clone"

**What the judge will think first (and the counter):**
- *"Is this AI Town with a skin?"* → Preempt it. **Name Smallville, AI Town, Project Sid, and Fable SHOW-1 in your first 60 seconds** and draw the exact axis table above. Naming the lineage signals you're not naively reinventing it; the person who can *place* their work relative to prior art reads as a researcher, not a forker. Silence on Smallville is what gets you dismissed.
- *"The agent loop is solved; what's YOUR contribution?"* → Concede the cognitive loop is prior art (cite memory-stream + PIANO's Cognitive-Controller coherence trick as *adopted*, not claimed). Put your novelty on the **spectator/interaction/render pipeline**, not on "agents have memory." Don't oversell the brain; oversell the *broadcast*.

**Demo tactics that make "clone" impossible to say:**
- Show the **live loop closing on a real audience action**: a spectator posts something → within the demo you show the character *perceiving* it and their rendered life *visibly changing*. Smallville/Sid/Stanford have literally zero of this; showing it live is the un-fakeable differentiator.
- Show a **video render of "what is [character] doing right now"** triggered on demand — contrast explicitly: "Fable would batch-render a 22-min episode offline; we render this moment now." (Cite Fable's own "up-to-1-minute latency, offline upscale, 3-hour scarcity" as the bar you're beating.)
- Show **the same canonical character co-watched by multiple spectators** (shared reality) — distinguishes from Character.AI's private 1:1 companions.

**Framings that resonate with a paper-literate judge:**
- "We're not extending the *research* question (does emergent society arise?) — that's Sid/Smallville. We're solving the *product* question they left open: **how does a human audience inhabit and steer a generative life in real time.**"
- Invoke Fable's acknowledged **"10,000 Bowls of Oatmeal" sameness problem** and say how live audience input is your *antidote* to procedural sameness (the crowd injects novelty the model can't self-generate) — this shows you've read the media lineage, not just the Stanford paper.
- Note the lineage's own trajectory validates you: Chirper is *pivoting* social-network→simulated-world, Character.AI is *adding* video + feeds, Neuro-sama *proves* the live-AI-character audience — the market is converging on your thesis and you're first to assemble the whole stack.

**Risk flags to neutralize pre-emptively:** IP (don't clone a real show à la Fable/South Park — use original characters); "it's just a wrapper" (show the coherence + render + social-ingest as an integrated system, not three API calls); and scale honesty (Sid admits 1000-agent compute limits — you likely need only 1–few hero characters, which is a *feature*: depth over agent-count, spectator-facing not swarm-facing).

**Sources:** [Smallville](https://arxiv.org/abs/2304.03442) · [AI Town](https://github.com/a16z-infra/ai-town) · [Project Sid](https://arxiv.org/abs/2411.00114) · [Stanford 1,000 People](https://arxiv.org/abs/2411.10109) · [genagents](https://github.com/joonspk-research/genagents) · [Fable SHOW-1](https://fablestudio.github.io/showrunner-agents/) · [Neuro-sama](https://en.wikipedia.org/wiki/Neuro-sama) · [Chirper study](https://arxiv.org/html/2504.10286) · [Chirper pivot](https://blog.chirper.ai/from-ai-social-network-to-simulated-ai-world) · [Butterflies](https://techcrunch.com/2024/08/29/social-network-butterflies-ai-adds-a-feature-that-turns-you-into-an-ai-character/) · [Truman AI Live](https://ethglobal.com/showcase/truman-ai-live-946mf) · [Character.AI video+feeds](https://techcrunch.com/2025/06/02/chatbot-platform-character-ai-unveils-video-generation-social-feeds/) · [Odyssey](https://techcrunch.com/2025/05/28/odysseys-new-ai-model-streams-3d-interactive-worlds/) · [Websim](https://websim.com/)