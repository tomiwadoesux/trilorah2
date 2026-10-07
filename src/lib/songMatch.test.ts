import { describe, expect, it } from 'vitest';
import { lyricScore } from './songMatch';
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
});
