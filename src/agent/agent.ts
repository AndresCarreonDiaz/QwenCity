import type { ModelAdapter } from "../model/adapter.ts";
import type { MemoryStore } from "../memory/store.ts";
import type { MemoryNode, ScoredMemory } from "../memory/types.ts";
import { buildUtterancePrompt, parseUtterance } from "./dialogue.ts";
import {
  buildFocalPrompt,
  buildInsightPrompt,
  parseFocalQuestions,
  parseInsights,
} from "./reflection.ts";
import { buildPostPrompt, parsePost } from "../social/post.ts";
import {
  buildDailyPlanPrompt,
  fmtMin,
  minutesSinceMidnight,
  parsePlan,
  type Plan,
  replanFrom,
  stepAt,
} from "./planning.ts";

/** salience bias applied to an ingested human reply, so it reliably surfaces next cycle */
export const AUDIENCE_SALIENCE_BIAS = 2;

export interface AgentProfile {
  id: string;
  name: string;
  /** one-line identity/bio, prepended to reasoning prompts (paper: summary description) */
  bio: string;
}

export interface AgentOptions {
  /**
   * Reflection fires once accumulated poignancy since the last reflection
   * crosses this threshold (paper default: 150 → ~2–3 reflections/day).
   */
  reflectionThreshold?: number;
  /** how many recent memories seed focal-question generation */
  reflectionWindow?: number;
}

export interface AgentAction {
  /** one-sentence reasoning that references a specific retrieved memory */
  text: string;
  /** short present-tense action phrase for the world/ticker (e.g. "opening the café") */
  label: string;
  /** ids of the retrieved memories the decision was conditioned on */
  citedMemoryIds: string[];
  /** the memories retrieved for this decision, in ranked order (for the ticker/eval) */
  retrieved: ScoredMemory[];
}

/**
 * The minimal cognitive unit. This is the day-2 go/no-go loop:
 *   perceive → store → retrieve → act(referencing a retrieved memory).
 * Reflection and planning layer on top of exactly these primitives.
 */
export class Agent {
  private readonly reflectionThreshold: number;
  private readonly reflectionWindow: number;
  /** poignancy accumulated since the last reflection (drives the trigger) */
  private accumulatedImportance = 0;
  /** audience-injection memory ids already surfaced to a decision (so each lands once) */
  private readonly responded = new Set<string>();
  /** if the current action was shaped by an audience reply, who/what shaped it
   *  (the causal loop, made observable). Cleared on any decision that isn't. */
  private lastInfluence: { handle: string; text: string; at: number } | null = null;
  /** today's schedule (empty until planDay is called) */
  plan: Plan = [];

  constructor(
    readonly profile: AgentProfile,
    private readonly memory: MemoryStore,
    private readonly model: ModelAdapter,
    opts: AgentOptions = {},
  ) {
    this.reflectionThreshold = opts.reflectionThreshold ?? 150;
    this.reflectionWindow = opts.reflectionWindow ?? 25;
  }

  /** record something the agent perceived, as an observation memory */
  async perceive(description: string, now: number): Promise<MemoryNode> {
    const node = await this.memory.add({
      agentId: this.profile.id,
      kind: "observation",
      description,
      now,
    });
    this.accumulatedImportance += node.importance;
    return node;
  }

  /** true when enough poignancy has accumulated to warrant a reflection pass */
  needsReflection(): boolean {
    return this.accumulatedImportance >= this.reflectionThreshold;
  }

