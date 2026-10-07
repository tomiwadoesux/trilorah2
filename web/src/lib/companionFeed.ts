/**
 * The pure half of the companion page's live feed: how rows that arrive from
 * three different places — the first backfill, realtime, and the catch-up
 * fetches — are folded into one list without duplicates or reordering.
 *
 * Kept apart from the hook so the rules can be tested without a socket.
 */

export interface FeedChunk {
  id: string;
  timestamp: string;
}

export interface FeedVerse {
  id: string;
  pushed_to_live?: boolean | null;
  pushed_at?: string | null;
}

export interface FeedService {
  id: string;
  started_at: string;
  ended_at: string | null;
}

/** A congregant's phone never needs more than this many chunks in memory. */
export const CHUNK_CAP = 200;

const time = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : 0;
};

/**
 * Fold incoming transcript rows into what the phone already holds.
 *
 * The same row can arrive twice — realtime delivers it, then a catch-up fetch
 * that overlaps on purpose returns it again — so rows are keyed on id, and a
 * repeat replaces rather than duplicates. Oldest first, newest kept at the cap.
 */
export function mergeChunks<T extends FeedChunk>(
  prev: readonly T[],
  incoming: readonly T[],
  cap = CHUNK_CAP,
): T[] {
  if (incoming.length === 0) return prev as T[];
  const byId = new Map<string, T>();
  for (const c of prev) byId.set(c.id, c);
  for (const c of incoming) byId.set(c.id, c);
  const merged = [...byId.values()].sort((a, b) => time(a.timestamp) - time(b.timestamp));
  return merged.length > cap ? merged.slice(-cap) : merged;
}

/**
 * Fold incoming verse rows in. Only verses that reached the wall belong on a
 * phone; a row that was staged and never pushed is dropped, and the UPDATE
 * that marks a staged verse live replaces the earlier copy. Newest first.
 */
export function mergeVerses<T extends FeedVerse>(prev: readonly T[], incoming: readonly T[]): T[] {
  if (incoming.length === 0) return prev as T[];
  const byId = new Map<string, T>();
  for (const v of prev) byId.set(v.id, v);
  for (const v of incoming) {
    if (v.pushed_to_live) byId.set(v.id, v);
    else byId.delete(v.id);
  }
  return [...byId.values()].sort((a, b) => time(b.pushed_at) - time(a.pushed_at));
}

/** The newest timestamp held, or null when nothing has arrived yet. */
export function newestTimestamp(chunks: readonly FeedChunk[]): string | null {
  let best: FeedChunk | null = null;
  for (const c of chunks) if (!best || time(c.timestamp) > time(best.timestamp)) best = c;
  return best?.timestamp ?? null;
}

/**
 * Where a catch-up fetch should start: a little before the newest row held.
 *
 * Two chunks written in the same round trip can carry the same timestamp, and
 * a fetch that started exactly AT the newest one would still be right — but
 * one that started just after it would skip its twin. The overlap costs a few
 * duplicate rows, which the merge absorbs.
 */
export function catchUpSince(chunks: readonly FeedChunk[], now: number, overlapMs = 10_000, emptyWindowMs = 3 * 60_000): string {
  const newest = newestTimestamp(chunks);
  const from = newest ? time(newest) - overlapMs : now - emptyWindowMs;
  return new Date(from).toISOString();
}

/**
 * Whether the page should move to `candidate`.
 *
 * A different service only wins if it started later than the one on screen —
 * a stale poll that comes back after a newer realtime INSERT must not drag the
 * page back to last week. The same service always wins, so its own updates
 * (the sermon title, `ended_at`) land.
 */
export function shouldAdopt(current: FeedService | null, candidate: FeedService | null): boolean {
  if (!candidate) return false;
  if (!current) return true;
  if (candidate.id === current.id) return true;
  return time(candidate.started_at) > time(current.started_at);
}
