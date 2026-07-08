import { Agent } from "../agent/agent.ts";
import type { MemoryStore } from "../memory/store.ts";

const MS_PER_MIN = 60_000;

export interface WorldOptions {
  /** sim-minutes advanced per tick */
  stepMinutes?: number;
  /** how long a chosen action occupies an agent before it decides again */
  actionMinutes?: number;
  /** perceiving something at/above this poignancy forces an out-of-schedule decision (a reaction) */
  reactThreshold?: number;
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
  private readonly runtimes: Runtime[] = [];

  constructor(
    readonly store: MemoryStore,
    startTime: number,
    opts: WorldOptions = {},
  ) {
    this.clock = startTime;
    this.stepMs = (opts.stepMinutes ?? 15) * MS_PER_MIN;
    this.actionMs = (opts.actionMinutes ?? 60) * MS_PER_MIN;
    this.reactThreshold = opts.reactThreshold ?? 7;
  }

  add(agent: Agent, initialAction = "starting the day"): void {
    // decide on the very first tick
    this.runtimes.push({ agent, action: initialAction, nextDecisionAt: this.clock, lastSeen: new Map() });
  }

  async tick(): Promise<void> {
    this.clock += this.stepMs;

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

    // 2. DECISION — only if due, or reacting to a salient new observation.
    for (const r of this.runtimes) {
      const due = this.clock >= r.nextDecisionAt;
      const reacting = salient.get(r.agent.profile.id) === true;
      let decided = false;
      if (due || reacting) {
        const situation =
          `It is ${new Date(this.clock).toISOString()}. ${r.agent.profile.name} is currently ${r.action}. ` +
          `What does ${r.agent.profile.name} do next?`;
        const act = await r.agent.decideAction(situation, this.clock);
        r.action = act.label;
        r.nextDecisionAt = this.clock + this.actionMs;
        this.decisions++;
        decided = true;
      } else {
        this.idleAgentTicks++;
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
        agentId: r.agent.profile.id,
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
