import { describe, expect, it } from 'vitest';
import { catchEntries, catchKind, groupFor, nextInSet, queuedIds, SET_GAP_MS, spotlightIndex, spotlightItem, type CatchItem } from './catchSets';

const item = (id: string, kind: CatchItem['kind'], group: string, arrivedAt: number): CatchItem =>
  ({ id, reference: id, kind, group, arrivedAt });

describe('catchKind', () => {
  it('names how a verse was caught', () => {
    expect(catchKind(undefined)).toBe('said');
    expect(catchKind({ source: 'quote' })).toBe('read');
    expect(catchKind({ source: 'named' })).toBe('named');
    expect(catchKind({ source: 'passage' })).toBe('story');
  });
});

describe('groupFor', () => {
  it('joins references named one straight after another', () => {
    const tail = { group: 'g1', at: 1000 };
    expect(groupFor('said', 1000 + SET_GAP_MS, tail, true, 'g2')).toBe('g1');
  });
  it('starts a new set after a pause, for a guess, or when the last set is done', () => {
    const tail = { group: 'g1', at: 1000 };
    expect(groupFor('said', 1001 + SET_GAP_MS, tail, true, 'g2')).toBe('g2');
    expect(groupFor('story', 1500, tail, true, 'g2')).toBe('g2');
    expect(groupFor('said', 1500, tail, false, 'g2')).toBe('g2');
    expect(groupFor('said', 1500, null, false, 'g2')).toBe('g2');
  });
});

describe('catchEntries', () => {
  /* Newest first, as the engine keeps them. */
  const three = [item('Romans 5:8', 'said', 'g1', 3), item('John 3:16', 'said', 'g1', 2), item('Genesis 3:5', 'said', 'g1', 1)];

  it('puts a set in the order it was said, the first one up', () => {
    const [entry] = catchEntries(three);
    expect(entry.waiting.map((w) => w.id)).toEqual(['Genesis 3:5', 'John 3:16', 'Romans 5:8']);
    expect(entry.current.id).toBe('Genesis 3:5');
    expect(queuedIds([entry])).toEqual(['John 3:16', 'Romans 5:8']);
  });

  it('keeps the verses already sent in their place in the strip', () => {
    const [entry] = catchEntries(three.slice(0, 2), { g1: [{ reference: 'Genesis 3:5', arrivedAt: 1 }] });
    expect(entry.steps.map((s) => (s.state === 'sent' ? `sent ${s.reference}` : s.item.id)))
      .toEqual(['sent Genesis 3:5', 'John 3:16', 'Romans 5:8']);
    expect(entry.current.id).toBe('John 3:16');
  });

  it('lets the operator pick which verse of a set is up', () => {
    const [entry] = catchEntries(three, {}, { g1: 'Romans 5:8' });
    expect(entry.current.id).toBe('Romans 5:8');
    expect(nextInSet(entry, 'Romans 5:8')?.id).toBe('Genesis 3:5');
    expect(nextInSet(entry, 'Genesis 3:5')?.id).toBe('John 3:16');
  });

  it('never lets a guess take the spotlight from a verse that was said', () => {
    const items = [item('Genesis 22:1-14', 'story', 'g2', 10), item('John 3:16', 'said', 'g1', 5)];
    const entries = catchEntries(items);
    expect(entries[0].group).toBe('g2');
    expect(spotlightIndex(entries)).toBe(1);
    expect(spotlightItem(items)?.id).toBe('John 3:16');
    expect(spotlightItem([item('Luke 15:11-32', 'named', 'g3', 1)])?.id).toBe('Luke 15:11-32');
    expect(spotlightItem([])).toBeNull();
  });
});
