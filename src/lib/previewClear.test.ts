import { describe, expect, it } from 'vitest';
import { previewClearPlan, previewIsLive } from './previewClear';
import type { LiveItem, ScreenState } from '../design/screens/projector';

const verse = (reference: string, version?: string, id = reference): LiveItem =>
  ({ source: 'scripture', id, label: reference, reference, version, origin: 'operator' });
const card = (id: string): LiveItem =>
  ({ source: 'song', id, label: `Morning Lantern — ${id}`, title: 'Morning Lantern', lines: ['an invented line'] });

const plan = (preview: LiveItem | null, live: LiveItem | null, screen: ScreenState = 'live', editingTheme = false) =>
  previewClearPlan({ preview, live, screen, editingTheme });

describe('previewClearPlan', () => {
  it('clears the wall too when the preview shows what is live', () => {
    expect(plan(verse('John 3:16', 'KJV'), verse('John 3:16', 'KJV'))).toEqual({ unstage: true, clearWall: true });
    expect(plan(card('song-1/verse-2'), card('song-1/verse-2'))).toEqual({ unstage: true, clearWall: true });
  });

  it('only unstages when the preview holds something else — a catch, the next verse of a set', () => {
    expect(plan(verse('John 3:17', 'KJV'), verse('John 3:16', 'KJV'))).toEqual({ unstage: true, clearWall: false });
    expect(plan(card('song-1/chorus'), card('song-1/verse-2'))).toEqual({ unstage: true, clearWall: false });
    expect(plan(verse('John 3:16', 'KJV'), card('song-1/verse-2'))).toEqual({ unstage: true, clearWall: false });
  });

  it('never lifts a black or a logo hold, and leaves a cleared wall cleared', () => {
    for (const screen of ['black', 'logo', 'clear'] as const) {
      expect(plan(verse('John 3:16', 'KJV'), verse('John 3:16', 'KJV'), screen)).toEqual({ unstage: true, clearWall: false });
    }
  });

  it('only unstages when nothing is live', () => {
    expect(plan(verse('John 3:16', 'KJV'), null)).toEqual({ unstage: true, clearWall: false });
  });

  it('only unstages while a theme is being edited', () => {
    expect(plan(verse('John 3:16', 'KJV'), verse('John 3:16', 'KJV'), 'live', true)).toEqual({ unstage: true, clearWall: false });
  });

  it('does nothing with an empty preview, even with words on the wall', () => {
    expect(plan(null, verse('John 3:16', 'KJV'))).toEqual({ unstage: false, clearWall: false });
  });

  it("knows the phone's id format and the engine's naming as the same reading", () => {
    const phone = verse('John 3:16–18', 'KJV', 'John 3:16–18@KJV');
    expect(plan(phone, verse('John 3:16-18', 'KJV'))).toEqual({ unstage: true, clearWall: true });
    expect(plan(verse('Psalm 104:12', 'KJV'), verse('Psalms 104:12', 'KJV'))).toEqual({ unstage: true, clearWall: true });
    expect(plan(verse('John 3 16', 'KJV'), verse('John 3:16', 'KJV'))).toEqual({ unstage: true, clearWall: true });
  });
});

describe('previewIsLive', () => {
  it('tells one translation from another when both name one', () => {
    expect(previewIsLive(verse('John 3:16', 'WEB'), verse('John 3:16', 'KJV'))).toBe(false);
    expect(previewIsLive(verse('John 3:16', 'kjv'), verse('John 3:16', 'KJV'))).toBe(true);
  });
  it('matches a run line staged before the engine picked a translation', () => {
    expect(previewIsLive(verse('John 3:16'), verse('John 3:16', 'KJV'))).toBe(true);
  });
  it('matches slides and pictures by what they are', () => {
    const slide: LiveItem = { source: 'presentation', id: 'deck:2', label: 'x', path: '/a.png' };
    expect(previewIsLive(slide, { ...slide })).toBe(true);
    expect(previewIsLive(slide, { ...slide, id: 'deck:3' })).toBe(false);
    const photo: LiveItem = { source: 'media', id: 'm1', label: 'x', path: 'file:///a.jpg' };
    expect(previewIsLive(photo, { ...photo, id: 'file:///a.jpg' })).toBe(true);
  });
});
