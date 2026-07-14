import type { Agent } from "../agent/agent.ts";
import type { MemoryKind } from "../memory/types.ts";
import type { MemoryStore } from "../memory/store.ts";
import type { Feed } from "../social/feed.ts";
import { weatherFor, type Weather } from "../world/weather.ts";
import type { WorldEvent } from "../world/world.ts";
import { selectHighlights, type HighlightBeat } from "./highlights.ts";
import { moodFor, type MoodKey } from "./mood.ts";
import { locationForAction, PLACES, type Place } from "./places.ts";

/**
 * The frontend contract: a JSON-serializable snapshot of the world at one
 * moment. This is what the spectator dashboard renders — the color-coded
 * thought-ticker ("watch the mind"), each character's current action and plan
 * step, the social feed, and the relationship graph inferred from who has
 * actually talked to whom. Pure derivation from world/memory/feed state, so it
 * works identically over a live run or a replayed golden run.
 */
export interface TickerEntry {
  t: number;
  agentId: string;
  agentName: string;
  kind: MemoryKind;
  importance: number;
  text: string;
}

export interface AgentView {
  id: string;
  name: string;
  /** one-line identity/bio (who this character is) — surfaced so viewers attach */
  bio: string;
  /** current emotional read, derived from recent memories (for the map + panel) */
  mood: MoodKey;
  /** if this agent's current action was shaped by an audience reply (the causal loop, visible) */
  influencedBy: { handle: string; text: string } | null;
  action: string;
  planActivity: string | null;
  /** id of the place the character is currently at (for the map) */
  location: string;
  top: Array<{ kind: MemoryKind; importance: number; text: string }>;
}

/** the emotional trajectory of a bond, read from the pair's recent dialogue */
export type EdgeTone = "warming" | "tension" | "strained" | "steady";

export interface Edge {
  a: string;
  b: string;
  weight: number;
  tone: EdgeTone;
}

/** map the sentiment of a pair's recent lines to a relationship trajectory */
function toneFrom(texts: string[]): EdgeTone {
  const m = moodFor(texts);
  if (m === "happy" || m === "warm" || m === "excited") return "warming";
  if (m === "tense") return "tension";
  if (m === "sad" || m === "worried") return "strained";
  return "steady";
}

export interface PostView {
  id: string;
  agentId: string;
  text: string;
  replies: number;
}

/** One spoken line, parsed back out of a stored `dialogue` memory (for speech bubbles). */
export interface DialogueLine {
  t: number;
  speakerId: string;
  speakerName: string;
  listenerId: string;
  listenerName: string;
  text: string;
}

/** One audience reply, parsed back out of a stored `injection` memory (shown on the broadcast). */
export interface AudienceLine {
  t: number;
  agentId: string;
  agentName: string;
  handle: string;
  text: string;
}

export interface WorldSnapshot {
  t: number;
  clock: string;
  /** deterministic town weather for this moment (engine + view share it) */
  weather: Weather;
  agents: AgentView[];
  ticker: TickerEntry[];
  relationships: Edge[];
  feed: PostView[];
  /** the most recent spoken lines town-wide, oldest→newest (for speech bubbles) */
  dialogue: DialogueLine[];
  /** the most recent audience replies, oldest→newest (surfaced on the broadcast) */
  audience: AudienceLine[];
  /** the day's top events town-wide (importance-driven), for the "Today's highlights" panel */
  highlights: HighlightBeat[];
  /** the town map places (static, but included so the frontend is self-describing) */
  places: Place[];
  /** the season framing — what's at stake — shown so drop-in viewers get the story */
  premise: string;
  /** a town-wide happening in progress (e.g. the daily town meeting), or null */
  event: WorldEvent | null;
  stats: { agents: number; memories: number; posts: number; edges: number };
}

/** The season's central conflict, framed for the audience. Tied to the seed
 *  event (`liveworld.init` plants the rent rumor) so it stays honest. */
export const PREMISE =
  "Season 1 — Rent Day. A rumor is spreading that the landlord will raise everyone's rent. " +
  "In a small town where Maya's café and Ana's bakery are already rivals, one secret could change everything. " +
  "Watch it unfold live — and talk to the cast to change what happens next.";

export interface SnapshotInput {
  now: number;
  agents: Agent[];
  store: MemoryStore;
  currentActions: Record<string, string>;
  feed?: Feed;
  tickerLimit?: number;
  highlightLimit?: number;
  /** the town-wide event in progress, from `World.activeEvent(now)` */
  event?: WorldEvent | null;
}

/** how many of the most recent dialogue lines a snapshot carries */
const DIALOGUE_LIMIT = 12;
/** how many of the most recent audience replies a snapshot carries */
const AUDIENCE_LIMIT = 6;

