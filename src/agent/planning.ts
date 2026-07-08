/**
 * Daily planning (Park et al. §4). An agent plans its day top-down as an ordered
 * schedule of activities, stores each as a `plan` memory (so plans influence
 * later retrieval and reflection), and can re-plan from the current moment
 * forward when it reacts to something — keeping the past, replacing the rest.
 */
export interface PlanStep {
  /** minutes since midnight (sim-local, UTC) */
  startMin: number;
  endMin: number;
  activity: string;
}
export type Plan = PlanStep[];

export function minutesSinceMidnight(now: number): number {
  const d = new Date(now);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function fmtMin(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function buildDailyPlanPrompt(bio: string, name: string, dateLabel: string): string {
  return [
    bio,
    `Today is ${dateLabel}. Plan ${name}'s day from waking to sleep.`,
    `List the plan as lines in the exact form "HH:MM - activity", earliest first.`,
  ].join("\n");
}

/**
 * Parse a schedule from "HH:MM - activity" lines. Steps are sorted by start
 * time and each step's end is the next step's start (the last runs to midnight),
 * so the plan tiles the day with no gaps.
 */
export function parsePlan(text: string): Plan {
  const raw: Array<{ startMin: number; activity: string }> = [];
  for (const line of text.split("\n")) {
    const m = line.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(.+\S)/);
    if (!m) continue;
    const h = parseInt(m[1]!, 10);
    const min = parseInt(m[2]!, 10);
    if (h > 23 || min > 59) continue;
    raw.push({ startMin: h * 60 + min, activity: m[3]!.trim() });
  }
  raw.sort((a, b) => a.startMin - b.startMin);
  return raw.map((step, i) => ({
    startMin: step.startMin,
    endMin: i + 1 < raw.length ? raw[i + 1]!.startMin : 24 * 60,
    activity: step.activity,
  }));
}

/** the step scheduled at `min` minutes-since-midnight, or null if before the first step */
export function stepAt(plan: Plan, min: number): PlanStep | null {
  for (const s of plan) if (min >= s.startMin && min < s.endMin) return s;
  return null;
}

/**
 * Re-plan from `min` forward: keep steps that already finished, truncate the
 * one in progress to end now, insert the new activity for the remainder of that
 * slot, and let later steps resume. Pure — returns a new plan.
 */
export function replanFrom(plan: Plan, min: number, activity: string): Plan {
  const done = plan.filter((s) => s.endMin <= min);
  const rest = plan.filter((s) => s.endMin > min);
  if (rest.length === 0) return [...done, { startMin: min, endMin: 24 * 60, activity }];
  const cur = rest[0]!;
  const later = rest.slice(1);
  const rebuilt: Plan = [
    ...done,
    ...(cur.startMin < min ? [{ startMin: cur.startMin, endMin: min, activity: cur.activity }] : []),
    { startMin: min, endMin: cur.endMin, activity },
    ...later,
  ];
  return rebuilt.filter((s) => s.startMin < s.endMin);
}
