import type { MemoryNode } from "../memory/types.ts";

/**
 * Dialogue prompt builder + parser (Park et al. §5). An utterance is conditioned
 * on the speaker's summary, the time, the relationship with the listener, the
 * conversation so far, and the memories relevant to the moment — so what an
 * agent says is grounded in what it knows. Storing each utterance into BOTH
 * speakers' streams is what lets information (a rumor, a plan) diffuse through
 * the society, which is exactly what the ablation later measures.
 */
export interface UtterancePromptInput {
  speakerBio: string;
  speakerName: string;
  listenerName: string;
  /** short summary of the speaker's relationship with the listener */
  relationship: string;
  /** prior lines, each "Name: text" */
  history: string[];
  /** memories relevant to this moment, top-ranked first */
  relevant: MemoryNode[];
  now: number;
}

export function buildUtterancePrompt(input: UtterancePromptInput): string {
  const memBlock = input.relevant.length
    ? input.relevant.map((m) => `- ${m.description}`).join("\n")
    : "- (nothing in particular)";
  const hist = input.history.length ? input.history.join("\n") : "(the conversation is just beginning)";
  return [
    input.speakerBio,
    `It is sim-time ${new Date(input.now).toISOString()}.`,
    `${input.speakerName} is talking with ${input.listenerName}. ${input.relationship}`.trim(),
    ``,
    `RELEVANT MEMORIES:`,
    memBlock,
    ``,
    `Conversation so far:`,
    hist,
    ``,
    `What does ${input.speakerName} say next? Respond with one line:`,
    `SAY: <one natural sentence>`,
  ].join("\n");
}

export function parseUtterance(raw: string): string {
  const m = raw.match(/SAY:\s*(.+)/i);
  return (m?.[1] ?? raw).trim();
}
