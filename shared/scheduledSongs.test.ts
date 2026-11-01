import { describe, expect, it } from 'vitest';
import type { QueueItem } from './operatorRun';
import { scheduledSongs } from './scheduledSongs';

const songs = [{ id: 'a', title: 'Morning Praise' }, { id: 'b', title: 'A Quiet Prayer' }];
const cue = (key: string, songId: string, title: string): QueueItem => ({ key, songId, title, source: 'song', label: `${title} — Chorus` });

describe('scheduled song library', () => {
  it('follows the service order and lists repeated lyric cues only once', () => {
    const result = scheduledSongs(songs, [
      { label: 'Opening', items: [cue('1', 'b', 'A Quiet Prayer'), cue('2', 'b', 'A Quiet Prayer')] },
      { label: 'Closing', items: [cue('3', 'a', 'Morning Praise'), cue('4', 'b', 'A Quiet Prayer')] },
    ]);
    expect(result.map(entry => [entry.key, entry.section])).toEqual([['b', 'Opening'], ['a', 'Closing']]);
  });
  it('resolves renamed songs by id and older title-only cues by exact title', () => {
    const result = scheduledSongs(songs, [{ label: 'Worship', items: [
      cue('1', 'a', 'Old title'),
      { key: '2', source: 'song', label: 'a quiet prayer — Verse 1' },
    ] }]);
    expect(result.map(entry => entry.song)).toEqual(songs);
  });
  it('keeps missing songs visible without treating another song as a match', () => {
    const result = scheduledSongs(songs, [{ label: 'Worship', items: [cue('1', 'missing', 'Morning')] }]);
    expect(result).toEqual([{ key: 'missing:missing', title: 'Morning', section: 'Worship', song: undefined }]);
  });
  it('ignores other content, even in music sections, and handles an empty run', () => {
    expect(scheduledSongs(songs, [{ label: 'Music', items: [{ key: '1', source: 'note', label: 'Morning Praise' }] }])).toEqual([]);
    expect(scheduledSongs(songs, [])).toEqual([]);
  });
});
