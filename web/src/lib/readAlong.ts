import type { WordTiming } from './wordTimings';

export interface ReadingChunk {
  id: string;
  text: string;
  timestamp: string;
  words: WordTiming[] | null;
  offset_ms: number | null;
}
export interface ReadingWord extends WordTiming { id: string; chunkId: string }
export interface ReadingPassage {
  id: string;
  text: string;
  words: ReadingWord[];
  chunkIds: string[];
  from: number;
  to: number;
}

/** Recognition chunks are transport boundaries. Group sentences for reading. */
export function readingPassages(chunks: ReadingChunk[], serviceStart: number): ReadingPassage[] {
  const at = (c: ReadingChunk) => c.offset_ms != null ? c.offset_ms / 1000 : (Date.parse(c.timestamp) - serviceStart) / 1000;
  const ordered = [...chunks].sort((a, b) => at(a) - at(b));
  const passages: ReadingPassage[] = [];
  let words: ReadingWord[] = [];
  const flush = () => {
    if (!words.length) return;
    passages.push({ id: words[0].id, text: words.map(w => w.w).join(' '), words,
      chunkIds: [...new Set(words.map(w => w.chunkId))], from: words[0].s, to: words.at(-1)!.e });
    words = [];
  };
  for (const chunk of ordered) {
    const timed = chunk.offset_ms != null && Array.isArray(chunk.words) && chunk.words.length > 0 &&
      chunk.words.every(w => Number.isFinite(w.s) && Number.isFinite(w.e) && w.e >= w.s);
    if (!timed) {
      flush();
      passages.push({ id: chunk.id, text: chunk.text, words: [], chunkIds: [chunk.id], from: at(chunk), to: at(chunk) });
      continue;
    }
    const base = at(chunk) - chunk.words![0].s;
    for (const [i, word] of chunk.words!.entries()) {
      const placed = { ...word, s: base + word.s, e: base + word.e, id: `${chunk.id}:${i}`, chunkId: chunk.id };
      if (words.length && placed.s - words.at(-1)!.e > 4) flush();
      words.push(placed);
      if ((words.length >= 18 && /[.!?][”"']?$/.test(word.w)) || words.length >= 48) flush();
    }
  }
  flush();
  return passages;
}

/** One current word globally, including the short silence between words. */
export function currentReadingWord(words: readonly ReadingWord[], seconds: number): string | null {
  let low = 0;
  let high = words.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (words[mid].s <= seconds) { found = mid; low = mid + 1; } else high = mid - 1;
  }
  // A quiet or disconnected publisher must not leave its last word glowing.
  if (found < 0 || seconds > words[found].e + 1.5) return null;
  return words[found].id;
}

/** Buffer already-received speech; never invent future words or word timings. */
export function delayedReadingPosition(seconds: number, holdMs: number, nudgeMs = 0) {
  return Math.max(0, seconds - Math.max(0, holdMs + nudgeMs) / 1000);
}

export function readingWordPhase(word: ReadingWord, currentId: string | null, seconds: number) {
  return word.id === currentId ? 'current' : word.s > seconds ? 'upcoming' : 'past';
}
