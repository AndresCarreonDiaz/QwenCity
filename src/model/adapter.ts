/**
 * ModelAdapter — the single seam between the simulation and any LLM backend.
 *
 * The entire cognitive loop (perceive → store → retrieve → reflect → plan → act)
 * depends only on this interface. The offline MockAdapter and the real
 * DashScope/Qwen adapter both implement it, so switching from local dev to
 * Qwen Cloud is a one-line factory change (see ./index.ts) — no call sites move.
 */

export interface CompleteOptions {
  /** soft cap on output length; adapters may interpret loosely */
  maxTokens?: number;
  /** 0 = deterministic. The MockAdapter is always deterministic regardless. */
  temperature?: number;
  /** stable label used for routing/telemetry (e.g. "plan", "dialogue", "reflect") */
  task?: string;
}

export interface ModelAdapter {
  /** human-readable backend name, surfaced in logs and the deploy proof */
  readonly name: string;

  /** dimensionality of vectors returned by embed() */
  readonly embedDim: number;

  /** embed text for memory storage / retrieval relevance */
  embed(text: string): Promise<number[]>;

  /**
   * Score a memory's poignancy on the paper's 1..10 scale
   * (1 = mundane, 10 = extremely poignant). Called once, at write time.
   */
  scoreImportance(memoryText: string): Promise<number>;

  /** free-form completion for planning, reflection, reaction, and dialogue */
  complete(prompt: string, opts?: CompleteOptions): Promise<string>;
}
