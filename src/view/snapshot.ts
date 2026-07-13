import type { Agent } from "../agent/agent.ts";
import type { MemoryKind } from "../memory/types.ts";
import type { MemoryStore } from "../memory/store.ts";
import type { Feed } from "../social/feed.ts";
import { selectHighlights, type HighlightBeat } from "./highlights.ts";
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
  action: string;
  planActivity: string | null;
  /** id of the place the character is currently at (for the map) */
  location: string;
  top: Array<{ kind: MemoryKind; importance: number; text: string }>;
}

export interface Edge {
  a: string;
  b: string;
  weight: number;
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

export interface WorldSnapshot {
  t: number;
  clock: string;
  agents: AgentView[];
  ticker: TickerEntry[];
  relationships: Edge[];
  feed: PostView[];
  /** the most recent spoken lines town-wide, oldest→newest (for speech bubbles) */
  dialogue: DialogueLine[];
  /** the day's top events town-wide (importance-driven), for the "Today's highlights" panel */
  highlights: HighlightBeat[];
  /** the town map places (static, but included so the frontend is self-describing) */
  places: Place[];
  stats: { agents: number; memories: number; posts: number; edges: number };
}

export interface SnapshotInput {
  now: number;
  agents: Agent[];
  store: MemoryStore;
  currentActions: Record<string, string>;
  feed?: Feed;
  tickerLimit?: number;
  highlightLimit?: number;
}

/** how many of the most recent dialogue lines a snapshot carries */
const DIALOGUE_LIMIT = 12;

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
    return {
      id: a.profile.id,
      name: a.profile.name,
      action,
      planActivity: a.currentPlanStep(now)?.activity ?? null,
      location: locationForAction(a.profile.id, action),
      top: [...store.forAgent(a.profile.id)]
        .sort((x, y) => y.importance - x.importance)
        .slice(0, 3)
        .map((n) => ({ kind: n.kind, importance: n.importance, text: n.description })),
    };
  });

  // Relationship graph: edges inferred from stored dialogue ("X said to Y: …").
  const edgeWeights = new Map<string, number>();
  for (const n of store.all()) {
    if (n.kind !== "dialogue") continue;
    const m = n.description.match(/^(.+?) said to (.+?):/);
    if (!m) continue;
    const ida = idByName.get(m[1]!.trim());
    const idb = idByName.get(m[2]!.trim());
    if (!ida || !idb || ida === idb) continue;
    const key = [ida, idb].sort().join("|");
    edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
  }
  // each exchange is stored in both agents' streams → halve to get exchange count
  const relationships: Edge[] = [...edgeWeights.entries()].map(([key, w]) => {
    const [a, b] = key.split("|") as [string, string];
    return { a, b, weight: Math.ceil(w / 2) };
  });

  // Recent dialogue for speech bubbles. Each utterance is stored twice (once in
  // the speaker's stream, once in the listener's) with identical created +
  // description, so dedupe on that pair; parse names back to ids and skip
  // anything that doesn't match the canonical `X said to Y: "…"` shape (e.g.
  // audience injections). The trailing `"$` anchor keeps the regex tolerant of
  // double quotes inside the spoken text itself.
  const dialogueRe = /^(.+?) said to (.+?): "([\s\S]*)"$/;
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
    agents: agentViews,
    ticker,
    relationships,
    feed: feedPosts,
    dialogue: recentDialogue,
    highlights,
    places: PLACES,
    stats: { agents: agents.length, memories: store.size, posts: feedPosts.length, edges: relationships.length },
  };
}
