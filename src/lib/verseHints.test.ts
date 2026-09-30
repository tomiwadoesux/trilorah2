import { describe, it, expect } from 'vitest';
import { createVerseHintSession, visitVerseHint } from './verseHints';

describe('verse navigation introductions', () => {
  it('shows twice, only after 72 seconds without another verse', () => {
    const s = createVerseHintSession();
    expect(visitVerseHint(s, 'John 1:1', 0)?.pass).toBe(1);
    expect(visitVerseHint(s, 'John 1:2', 60_000)).toBeNull();
    expect(visitVerseHint(s, 'John 1:3', 120_000)).toBeNull();
    expect(visitVerseHint(s, 'John 1:4', 192_000)?.pass).toBe(2);
    expect(visitVerseHint(s, 'John 1:5', 300_000)).toBeNull();
  });
  it('resumes on remount without consuming a second introduction', () => {
    const s = createVerseHintSession();
    visitVerseHint(s, 'John 1:1', 0);
    expect(visitVerseHint(s, 'John 1:1', 500)).toEqual({ pass: 1, remaining: 3500 });
    expect(s.count).toBe(1);
    expect(visitVerseHint(s, 'John 1:1', 4000)).toBeNull();
  });
});
