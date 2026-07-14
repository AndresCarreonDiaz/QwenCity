import { Agent } from "../agent/agent.ts";
import type { MemoryStore } from "../memory/store.ts";
import { locationForAction, placeById } from "../view/places.ts";
import { converse } from "./conversation.ts";

const MS_PER_MIN = 60_000;

export interface WorldOptions {
  /** sim-minutes advanced per tick */
  stepMinutes?: number;
  /** how long a chosen action occupies an agent before it decides again */
  actionMinutes?: number;
  /** perceiving something at/above this poignancy forces an out-of-schedule decision (a reaction) */
  reactThreshold?: number;
  /** opt-in: agents follow a daily plan (call planAll first); reactions re-plan */
  usePlans?: boolean;
  /** opt-in: co-present agents hold scheduled conversations (forms the relationship graph) */
  enableConversations?: boolean;
  /** with enableConversations, run one conversation every N ticks (default 3) */
  conversationEveryTicks?: number;
  /** alternating turns per scheduled conversation (default 2; the live show uses 4 for richer scenes) */
  conversationTurns?: number;
}

interface Runtime {
  agent: Agent;
  /** short label of what the agent is currently doing (shown in the ticker) */
  action: string;
  /** next sim-time the agent is due to re-decide */
  nextDecisionAt: number;
  /** last-seen action of every other agent, so co-presence perception is event-driven */
  lastSeen: Map<string, string>;
}

export interface TickEntry {
  t: number;
  agentId: string;
  name: string;
  action: string;
  reflected: boolean;
  decided: boolean;
}

/**
 * The always-on world. A tick advances the sim clock, lets agents perceive each
 * other's *changed* actions, decide (only when due or reacting to something
 * salient), and reflect. Everything is event-driven: an agent that is neither
 * due nor reacting makes zero model calls that tick — the property that makes a
 * 24/7 run affordable. The tick log is the raw material the fast-forward buffer
 * and the live spectator view replay from.
 */
export class World {
  clock: number;
  readonly tickLog: TickEntry[] = [];
  // instrumentation for the cost story
  decisions = 0;
  perceptions = 0;
  idleAgentTicks = 0;
  reflections = 0;

  private readonly stepMs: number;
  private readonly actionMs: number;
  private readonly reactThreshold: number;
  private readonly usePlans: boolean;
  private readonly enableConversations: boolean;
  private readonly convEvery: number;
  private readonly convTurns: number;
  private readonly runtimes: Runtime[] = [];
  private tickCount = 0;
  /** realized conversational edges, keyed "idA|idB" (sorted) → exchange count */
  private readonly edgeWeights = new Map<string, number>();

  constructor(
    readonly store: MemoryStore,
    startTime: number,
    opts: WorldOptions = {},
  ) {
    this.clock = startTime;
    this.stepMs = (opts.stepMinutes ?? 15) * MS_PER_MIN;
    this.actionMs = (opts.actionMinutes ?? 60) * MS_PER_MIN;
    this.reactThreshold = opts.reactThreshold ?? 7;
    this.usePlans = opts.usePlans ?? false;
    this.enableConversations = opts.enableConversations ?? false;
    this.convEvery = Math.max(1, opts.conversationEveryTicks ?? 3);
    this.convTurns = Math.max(1, opts.conversationTurns ?? 2);
  }

