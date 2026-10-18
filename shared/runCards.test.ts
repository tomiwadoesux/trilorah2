import { describe, expect, it } from 'vitest';
import { applyRunDrop, moveRunSegments, RUN_COMPONENTS, runItemTarget, runSectionTarget, runSelectionRange, sectionDropPosition, type RunCarry } from './runCards';
import type { RunSegment } from './operatorRun';

let id = 0;
const key = () => `new-${++id}`;
const fixture = (): RunSegment[] => [
  { key: 'a', type: 'music', label: 'Music', items: [{ key: '1', source: 'song', label: 'First', lines: ['verse'] }, { key: '2', source: 'song', label: 'Second' }, { key: '3', source: 'song', label: 'Third' }] },
  { key: 'b', type: 'video', label: 'Video', items: [{ key: '4', source: 'media', label: 'Clip', path: 'file:///clip.mp4', mediaKind: 'video' }] },
  { key: 'c', type: 'notes', label: 'Notes', items: [] },
];
const move = (itemKey = '1'): RunCarry => ({ source: 'song', label: 'stale label', dragItem: { segmentKey: 'a', itemKey } });

describe('run of show card drops', () => {
  it('offers exactly the seven requested components', () => {
    expect(RUN_COMPONENTS.map(c => c.label)).toEqual(['Sermon', 'Music', 'Slides', 'Notes', 'Image', 'Video', 'Verse']);
  });
  it('moves an item between any sections without changing identity or losing content', () => {
    const old = fixture();
    const next = applyRunDrop(old, 'b', [move()], key);
    expect(next[0].items.map(i => i.key)).toEqual(['2', '3']);
    expect(next[1].items.map(i => i.key)).toEqual(['4', '1']);
    expect(next[1].items[1]).toEqual(old[0].items[0]);
    expect(old[0].items).toHaveLength(3);
  });
  it('reorders items in either direction, and can place them last', () => {
    let next = applyRunDrop(fixture(), runItemTarget('a', '1'), [move('3')], key);
    expect(next[0].items.map(i => i.key)).toEqual(['3', '1', '2']);
    next = applyRunDrop(next, 'a', [move('3')], key);
    expect(next[0].items.map(i => i.key)).toEqual(['1', '2', '3']);
    next = applyRunDrop(next, runItemTarget('a', '3'), [move('1')], key);
    expect(next[0].items.map(i => i.key)).toEqual(['2', '1', '3']);
  });
  it('drops a stack at the requested position and supports duplicate library items', () => {
    const song: RunCarry = { source: 'song', label: 'Amazing Grace' };
    const next = applyRunDrop(fixture(), runItemTarget('b', '4'), [song, song], key);
    expect(next[1].items.map(i => i.label)).toEqual(['Amazing Grace', 'Amazing Grace', 'Clip']);
    expect(new Set(next[1].items.map(i => i.key)).size).toBe(3);
  });
  it('reorders entire sections and preserves all their contents', () => {
    const original = fixture();
    const carry: RunCarry = { source: 'note', label: 'Music', dragSegmentKey: 'a' };
    const next = applyRunDrop(original, 'c', [carry], key);
    expect(next.map(s => s.key)).toEqual(['b', 'a', 'c']);
    expect(next[1]).toBe(original[0]);
    expect(applyRunDrop(next, null, [carry], key).map(s => s.key)).toEqual(['b', 'c', 'a']);
  });
  it('moves selected sections together in their existing order, preserving all contents', () => {
    const old = fixture();
    const carry: RunCarry = { source: 'note', label: '2 sections', dragSegmentKey: 'b', dragSegmentKeys: ['b', 'a'] };
    const next = applyRunDrop(old, runSectionTarget('c', 'after'), [carry], key);
    expect(next).toEqual([old[2], old[0], old[1]]);
    expect(next[1]).toBe(old[0]);
    expect(next[2]).toBe(old[1]);
    expect(applyRunDrop(old, 'b', [carry], key)).toBe(old);
    expect(applyRunDrop(old, null, [carry], key)).toEqual([old[2], old[0], old[1]]);
    expect(applyRunDrop(old, 'gone', [carry], key)).toBe(old);
  });
  it('ignores stale group members and inserts a group before its target', () => {
    const old = fixture();
    expect(applyRunDrop(old, runSectionTarget('a', 'before'), [{ source: 'note', label: 'group', dragSegmentKey: 'c', dragSegmentKeys: ['gone', 'c', 'b'] }], key)).toEqual([old[1], old[2], old[0]]);
  });
  it('creates a section from a component drag at any position', () => {
    const next = applyRunDrop(fixture(), 'b', [{ source: 'note', label: 'Image', dragType: 'image' }], key);
    expect(next.map(s => s.type)).toEqual(['music', 'image', 'video', 'notes']);
    expect(next[1].items).toEqual([]);
  });
  it('swaps only the two selected sections, keeping their items and intermediate sections intact', () => {
    const old = fixture();
    const next = applyRunDrop(old, runSectionTarget('c', 'swap'), [{ source: 'note', label: 'Music', dragSegmentKey: 'a' }], key);
    expect(next).toEqual([old[2], old[1], old[0]]);
    expect(next[2]).toBe(old[0]);
    expect(old.map(s => s.key)).toEqual(['a', 'b', 'c']);
  });
  it('inserts before or after in both directions without swapping', () => {
    const carry = (id: string): RunCarry => ({ source: 'note', label: '', dragSegmentKey: id });
    expect(applyRunDrop(fixture(), runSectionTarget('b', 'after'), [carry('a')], key).map(s => s.key)).toEqual(['b', 'a', 'c']);
    expect(applyRunDrop(fixture(), runSectionTarget('a', 'after'), [carry('c')], key).map(s => s.key)).toEqual(['a', 'c', 'b']);
    expect(applyRunDrop(fixture(), runSectionTarget('a', 'before'), [carry('c')], key).map(s => s.key)).toEqual(['c', 'a', 'b']);
    expect(applyRunDrop(fixture(), runSectionTarget('c', 'after'), [carry('a')], key).map(s => s.key)).toEqual(['b', 'c', 'a']);
  });
  it('creates new sections after a target and ignores a self swap', () => {
    expect(applyRunDrop(fixture(), runSectionTarget('b', 'after'), [{ source: 'note', label: 'Image', dragType: 'image' }], key).map(s => s.type)).toEqual(['music', 'video', 'image', 'notes']);
    const old = fixture();
    expect(applyRunDrop(old, runSectionTarget('a', 'swap'), [{ source: 'note', label: '', dragSegmentKey: 'a' }], key)).toBe(old);
  });
  it('uses the center for swaps and either edge for insertion, including the gaps', () => {
    expect([-0.1, 0.24, 0.25, 0.5, 0.75, 0.76, 1.1].map(x => sectionDropPosition(x, true))).toEqual(['before', 'before', 'swap', 'swap', 'swap', 'after', 'after']);
    expect([0.4, 0.6].map(x => sectionDropPosition(x, false))).toEqual(['before', 'after']);
  });
  it('groups backdrop drops by content kind, including multiple images and videos', () => {
    const next = applyRunDrop([], null, [
      { source: 'media', mediaKind: 'video', label: 'v1' }, { source: 'media', mediaKind: 'photo', label: 'i1' },
      { source: 'media', mediaKind: 'video', label: 'v2' }, { source: 'media', mediaKind: 'photo', label: 'i2' },
      { source: 'scripture', label: 'John 3:16' },
    ], key);
    expect(next.map(s => [s.type, s.items.length])).toEqual([['video', 2], ['image', 2], ['verse', 1]]);
  });
  it('ignores removed sources, removed destinations and self drops', () => {
    const old = fixture();
    expect(applyRunDrop(old, 'gone', [move()], key)).toBe(old);
    expect(applyRunDrop(old, 'b', [move('gone')], key)).toBe(old);
    expect(applyRunDrop(old, runItemTarget('a', '1'), [move()], key)).toBe(old);
    expect(applyRunDrop(old, 'b', [{ source: 'note', label: '', dragSegmentKey: 'gone' }], key)).toBe(old);
  });
});

