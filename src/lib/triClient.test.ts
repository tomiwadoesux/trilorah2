import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTriSnapshot, normalizeTriTheme, readTriLocal, selectTriItems, selectedTriCount, TRI_DISPLAY_KEY, TRI_THEME_KEY } from './triClient';
import type { TriSnapshot } from '../../shared/triPackage';

const theme = {
  backgroundId: 'imported-background', dimness: 42, blur: 3, shadow: 77,
  font: 'serif' as const, size: 4, verseSize: 2, refGap: 1.25,
  layout: 'bottom-right' as const, safeMargin: 12.5,
};

describe('portable package choices', () => {
  afterEach(() => vi.unstubAllGlobals());
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

  it('bounds malformed imported controls without losing valid layout settings', () => {
    expect(normalizeTriTheme({ ...theme, font: 'invalid', dimness: 500, refGap: -10, safeMargin: NaN }, theme))
      .toEqual({ ...theme, dimness: 100, refGap: 0 });
  });

  it('stages a display-only import without changing the live output settings', () => {
    const data = new Map([[TRI_THEME_KEY, JSON.stringify(theme)]]);
    const setSetting = vi.fn();
    vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
    vi.stubGlobal('window', { dispatchEvent: vi.fn(), api: { setSetting } });
    const display = { textTransition: 'fade', defaultTextColor: '#fffabc', overlayOpacity: 0.6, safeMargin: 15, verseLayout: 'center', refGap: 2.25 };
    applyTriSnapshot({ categories: { themes: [{ id: 'display', label: 'Appearance', data: display }] } }, false);
    expect(readTriLocal(TRI_DISPLAY_KEY, {})).toEqual(display);
    expect(readTriLocal(TRI_THEME_KEY, {})).toMatchObject({ ...theme, dimness: 60, safeMargin: 15, layout: 'center', refGap: 2.25 });
    expect(setSetting).not.toHaveBeenCalled();
  });
});
