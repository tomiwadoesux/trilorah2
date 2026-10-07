import { describe, expect, it } from "vitest";
import { catchUpSince, mergeChunks, mergeVerses, newestTimestamp, shouldAdopt } from "./companionFeed";

const chunk = (id: string, seconds: number, text = id) => ({
  id,
  text,
  timestamp: new Date(Date.UTC(2026, 9, 4, 10, 0, seconds)).toISOString(),
});

describe("mergeChunks", () => {
  it("adds rows that realtime missed, in spoken order", () => {
    const held = [chunk("a", 1), chunk("b", 2)];
    const fetched = [chunk("d", 4), chunk("c", 3)];
    expect(mergeChunks(held, fetched).map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("does not duplicate a row that arrives from realtime and the catch-up fetch", () => {
    const held = [chunk("a", 1), chunk("b", 2)];
    const overlap = [chunk("b", 2), chunk("c", 3)];
    expect(mergeChunks(held, overlap).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("lets the later copy of a row replace the earlier one", () => {
    const held = [chunk("a", 1, "old")];
    expect(mergeChunks(held, [chunk("a", 1, "new")])[0].text).toBe("new");
  });

  it("keeps the newest rows at the cap", () => {
    const held = Array.from({ length: 5 }, (_, i) => chunk(`c${i}`, i));
    expect(mergeChunks(held, [chunk("c5", 5)], 3).map((c) => c.id)).toEqual(["c3", "c4", "c5"]);
  });

  it("returns the same array when nothing arrived, so React skips the render", () => {
    const held = [chunk("a", 1)];
    expect(mergeChunks(held, [])).toBe(held);
  });
});

describe("mergeVerses", () => {
  const verse = (id: string, seconds: number, live = true) => ({
    id,
    pushed_to_live: live,
    pushed_at: new Date(Date.UTC(2026, 9, 4, 10, 0, seconds)).toISOString(),
  });

  it("keeps only verses that reached the wall, newest first", () => {
    const merged = mergeVerses([], [verse("a", 1), verse("b", 2, false), verse("c", 3)]);
    expect(merged.map((v) => v.id)).toEqual(["c", "a"]);
  });

  it("replaces a verse when its live update arrives", () => {
    const merged = mergeVerses([verse("a", 1)], [verse("a", 9)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].pushed_at).toContain("10:00:09");
  });
});

describe("catchUpSince", () => {
  it("starts a little before the newest row held", () => {
    const since = catchUpSince([chunk("a", 1), chunk("b", 30)], Date.now(), 10_000);
    expect(since).toBe(new Date(Date.UTC(2026, 9, 4, 10, 0, 20)).toISOString());
  });

  it("looks back a few minutes when the phone holds nothing yet", () => {
    const now = Date.UTC(2026, 9, 4, 10, 10, 0);
    expect(catchUpSince([], now, 10_000, 180_000)).toBe(new Date(Date.UTC(2026, 9, 4, 10, 7, 0)).toISOString());
  });
});

describe("newestTimestamp", () => {
  it("is null for an empty feed", () => {
    expect(newestTimestamp([])).toBeNull();
  });
  it("finds the newest row regardless of order", () => {
    expect(newestTimestamp([chunk("b", 9), chunk("a", 1)])).toContain("10:00:09");
  });
});

describe("shouldAdopt", () => {
  const service = (id: string, minute: number, ended: string | null = null) => ({
    id,
    started_at: new Date(Date.UTC(2026, 9, 4, 10, minute)).toISOString(),
    ended_at: ended,
  });

  it("adopts the first service the page sees", () => {
    expect(shouldAdopt(null, service("a", 0))).toBe(true);
  });
  it("moves to a service that started later", () => {
    expect(shouldAdopt(service("old", 0, "x"), service("new", 5))).toBe(true);
  });
  it("never moves back to an older service from a stale poll", () => {
    expect(shouldAdopt(service("new", 5), service("old", 0))).toBe(false);
  });
  it("accepts updates to the service on screen", () => {
    expect(shouldAdopt(service("a", 0), service("a", 0, "ended"))).toBe(true);
  });
  it("ignores an empty answer", () => {
    expect(shouldAdopt(service("a", 0), null)).toBe(false);
  });
});
