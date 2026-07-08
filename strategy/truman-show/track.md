PRICING (Alibaba Cloud Model Studio / DashScope "Qwen Cloud", International tier, USD per 1M tokens, verified 2026-07):

| Model | Input (0–256K) | Output | Role in design |
|---|---|---|---|
| qwen-flash | $0.05 | $0.40 | Tier-0 routine (cheapest; use this, not 3.6-flash) |
| qwen3.6-flash | $0.25 | $1.50 | 5× dearer than qwen-flash — avoid for bulk |
| qwen-plus | $0.40 | $1.20 | Tier-1 workhorse (dialogue, hourly plan) |
| qwen3-max | $1.20 (0–32K) / $2.40 (32–128K) | $6.00 | Tier-2 quality (reflection, daily plan) |
| qwen3.7-max | $2.50 | $7.50 | Premium; reserve for hero moments only |
| embeddings | ~$0.01–0.05 | — | Retrieval; negligible |

Levers (official): Batch API = 50% off input AND output. Implicit context cache = cached input billed at 20% of input price (min 1024-token prefix, no fee to enable). Explicit cache = 10% of input. Cache and Batch cannot stack. Free quota = 1M tokens per model, per new International account, valid 90 days (≈2–3M total across max+plus+flash+embeddings, front-loaded).

═══════════════════════════════════════════

ARCHITECTURE (the unlock): Do NOT run real-time. Pre-generate the sim in fast-forward into a buffer that stays ahead of a 1× "live" playhead; spectators watch the buffered replay "as if live." Consequence: 100% of generation is non-interactive → Batch API 50% off applies to every call, and there is no latency SLA. This single decision is what makes 24/7 affordable. Layer on top:
1. Event-driven scheduler — LLM fires only on state change (new perception, plan expiry, conversation start). Idle/sleeping agents cost $0. Fixed cadence would 3–5× calls.
2. 3-tier model routing (table above).
3. Implicit cache on the stable ~800-token persona prefix (20% on cached input) for any calls you keep interactive (e.g. a "poke an agent" spectator feature); Batch for all bulk.
4. Embedding retrieval (top-k≈8 memories) caps prompts at ~1–2.5K tokens instead of dumping the memory stream.
5. Importance scoring batched — score 10 memories per prompt, submitted to Batch API overnight.

═══════════════════════════════════════════

PER-AGENT PER-SIM-HOUR LEDGER (MVP, event-driven, compressed):

| Task | Tier / model | calls/hr | in tok | out tok | in/hr | out/hr |
|---|---|---|---|---|---|---|
| Action decision | 0 / flash | 3.0 | 1000 | 100 | 3000 | 300 |
| Reaction check | 0 / flash | 2.0 | 800 | 50 | 1600 | 100 |
| Importance score (batched) | 0 / flash | 2.0 | 1200 | 150 | 2400 | 300 |
| Dialogue turn | 1 / plus | 3.0 | 1500 | 150 | 4500 | 450 |
| Hourly plan/decompose | 1 / plus | 1.0 | 1200 | 200 | 1200 | 200 |
| Daily plan (amortized /16) | 2 / max | 0.06 | 1800 | 600 | 108 | 36 |
| Reflection | 2 / max | 0.33 | 2500 | 400 | 825 | 132 |
| Embeddings (memories+queries) | embed | — | — | — | 1200 | 0 |

Totals/agent/sim-hour: ~14.8K input + ~1.5K output ≈ 16.4K tokens (+1.2K embed). Over 16 waking hrs = ~262K tokens/agent/sim-day.

COST/agent/sim-hour at Batch 50% (effective: flash $0.025/$0.20; plus $0.20/$0.60; max $0.60/$3.00):
- Tier-0 flash: (7000×$0.025 + 700×$0.20)/1M = $0.000315
- Tier-1 plus: (5700×$0.20 + 650×$0.60)/1M = $0.00153
- Tier-2 max: (933×$0.60 + 168×$3.00)/1M = $0.00106
- Embeddings: ~$0
→ ≈ $0.0029/agent/sim-hour → $0.046/agent/sim-day (16h).

Conservative variant (route ALL dialogue+planning to qwen3-max instead of plus, for quality) ≈ $0.107/agent/sim-day.

