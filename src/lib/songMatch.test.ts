import { describe, expect, it } from 'vitest';
import { HEARD_BAR, lyricScore, matchSongs, readsAsVerse, recentSongWords, retainSongMatches, sharedWords, type MatchableSong } from './songMatch';
describe('live lyric matching', () => {
  it('matches a distinctive line with transcription errors', () => {
    expect(lyricScore('rock of ages cleft for me let me hide myself', 'Rock of ages cleft for me let me hide myself in thee')).toBeGreaterThan(.8);
    expect(lyricScore('rok of ages cleft for me let me hide myself', 'Rock of ages cleft for me let me hide myself in thee')).toBeGreaterThan(.6);
  });
  it('rejects generic words and unrelated speech', () => {
    expect(lyricScore('you and i we are in the room', 'you and i we sing to the lord')).toBe(0);
    expect(lyricScore('please put the announcements up before the meeting', 'Rock of ages cleft for me let me hide myself in thee')).toBe(0);
  });
  it('rejects an insufficient fragment', () => {
    expect(lyricScore('amazing grace', 'Amazing grace how sweet the sound')).toBe(0);
  });
  it('scores the line just sung, not the talk before it', () => {
    expect(lyricScore('and now let us all stand and sing together rock of ages cleft for me let me', 'Rock of ages cleft for me let me hide myself in thee')).toBeGreaterThan(.8);
  });
  it('finds the words just sung even when a spoken request follows them', () => {
    expect(lyricScore('amazing grace how sweet the sound can you find that song please', 'Amazing grace how sweet the sound')).toBe(1);
  });
  it('handles common speech-to-text homophones', () => {
    expect(lyricScore('your rain will last forever', 'Your reign will last forever')).toBe(1);
  });
  it('looks back across short finalized lines and the current partial for exactly fourteen words', () => {
    const heard = recentSongWords({ lines: [
      { text: 'before we begin now' }, { text: 'amazing grace' }, { text: 'how sweet the sound' },
      { text: 'that saved' }, { text: 'a wretch' },
    ], partial: 'like me' });
    expect(heard).toBe('begin now amazing grace how sweet the sound that saved a wretch like me');
  });
});

const songs: MatchableSong[] = [
  { id: 'grace', title: 'Amazing Grace', sections: [{ label: 'Verse 1', lines: ['Amazing grace how sweet the sound'] }] },
  { id: 'rock', title: 'Rock of Ages', sections: [{ label: 'Verse 1', lines: ['Rock of ages cleft for me'] }] },
];

describe('song suggestion retention', () => {
  it('matches recent speech immediately without needing a fresh transcript event', () => {
    const heard = recentSongWords({ lines: [{ text: 'amazing grace how sweet the sound' }], partial: '' });
    expect(matchSongs(heard, songs).map(match => match.song.id)).toEqual(['grace']);
  });
  it('keeps suggestions when a partial correction, silence or unrelated speech gives no match', () => {
    const found = matchSongs('amazing grace how sweet the sound', songs);
    expect(retainSongMatches(found, matchSongs('please continue with the announcements', songs))).toEqual(found);
    expect(retainSongMatches(found, [])).toEqual(found);
  });
  it('keeps older suggestions beside a new song and deduplicates repeated matches', () => {
    const grace = matchSongs('amazing grace how sweet the sound', songs);
    const rock = matchSongs('rock of ages cleft for me', songs);
    const retained = retainSongMatches(grace, rock);
    expect(retained.map(match => match.song.id)).toEqual(['rock', 'grace']);
    expect(retainSongMatches(retained, grace).map(match => match.song.id)).toEqual(['rock', 'grace']);
  });
});

describe('a song offered without being asked for', () => {
  /* Invented lines, not real lyrics. */
  const line = 'lanterns in the valley carry morning over every quiet hill';
  it('needs seven words of the line, where a search needs four', () => {
    expect(lyricScore('lanterns in the valley carry', line)).toBeGreaterThan(0);
    expect(lyricScore('lanterns in the valley carry', line, HEARD_BAR)).toBe(0);
    expect(lyricScore('lanterns in the valley carry morning over every', line, HEARD_BAR)).toBeGreaterThan(0.8);
  });
  it('finds the line at the end of talk, as the asked search does', () => {
    expect(lyricScore('so let us sing it together lanterns in the valley carry morning over every quiet', line, HEARD_BAR)).toBeGreaterThan(0.8);
  });
  it('turns away a sermon sentence that shares a few of its words', () => {
    expect(lyricScore('every morning in the valley we carry on and the lord is good', line, HEARD_BAR)).toBe(0);
  });
  it('offers only songs that clear the bar', () => {
    const library: MatchableSong[] = [{ id: 'lanterns', title: 'Lanterns', sections: [{ label: 'Verse 1', lines: [line] }] }];
    expect(matchSongs('lanterns in the valley carry', library, HEARD_BAR)).toEqual([]);
    expect(matchSongs('lanterns in the valley carry morning over every quiet hill', library, HEARD_BAR).map(m => m.song.id)).toEqual(['lanterns']);
  });
});

describe('scripture read out is not a song', () => {
  const john316 = 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.';
  /* Invented, not a real hymn: a line that borrows the verse's words. */
  const borrowed: MatchableSong = { id: 'borrowed', title: 'Borrowed Line', sections: [{ label: 'Verse 1', lines: ['so loved he the world that he gave us his son'] }] };
  const reading = 'turn with me for god so loved the world that he gave his only begotten son';

  it('knows the words of a verse being read', () => {
    expect(readsAsVerse(reading, [john316])).toBe(true);
    expect(readsAsVerse('lanterns in the valley carry morning over every quiet hill', [john316])).toBe(false);
  });
  it('looks the Bible up by the uncommon words the reading shares with the song', () => {
    const shared = sharedWords(reading, borrowed.sections[0].lines.join(' '));
    expect(shared).toEqual(expect.arrayContaining(['loved', 'world', 'gave', 'son']));
    expect(shared).not.toContain('the');
  });
  it('still finds the song when the operator asks for it', () => {
    expect(matchSongs(reading, [borrowed]).map(m => m.song.id)).toEqual(['borrowed']);
  });
});
