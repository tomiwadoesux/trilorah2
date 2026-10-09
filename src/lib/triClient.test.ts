import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTriSnapshot, normalizeTriTheme, readTriLocal, selectTriItems, selectedTriCount, TRI_DISPLAY_KEY, TRI_THEME_KEY } from './triClient';
import type { TriSnapshot } from '../../shared/triPackage';
import type { RunSegment } from '../../shared/operatorRun';
import { operatorRunStore } from '../stores/operatorRunStore';

const theme = {
  backgroundId: 'imported-background', dimness: 42, blur: 3, shadow: 77,
  font: 'serif' as const, textCase: 'none' as const, textSpacing: 'normal' as const, size: 4, verseSize: 2, refGap: 1.25,
  layout: 'bottom-right' as const, safeMargin: 12.5, textWidth: 75,
};

describe('portable package choices', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  const snapshot: TriSnapshot = { categories: {
    service: [{ id: 'current', label: 'Sunday', data: { segments: [] } }],
    preachers: [{ id: 'guest', label: 'Guest preacher', data: { profile: {} } }],
    records: [{ id: 'notes', label: 'Private notes', data: {} }],
  } };

  it('exports a pastor-only selection without service records or the current run', () => {
    const selection = selectTriItems(snapshot, ['preachers']);
    expect(selection).toEqual({ preachers: ['guest'] });
    expect(selectedTriCount(selection)).toBe(1);
  });

  it('preserves every layout control in a valid imported theme', () => {
    expect(normalizeTriTheme(JSON.parse(JSON.stringify(theme)), theme)).toEqual(theme);
  });

  it('preserves the center layout from a portable theme', () => {
    expect(normalizeTriTheme({ ...theme, layout: 'center' }, theme)).toEqual({ ...theme, layout: 'center' });
  });

  it('keeps older themes at their safe width and bounds imported text widths', () => {
    const { textWidth: _width, ...legacy } = theme;
    expect(normalizeTriTheme(legacy, legacy).textWidth).toBe(75);
    expect(normalizeTriTheme({ ...theme, textWidth: 10 }, theme).textWidth).toBe(40);
    expect(normalizeTriTheme({ ...theme, textWidth: 200 }, theme).textWidth).toBe(100);
  });

  it('restores case without replacing the selected font, including older uppercase themes', () => {
    expect(normalizeTriTheme({ ...theme, textCase: 'lowercase' }, theme)).toMatchObject({ font: 'serif', textCase: 'lowercase' });
    const { textCase: _case, ...legacy } = theme;
    expect(normalizeTriTheme({ ...legacy, font: 'uppercase' }, theme).textCase).toBe('uppercase');
    expect(normalizeTriTheme(legacy, theme).textCase).toBe('none');
  });

  it('restores spacing and keeps older or malformed themes at normal spacing', () => {
    expect(normalizeTriTheme({ ...theme, textSpacing: 'airy' }, theme)).toMatchObject({ font: 'serif', textSpacing: 'airy', refGap: 1.25 });
    expect(normalizeTriTheme({ ...theme, textSpacing: 'tight' }, theme).textSpacing).toBe('tight');
    const { textSpacing: _spacing, ...legacy } = theme;
    expect(normalizeTriTheme(legacy, theme).textSpacing).toBe('normal');
    expect(normalizeTriTheme({ ...theme, textSpacing: 'invalid' }, theme).textSpacing).toBe('normal');
  });

  it.each(['top-left', 'top-right', 'middle-left', 'middle-right'])('restores %s from a saved theme', (layout) => {
    const saved = JSON.parse(JSON.stringify({ ...theme, layout }));
    expect(normalizeTriTheme(saved, theme).layout).toBe(layout);
  });

  it('bounds malformed imported controls without losing valid layout settings', () => {
    expect(normalizeTriTheme({ ...theme, font: 'invalid', dimness: 500, refGap: -10, safeMargin: NaN }, theme))
      .toEqual({ ...theme, dimness: 100, refGap: 0 });
  });

  it('stages a display-only import without changing the live output settings', () => {
    const data = new Map([[TRI_THEME_KEY, JSON.stringify(theme)]]);
    const setSetting = vi.fn();
    vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
    vi.stubGlobal('window', { dispatchEvent: vi.fn(), api: { setSetting } });
    const display = { scriptureFontPreset: 'modern-sans', textTransition: 'fade', textCase: 'lowercase', textSpacing: 'airy', defaultTextColor: '#fffabc', overlayOpacity: 0.6, safeMargin: 15, textWidth: 62, verseLayout: 'center', refGap: 2.25 };
    applyTriSnapshot({ categories: { themes: [{ id: 'display', label: 'Appearance', data: display }] } }, false);
    expect(readTriLocal(TRI_DISPLAY_KEY, {})).toEqual(display);
    expect(readTriLocal(TRI_THEME_KEY, {})).toMatchObject({ ...theme, font: 'default', textCase: 'lowercase', textSpacing: 'airy', dimness: 60, safeMargin: 15, textWidth: 62, layout: 'center', refGap: 2.25 });
    expect(setSetting).not.toHaveBeenCalled();
  });

  it.each([false, true])('applies all selected services together when opening is %s', (openService) => {
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    const local: RunSegment[] = [{ key: 'local', type: 'custom', label: 'Local', items: [] }];
    let applied = local;
    const update = vi.spyOn(operatorRunStore, 'update').mockImplementation(change => {
      applied = typeof change === 'function' ? change(local) : change;
    });
    const source: TriSnapshot = { categories: { service: ['First', 'Second'].map(label => ({
      id: label, label, data: { segments: [{ key: label, type: 'custom', label, items: [] }] },
    })) } };
    applyTriSnapshot(source, openService);
    expect(update).toHaveBeenCalledTimes(1);
    expect(applied.map(segment => segment.label)).toEqual(openService ? ['First', 'Second'] : ['Local', 'First', 'Second']);
  });
});
