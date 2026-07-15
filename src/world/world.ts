import { Agent } from "../agent/agent.ts";
import type { MemoryStore } from "../memory/store.ts";
import { DESTINATIONS, locationForAction, placeById } from "../view/places.ts";
import { converse } from "./conversation.ts";
import { weatherPhrase } from "./weather.ts";

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
  /** opt-in: once per sim day the whole cast gathers at the plaza (appointment viewing).
   *  `topics` (optional) escalate the meeting's subject by sim-day (index = days
   *  since the world started, clamped) — a light, emergent story arc: agents still
   *  react freely, only the day's framing advances. */
  dailyGathering?: { hour: number; durationMin: number; topic?: string; topics?: string[] };
  /** opt-in: story-arc hooks planted on a sim-day offset (days since the world
   *  started). Each fires exactly once — the first tick on/after its day — as a
   *  perception for one agent, seeding a fresh emergent storyline without ever
   *  scripting its outcome. Pairs with `dailyGathering.topics` (whose day-indexed
   *  framing walks through the same arcs), so the town keeps generating new drama
   *  across a long run instead of looping one storyline forever. */
  arcSeeds?: Array<{ onDay: number; text: string; agentIndex?: number }>;
}

/** a scheduled town-wide happening surfaced to the spectator view */
export interface WorldEvent {
  kind: "gathering";
  label: string;
  until: number;
}

interface Runtime {
  agent: Agent;
  /** short label of what the agent is currently doing (shown in the ticker) */
  action: string;
  /** next sim-time the agent is due to re-decide */
  nextDecisionAt: number;
  /** last-seen action of every other agent, so co-presence perception is event-driven */
  lastSeen: Map<string, string>;
  /** while set and in the future, the agent stays at the town-meeting gathering */
  gatheredUntil?: number;
}

const GATHER_ACTION = "at the town meeting in the Town Plaza";

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
  private readonly gather: { hour: number; durationMin: number; topic?: string; topics?: string[] } | undefined;
  private readonly arcSeeds: Array<{ onDay: number; text: string; agentIndex?: number }>;
  private readonly firedSeeds = new Set<number>();
  private readonly startDay: number;
  private lastGatherDay = -1;
  private gatheringUntil = 0;
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
    this.gather = opts.dailyGathering;
    this.arcSeeds = opts.arcSeeds ?? [];
    this.startDay = Math.floor(startTime / 86_400_000);
  }

  /** whole sim-days elapsed since the world started (0-based) — the season/chapter clock */
  simDay(now: number = this.clock): number {
    return Math.floor(now / 86_400_000) - this.startDay;
  }

  /** the town-wide event in progress at `now`, if any (for the spectator view) */
  activeEvent(now: number): WorldEvent | null {
    if (this.gatheringUntil && now < this.gatheringUntil) {
      return { kind: "gathering", label: "Town Meeting", until: this.gatheringUntil };
    }
    return null;
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

    // 0a. STORY ARCS — plant each arc's seed hook once, the first tick on/after
    // its sim-day, so a fresh emergent storyline kicks off. Only the seed is
    // authored; the cast reacts freely, and the meeting framing (below) walks the
    // same arc schedule. This is what keeps a 24/7 run from looping one story.
    if (this.arcSeeds.length && this.runtimes.length) {
      const dayOffset = Math.floor(this.clock / 86_400_000) - this.startDay;
      for (let i = 0; i < this.arcSeeds.length; i++) {
        const s = this.arcSeeds[i]!;
        if (this.firedSeeds.has(i) || dayOffset < s.onDay) continue;
        this.firedSeeds.add(i);
        const r = this.runtimes[Math.min(s.agentIndex ?? 0, this.runtimes.length - 1)]!;
        await r.agent.perceive(s.text, this.clock);
      }
    }

    // 0. TOWN MEETING (opt-in) — once per sim day the whole cast converges on
    // the plaza to talk through the day's big worry (the rent). This gives the
    // stream a predictable "appointment viewing" beat and a full-cast scene.
    if (this.gather && this.runtimes.length) {
      const d = new Date(this.clock);
      const hour = d.getUTCHours() + d.getUTCMinutes() / 60;
      const day = Math.floor(this.clock / 86_400_000);
      if (day !== this.lastGatherDay && hour >= this.gather.hour && hour < this.gather.hour + this.gather.durationMin / 60) {
        this.lastGatherDay = day;
        this.gatheringUntil = this.clock + this.gather.durationMin * MS_PER_MIN;
        const topics = this.gather.topics;
        const topic = topics && topics.length
          ? topics[Math.min(Math.max(0, day - this.startDay), topics.length - 1)]!
          : (this.gather.topic ?? "the news that the landlord may raise everyone's rent");
        for (const r of this.runtimes) {
          r.gatheredUntil = this.gatheringUntil;
          r.action = GATHER_ACTION;
          await r.agent.perceive(`The whole town is gathering at the Town Plaza for a meeting about ${topic}.`, this.clock);
        }
      }
    }

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
      } else if (r.gatheredUntil && this.clock < r.gatheredUntil) {
        // anchored at the town meeting: stay put (no model call, no plan drift)
        r.action = GATHER_ACTION;
        r.nextDecisionAt = r.gatheredUntil;
        decided = true;
      } else if (due || reacting) {
        // Ground the decision in place: the model knows WHERE the agent is,
        // WHAT is physically around them, and WHO else is here — so actions
        // use the set ("rearranges the window display", "waves Tom over to a
        // corner table") and the map renders exactly where it says they are.
        const hereId = locationForAction(id, r.action);
        const here = placeById(hereId);
        const copresent = this.runtimes
          .filter((o) => o !== r && locationForAction(o.agent.profile.id, o.action) === hereId)
          .map((o) => `${o.agent.profile.name} (${o.action})`)
          .join(", ");
        const situation =
          `It is ${new Date(this.clock).toISOString()}. ${weatherPhrase(this.clock)}${r.agent.profile.name} is at ${here?.label ?? "the Town Plaza"} — around them: ${here?.flavor ?? "the fountain and benches"}. ` +
          (copresent ? `Also here: ${copresent}. ` : "") +
          `${r.agent.profile.name} is currently ${r.action}. ` +
          `Places around town they could head to: ${DESTINATIONS.join(", ")}. ` +
          `What does ${r.agent.profile.name} do next — stay here, or head somewhere in town? Prefer concrete actions that use the surroundings or the people present, and vary where they go across the day.`;
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
