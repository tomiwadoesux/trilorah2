/**
 * Tests for the mirrored playhead maths. These exist because the module is a
 * COPY of /shared/wordTimings.ts (see the comment there for why) — without its
 * own tests the copy could drift silently.
 *
 *   npx vitest run --config web/vitest.config.ts     (from the repo root)
 */
import { describe, it, expect } from "vitest";
import {
  playheadSeconds,
  wordState,
  activeWordIndex,
  type WordTiming,
} from "./wordTimings";

const W = (w: string, s: number, e: number): WordTiming => ({ w, s, e });

describe("playheadSeconds — the room's clock, minus the lags", () => {
  const start = 1_000_000;
  it("subtracts both the stream delay and the deliberate hold", () => {
    expect(playheadSeconds(start + 30_000, start, 20_000, 4_000)).toBeCloseTo(6);
  });
  it("never goes negative — a phone opened at the first second shows nothing, not a rewind", () => {
    expect(playheadSeconds(start + 1_000, start, 20_000, 4_000)).toBe(0);
  });
  it("is a straight second-for-second advance once past the lags", () => {
    const a = playheadSeconds(start + 60_000, start, 20_000, 4_000);
    const b = playheadSeconds(start + 61_000, start, 20_000, 4_000);
    expect(b - a).toBeCloseTo(1);
  });
  /**
   * The congregant in the building has no stream to be behind, so the caller
   * passes a zero delay and only the deliberate hold applies. This used to
   * subtract a full twenty seconds of assumed YouTube latency from them as
   * well, which parked the highlight ~24s back down the transcript and meant
   * the live word never appeared while the preacher was speaking.
   */
  it("is only the hold behind the room when there is no stream", () => {
    expect(playheadSeconds(start + 30_000, start, 0, 4_000)).toBeCloseTo(26);
  });
});

describe("wordState", () => {
  const word = W("grace", 2, 2.5);
  it("is coming before it starts", () => {
    expect(wordState(word, 1.99)).toBe("coming");
  });
  it("is saying across its own span, inclusive of the start", () => {
    expect(wordState(word, 2)).toBe("saying");
    expect(wordState(word, 2.4)).toBe("saying");
  });
  it("is said the instant it ends — no gap where a word has no state", () => {
    expect(wordState(word, 2.5)).toBe("said");
    expect(wordState(word, 99)).toBe("said");
  });
});

describe("activeWordIndex", () => {
  const words = [W("The", 0, 0.3), W("Lord", 0.4, 0.8), W("is", 0.9, 1), W("good", 1.1, 1.6)];

  it("answers -1 before the first word so 'nothing yet' is distinguishable", () => {
    expect(activeWordIndex(words, -1)).toBe(-1);
    expect(activeWordIndex(words, 0)).toBe(0);
  });
  it("holds the last finished word through a gap between words", () => {
    expect(activeWordIndex(words, 0.35)).toBe(0);
  });
  it("walks forward from a stale hint", () => {
    expect(activeWordIndex(words, 1.2, 0)).toBe(3);
  });
  it("walks backward when the viewer nudges the sync and the playhead jumps back", () => {
    expect(activeWordIndex(words, 0.45, 3)).toBe(1);
  });
  it("clamps an out-of-range hint rather than reading off the end", () => {
    expect(activeWordIndex(words, 1.3, 999)).toBe(3);
    expect(activeWordIndex(words, 1.3, -5)).toBe(3);
  });
  it("stays on the last word once the chunk is over", () => {
    expect(activeWordIndex(words, 500)).toBe(3);
  });
  it("is -1 for an empty chunk", () => {
    expect(activeWordIndex([], 5)).toBe(-1);
  });
});