═══════════════════════════════════════════

RUN COST — 24/7 for 21 sim-days (= 21 real days at 1× replay; Jul 21→Aug 11):

| N | tokens/real-day | $ / real-day (plus-workhorse) | 21-day total | Conservative 21-day (max-workhorse) |
|---|---|---|---|---|
| 8 | ~2.1M | $0.37 | **$7.8** | $17.9 |
| 15 | ~3.9M | $0.69 | **$14.6** | $33.6 |
| 25 | ~6.5M | $1.15 | **$24.3** | $56.0 |

All three N fit in $90. Even the conservative all-qwen3-max design at N=25 lands at $56, leaving ~$34 (≈60% headroom) for dev iteration, failed/retried calls, and dialogue spikes. Free 1M×N-model quota covers roughly the first real day at N=8 outright.

DEFENSIBLE MVP RECOMMENDATION: **N=15**, plus-workhorse routing, ~3.9M tokens/day, **~$15 over 21 days** (or ~$34 conservative). This is the sweet spot — enough agents for emergent social dynamics (the Smallville demo used 25, but 15 reads as a "town" on screen), comfortably inside 1M free + $90 with a full 2× safety margin. Scale to N=25 (~$24–56) if the budget check on real dialogue volume holds after a 1-day pilot.

═══════════════════════════════════════════

SINGLE BIGGEST COST DRIVER: Tier-1/2 smart-model calls, dominated by **dialogue turns** (4500 in + 450 out /agent/hr) and reflection output. In the plus-workhorse design, Tier-1 = ~53% and Tier-2 = ~37% of spend; Tier-0 flash routine ticks + importance scoring + embeddings together are <11% (rounding error). Output tokens on max ($3/1M even at batch) are the most expensive per-token line. Implication: the cost knob that matters is smart-model volume — cap conversation length (hard limit ~6 turns), throttle reflection to every ~3 sim-hours or an importance-sum threshold, and keep dialogue on qwen-plus not max. Cutting per-tick action decisions (flash) saves almost nothing.

SENSITIVITY: dialogue is the swing variable. 3× the assumed conversation volume roughly doubles total cost (dialogue is ~half of spend). Budget assuming 2× dialogue → N=25 conservative ≈ $90 exactly, so N=15 is the safe committed target.

═══════════════════════════════════════════

WHY IT'S "MAKE-OR-BREAK" — reduction ladder (N=25, 21 days):
- Naive: real-time, full Stanford-fidelity (per-tick + per-memory calls, everything on qwen3.7-max) → thousands of $ (the original paper cost ~$thousands for 2 sim-days). Infeasible.
- + Event-driven (collapse idle ticks) + small retrieval prompts → ~$300–500.
- + 3-tier routing (flash routine, plus dialogue) → ~$110.
- + Fast-forward/pre-generate → enables Batch 50% on everything → **~$56 (max) / ~$24 (plus)**.
Net ≈ 15–40× reduction; the fast-forward→Batch step is the linchpin (halves the already-optimized bill and removes latency risk).

ASSUMPTIONS (explicit): International pricing (China tier is ~3× cheaper — a further lever if account region allows). 16 waking sim-hrs/agent/day, 8h sleep = 0 calls. 21 sim-days = 21 real days at 1× replay; if the run starts today (Jul 8, 34 days) multiply totals ×1.6 (N=15 → ~$24 / ~$54). ~15 new memories/agent/sim-hr; ~1 conversation/2hr/agent × 6 turns; top-k≈8 retrieval keeps prompts ≤2.5K. Batch 50% applies because generation is offline-buffered; cache used only for the interactive-poke path (not stacked with batch). Excludes web hosting/CDN for the spectator front-end and the embedding model's exact rate (negligible). Recommend reserving 25–30% of the $90 for dev/debug token burn during the build.

Sources: [Alibaba Cloud Model Studio pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing), [Context Cache feature](https://www.alibabacloud.com/help/en/model-studio/context-cache), [Batch API (OpenAI-compatible)](https://www.alibabacloud.com/help/en/model-studio/batch-interfaces-compatible-with-openai/), [Qwen pricing overview (eesel)](https://www.eesel.ai/blog/qwen-pricing)