import { describe, expect, it } from 'vitest';
import { currentReadingWord, delayedReadingPosition, readingPassages, readingWordPhase, type ReadingChunk } from './readAlong';
import { DEFAULT_HOLD_MS } from './syncPrefs';

const chunk = (id: string, offset: number, text: string, audioStart = 50): ReadingChunk => ({
  id, text, offset_ms: offset, timestamp: '2026-10-15T00:00:00Z',
  words: text.split(' ').map((w, i) => ({ w, s: audioStart + i * .3, e: audioStart + i * .3 + .25 })),
});
describe('read along', () => {
  it('orders by the service clock and joins recognition fragments into prose', () => {
    const result = readingPassages([chunk('b', 1100, 'is here.'), chunk('a', 500, 'The message')], 0);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('The message is here.');
    result[0].words.forEach((word, index) => expect(word.s).toBeCloseTo(.5 + index * .3));
    expect(result[0].chunkIds).toEqual(['a', 'b']);
  });
  it('has exactly one current word while retaining every upcoming word', () => {
    const words = readingPassages([chunk('a', 1000, 'Follow these words.')], 0)[0].words;
    expect(currentReadingWord(words, 1.35)).toBe('a:1');
    expect(words.filter(w => w.s > 1.35).map(w => w.w)).toEqual(['words.']);
    expect(currentReadingWord(words, .5)).toBeNull();
    expect(currentReadingWord(words, 20)).toBeNull();
  });
  it('retains the last word through short gaps and seeks backwards', () => {
    const words = readingPassages([chunk('a', 1000, 'Grace and peace.')], 0)[0].words;
    expect(currentReadingWord(words, 1.28)).toBe('a:0');
    expect(currentReadingWord(words, 1.7)).toBe('a:2');
    expect(currentReadingWord(words, 1.02)).toBe('a:0');
  });
  it('preserves untimed text without manufacturing word timings', () => {
    const result = readingPassages([{ ...chunk('a', 1000, 'An untimed message.'), words: null }], 0);
    expect(result[0].words).toEqual([]);
    expect(result[0].text).toBe('An untimed message.');
  });
  it('breaks long pauses into distinct passages', () => {
    expect(readingPassages([chunk('a', 1000, 'Amen.'), chunk('b', 8000, 'Let us pray.')], 0)).toHaveLength(2);
  });
  it('holds the live cursor five seconds behind speech with known words ahead', () => {
    const words = readingPassages([chunk('a', 1000, 'Let these words stay visible ahead of the current word.')], 0)[0].words;
    const position = delayedReadingPosition(6.35, DEFAULT_HOLD_MS);
    expect(position).toBeCloseTo(1.35);
    const current = currentReadingWord(words, position);
    expect(current).toBe('a:1');
    expect(words.map(w => readingWordPhase(w, current, position)).slice(0, 4)).toEqual(['past', 'current', 'upcoming', 'upcoming']);
  });
  it('buffers startup and nudges without putting the cursor ahead of speech', () => {
    expect(delayedReadingPosition(3, DEFAULT_HOLD_MS)).toBe(0);
    expect(delayedReadingPosition(30, DEFAULT_HOLD_MS, 2000)).toBe(23);
    expect(delayedReadingPosition(30, DEFAULT_HOLD_MS, -2000)).toBe(27);
    expect(delayedReadingPosition(30, DEFAULT_HOLD_MS, -30000)).toBe(30);
  });
  it('waits without a glowing word when delivered words run out', () => {
    const words = readingPassages([chunk('a', 1000, 'A finished sentence.')], 0)[0].words;
    const position = delayedReadingPosition(20, DEFAULT_HOLD_MS);
    expect(currentReadingWord(words, position)).toBeNull();
    expect(words.every(w => readingWordPhase(w, null, position) === 'past')).toBe(true);
  });
});