describe('run selection controls', () => {
  const sections = (): RunSegment[] => ['a', 'b', 'c', 'd', 'e'].map(key => ({ key, type: 'notes', label: key, items: [] }));
  it('moves each selected block one place, keeping relative order', () => {
    const old = sections();
    expect(moveRunSegments(old, ['b', 'c'], -1).map(section => section.key)).toEqual(['b', 'c', 'a', 'd', 'e']);
    expect(moveRunSegments(old, ['b', 'c'], 1).map(section => section.key)).toEqual(['a', 'd', 'b', 'c', 'e']);
    expect(moveRunSegments(old, ['b', 'd'], -1).map(section => section.key)).toEqual(['b', 'a', 'd', 'c', 'e']);
    expect(moveRunSegments(old, ['b', 'd'], 1).map(section => section.key)).toEqual(['a', 'c', 'b', 'e', 'd']);
    expect(old.map(section => section.key)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('keeps boundary selections in place and ignores removed keys', () => {
    const old = sections();
    expect(moveRunSegments(old, ['a', 'b'], -1)).toBe(old);
    expect(moveRunSegments(old, ['d', 'e'], 1)).toBe(old);
    expect(moveRunSegments(old, ['gone'], 1)).toBe(old);
    expect(moveRunSegments(old, old.map(section => section.key), -1)).toBe(old);
  });
  it('selects inclusive ranges in either direction and tolerates deleted anchors', () => {
    const keys = sections().map(section => section.key);
    expect(runSelectionRange(keys, 'b', 'd')).toEqual(['b', 'c', 'd']);
    expect(runSelectionRange(keys, 'd', 'b')).toEqual(['b', 'c', 'd']);
    expect(runSelectionRange(keys, 'gone', 'd')).toEqual(['d']);
    expect(runSelectionRange(keys, null, 'd')).toEqual(['d']);
    expect(runSelectionRange(keys, 'd', 'gone')).toEqual([]);
  });
});
