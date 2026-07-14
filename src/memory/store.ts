import type { ModelAdapter } from "../model/adapter.ts";
import {
  cosine,
  minMaxNormalize,
  recencyRaw,
  RETRIEVAL_WEIGHTS,
} from "./retrieval.ts";
import type { MemoryKind, MemoryNode, ScoredMemory } from "./types.ts";

export interface AddMemoryInput {
  agentId: string;
  kind: MemoryKind;
  description: string;
  /** sim-clock time (ms). Defaults to the store's notion of now if omitted. */
  now: number;
  filling?: string[];
  depth?: number;
  /** override the model's poignancy (e.g. +2 salience bias for human injections) */
  importanceBias?: number;
}

/**
 * In-memory memory stream + retrieval.
 *
 * This is the local stand-in for the eventual RDS Postgres + pgvector store.
 * The interface (add / retrieve) is deliberately what a pgvector-backed
 * implementation will expose, so swapping persistence in later is mechanical.
 */
export interface MemoryStoreOptions {
  /**
   * Cap on retained memories. When the stream exceeds it, the least valuable
   * nodes are forgotten (lowest importance first, oldest broken ties) so a 24/7
   * run stays bounded in heap AND keeps per-tick retrieval/snapshot scans cheap.
   * Undefined = unbounded (the default — sims and the ablation stay deterministic).
   */
  maxNodes?: number;
}

export class MemoryStore {
  private nodes: MemoryNode[] = [];
  private seq = 0;
  private readonly maxNodes: number | undefined;

  constructor(
    private readonly model: ModelAdapter,
    opts: MemoryStoreOptions = {},
  ) {
    this.maxNodes = opts.maxNodes && opts.maxNodes > 0 ? opts.maxNodes : undefined;
  }

  get size(): number {
    return this.nodes.length;
  }

  all(): readonly MemoryNode[] {
    return this.nodes;
  }

  forAgent(agentId: string): MemoryNode[] {
    return this.nodes.filter((n) => n.agentId === agentId);
  }

  async add(input: AddMemoryInput): Promise<MemoryNode> {
    const embedding = await this.model.embed(input.description);
    const baseImportance = await this.model.scoreImportance(input.description);
    const importance = clamp(baseImportance + (input.importanceBias ?? 0), 1, 10);
    const node: MemoryNode = {
      id: `${input.agentId}:${this.seq++}`,
      agentId: input.agentId,
      kind: input.kind,
      description: input.description,
      importance,
      embedding,
      created: input.now,
      lastAccessed: input.now,
      filling: input.filling ?? [],
      depth: input.depth ?? 0,
    };
    this.nodes.push(node);
    this.prune();
    return node;
  }

  /**
   * Forget down to `maxNodes` when over cap. Keep-priority = importance first
   * (reflections, audience injections, and dramatic beats survive), most-recent
   * breaking ties (so an agent keeps its short-term context). Preserves insertion
   * order among survivors, so retrieval/replay semantics are unchanged otherwise.
   */
  private prune(): void {
    if (this.maxNodes === undefined || this.nodes.length <= this.maxNodes) return;
    const order = this.nodes.map((_, i) => i);
    order.sort((a, b) => {
      const na = this.nodes[a]!;
      const nb = this.nodes[b]!;
      if (nb.importance !== na.importance) return nb.importance - na.importance;
      return b - a; // higher index = more recent = kept first
    });
    const keep = new Set(order.slice(0, this.maxNodes));
    this.nodes = this.nodes.filter((_, i) => keep.has(i));
  }

  /**
   * Retrieve the top-k memories for `agentId` most relevant to `query` right now.
   * Updates lastAccessed on every returned node (retrieval refreshes recency).
   */
  async retrieve(
    agentId: string,
    query: string,
    now: number,
    k = 8,
  ): Promise<ScoredMemory[]> {
    const candidates = this.forAgent(agentId);
    if (candidates.length === 0) return [];

    const queryVec = await this.model.embed(query);

    const recencyRawVals = candidates.map((n) => recencyRaw(n, now));
    const relevanceRawVals = candidates.map((n) => cosine(queryVec, n.embedding));
    const importanceRawVals = candidates.map((n) => n.importance);

    const recencyN = minMaxNormalize(recencyRawVals);
    const relevanceN = minMaxNormalize(relevanceRawVals);
    const importanceN = minMaxNormalize(importanceRawVals);

    const scored: ScoredMemory[] = candidates.map((node, i) => {
      const parts = {
        recency: recencyN[i]!,
        relevance: relevanceN[i]!,
        importance: importanceN[i]!,
      };
      const score =
        RETRIEVAL_WEIGHTS.recency * parts.recency +
        RETRIEVAL_WEIGHTS.relevance * parts.relevance +
        RETRIEVAL_WEIGHTS.importance * parts.importance;
      return { node, score, parts };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, k);
    for (const s of top) s.node.lastAccessed = now;
    return top;
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