  /** plan each agent's day (call before run when usePlans is on) */
  async planAll(): Promise<void> {
    const d = new Date(this.clock);
    const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0);
    for (const r of this.runtimes) await r.agent.planDay(dayStart);
  }

  /** relationship edges realized so far, as {a, b, weight} */
  edges(): Array<{ a: string; b: string; weight: number }> {
    return [...this.edgeWeights.entries()].map(([key, weight]) => {
      const [a, b] = key.split("|") as [string, string];
      return { a, b, weight };
    });
  }

  add(agent: Agent, initialAction = "starting the day"): void {
    // decide on the very first tick
    this.runtimes.push({ agent, action: initialAction, nextDecisionAt: this.clock, lastSeen: new Map() });
  }

  async tick(): Promise<void> {
    this.clock += this.stepMs;
    this.tickCount++;

    // 1. PERCEPTION — event-driven: only when another agent's action changed.
    const salient = new Map<string, boolean>();
    for (const r of this.runtimes) {
      for (const other of this.runtimes) {
        if (other === r) continue;
        if (r.lastSeen.get(other.agent.profile.id) === other.action) continue;
        const node = await r.agent.perceive(`${other.agent.profile.name} is ${other.action}.`, this.clock);
        r.lastSeen.set(other.agent.profile.id, other.action);
        this.perceptions++;
        if (node.importance >= this.reactThreshold) salient.set(r.agent.profile.id, true);
      }
    }

    // 1.5 CONVERSATION (opt-in) — on cadence, one co-present pair talks; this is
    // how relationships form and information spreads within a single run.
    const conversed = new Set<string>();
    if (this.enableConversations && this.runtimes.length >= 2 && this.tickCount % this.convEvery === 0) {
      const pairs = this.runtimes.length;
      const i = Math.floor(this.tickCount / this.convEvery) % pairs;
      const a = this.runtimes[i]!;
      const b = this.runtimes[(i + 1) % pairs]!;
      // The view stages every conversation at the plaza fountain, so ground the
      // scene there — the model writes lines aware of where they're standing.
      await converse(a.agent, b.agent, this.clock, this.store, {
        maxTurns: this.convTurns,
        topic: "chatting by the fountain at Town Plaza about the most important thing on my mind lately",
      });
      a.action = `talking with ${b.agent.profile.name}`;
      b.action = `talking with ${a.agent.profile.name}`;
      a.nextDecisionAt = b.nextDecisionAt = this.clock + this.actionMs;
      const key = [a.agent.profile.id, b.agent.profile.id].sort().join("|");
      this.edgeWeights.set(key, (this.edgeWeights.get(key) ?? 0) + 1);
      conversed.add(a.agent.profile.id).add(b.agent.profile.id);
    }

    // 2. DECISION — only if due, or reacting to a salient new observation.
    for (const r of this.runtimes) {
      const id = r.agent.profile.id;
      const due = this.clock >= r.nextDecisionAt;
      const reacting = salient.get(id) === true;
      let decided = false;
      if (conversed.has(id)) {
        decided = true; // the conversation was this agent's action this tick
      } else if (due || reacting) {
        // Ground the decision in place: the model writes actions that use the
        // surroundings ("rearranges the window display") instead of floating in
        // a void — and the map renders exactly where it says they are.
        const here = placeById(locationForAction(id, r.action));
        const situation =
          `It is ${new Date(this.clock).toISOString()}. ${r.agent.profile.name} is at ${here?.label ?? "the Town Plaza"}, currently ${r.action}. ` +
          `What does ${r.agent.profile.name} do next, here or nearby? Prefer concrete actions that use the surroundings.`;
        const act = await r.agent.decideAction(situation, this.clock);
        r.action = act.label;
        r.nextDecisionAt = this.clock + this.actionMs;
        this.decisions++;
        decided = true;
        if (this.usePlans) r.agent.replan(this.clock, r.action); // reaction re-plans the day
      } else {
        this.idleAgentTicks++;
        // Following the plan is free (no model call): action tracks the schedule.
        if (this.usePlans) {
          const step = r.agent.currentPlanStep(this.clock);
          if (step) r.action = step.activity;
        }
      }

      // 3. REFLECTION — fires when accumulated poignancy crosses the threshold.
      let reflected = false;
      if (r.agent.needsReflection()) {
        const refs = await r.agent.reflect(this.clock);
        this.reflections += refs.length;
        reflected = refs.length > 0;
      }

      this.tickLog.push({
        t: this.clock,
        agentId: id,
        name: r.agent.profile.name,
        action: r.action,
        reflected,
        decided,
      });
    }
  }

  async run(ticks: number): Promise<void> {
    for (let i = 0; i < ticks; i++) await this.tick();
  }

  /** each agent's current action label, keyed by agent id (for the live view) */
  currentActions(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const r of this.runtimes) out[r.agent.profile.id] = r.action;
    return out;
  }
}
