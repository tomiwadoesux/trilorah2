import { describe, it, expect } from 'vitest';
import { christianMusicResults } from './songDiscovery';
describe('online Christian discovery', () => {
  it('accepts Christian songs beyond the starter catalogue and removes unrelated genres', () => {
    const records = [
      { trackId: 1, trackName: 'New Worship Song', artistName: 'New Artist', primaryGenreName: 'Christian & Gospel' },
      { trackId: 2, trackName: 'New Worship Song', artistName: 'New Artist', primaryGenreName: 'Christian & Gospel' },
      { trackId: 3, trackName: 'Other Music', artistName: 'Another Artist', primaryGenreName: 'Pop' },
    ];
    expect(christianMusicResults(records).map(song => song.title)).toEqual(['New Worship Song']);
  });
  it('does not trust arbitrary remote image and link hosts', () => {
    const [song] = christianMusicResults([{ trackId: 1, trackName: 'Song', artistName: 'Artist', primaryGenreName: 'Gospel', artworkUrl100: 'https://untrusted.example/a.jpg', trackViewUrl: 'javascript:alert(1)' }]);
    expect(song.artwork).toBe('');
    expect(song.storeUrl).toBe('');
  });
});
