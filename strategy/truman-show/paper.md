# GENERATIVE AGENTS (Park et al., Stanford/Google 2023, UIST) — REIMPLEMENTATION SPEC

Source: arXiv 2304.03442; repo github.com/joonspk-research/generative_agents (backend `reverie/backend_server/`, frontend Django+Phaser `environment/frontend_server/`). Model: GPT-3.5-turbo (paper used `text-davinci-003` / ChatGPT-3.5) + OpenAI text embeddings. Where paper and code differ, both given.

## 1. MEMORY STREAM — schema
Class `ConceptNode` (`memory_structures/associative_memory.py`). Every memory record's fields:
- `node_id`, `node_count`, `type_count`
- `type` ∈ {`"event"`, `"thought"`, `"chat"`} (paper's conceptual types = observation / reflection / plan; "event"=observation, "thought"=reflection/plan-derived insight, "chat"=dialogue)
- `depth` — reflection tree level (0 = observation leaf; higher = more abstract)
- `created` (creation timestamp), `expiration`, `last_accessed` (most-recent-access timestamp)
- `subject`, `predicate`, `object` — the (s,p,o) triple
- `description` — natural-language text of the memory
- `embedding_key` — key into `self.embeddings` dict (embedding_key → vector)
- `poignancy` — importance score 1–10 (stored per node)
- `keywords` — set; indexed via `kw_to_event/thought/chat`; `kw_strength_event/thought` incremented for non-idle predicates
- `filling` — evidence pointers: list of source `node_id`s for thoughts/reflections (empty for raw observations)

Storage: three chronological sequences `seq_event`, `seq_thought`, `seq_chat`; separate keyword→node indices per type; embeddings held separately keyed by `embedding_key`. **Recording observations**: each sandbox step, the agent perceives objects/agents within `vision_r=4` tiles; perceived events (each an "[subject] is [action]" statement, e.g. "the stove is on") are added as event nodes with an LLM-assigned poignancy and an embedding.

## 2. RETRIEVAL — scoring formula
Function `retrieve()` / `new_retrieve()` in `cognitive_modules/retrieve.py`. For a query (focal point), score every candidate memory node by three components, each **min-max normalized to [0,1]** (`normalize_dict_floats(..., 0, 1)`):

- **Recency**: exponential decay over the sorted-by-last-access nodes. `recency_vals = [recency_decay ** i for i in range(1, len(nodes)+1)]`. `recency_decay` default = **0.99** in code (`scratch.py`); **paper states 0.995** per game hour. (Discrepancy — code decays per rank-index, not per real game-hour.)
- **Importance**: the node's stored `poignancy` (1–10).
- **Relevance**: `cos_sim(node_embedding, focal_embedding)` — cosine similarity of the memory's embedding vs the query embedding.

**Final score:**
```
score = recency_w · recency · gw[0]
      + relevance_w · relevance · gw[1]
      + importance_w · importance · gw[2]
```
- Paper: α_recency = α_importance = α_relevance = **1** (all weights 1), `score = α_rec·rec + α_imp·imp + α_rel·rel`.
- Code defaults: `recency_w = relevance_w = importance_w = 1`, PLUS a fixed multiplier `gw = [0.5, 3, 2]` for [recency, relevance, importance] respectively (i.e. relevance is up-weighted 3×, importance 2×, recency 0.5×). This is the real shipped weighting.

**Top-k**: `top_highest_x_values(master_out, n_count)` with default `n_count = 30` — the 30 highest-scoring memories, concatenated into the prompt (paper: "top-ranked memories that fit in the context window"). Retrieved nodes get `last_accessed` updated.

Importance/poignancy is scored **once at creation** via LLM prompt (verbatim):
> "On the scale of 1 to 10, where 1 is purely mundane (e.g., brushing teeth, making bed) and 10 is extremely poignant (e.g., a break up, college acceptance), rate the likely poignancy of the following piece of memory. Memory: [description]. Rating: <fill in>"

## 3. REFLECTION
**Trigger**: fires when the sum of importance scores of the latest perceived events exceeds a threshold. `importance_trigger_max = 150` (code default, matches paper "150"); a running counter `importance_trigger_curr` starts at 150 and is decremented by each new event's poignancy; reflection triggers when `importance_trigger_curr <= 0`, then resets. Result: agents reflect ~2–3× per day.

**Question generation** (`generate_focal_points`, n=3): take the most recent memory records (paper: the **100 most recent**; code uses `importance_ele_n` most-recent nodes — the events that accumulated the 150) and prompt:
> "Given only the information above, what are 3 most salient high-level questions we can answer about the subjects in the statements?"

→ yields 3 focal-point questions.

**Insight synthesis**: for each focal point, `retrieve()` gathers relevant memories, then `generate_insights_and_evidence(persona, nodes, 5)` prompts:
> "What 5 high-level insights can you infer from the above statements? (example format: insight (because of 1, 5, 3))"

→ e.g. "Klaus Mueller is dedicated to his research on gentrification (because of 1, 2, 8, 15)." The cited indices map back to node_ids: `evidence_node_id = [nodes[i].node_id for i in evi_raw]`; stored via `add_thought(...)` with the evidence list → `filling` pointers. Each insight becomes a `thought` node with its own LLM poignancy + embedding, and `depth = max(source depths)+1`.

**Tree**: leaves = observations (depth 0); reflections point to the memories (observations OR lower reflections) that generated them, forming a hierarchical tree of increasing abstraction. Reflections are retrievable like any memory. (Other reflection thresholds in code: `overlap_reflect_th=2`, `kw_strg_event_reflect_th=4`, `kw_strg_thought_reflect_th=4` — keyword-strength based auxiliary triggers.)

## 4. PLANNING
Top-down, recursive decomposition, stored as memories.

**(a) Broad strokes daily agenda** — seed from the agent's **summary description** (identity, traits, recent-experience summary auto-generated by querying memory) + previous day's summary. Prompt continuation:
> "[Agent summary/bio]. Today is Wednesday February 13. Here is Eddy's plan today in broad strokes: 1)"

→ 5–8 chunks, e.g. "1) wake up and complete morning routine at 8:00 am, 2) go to Oak Hill College to take classes starting 10:00 am, … 5) work on his new music composition from 1:00 pm to 5:00 pm, 6) have dinner at 5:30 pm, 7) finish assignments and go to bed by 11:00 pm."

**(b) Recursive decomposition**: each broad chunk → hour-long chunks → **5–15 minute chunks** (each with a start time + duration). `daily_reflection_time = 180` min (3h) related param; `daily_req` holds the requirements list.

**(c) Storage**: the whole plan and each decomposed sub-action are written into the memory stream as `plan`/thought-type nodes (so plans influence later retrieval/reflection). Agent maintains `daily_req` and current action.

**(d) Revision on reaction**: at each step the agent perceives; a retrieved context may indicate it should react. When it reacts, the system **regenerates the plan from the current moment forward** (keeps the past, discards/replaces the remainder), so plans are dynamically rewritten mid-day rather than followed rigidly.

## 5. REACTING & DIALOGUE
**Reaction decision** — each step, for a salient observed event O, build a **context summary** via two retrieval queries:
1. "What is [observer]'s relationship with the [observed entity]?"
2. "[Observed entity] is [action/status]."
Their retrieved memories are summarized, then the LLM is prompted (verbatim structure):
> "[Agent's Summary Description] It is [date/time]. [Agent name]'s status: [status]. Observation: [observed event]. Summary of relevant context from [Agent]'s memory: [summary]. Should [Agent] react to the observation, and if so, what would be an appropriate reaction?"

If it decides to react (and reaction implies conversation), planning is re-invoked from that time.

**Dialogue** — utterances conditioned on: (1) agent summary, (2) current time/status, (3) triggering observation, (4) **summarized memory about the other agent** (relationship), (5) conversation history so far. Example prompt (verbatim):
> "[Agent's Summary Description] It is February 13, 2023, 4:56 pm. John Lin's status: John is back home early from work. Observation: John saw Eddy taking a short walk. Summary of relevant context from John's memory: Eddy Lin is John's son. Eddy has been working on a music composition. John is asking Eddy about his music composition project. What would he say to Eddy?"

→ "Hey Eddy, how's the music composition project for your class coming along?" Each subsequent turn re-prompts with updated history until the model ends the conversation; the full dialogue is stored as `chat` node(s) in both agents' memory.

## 6. ARCHITECTURE LOOP & SANDBOX/TIME MODEL
**Cognitive loop** (per agent per step): **perceive** (events within `vision_r=4` tiles; `att_bandwidth=3` limits how many are attended; `retention=5`) → **store** as event nodes with poignancy+embedding → **retrieve** (recency·importance·relevance top-30) → **plan or react** (follow decomposed plan; or if observation triggers reaction, re-plan / start dialogue) → **reflect** (when importance sum > 150) → **act/execute** (convert chosen action to movement + an emoji shown above the sprite) → results feed back into perception.

**World model (Smallville)**: environment encoded as a **tree** of nested areas/objects (world → sector → arena → object; e.g. house → kitchen → stove), representing containment. Each agent keeps a **subgraph** (spatial memory) of only the parts it has explored; agents plan action locations by traversing this tree ("find a place to X"). Actions like "Isabella Rodriguez is writing in her journal" are (a) rendered as an emoji over the avatar and (b) resolved to a target tile the agent pathfinds to.

**Servers**: **Reverie** = Python backend simulation engine (`reverie.py`) driving agent cognition, holds JSON state of all agents/objects. **Frontend** = Django server + **Phaser** JS game engine rendering the 2D sprite world; communicates state via JSON. Setup: run Django (`manage.py runserver`, port 8000), run `reverie.py`, fork a base sim, issue `run <steps>`, save with `fin`.

**Time model**: each sandbox step = **10 game seconds**; agents act on a tile grid; step processes all agent actions, updates object states, and sends each agent the locally visible agents/objects. Replay: `http://localhost:8000/replay/<sim>/<step>`; demo: `/demo/<sim>/<step>/<speed>`. Scale in study: **25 agents**, town of Smallville. Python 3.9.12.

## 7. EVALUATION, ABLATIONS, LIMITATIONS
**Believability study**: 25 agents run **2 game days**; each interviewed with questions across **5 categories** (self-knowledge, memory, plans, reactions, reflections), 5 questions each. **100 evaluators (Prolific)**, within-subjects; ranked conditions → **TrueSkill** ratings (Elo generalization).

**Ablation conditions & TrueSkill (μ / σ)** — ranked best→worst:
| Condition | μ | σ |
|---|---|---|
| **Full architecture** | **29.89** | 0.72 |
| No reflection | 26.88 | 0.69 |
| No reflection, no planning | 25.64 | 0.68 |
| Human crowdworker | 22.95 | 0.69 |
| No observation, no reflection, no planning (≈ prior work) | 21.21 | 0.70 |

Full architecture beat the fully-ablated baseline with **d = 8.16** (~8 SDs). Kruskal-Wallis **H(4)=150.29, p<0.001**. **Takeaway: all three components contribute; memory (observation/retrieval) matters most (its removal is worst), then planning, then reflection** — each layer added monotonic gains; full stack even beat the human-authored condition. Notably the full agents outscored human crowdworkers.

**Emergent social behavior** (single 2-day end-to-end run):
- **Information diffusion** — Sam's mayoral candidacy: awareness grew from 1 agent (4%) → **8 agents (32%)**. Isabella's Valentine's Day party: 1 (4%) → **13 agents (52%)**.
- **Coordination** — Isabella invited 12 agents; **5 of 12 showed up** at Hobbs Cafe (3 cited scheduling conflicts, 4 interested but didn't plan to go).
- **Relationship formation** — network density rose **0.167 → 0.74**.
- **Hallucination check** — of agents claiming awareness, only **1.3% (n=6)** were hallucinated (had not actually been told).

**Limitations / failure modes reported**:
- **Memory retrieval failures** — fails to retrieve correct instances; incomplete context → behavior degrades as memory grows (chose semantically wrong locations for actions).
- **Hallucination / embellishment** — adds knowledge not grounded in memory; inherits LLM world-knowledge errors (e.g. attributing "Wealth of Nations" authorship).
- **Physical/world-norm errors** — multiple agents entering single-occupancy bathrooms; entering closed shops after 5pm (no business-hours awareness).
- **Instruction-tuning artifacts** — dialogue "overly formal"; agents "overly cooperative/polite" even against their stated interests.
- **Cost/time** — simulating 25 agents for 2 days cost "thousands of dollars in token credits" and took multiple days.
- **Bias** — inherits LLM biases; may fail to believably portray marginalized subpopulations.

**KEY DISCREPANCIES to note when reimplementing**: (1) recency decay — paper 0.995/game-hour vs code default **0.99** applied per rank-index; (2) retrieval weights — paper all α=1 vs code adds `gw=[0.5, 3, 2]` (recency, relevance, importance) so relevance dominates; (3) top-k default `n_count=30`; (4) reflection recent-window: paper "100 records" vs code uses accumulated-importance window (`importance_ele_n`).