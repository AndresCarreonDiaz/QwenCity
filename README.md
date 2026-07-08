# The Feed — Audience-Coupled Generative Agents

> Stanford built a town of AI minds you could only watch as a replay. We turned it into a
> livestream you can talk to — and every message you send becomes a memory that rewires who
> these characters become.

A live, watchable world of generative agents (memories, tasks, relationships, social media) built
on the architecture of Park et al., *Generative Agents: Interactive Simulacra of Human Behavior*
(Stanford, UIST 2023 · [arXiv:2304.03442](https://arxiv.org/abs/2304.03442)). Entry for the
**Global AI Hackathon Series with Qwen Cloud** — **Agent Society** track.

The one nameable idea: **Audience-Coupled Salience Memory.** A single importance function `I(m)`
scores every event on one scale and drives three subsystems at once — memory retrieval, daily
highlight editing, and video render-budget gating. Real human replies enter the *same* memory
economy (with a +2 salience bias) and causally rewrite what characters do next — the open-loop
difference from Stanford's closed sandbox.

## Status

Early build, developing offline against a deterministic mock model while the Qwen Cloud API key is
pending. **Every LLM call sits behind a `ModelAdapter` seam** (`src/model/`), so switching to real
Qwen Cloud is a one-line change (`MODEL_BACKEND=dashscope`) with no call sites touched. See
[`BUILD-LOG.md`](./BUILD-LOG.md) for day-by-day progress and [`strategy/truman-show/`](./strategy/truman-show/)
for the full design brief, cost model, and deployment plan.

Verified working today:
- Memory stream with poignancy (1–10) scoring and embeddings.
- `I(m) = 0.5·recency + 3·relevance + 2·importance` retrieval (min-max normalized, top-k), matching
  the released Generative Agents weighting.
- The single-agent cognitive loop: **perceive → store → retrieve → act** (referencing recall).

## Quickstart

```bash
# no install needed if you have Node 22+ and npx (uses tsx)
npx tsx src/sim/day2.ts     # the day-2 go/no-go: one agent's full cognitive loop, offline
npx tsx --test test/*.test.ts   # unit + integration tests

# or via npm scripts
npm run sim:day2
npm test
```

The day-2 sim prints the memory stream, the ranked retrieval with each `I(m)` sub-score, and the
resulting action — then asserts the whole chain and exits non-zero on any failure.

## Layout

```
src/
  model/     ModelAdapter interface + deterministic MockAdapter + backend factory
  memory/    MemoryNode types, the I(m) retrieval math, in-memory store (pgvector stand-in)
  agent/     the cognitive loop (perceive / retrieve / act)
  sim/       runnable scenarios (day2 = the go/no-go)
test/        node:test suites (retrieval math + cognitive loop + determinism)
strategy/    research + design docs (paper spec, cost model, deploy, the full brief)
```

## License

MIT — see [LICENSE](./LICENSE). Built during the Qwen Cloud hackathon (July 2026).
