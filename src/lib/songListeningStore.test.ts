import { beforeEach, describe, expect, it } from 'vitest';
import { matchSongs } from './songMatch';
import { useSongListeningStore } from '../stores/songListeningStore';

const heard = 'amazing grace how sweet the sound';
const matches = matchSongs(heard, [{ id: 'grace', title: 'Amazing Grace', sections: [{ label: 'Verse 1', lines: [heard] }] }]);

beforeEach(() => useSongListeningStore.setState({ active: false, matches: [], ignoredHeard: null }));

describe('microphone song search session', () => {
  it('retains matches through empty updates and clears them when stopped', () => {
    const store = useSongListeningStore.getState();
    store.setActive(true);
    store.remember(matches, heard);
    store.remember([], 'unrelated speech');
    expect(useSongListeningStore.getState().matches).toEqual(matches);
    store.setActive(false);
    expect(useSongListeningStore.getState().matches).toEqual([]);
  });
  it('does not immediately restore explicitly cleared results on a remount', () => {
    const store = useSongListeningStore.getState();
    store.setActive(true);
    store.remember(matches, heard);
    store.clear(heard);
    store.remember(matches, heard);
    expect(useSongListeningStore.getState().matches).toEqual([]);
    store.remember(matches, `${heard} again`);
    expect(useSongListeningStore.getState().matches).toEqual(matches);
  });
  it('starts a fresh search with no stale cards or ignored text', () => {
    const store = useSongListeningStore.getState();
    store.setActive(true);
    store.clear(heard);
    store.setActive(false);
    store.setActive(true);
    store.remember(matches, heard);
    expect(useSongListeningStore.getState().matches).toEqual(matches);
  });
});