  /**
   * Synthesize higher-level insights from recent memories and store each as a
   * "reflection" memory whose `filling` cites the evidence it came from and
   * whose `depth` is one above its deepest source — forming the reflection tree.
   * Resets the poignancy accumulator. Returns the reflections created.
   */
  async reflect(now: number): Promise<MemoryNode[]> {
    const mine = this.memory.forAgent(this.profile.id);
    const recent = mine.slice(-this.reflectionWindow);
    const created: MemoryNode[] = [];

    const qText = await this.model.complete(
      buildFocalPrompt(this.profile.bio, this.profile.name, recent),
      { task: "reflect-questions", temperature: 0 },
    );
    let questions = parseFocalQuestions(qText, 3);
    // Fallback if the backend returns nothing usable: focus on the most recent memories.
    if (questions.length === 0) {
      questions = recent.slice(-3).map((m) => m.description);
    }

    for (const q of questions) {
      const scored = await this.memory.retrieve(this.profile.id, q, now, 8);
      if (scored.length === 0) continue;
      const mems = scored.map((s) => s.node);
      const iText = await this.model.complete(
        buildInsightPrompt(this.profile.bio, this.profile.name, q, mems),
        { task: "reflect-insights", temperature: 0 },
      );
      for (const parsed of parseInsights(iText, mems.length)) {
        const evidence = parsed.evidenceIdx.map((i) => mems[i - 1]!);
        const depth = 1 + Math.max(...evidence.map((m) => m.depth));
        const node = await this.memory.add({
          agentId: this.profile.id,
          kind: "reflection",
          description: parsed.text,
          now,
          filling: evidence.map((m) => m.id),
          depth,
        });
        created.push(node);
      }
    }

    this.accumulatedImportance = 0;
    return created;
  }
  /**
   * Decide the next action given the current situation. Retrieves the top-k
   * relevant memories, conditions the model on them, and returns an action that
   * explicitly cites the memories it used.
   */
  /** the audience reply shaping this agent's current action, if any (for the view) */
  get influence(): { handle: string; text: string; at: number } | null {
    return this.lastInfluence;
  }

  async decideAction(situation: string, now: number, k = 8): Promise<AgentAction> {
    this.lastInfluence = null; // a fresh decision is uninfluenced unless an injection surfaces below
    let retrieved = await this.memory.retrieve(this.profile.id, situation, now, k);
    retrieved = this.surfacePendingInjection(retrieved, k);
    const prompt = this.buildActionPrompt(situation, now, retrieved);
    const raw = await this.model.complete(prompt, { task: "act", temperature: 0 });
    const { reasoning, label } = parseAction(raw);
    // The decision is conditioned on the top retrieved memories; cite the ones
    // that actually carried ranking weight (the top few).
    const citedMemoryIds = retrieved.slice(0, Math.min(3, retrieved.length)).map((s) => s.node.id);
    return { text: reasoning, label, citedMemoryIds, retrieved };
  }

  /**
   * Force the most recent not-yet-answered audience reply to the top of the
   * decision context (design §4.6: "the character always acknowledges the
   * audience"). This is what makes the causal loop *visible* — the agent reacts
   * to the reply the same turn it arrives — rather than leaving it to ranking
   * chance. Each injection is surfaced once.
   */
  private surfacePendingInjection(retrieved: ScoredMemory[], k: number): ScoredMemory[] {
    const pending = this.memory
      .forAgent(this.profile.id)
      .filter((n) => n.kind === "injection" && !this.responded.has(n.id));
    const latest = pending[pending.length - 1];
    if (!latest) return retrieved;
    this.responded.add(latest.id);
    // record the causal link so the view can show "acting on your message"
    const m = latest.description.match(/@([\w.-]+) replied to my post: "([\s\S]*)"$/);
    if (m) this.lastInfluence = { handle: m[1]!, text: m[2]!, at: latest.created };
    const promoted: ScoredMemory = {
      node: latest,
      score: Number.POSITIVE_INFINITY,
      parts: { recency: 1, relevance: 1, importance: 1 },
    };
    return [promoted, ...retrieved.filter((s) => s.node.id !== latest.id)].slice(0, k);
  }

  /**
   * Generate today's plan top-down and store each step as a `plan` memory.
   * Returns the schedule and also sets `this.plan`.
   */
  async planDay(now: number): Promise<Plan> {
    const day = new Date(now).toISOString().slice(0, 10);
    const raw = await this.model.complete(
      buildDailyPlanPrompt(this.profile.bio, this.profile.name, day),
      { task: "plan", temperature: 0 },
    );
    this.plan = parsePlan(raw);
    for (const s of this.plan) {
      await this.memory.add({
        agentId: this.profile.id,
        kind: "plan",
        description: `Plan ${fmtMin(s.startMin)}–${fmtMin(s.endMin)}: ${s.activity}`,
        now,
      });
    }
    return this.plan;
  }

  /** what this agent is scheduled to be doing at `now`, per its current plan */
  currentPlanStep(now: number) {
    return stepAt(this.plan, minutesSinceMidnight(now));
  }

