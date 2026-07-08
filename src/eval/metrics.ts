/**
 * Metrics for the ablation. Deliberately simple and deterministic so the
 * numbers are reproducible and defensible — the whole point of the ablation is
 * that the claim survives a skeptical judge, so nothing here may depend on
 * Date.now / Math.random.
 */

/** how many agents' memories contain a fact matching `pattern` */
export function countKnowers(memoriesByAgent: string[][], pattern: RegExp): number {
  return memoriesByAgent.filter((mems) => mems.some((m) => pattern.test(m))).length;
}

/**
 * Relationship-graph density: realized conversational edges as a fraction of all
 * possible undirected pairs among `n` agents. 0 = nobody interacted, 1 = fully
 * connected.
 */
export function graphDensity(edgeCount: number, n: number): number {
  if (n < 2) return 0;
  const possible = (n * (n - 1)) / 2;
  return edgeCount / possible;
}

/**
 * Trajectory divergence between two runs: the fraction of agents whose final
 * action text differs. Two identical (deterministic) runs → 0; a run perturbed
 * by an audience reply → > 0. This is the "the audience changed the world"
 * number a closed sandbox cannot produce.
 */
export function actionDivergence(a: string[], b: string[]): number {
  const n = Math.max(a.length, b.length);
  if (n === 0) return 0;
  let diff = 0;
  for (let i = 0; i < n; i++) {
    if ((a[i] ?? "") !== (b[i] ?? "")) diff++;
  }
  return diff / n;
}
