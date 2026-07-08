import type { Agent } from "../agent/agent.ts";
import type { MemoryStore } from "../memory/store.ts";

export interface Utterance {
  speakerId: string;
  speakerName: string;
  text: string;
  t: number;
}

export interface ConverseOptions {
  /** max alternating turns (paper conversations are short) */
  maxTurns?: number;
  /** sim-ms between turns */
  stepMs?: number;
  /** what the conversation is nominally about (seeds the speaker's retrieval) */
  topic?: string;
}

/**
 * Run a short conversation between two agents, alternating turns. Each utterance
 * is stored as a `dialogue` memory in BOTH agents' streams — so anything one
 * agent says (a rumor, a plan, a feeling) becomes something the other now
 * remembers and can act on or pass along. That storage step is the mechanism
 * behind information diffusion through the society.
 */
export async function converse(
  a: Agent,
  b: Agent,
  now: number,
  store: MemoryStore,
  opts: ConverseOptions = {},
): Promise<Utterance[]> {
  const maxTurns = opts.maxTurns ?? 4;
  const stepMs = opts.stepMs ?? 60_000;
  const topic = opts.topic ?? "recent important news";

  const order: Agent[] = [a, b];
  const history: string[] = [];
  const transcript: Utterance[] = [];
  let t = now;

  for (let i = 0; i < maxTurns; i++) {
    const speaker = order[i % 2]!;
    const listener = order[(i + 1) % 2]!;

    const text = await speaker.speak(
      { id: listener.profile.id, name: listener.profile.name },
      history,
      t,
      topic,
    );

    history.push(`${speaker.profile.name}: ${text}`);
    transcript.push({ speakerId: speaker.profile.id, speakerName: speaker.profile.name, text, t });

    // Record the same exchange in both streams (heard by both parties).
    const desc = `${speaker.profile.name} said to ${listener.profile.name}: "${text}"`;
    await store.add({ agentId: speaker.profile.id, kind: "dialogue", description: desc, now: t });
    await store.add({ agentId: listener.profile.id, kind: "dialogue", description: desc, now: t });

    t += stepMs;
  }

  return transcript;
}
