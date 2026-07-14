import assert from "node:assert/strict";
import { test } from "node:test";
import { moodFor } from "../src/view/mood.ts";

test("empty or neutral memories give a neutral mood", () => {
  assert.equal(moodFor([]), "neutral");
  assert.equal(moodFor(["Opened the shop.", "Restocked the shelves."]), "neutral");
});

test("worry-laden memories read as worried", () => {
  assert.equal(
    moodFor(["Ana heard the landlord will raise the rent.", "I'm anxious about whether I can afford it."]),
    "worried",
  );
});

test("lonely / wistful memories read as sad", () => {
  assert.equal(
    moodFor(["Re-read old texts and sighed heavily.", "I miss how things were; the note stays unsent."]),
    "sad",
  );
});

test("cheerful memories read as happy", () => {
  assert.equal(
    moodFor(["A regular made me smile.", "I feel grateful and glad today."]),
    "happy",
  );
});

test("recent memories outweigh older ones", () => {
  // older worry, but the two most-recent are happy → happy wins via recency ramp
  const mood = moodFor([
    "worried about the rent",
    "a customer smiled at me",
    "I feel grateful and full of joy",
  ]);
  assert.equal(mood, "happy");
});

test("moodFor is deterministic", () => {
  const texts = ["angry at my rival", "the argument still stings"];
  assert.equal(moodFor(texts), moodFor(texts));
  assert.equal(moodFor(texts), "tense");
});
