import { describe, expect, it } from 'vitest';
import { liveKey, spanKey } from './liveKey';
import type { LiveItem } from '../design/screens/projector';

const verse = (reference: string, version?: string, id = reference): LiveItem =>
  ({ source: 'scripture', id, label: reference, reference, version });

describe('liveKey', () => {
  it('names a range the same with a hyphen, an en dash or spaces around it', () => {
    expect(liveKey(verse('John 3:16-18', 'KJV'))).toBe(liveKey(verse('John 3:16–18', 'KJV')));
    expect(liveKey(verse('John 3:16 — 18', 'KJV'))).toBe(liveKey(verse('John 3:16-18', 'KJV')));
  });
  it('names a book the same however it was spelled', () => {
    expect(liveKey(verse('Psalm 104:12', 'KJV'))).toBe(liveKey(verse('Psalms 104:12', 'KJV')));
    expect(liveKey(verse('1 cor 13:4', 'KJV'))).toBe(liveKey(verse('1 Corinthians 13:4', 'KJV')));
  });
  it('tells a single verse from a range that starts on it', () => {
    expect(liveKey(verse('John 3:16', 'KJV'))).not.toBe(liveKey(verse('John 3:16-17', 'KJV')));
    expect(liveKey(verse('John 3:16', 'KJV'))).toBe(liveKey(verse('John 3:16-16', 'KJV')));
  });
  it('tells John from 1 John', () => {
    expect(liveKey(verse('John 1:1', 'KJV'))).not.toBe(liveKey(verse('1 John 1:1', 'KJV')));
  });
  it('tells one translation from another, but not by case', () => {
    expect(liveKey(verse('John 3:16', 'KJV'))).not.toBe(liveKey(verse('John 3:16', 'WEB')));
    expect(liveKey(verse('John 3:16', 'kjv'))).toBe(liveKey(verse('John 3:16', 'KJV')));
  });
  it('reads a reference the way main does: spaces or a dot for the colon, an abbreviation, a reversed range', () => {
    expect(liveKey(verse('John 3 16', 'KJV'))).toBe(liveKey(verse('John 3:16', 'KJV')));
    expect(liveKey(verse('john 3.16', 'KJV'))).toBe(liveKey(verse('John 3:16', 'KJV')));
    expect(liveKey(verse('Matt 5 3', 'KJV'))).toBe(liveKey(verse('Matthew 5:3', 'KJV')));
    expect(liveKey(verse('John 3 16 18', 'KJV'))).toBe(liveKey(verse('John 3:16-18', 'KJV')));
    expect(liveKey(verse('John 3:18-16', 'KJV'))).toBe(liveKey(verse('John 3:16-18', 'KJV')));
  });
  it("reads the phone's id when the item carries no reference", () => {
    const phone: LiveItem = { source: 'scripture', id: 'John 3:16–18@KJV', label: 'John 3:16–18', version: 'KJV' };
    expect(liveKey(phone)).toBe(liveKey(verse('John 3:16-18', 'KJV')));
  });
  it('keys songs, slides and pictures by what they are', () => {
    expect(liveKey({ source: 'song', id: 'song-1/verse-1', label: 'x' })).toBe('song:song-1/verse-1');
    expect(liveKey({ source: 'presentation', id: 'deck:2', label: 'x', path: '/a.png' })).toBe('presentation:deck:2');
    expect(liveKey({ source: 'media', id: 'm1', label: 'x', path: 'file:///a.jpg' })).toBe('media:file:///a.jpg');
    expect(liveKey(null)).toBeNull();
  });
});

describe('spanKey', () => {
  it('leaves the translation out, so a push is known before the engine picks one', () => {
    expect(spanKey(verse('Psalm 104:12'))).toBe(spanKey(verse('Psalms 104:12', 'NIV')));
  });
  it('falls back to the words when the reference is not one main would push', () => {
    expect(spanKey(verse('Psalms 23'))).toBe('scripture:psalms 23');
    expect(spanKey(verse('Zzz 3:16'))).toBe('scripture:zzz 3:16');
    expect(spanKey(verse('John 3:16–'))).toBe('scripture:john 3:16-');
  });
});
