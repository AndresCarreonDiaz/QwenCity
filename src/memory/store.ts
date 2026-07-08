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
export class MemoryStore {
  private nodes: MemoryNode[] = [];
  private seq = 0;

  constructor(private readonly model: ModelAdapter) {}

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
    return node;
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