  /** re-plan from `now` forward, inserting `activity` for the current slot (reaction) */
  replan(now: number, activity: string): Plan {
    this.plan = replanFrom(this.plan, minutesSinceMidnight(now), activity);
    return this.plan;
  }

  /**
   * Compose a first-person social post about the most salient recent memory,
   * or return null if nothing is worth posting. Does not add to any feed — the
   * caller records it (with provenance back to the source memory).
   */
  async composePost(
    now: number,
    opts: { threshold?: number; window?: number } = {},
  ): Promise<{ text: string; sourceMemoryId: string } | null> {
    const threshold = opts.threshold ?? 5;
    const window = opts.window ?? 15;
    const recent = this.memory.forAgent(this.profile.id).slice(-window);
    const salient = recent
      .filter((m) => m.importance >= threshold)
      .sort((a, b) => b.importance - a.importance)[0];
    if (!salient) return null;
    const raw = await this.model.complete(
      buildPostPrompt(this.profile.bio, this.profile.name, salient.description),
      { task: "post", temperature: 0 },
    );
    return { text: parsePost(raw), sourceMemoryId: salient.id };
  }

  /**
   * Ingest a (moderated) human reply as a memory. The +2 salience bias ensures
   * it surfaces in the very next retrieval — so an audience message causally
   * enters the agent's cognition. This is the open-loop difference from Stanford.
   */
  async ingestAudienceReply(handle: string, text: string, now: number): Promise<MemoryNode> {
    const day = new Date(now).toISOString().slice(0, 10);
    return this.memory.add({
      agentId: this.profile.id,
      kind: "injection",
      description: `On ${day}, @${handle} replied to my post: "${text}"`,
      now,
      importanceBias: AUDIENCE_SALIENCE_BIAS,
    });
  }

  /**
   * Produce one utterance to `listener`, grounded in the memories most relevant
   * to the topic and in what this agent remembers about the listener. Does not
   * store anything — the conversation orchestrator records the line in both
   * agents' streams (so information can diffuse).
   */
  async speak(
    listener: { id: string; name: string },
    history: string[],
    now: number,
    topic = "recent important news",
  ): Promise<string> {
    // Retrieve what's most on-mind for the topic. Deliberately does NOT mention
    // the listener here — that would bias toward mundane co-presence memories
    // about them and crowd out genuinely salient news. Relationship context is a
    // separate retrieval below.
    const relevant = await this.memory.retrieve(this.profile.id, topic, now, 5);
    const rel = await this.memory.retrieve(
      this.profile.id,
      `${this.profile.name}'s relationship with ${listener.name}`,
      now,
      2,
    );
    const relationship = rel.length
      ? `Context about ${listener.name}: ${rel.map((s) => s.node.description).join("; ")}`
      : "";
    const prompt = buildUtterancePrompt({
      speakerBio: this.profile.bio,
      speakerName: this.profile.name,
      listenerName: listener.name,
      relationship,
      history,
      relevant: relevant.map((s) => s.node),
      now,
    });
    const raw = await this.model.complete(prompt, { task: "dialogue", temperature: 0 });
    return parseUtterance(raw);
  }

  private buildActionPrompt(situation: string, now: number, retrieved: ScoredMemory[]): string {
    const memBlock = retrieved.length
      ? retrieved.map((s) => `- ${s.node.description}`).join("\n")
      : "- (no memories yet)";
    return [
      this.profile.bio,
      `It is sim-time ${new Date(now).toISOString()}.`,
      `Situation: ${situation}`,
      ``,
      `RELEVANT MEMORIES:`,
      memBlock,
      ``,
      `Given the situation and what ${this.profile.name} remembers, decide the next action.`,
      `Respond in exactly two lines:`,
      `REASON: one sentence, referring to a specific memory above.`,
      `ACT: a short present-tense action phrase (e.g. "opening the café").`,
    ].join("\n");
  }
}

/**
 * Split a two-line action response into reasoning (quotes a memory) and a short
 * action label. Falls back gracefully if the backend didn't follow the format.
 */
function parseAction(raw: string): { reasoning: string; label: string } {
  const reason = raw.match(/REASON:\s*(.+)/i)?.[1]?.trim();
  const act = raw.match(/ACT:\s*(.+)/i)?.[1]?.trim();
  const reasoning = reason || raw.trim();
  const label = act || shorten(reasoning);
  return { reasoning, label };
}

function shorten(text: string, n = 60): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}
