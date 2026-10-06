import { describe, expect, it } from 'vitest';
import { activeDrafts, SONG_RECOVERY_MS, type SongDraft } from './songDraft';
const draft: SongDraft = { title: 'Song', author: '', cards: [], caret: 0, focusKey: null, scrollTop: 0, updatedAt: 1000 };
describe('temporary song recovery', () => {
  it('keeps work until the deadline and discards at thirty minutes', () => {
    const map = { song: draft };
    expect(activeDrafts(map, 1000 + SONG_RECOVERY_MS - 1)).toBe(map);
    expect(activeDrafts(map, 1000 + SONG_RECOVERY_MS)).toEqual({});
  });
  it('a fresh close starts a new recovery window without extending other work', () => {
    const now = 1000 + SONG_RECOVERY_MS;
    expect(activeDrafts({ old: draft, resumed: { ...draft, updatedAt: now } }, now)).toEqual({ resumed: { ...draft, updatedAt: now } });
  });
});

describe('empty new songs', () => {
  const blank: SongDraft = { ...draft, title: '  ', author: '\n', cards: [{ key: 'one', label: 'Verse 1', text: ' \n ' }] };
  it('removes placeholder-only recovery entries while keeping real work', () => {
    expect(activeDrafts({ 'new:blank': blank, 'new:words': { ...blank, sourceLyrics: 'A song begins' }, 'new:title': draft }, 1001))
      .toEqual({ 'new:words': { ...blank, sourceLyrics: 'A song begins' }, 'new:title': draft });
  });
  it('uses current lyrics rather than stale slide cards when lyrics are cleared', () => {
    expect(activeDrafts({ 'new:cleared': { ...blank, sourceLyrics: '', cards: [{ key: 'one', label: 'Verse 1', text: 'old words' }] } }, 1001)).toEqual({});
  });
  it('preserves an intentional removal of words from an existing song', () => {
    expect(activeDrafts({ existing: blank }, 1001)).toEqual({ existing: blank });
  });
});
