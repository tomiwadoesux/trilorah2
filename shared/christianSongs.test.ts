import { describe, expect, it } from 'vitest';
import { CHRISTIAN_SONGS, filterChristianSongs, matchesChristianSong, shuffleChristianSongs } from './christianSongs';

describe('Christian song discovery', () => {
  it('provides real release artwork and a source link for every card', () => {
    for (const song of CHRISTIAN_SONGS) {
      expect(new URL(song.artwork).hostname).toMatch(/\.mzstatic\.com$/);
      expect(new URL(song.storeUrl).hostname).toBe('music.apple.com');
    }
  });
  it('shuffles only the curated collection without duplicates or mutation', () => {
    const original = CHRISTIAN_SONGS.map(song => song.id);
    const shuffled = shuffleChristianSongs(() => 0);
    expect(shuffled.map(song => song.id)).not.toEqual(original);
    expect(new Set(shuffled.map(song => song.id))).toEqual(new Set(original));
    expect(CHRISTIAN_SONGS.map(song => song.id)).toEqual(original);
  });
  it('searches titles, artists and categories without introducing outside songs', () => {
    expect(filterChristianSongs(CHRISTIAN_SONGS, 'SINACH way')).toEqual([CHRISTIAN_SONGS[1]]);
    expect(filterChristianSongs(CHRISTIAN_SONGS, 'gospel').every(song => song.category === 'gospel')).toBe(true);
    expect(filterChristianSongs(CHRISTIAN_SONGS, 'unlisted song')).toEqual([]);
  });
  it('rejects another artist or title but accepts live versions of the selected song', () => {
    const song = CHRISTIAN_SONGS[1];
    expect(matchesChristianSong({ title: 'Way Maker (Live)', artist: 'Sinach' }, song)).toBe(true);
    expect(matchesChristianSong({ title: 'Way Maker', artist: 'Someone else' }, song)).toBe(false);
    expect(matchesChristianSong({ title: 'Another song', artist: 'Sinach' }, song)).toBe(false);
  });
});