export function buildSnapshot(input: SnapshotInput): WorldSnapshot {
  const { now, agents, store, currentActions } = input;
  const tickerLimit = input.tickerLimit ?? 24;
  const nameById = new Map(agents.map((a) => [a.profile.id, a.profile.name]));
  const idByName = new Map(agents.map((a) => [a.profile.name, a.profile.id]));

  // Global thought-ticker: newest memories first, across all agents.
  const ticker: TickerEntry[] = [...store.all()]
    .sort((a, b) => b.created - a.created)
    .slice(0, tickerLimit)
    .map((n) => ({
      t: n.created,
      agentId: n.agentId,
      agentName: nameById.get(n.agentId) ?? n.agentId,
      kind: n.kind,
      importance: n.importance,
      text: n.description,
    }));

  // Per-agent view.
  const agentViews: AgentView[] = agents.map((a) => {
    const action = currentActions[a.profile.id] ?? "…";
    const recent = store.forAgent(a.profile.id);
    const mood = moodFor(recent.slice(-14).map((n) => n.description));
    const inf = a.influence;
    return {
      id: a.profile.id,
      name: a.profile.name,
      bio: a.profile.bio,
      mood,
      influencedBy: inf ? { handle: inf.handle, text: inf.text } : null,
      action,
      planActivity: a.currentPlanStep(now)?.activity ?? null,
      location: locationForAction(a.profile.id, action),
      top: [...store.forAgent(a.profile.id)]
        .sort((x, y) => y.importance - x.importance)
        .slice(0, 3)
        .map((n) => ({ kind: n.kind, importance: n.importance, text: n.description })),
    };
  });

  // Relationship graph + tone: edges inferred from stored dialogue ("X said to
  // Y: …"), each carrying an emotional trajectory read from the sentiment of the
  // pair's most recent exchanges (so a bond can be "warming" or in "tension").
  const dialogueRe = /^(.+?) said to (.+?): "([\s\S]*)"$/;
  const edgeWeights = new Map<string, number>();
  const edgeTexts = new Map<string, Array<{ t: number; text: string }>>();
  for (const n of store.all()) {
    if (n.kind !== "dialogue") continue;
    const m = n.description.match(dialogueRe);
    if (!m) continue;
    const ida = idByName.get(m[1]!.trim());
    const idb = idByName.get(m[2]!.trim());
    if (!ida || !idb || ida === idb) continue;
    const key = [ida, idb].sort().join("|");
    edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
    const arr = edgeTexts.get(key) ?? [];
    arr.push({ t: n.created, text: m[3]! });
    edgeTexts.set(key, arr);
  }
  // each exchange is stored in both agents' streams → halve to get exchange count
  const relationships: Edge[] = [...edgeWeights.entries()].map(([key, w]) => {
    const [a, b] = key.split("|") as [string, string];
    const recentTexts = (edgeTexts.get(key) ?? []).sort((x, y) => x.t - y.t).slice(-6).map((e) => e.text);
    return { a, b, weight: Math.ceil(w / 2), tone: toneFrom(recentTexts) };
  });

  // Recent dialogue for speech bubbles. Each utterance is stored twice (once in
  // the speaker's stream, once in the listener's) with identical created +
  // description, so dedupe on that pair; parse names back to ids and skip
  // anything that doesn't match the canonical `X said to Y: "…"` shape (e.g.
  // audience injections). The trailing `"$` anchor keeps the regex tolerant of
  // double quotes inside the spoken text itself.
  const seenLines = new Set<string>();
  const dialogue: DialogueLine[] = [];
  for (const n of store.all()) {
    if (n.kind !== "dialogue") continue;
    const key = `${n.created}|${n.description}`;
    if (seenLines.has(key)) continue;
    seenLines.add(key);
    const m = n.description.match(dialogueRe);
    if (!m) continue;
    const speakerName = m[1]!.trim();
    const listenerName = m[2]!.trim();
    const speakerId = idByName.get(speakerName);
    const listenerId = idByName.get(listenerName);
    if (!speakerId || !listenerId) continue;
    dialogue.push({ t: n.created, speakerId, speakerName, listenerId, listenerName, text: m[3]! });
  }
  dialogue.sort((x, y) => x.t - y.t);
  const recentDialogue = dialogue.slice(-DIALOGUE_LIMIT);

  // Recent audience replies (injection memories) — first-class in the contract
  // so the broadcast can surface them even after the ticker has moved on.
  const audienceRe = /^On [^,]+, @([\w.-]+) replied to my post: "([\s\S]*)"$/;
  const audience: AudienceLine[] = [];
  for (const n of store.all()) {
    if (n.kind !== "injection") continue;
    const m = n.description.match(audienceRe);
    if (!m) continue;
    audience.push({
      t: n.created,
      agentId: n.agentId,
      agentName: nameById.get(n.agentId) ?? n.agentId,
      handle: m[1]!,
      text: m[2]!,
    });
  }
  audience.sort((x, y) => x.t - y.t);
  const recentAudience = audience.slice(-AUDIENCE_LIMIT);

  const feedPosts: PostView[] = (input.feed?.posts ?? []).map((p) => ({
    id: p.id,
    agentId: p.agentId,
    text: p.text,
    replies: (input.feed?.replies ?? []).filter((r) => r.postId === p.id && r.status === "accepted").length,
  }));

  // Town-wide daily highlights (importance-driven; USE 2 of the Salience Engine).
  const highlights = selectHighlights([...store.all()], { k: input.highlightLimit ?? 6 });

  return {
    t: now,
    clock: new Date(now).toISOString().slice(11, 16),
    weather: weatherFor(now),
    agents: agentViews,
    ticker,
    relationships,
    feed: feedPosts,
    dialogue: recentDialogue,
    audience: recentAudience,
    highlights,
    places: PLACES,
    premise: PREMISE,
    event: input.event ?? null,
    stats: { agents: agents.length, memories: store.size, posts: feedPosts.length, edges: relationships.length },
  };
}
