import { Agent } from "../agent/agent.ts";
import { MemoryStore } from "../memory/store.ts";
import { MockAdapter } from "../model/mock.ts";
import { converse } from "../world/conversation.ts";

/**
 * A controlled, fully deterministic scenario used by the ablation. Same config
 * in → same result out (no Date.now / Math.random anywhere), so any difference
 * between two runs is caused only by the config difference — which is what makes
 * the ablation a real experiment rather than a demo.
 */
export interface ScenarioConfig {
  n: number;
  /** whether agents may converse (and thus spread information) */
  dialogue: boolean;
  /** whether an audience reply is injected into agent 0 before the day unfolds */
  audience: boolean;
}

export interface ScenarioResult {
  /** how many agents' memories contain the rumor */
  knowersRumor: number;
  /** realized conversational edges */
  edges: number;
  /** final action text per agent (index = agent index) */
  actions: string[];
  totalMemories: number;
}

const START = Date.UTC(2026, 6, 10, 8, 0, 0);
const HOUR = 3_600_000;
const NAMES = ["Ana", "Bo", "Cy", "Di", "Ed", "Fi", "Gio", "Hana"];

export const RUMOR = /rent|landlord/i;
const AUDIENCE_REPLY = "you should throw a surprise block party — everyone has been so afraid lately";

export async function runScenario(cfg: ScenarioConfig): Promise<ScenarioResult> {
  const model = new MockAdapter();
  const store = new MemoryStore(model);
  const agents = Array.from({ length: cfg.n }, (_, i) => {
    const name = NAMES[i] ?? `A${i}`;
    return new Agent({ id: `a${i}`, name, bio: `${name} lives on the same street.` }, store, model);
  });

  let t = START;
  for (const a of agents) await a.perceive(`${a.profile.name} tidied up this morning.`, t);
  // Seed the rumor only in agent 0 (worded with a poignant word so it ranks).
  await agents[0]!.perceive("Ana heard a troubling secret: the landlord will raise everyone's rent.", t);
  t += HOUR;

  // Optional audience perturbation, injected before the day unfolds so it can ripple.
  if (cfg.audience) {
    await agents[0]!.ingestAudienceReply("fan", AUDIENCE_REPLY, t);
    t += HOUR;
  }

  // Optional dialogue chain 0↔1↔2↔… (the only channel information can spread through).
  let edges = 0;
  if (cfg.dialogue) {
    for (let i = 0; i < cfg.n - 1; i++) {
      await converse(agents[i]!, agents[i + 1]!, t, store, {
        maxTurns: 2,
        topic: "the most important thing I heard recently",
      });
      edges++;
      t += HOUR;
    }
  }

  // Final decision round: every agent commits to an evening action.
  const actions: string[] = [];
  for (const a of agents) {
    const act = await a.decideAction(`What should ${a.profile.name} do this evening?`, t, 8);
    actions.push(act.text);
  }

  const memoriesByAgent = agents.map((a) => store.forAgent(a.profile.id));
  const knowersRumor = memoriesByAgent.filter((mems) => mems.some((n) => RUMOR.test(n.description))).length;

  return { knowersRumor, edges, actions, totalMemories: store.size };
}
