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

// Each character carries a standing desire (4th field) — the throughline that
// drives them across days. The sim never scripts how these resolve; the wants
// only tilt what each character reaches for, so arcs *emerge* (will Tom and Maya
// find their way back? does Ana's rivalry cost her more than it wins?).
const DEFAULT_CAST: Array<[string, string, string, string]> = [
  ["maya", "Maya", "Maya runs the corner café; warm, conflict-avoidant, values friendships.",
    "Maya quietly wishes she and Tom could be close again the way they once were, but she's afraid that reaching out would only push him further away."],
  ["tom", "Tom", "Tom is a café regular and Maya's old friend; blunt, easily hurt.",
    "Tom still cares about Maya and wants to bridge the old distance between them, but his pride keeps getting in the way of saying so."],
  ["ana", "Ana", "Ana runs the bakery next door; ambitious, competitive with the café.",
    "Ana is determined to prove her bakery can outshine Maya's café — though a part of her wonders whether winning is worth standing alone."],
  ["leo", "Leo", "Leo delivers for both shops; cheerful, a bit of a gossip.",
    "Leo wants the neighbours to finally see him as someone who matters, not just the kid who carries the boxes."],
];

/** cast index by role, for arc seeds (matches DEFAULT_CAST order) */
const MAYA = 0, TOM = 1, ANA = 2, LEO = 3;

export interface SeasonArc {
  title: string;
  /** who perceives the arc's hook (index into DEFAULT_CAST); omitted for arc 0 (seeded at init) */
  seedAgent?: number;
  /** the hook, a neutral past-tense perception (a fact/rumor, never a directive) */
  seedText?: string;
  /** escalating daily town-meeting subjects for this arc, each completing "a meeting about ___" */
  topics: string[];
}

/**
 * Season 1 — a rotating sequence of emergent arcs so a 24/7 run keeps generating
 * fresh drama instead of looping one storyline. Arc 0 (the rent) is seeded in
 * init() before planning; arcs 1+ are planted mid-run on their sim-day by the
 * World. We author only the seed + the escalating meeting framing — every
 * outcome is left to the agents. Content from a 3-writer panel + critique pass.
 * The register deliberately cycles: crisis → mystery → warmth → conflict → heartbreak.
 */
export const SEASON: SeasonArc[] = [
  { title: "The Rent", topics: [
    "the rumor that the landlord may raise everyone's rent",
    "the official notice — the landlord has confirmed the rent will go up",
    "what the shop owners should do about the rent; some want to band together",
    "how the town is coping now that the higher rent has taken effect",
    "whether the café and bakery can survive the winter under the new rent",
  ] },
  { title: "The Newcomer", seedAgent: LEO,
    seedText: "Leo noticed a woman no one recognized had spent the week walking the plaza, photographing the storefronts and asking shopkeepers how long their families had been in town.",
    topics: [
      "the stranger who's been asking questions around the plaza",
      "what the newcomer is really after",
      "whether to welcome the newcomer or close ranks",
      "the rumors running ahead of the facts",
      "the place the town is willing to give a newcomer",
    ] },
  { title: "The Spring Fair", seedAgent: MAYA,
    seedText: "Maya found a faded fair ribbon and a photograph of two laughing teenagers tucked behind a loose board while clearing out the café's back room.",
    topics: [
      "reviving the spring fair the town let lapse years ago",
      "who still remembers how the old fair used to run",
      "the booths, the music, and the contest no one's held in years",
      "which of the old fair traditions are worth bringing back",
      "the last dance the old fair always closed on",
    ] },
  { title: "The Critic", seedAgent: ANA,
    seedText: "Ana read that a regional food magazine was sending a critic to the plaza to write up a single standout shop for its spring issue.",
    topics: [
      "the critic coming to write up one shop on the plaza",
      "how the café and the bakery will present themselves to the visit",
      "where rivalry ends and sabotage begins",
      "the dish each shop is willing to stake its name on",
      "whether a crown for one shop dims the other or lifts the whole plaza",
    ] },
  { title: "The Leaving", seedAgent: MAYA,
    seedText: "Maya overheard that Tom had been asking around about work in another town and had begun clearing out his flat.",
    topics: [
      "the news that Tom might be leaving the plaza",
      "what the town would lose if he goes",
      "the things old friends leave unsaid",
      "the question of whether Tom stays or goes",
      "what's worth saying before a door closes",
    ] },
];

/**
 * Flatten a season into the World's inputs: one day-indexed topic schedule (the
 * meeting framing walks through every arc, day by day) and the arc seed hooks,
 * each aligned to the sim-day its arc begins (the cumulative topic count before
 * it). Arc 0 has no seedText here — it's planted in init() before planning so
 * day-0 plans already know it. Pure, so the alignment is unit-tested.
 */
export function seasonSchedule(season: SeasonArc[]): {
  topics: string[];
  arcSeeds: Array<{ onDay: number; text: string; agentIndex: number }>;
} {
  const topics: string[] = [];
  const arcSeeds: Array<{ onDay: number; text: string; agentIndex: number }> = [];
  let day = 0;
  for (const a of season) {
    if (a.seedText && a.seedAgent !== undefined) {
      arcSeeds.push({ onDay: day, text: a.seedText, agentIndex: a.seedAgent });
    }
    topics.push(...a.topics);
    day += a.topics.length;
  }
  return { topics, arcSeeds };
}

