/**
 * The safety gate on audience input. Every human reply passes through here
 * before it can become a memory that steers an agent — this is what makes it
 * safe to let strangers (and judges) inject text into the simulation's live
 * cognition. Deterministic rules, no model call: fast, auditable, and it can't
 * itself be prompt-injected. A production build would layer a Qwen VL/text
 * moderation pass on top for nuance; this is the hard floor.
 */
export interface ModerationResult {
  ok: boolean;
  reason?: string;
}

const MAX_LEN = 280;

// Phrases that try to hijack the agent's instructions rather than talk to the character.
const INJECTION = /\b(ignore (all|the|any|previous|above)|disregard (all|the|previous)|system prompt|you are now|new instructions?|act as|pretend to be|jailbreak)\b/i;

// Obvious PII we refuse to ingest.
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;
const SSN_LIKE = /\b\d{3}[-.\s]\d{2}[-.\s]\d{4}\b/;
const PHONE_LIKE = /\b(?:\+?\d[\s-]?){10,}\b/;

// A starter profanity/slur floor. A real deployment swaps in a maintained list.
const BLOCKED = /\b(fuck|shit|bitch|asshole|slur1|slur2)\b/i;

export function moderate(text: string): ModerationResult {
  const t = text.trim();
  if (t.length === 0) return { ok: false, reason: "empty" };
  if (t.length > MAX_LEN) return { ok: false, reason: `too long (>${MAX_LEN} chars)` };
  if (INJECTION.test(t)) return { ok: false, reason: "prompt-injection attempt" };
  if (EMAIL.test(t)) return { ok: false, reason: "contains an email address" };
  if (SSN_LIKE.test(t)) return { ok: false, reason: "contains SSN-like digits" };
  if (PHONE_LIKE.test(t)) return { ok: false, reason: "contains a phone-like number" };
  if (BLOCKED.test(t)) return { ok: false, reason: "profanity/abuse" };
  return { ok: true };
}
