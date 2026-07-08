/**
 * A single memory record — the paper's ConceptNode, trimmed to what we use.
 * Every experience an agent has is exactly one of these.
 */
export type MemoryKind =
  | "observation" // something perceived in the world (paper: "event")
  | "dialogue" // an utterance in a conversation (paper: "chat")
  | "reflection" // a synthesized higher-level belief (paper: "thought")
  | "plan" // a committed intention / decomposed action
  | "injection"; // NEW vs Stanford: an external human reply, ingested as memory

export interface MemoryNode {
  id: string;
  agentId: string;
  kind: MemoryKind;
  /** natural-language content — this is what gets embedded and shown in the ticker */
  description: string;
  /** poignancy 1..10, scored once by the model at creation */
  importance: number;
  /** embedding of `description`, from ModelAdapter.embed */
  embedding: number[];
  /** simulation time (ms since epoch in sim-clock) the memory was created */
  created: number;
  /** simulation time of most recent retrieval — drives the recency term */
  lastAccessed: number;
  /** node ids this memory was synthesized from (reflections cite their evidence) */
  filling: string[];
  /** reflection-tree depth: 0 = raw observation, higher = more abstract */
  depth: number;
}

/** A retrieval result: the node plus the three normalized sub-scores that ranked it. */
export interface ScoredMemory {
  node: MemoryNode;
  score: number;
  parts: { recency: number; relevance: number; importance: number };
}
