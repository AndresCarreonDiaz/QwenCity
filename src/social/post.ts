/**
 * Prompt + parser for turning a salient memory into a first-person social post.
 * Kept tiny and model-agnostic; the mock returns a deterministic post, real Qwen
 * returns something in the character's voice.
 */
export function buildPostPrompt(bio: string, name: string, memoryText: string): string {
  return [
    bio,
    `${name} wants to post to their followers about what's on their mind.`,
    ``,
    `RELEVANT MEMORIES:`,
    `- ${memoryText}`,
    ``,
    `Write ONE short first-person social post (one sentence) in ${name}'s voice.`,
    `Respond with one line:`,
    `POST: <text>`,
  ].join("\n");
}

export function parsePost(raw: string): string {
  const m = raw.match(/POST:\s*(.+)/i);
  return (m?.[1] ?? raw).trim();
}
