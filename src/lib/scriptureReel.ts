import { BOOKS, CHAPTER_COUNTS } from './books';
import type { LiveItem } from '../design/screens/projector';

/*
 * Where a live verse is, and the rows the scripture list flicks past on its
 * way there. Pure, so the arithmetic can be tested without a window.
 */

/** The verses a live scripture item covers, in the list's own terms. */
export interface LiveSpan {
  bookIndex: number;
  book: string;
  chapter: number;
  first: number;
  last: number;
}

/** "Genesis 22:1-3" off the projector's live item, or null for anything else. */
export function liveSpan(item: LiveItem | null | undefined): LiveSpan | null {
  if (!item || item.source !== 'scripture') return null;
  const m = (item.reference ?? item.id).trim().match(/^(.+?)\s+(\d+):(\d+)(?:\s*-\s*(\d+))?$/);
  if (!m) return null;
  const bookIndex = BOOKS.findIndex((name) => name.toLowerCase() === m[1].toLowerCase());
  const chapter = Number(m[2]);
  const first = Number(m[3]);
  const last = m[4] ? Number(m[4]) : first;
  if (bookIndex < 0 || chapter < 1 || chapter > CHAPTER_COUNTS[bookIndex] || first < 1 || last < first) return null;
  return { bookIndex, book: BOOKS[bookIndex], chapter, first, last };
}

/** What the reference field shows for a span. */
export function spanReference(span: LiveSpan): string {
  return `${span.book} ${span.chapter}:${span.first}${span.last > span.first ? `-${span.last}` : ''}`;
}

/* Chapters before each book, so a chapter has one number across the Bible. */
const BEFORE = CHAPTER_COUNTS.reduce<number[]>((acc, _n, i) => [...acc, i === 0 ? 0 : acc[i - 1] + CHAPTER_COUNTS[i - 1]], []);

/** A chapter's place in the whole Bible: Genesis 1 is 0, Revelation 22 is 1188. */
export function chapterOrdinal(bookIndex: number, chapter: number): number {
  return BEFORE[bookIndex] + chapter - 1;
}

function chapterAt(ordinal: number): { bookIndex: number; chapter: number } {
  let bookIndex = BEFORE.length - 1;
  while (bookIndex > 0 && BEFORE[bookIndex] > ordinal) bookIndex--;
  return { bookIndex, chapter: ordinal - BEFORE[bookIndex] + 1 };
}

/** One row of the reel: a reference and how long its verse is. */
export interface ReelRow {
  ref: string;
  /** Characters in the verse, which sets the placeholder bar's length. */
  length: number;
  live?: boolean;
}

/**
 * The chapters passed between two places, in Bible order.
 *
 * Spread evenly between the chapter the list leaves and the one it lands
 * on, so a jump from Genesis to John flicks past Exodus, the Psalms and
 * Isaiah. Chapters only, no verse numbers: a chapter count is known for
 * every book and a verse count is not, and a reel that flashed
 * "2 Thessalonians 1:21" would be showing a verse that does not exist.
 * Neighbouring chapters pass nothing between them.
 */
export function passingRows(
  from: { bookIndex: number; chapter: number },
  to: { bookIndex: number; chapter: number },
  count: number,
): ReelRow[] {
  const [low, high] = [chapterOrdinal(from.bookIndex, from.chapter), chapterOrdinal(to.bookIndex, to.chapter)].sort((a, b) => a - b);
  /* Never more rows than there are chapters between, so none is passed twice. */
  const rows = Math.min(count, Math.max(0, high - low - 1));
  return Array.from({ length: rows }, (_, k) => {
    const { bookIndex, chapter } = chapterAt(Math.round(low + ((high - low) * (k + 1)) / (rows + 1)));
    /* Deterministic, so a re-render mid-flight does not reshuffle the bars. */
    const length = 50 + ((k * 37 + chapter * 11) % 110);
    return { ref: `${BOOKS[bookIndex]} ${chapter}`, length };
  });
}

/** How many rows to pass, and how long to take: further is more of both, within reason. */
export function travelShape(fromOrdinal: number, toOrdinal: number): { passing: number; ms: number } {
  const distance = Math.abs(toOrdinal - fromOrdinal);
  const steps = Math.log2(1 + distance);
  return {
    passing: Math.min(30, 6 + Math.round(steps * 3)),
    ms: Math.round(Math.min(900, 440 + steps * 46)),
  };
}
