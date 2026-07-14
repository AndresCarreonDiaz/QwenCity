import { Agent } from "../agent/agent.ts";
import { MemoryStore } from "../memory/store.ts";
import { getModel } from "../model/index.ts";
import type { ModelAdapter } from "../model/adapter.ts";
import { Feed } from "../social/feed.ts";
import { moderate } from "../social/moderation.ts";
import { renderSnapshotHtml } from "../view/render.ts";
import { buildSnapshot, type WorldSnapshot } from "../view/snapshot.ts";
import { World } from "../world/world.ts";
import { appendTick } from "../world/replay.ts";

export interface LiveWorldOptions {
  start?: number;
  /** wall-clock ms between sim ticks (the fast-forward generator cadence) */
  tickIntervalMs?: number;
  stepMinutes?: number;
  /** cap on total accepted audience replies per process (budget guard) */
  maxReplies?: number;
  /** append the tick log here for replay (optional) */
  logPath?: string;
  model?: ModelAdapter;
}

const DEFAULT_CAST: Array<[string, string, string]> = [
  ["maya", "Maya", "Maya runs the corner café; warm, conflict-avoidant, values friendships."],
  ["tom", "Tom", "Tom is a café regular and Maya's old friend; blunt, easily hurt."],
  ["ana", "Ana", "Ana runs the bakery next door; ambitious, competitive with the café."],
  ["leo", "Leo", "Leo delivers for both shops; cheerful, a bit of a gossip."],
];

/**
 * The always-on world behind the server: fast-forwards the simulation on a
 * timer, keeps a rendered snapshot + HTML cached for cheap reads, appends the
 * tick log for replay, and accepts (moderated, rate-capped) audience replies
 * that enter agents' memory. Backend-agnostic (mock or Qwen via getModel()).
 */
export class LiveWorld {
  readonly store: MemoryStore;
  private readonly world: World;
  private readonly feed = new Feed();
  private readonly agents: Agent[] = [];
  private readonly nameById = new Map<string, string>();
  private readonly maxReplies: number;
  private readonly logPath: string | undefined;
  private readonly tickIntervalMs: number;
  private snap: WorldSnapshot | null = null;
  private cachedHtml = "";
  private ticks = 0;
  private replyCount = 0;
  private running = false;
  private ticking = false;

  constructor(opts: LiveWorldOptions = {}) {
    const model = opts.model ?? getModel();
    const start = opts.start ?? Date.UTC(2026, 6, 10, 8, 0, 0);
    this.store = new MemoryStore(model);
    this.tickIntervalMs = opts.tickIntervalMs ?? 4000;
    this.maxReplies = opts.maxReplies ?? 200;
    this.logPath = opts.logPath;
    this.world = new World(this.store, start, {
      stepMinutes: opts.stepMinutes ?? 30,
      usePlans: true,
      enableConversations: true,
      conversationEveryTicks: 2,
      conversationTurns: 4,
      dailyGathering: { hour: 12, durationMin: 90 },
    });
    for (const [id, name, bio] of DEFAULT_CAST) {
      const a = new Agent({ id, name, bio }, this.store, model, { reflectionThreshold: 200 });
      this.world.add(a);
      this.agents.push(a);
      this.nameById.set(id, name);
    }
  }

  /** plan the day, seed a hook, run one tick, and cache the first snapshot */
  async init(): Promise<void> {
    await this.agents[2]!.perceive("Ana heard a troubling secret: the landlord will raise everyone's rent.", this.world.clock);
    await this.world.planAll();
    await this.advance();
  }

  private async advance(): Promise<void> {
    await this.world.tick();
    this.ticks++;
    if (this.logPath) for (const e of this.world.tickLog.slice(-this.agents.length)) appendTick(this.logPath, e);
    this.snap = buildSnapshot({ now: this.world.clock, agents: this.agents, store: this.store, currentActions: this.world.currentActions(), feed: this.feed, event: this.world.activeEvent(this.world.clock) });
    this.cachedHtml = renderSnapshotHtml(this.snap);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = async (): Promise<void> => {
      if (!this.running) return;
      if (!this.ticking) {
        this.ticking = true;
        try {
          await this.advance();
        } catch (err) {
          console.error("tick error:", err instanceof Error ? err.message : err);
        } finally {
          this.ticking = false;
        }
      }
      if (this.running) setTimeout(loop, this.tickIntervalMs);
    };
    setTimeout(loop, this.tickIntervalMs);
  }

  stop(): void {
    this.running = false;
  }

  snapshot(): WorldSnapshot | null {
    return this.snap;
  }

  html(): string {
    return this.cachedHtml;
  }

  health(): { status: string; clock: string; ticks: number; agents: number; memories: number } {
    return {
      status: this.snap ? "alive" : "starting",
      clock: this.snap?.clock ?? "--:--",
      ticks: this.ticks,
      agents: this.agents.length,
      memories: this.store.size,
    };
  }

  /** moderate + ingest an audience reply into a character's memory (rate-capped) */
  async ingestReply(agentId: string, handle: string, text: string): Promise<{ ok: boolean; reason?: string; importance?: number }> {
    if (this.replyCount >= this.maxReplies) return { ok: false, reason: "reply budget reached for this session" };
    const agent = this.agents.find((a) => a.profile.id === agentId);
    if (!agent) return { ok: false, reason: `unknown character "${agentId}"` };
    const { ok, reason } = moderate(text);
    if (!ok) return { ok: false, reason };
    const node = await agent.ingestAudienceReply(handle || "guest", text, this.world.clock);
    this.replyCount++;
    return { ok: true, importance: node.importance };
  }
}
