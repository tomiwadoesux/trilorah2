import { describe, expect, it } from 'vitest';
import { CHRISTIAN_SONGS, baseSongTitle, filterChristianSongs, matchesChristianSong, primaryArtist, shuffleChristianSongs, songSearchTerms } from './christianSongs';

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

  // Titles and artists below are invented.
  describe('online results whose catalogues disagree', () => {
    const song = { title: 'Ọ̀rọ̀ Ìyanu Tuntun', artist: 'Invented Choir' };
    it('ignores accents in titles and artists', () => {
      expect(matchesChristianSong({ title: 'Oro Iyanu Tuntun', artist: 'Invented Choir' }, song)).toBe(true);
      expect(matchesChristianSong({ title: 'Oro Iyanu Tuntun', artist: 'Ínvénted Chóir' }, song)).toBe(true);
    });
    it('ignores a guest credit on either side', () => {
      const guest = { title: 'Made Up Anthem (feat. Pretend Singer)', artist: 'Invented Band' };
      expect(matchesChristianSong({ title: 'Made Up Anthem', artist: 'Invented Band' }, guest)).toBe(true);
      expect(matchesChristianSong({ title: 'Made Up Anthem (with Pretend Singer)', artist: 'Invented Band' }, { title: 'Made Up Anthem', artist: 'Invented Band' })).toBe(true);
      expect(matchesChristianSong({ title: 'Made Up Anthem ft. Pretend Singer', artist: 'Invented Band' }, { title: 'Made Up Anthem', artist: 'Invented Band' })).toBe(true);
    });
    it('keeps a subtitle that may be the only difference between two songs', () => {
      expect(matchesChristianSong({ title: 'Made Up Anthem', artist: 'Invented Band' }, { title: 'Made Up Anthem (Second Story)', artist: 'Invented Band' })).toBe(false);
    });
    it('accepts a duet listed under either of its names', () => {
      const duet = { title: 'Pretend Psalm', artist: 'Invented Band & Pretend Singer' };
      expect(matchesChristianSong({ title: 'Pretend Psalm', artist: 'Invented Band' }, duet)).toBe(true);
      expect(matchesChristianSong({ title: 'Pretend Psalm', artist: 'Pretend Singer' }, duet)).toBe(true);
      expect(matchesChristianSong({ title: 'Pretend Psalm', artist: 'Invented Band, Third Person' }, duet)).toBe(true);
    });
    it('still rejects the same title by an unrelated artist', () => {
      const duet = { title: 'Pretend Psalm', artist: 'Invented Band & Pretend Singer' };
      expect(matchesChristianSong({ title: 'Pretend Psalm', artist: 'Someone Else' }, duet)).toBe(false);
      // One shared word is not the same artist.
      expect(matchesChristianSong({ title: 'Pretend Psalm', artist: 'Band' }, duet)).toBe(false);
      expect(matchesChristianSong({ title: 'Pretend Psalm', artist: 'Worship' }, { title: 'Pretend Psalm', artist: 'Invented Worship' })).toBe(false);
    });
  });

  it('asks the catalogue for the base title and the first-named artist', () => {
    expect(baseSongTitle('Made Up Anthem (Live) [feat. Pretend Singer]')).toBe('Made Up Anthem');
    expect(baseSongTitle('Made Up Anthem - Live at Nowhere')).toBe('Made Up Anthem');
    expect(primaryArtist('Invented Band x Pretend Singer')).toBe('Invented Band');
    expect(primaryArtist('Invented Band feat. Pretend Singer')).toBe('Invented Band');
    expect(songSearchTerms({ title: 'Made Up Anthem (feat. Pretend Singer)', artist: 'Invented Band & Pretend Singer' })).toBe('Made Up Anthem Invented Band');
  });
});