/** which chapter (1-based) the town is in at a given sim-day, with its title +
 *  hook — so the spectator view can name where the season is right now. Clamps
 *  to the last arc once the season's topics are exhausted. */
export function chapterAt(
  season: SeasonArc[],
  dayOffset: number,
): { n: number; title: string; hook?: string } {
  let day = 0;
  for (let i = 0; i < season.length; i++) {
    const arc = season[i]!;
    if (dayOffset < day + arc.topics.length) return { n: i + 1, title: arc.title, hook: arc.seedText };
    day += arc.topics.length;
  }
  const last = season[season.length - 1]!;
  return { n: season.length, title: last.title, hook: last.seedText };
}

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
  /** the audience's causal fingerprints: viewer replies that shaped a decision,
   *  logged once each (deduped by agent+injection), so the record persists and
   *  the audience's authorship stays visible long after the live steer clears. */
  private readonly influenceLog: Array<{ handle: string; name: string; text: string; action: string; at: number }> = [];
  private readonly loggedInfluence = new Set<string>();
  /** social-feed posting: one agent per cadence broadcasts a post about a NEW
   *  salient memory. Self-gated (no model call unless there's something fresh to
   *  say) + budget-capped, so the namesake feed fills without a big Qwen bill. */
  private readonly postedMem = new Set<string>();
  private postCursor = 0;
  private postCount = 0;
  private readonly postEveryTicks: number;
  private readonly maxPosts: number;

  constructor(opts: LiveWorldOptions = {}) {
    const model = opts.model ?? getModel();
    const start = opts.start ?? Date.UTC(2026, 6, 10, 8, 0, 0);
    // Bound the stream so a multi-week 24/7 run stays within the ECS box's heap
    // and per-tick snapshot/retrieval scans stay fast (importance-based forgetting).
    this.store = new MemoryStore(model, { maxNodes: Number(process.env.MAX_MEMORIES ?? 6000) });
    this.tickIntervalMs = opts.tickIntervalMs ?? 4000;
    this.maxReplies = opts.maxReplies ?? 200;
    // Post cadence + budget (env-tunable): a post is only *attempted* every N ticks
    // and only fires a model call when the chosen agent has a fresh salient memory.
    this.postEveryTicks = Math.max(1, Number(process.env.POST_EVERY_TICKS ?? 3));
    this.maxPosts = Number(process.env.MAX_POSTS ?? 400);
    this.logPath = opts.logPath;
    // The season: a rotating sequence of emergent arcs. The meeting framing walks
    // through every arc's escalating topics day by day, and each arc's hook is
    // planted on the sim-day it begins — so the town keeps generating fresh drama
    // across a long run. The cast always reacts freely; we author only the framing.
    const { topics, arcSeeds } = seasonSchedule(SEASON);
    this.world = new World(this.store, start, {
      stepMinutes: opts.stepMinutes ?? 30,
      usePlans: true,
      enableConversations: true,
      conversationEveryTicks: 2,
      conversationTurns: 4,
      dailyGathering: { hour: 12, durationMin: 90, topics },
      arcSeeds,
    });
    const reflectionThreshold = Number(process.env.REFLECT_THRESHOLD ?? 200);
    for (const [id, name, bio, desire] of DEFAULT_CAST) {
      const a = new Agent({ id, name, bio, desire }, this.store, model, { reflectionThreshold });
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
    const currentActions = this.world.currentActions();
    // record any fresh audience-caused moment once — a persistent thread of the
    // story the audience has actually changed (deduped by the injection's timestamp).
    for (const a of this.agents) {
      const inf = a.influence;
      if (!inf) continue;
      const key = `${a.profile.id}|${inf.at}`;
      if (this.loggedInfluence.has(key)) continue;
      this.loggedInfluence.add(key);
      this.influenceLog.push({ handle: inf.handle, name: a.profile.name, text: inf.text, action: currentActions[a.profile.id] ?? "…", at: inf.at });
      if (this.influenceLog.length > 40) this.influenceLog.shift();
    }
    // Social feed: one agent per cadence broadcasts a post about a fresh salient
    // memory (composePost self-gates on new+salient, so no wasted model calls).
    if (this.ticks % this.postEveryTicks === 0 && this.postCount < this.maxPosts && this.agents.length) {
      const poster = this.agents[this.postCursor % this.agents.length]!;
      this.postCursor++;
      const draft = await poster.composePost(this.world.clock, { exclude: (id) => this.postedMem.has(id) });
      if (draft) {
        this.postedMem.add(draft.sourceMemoryId);
        this.feed.addPost(poster.profile.id, draft.text, draft.sourceMemoryId, this.world.clock);
        this.postCount++;
      }
    }
    this.snap = buildSnapshot({ now: this.world.clock, agents: this.agents, store: this.store, currentActions, feed: this.feed, event: this.world.activeEvent(this.world.clock), chapter: chapterAt(SEASON, this.world.simDay()), influences: this.influenceLog.slice(-8).map(({ handle, name, text, action }) => ({ handle, name, text, action })) });
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
    // also attach it to the character's latest post so the feed's reply-counts are
    // real (the live world never re-ingests feed replies — see sim/ — so no double-count).
    const myPosts = this.feed.postsBy(agentId);
    const latest = myPosts[myPosts.length - 1];
    if (latest) this.feed.addReply(latest.id, handle || "guest", text, this.world.clock);
    return { ok: true, importance: node.importance };
  }
}
