import assert from "node:assert/strict";
import { test } from "node:test";
import { weatherFor, weatherPhrase } from "../src/world/weather.ts";

test("weather is deterministic and stable within a 3-hour block", () => {
  const t = Date.UTC(2026, 6, 12, 10, 0);
  assert.equal(weatherFor(t), weatherFor(t));
  assert.equal(weatherFor(t), weatherFor(t + 60 * 60 * 1000)); // same block one hour later
});

test("weather varies across days and covers all three skies", () => {
  const seen = new Set<string>();
  for (let d = 0; d < 40; d++) {
    seen.add(weatherFor(Date.UTC(2026, 6, 10) + d * 3 * 60 * 60 * 1000));
  }
  assert.ok(seen.has("clear") && seen.has("overcast") && seen.has("rain"), `saw only ${[...seen]}`);
});

test("weatherPhrase matches the weather and is prompt-ready", () => {
  for (let d = 0; d < 40; d++) {
    const t = Date.UTC(2026, 6, 10) + d * 3 * 60 * 60 * 1000;
    const w = weatherFor(t);
    const p = weatherPhrase(t);
    if (w === "clear") assert.equal(p, "");
    else assert.ok(p.endsWith(". ") && /rain|overcast/.test(p));
  }
});
