import { videoSpeed, videoBass } from './backgroundPlayback';
import type { TriApi, TriRendererState } from '../../shared/triBridge';
import type { TriCategory, TriSelection, TriSnapshot } from '../../shared/triPackage';
import { getMediaLibrary, importMedia, type ThemeMedia } from '../design/screens/mediaLibrary';
import { operatorRunStore } from '../stores/operatorRunStore';
import { validRun } from './persistentRun';
import type { SlideTheme } from '../design/screens/slide';
import type { FontOption, TextPositionOption } from '../ui';
import { isTextPosition } from '../../shared/textPosition';
import { clampTextWidth } from '../../shared/textWidth';
import { resolveTextCase } from '../../shared/textCase';
import { resolveTextSpacing } from '../../shared/textSpacing';
import { themeFieldsFromSettings } from './backgroundDrop';

export const TRI_THEME_KEY = 'trilorah_theme_layout';
export const TRI_THEME_EVENT = 'trilorah-theme-imported';
export const TRI_DISPLAY_KEY = 'trilorah_theme_display';
export const TRI_DISPLAY_EVENT = 'trilorah-display-imported';
export const TRI_DECKS_KEY = 'trilorah_custom_presentation_decks';
export const TRI_DECKS_EVENT = 'trilorah-custom-decks-updated';
export const TRI_CATEGORIES: Array<{ id: TriCategory; label: string; detail: string }> = [
  { id: 'service', label: 'Run of service', detail: 'Segments, timing, queued songs, scriptures, media, and notes' },
  { id: 'songs', label: 'Songs', detail: 'Lyrics, sections, arrangements, and song information' },
  { id: 'media', label: 'Images and videos', detail: 'The actual files, copied into the package' },
  { id: 'presentations', label: 'Presentations', detail: 'Imported slide decks and custom presentations' },
  { id: 'themes', label: 'Themes and layouts', detail: 'Backgrounds, fonts, positioning, spacing, and display appearance' },
  { id: 'preachers', label: 'Pastor profiles and learning', detail: 'Saved corrections, vocabulary, aliases, and learning evidence. No voice recordings.' },
  { id: 'church', label: 'Church information', detail: 'Church identity and saved public details' },
  { id: 'tools', label: 'Service tools', detail: 'Saved timers, templates, and messages' },
  { id: 'records', label: 'Service records', detail: 'Saved notes, transcripts, and history. Review before sharing.' },
  { id: 'folders', label: 'Library folders', detail: 'Folder organisation and links to included content' },
];
export const SERVICE_CATEGORIES: TriCategory[] = ['service', 'songs', 'media', 'presentations', 'themes', 'folders'];

export function triApi(): Partial<TriApi> | undefined {
  return window.api as (typeof window.api & Partial<TriApi>);
}

export function readTriLocal<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
}

/** Keep every editable layout field while rejecting malformed package values. */
type PackageTheme = Omit<SlideTheme, 'font' | 'layout'> & { font: FontOption; layout: TextPositionOption };
export function normalizeTriTheme(value: unknown, fallback: PackageTheme): PackageTheme & { textWidth: number } {
  if (!value || typeof value !== 'object') return { ...fallback, textWidth: clampTextWidth(fallback.textWidth, 100 - fallback.safeMargin * 2) };
  const input = value as Record<string, unknown>;
  const number = (key: keyof SlideTheme, min: number, max: number) => typeof input[key] === 'number' && Number.isFinite(input[key]) ? Math.max(min, Math.min(max, input[key] as number)) : fallback[key] as number;
  return {
    backgroundId: typeof input.backgroundId === 'string' && input.backgroundId ? input.backgroundId : fallback.backgroundId,
    ...(input.videoSpeed !== undefined || fallback.videoSpeed !== undefined ? { videoSpeed: videoSpeed(input.videoSpeed ?? fallback.videoSpeed) } : {}),
    ...(input.videoBass !== undefined || fallback.videoBass !== undefined ? { videoBass: videoBass(input.videoBass ?? fallback.videoBass) } : {}),
    ...(input.videoSound !== undefined || fallback.videoSound !== undefined ? { videoSound: (input.videoSound ?? fallback.videoSound) === true } : {}),
    dimness: number('dimness', 0, 100), blur: number('blur', 0, 12), shadow: number('shadow', 0, 100),
    size: number('size', -2, 8), verseSize: number('verseSize', -2, 8), refGap: number('refGap', 0, 3), safeMargin: number('safeMargin', 3, 20),
    textWidth: clampTextWidth(input.textWidth, 100 - number('safeMargin', 3, 20) * 2),
    font: ['default', 'serif', 'uppercase'].includes(String(input.font)) ? input.font as FontOption : fallback.font,
    textCase: resolveTextCase(input.textCase, typeof input.font === 'string' ? input.font : fallback.font),
    textSpacing: resolveTextSpacing(input.textSpacing),
    layout: isTextPosition(input.layout) ? input.layout : input.layout === 'bottom' ? 'bottom-center' : fallback.layout,
  };
}

export function triRendererState(): TriRendererState {
  return {
    run: operatorRunStore.getSnapshot(),
    media: getMediaLibrary(),
    customDecks: readTriLocal(TRI_DECKS_KEY, []),
    theme: readTriLocal(TRI_THEME_KEY, undefined),
  };
}

export function selectTriItems(snapshot: TriSnapshot, categories: TriCategory[] = TRI_CATEGORIES.map(item => item.id)): TriSelection {
  return Object.fromEntries(categories.map(category => [category, (snapshot.categories[category] ?? []).map(item => item.id)]));
}

export function selectedTriCount(selection: TriSelection): number {
  return Object.values(selection).reduce((count, ids) => count + (ids?.length ?? 0), 0);
}

export function stageTriDisplay(display: Record<string, unknown>): void {
  localStorage.setItem(TRI_DISPLAY_KEY, JSON.stringify(display));
  window.dispatchEvent(new CustomEvent(TRI_DISPLAY_EVENT, { detail: display }));
}

export function updateStagedTriDisplay(patch: Record<string, unknown>): void {
  const staged = readTriLocal<Record<string, unknown> | null>(TRI_DISPLAY_KEY, null);
  if (staged) {
    const next = { ...staged, ...patch };
    localStorage.setItem(TRI_DISPLAY_KEY, JSON.stringify(next));
    void window.api?.setSetting('triThemeDisplay', next).catch(() => undefined);
  }
  window.dispatchEvent(new Event('trilorah-theme-changed'));
}

export function applyTriSnapshot(snapshot: TriSnapshot, openService: boolean): void {
  const media = (snapshot.categories.media ?? []).map(item => item.data).filter((item): item is ThemeMedia => !!item && typeof item.id === 'string');
  importMedia(media);
  const decks = (snapshot.categories.presentations ?? []).filter(item => item.data?.kind === 'custom').map(item => item.data.value);
  if (decks.length) {
    const ids = new Set(decks.map(deck => deck.id));
    const current = readTriLocal<any[]>(TRI_DECKS_KEY, []);
    localStorage.setItem(TRI_DECKS_KEY, JSON.stringify([...decks, ...current.filter(deck => !ids.has(deck.id))]));
    window.dispatchEvent(new Event(TRI_DECKS_EVENT));
  }
  const layout = snapshot.categories.themes?.find(item => item.id === 'layout')?.data;
  const display = snapshot.categories.themes?.find(item => item.id === 'display')?.data;
  if (layout && typeof layout === 'object') {
    localStorage.setItem(TRI_THEME_KEY, JSON.stringify(layout));
    window.dispatchEvent(new CustomEvent(TRI_THEME_EVENT, { detail: layout }));
  }
  if (display && typeof display === 'object') {
    stageTriDisplay(display);
    // A display-only import needs a matching preview, so projection cannot
    // overwrite the imported appearance with the previous layout.
    if (!layout) {
      /* The same reading of display settings the LIVE box uses on the wall's
         own (lib/backgroundDrop), so an import and the wall cannot disagree
         about what a setting means. */
      const converted: Record<string, unknown> = { ...readTriLocal<Record<string, unknown>>(TRI_THEME_KEY, {}), ...themeFieldsFromSettings(display) };
      if (typeof display.defaultBackgroundUrl === 'string' && display.defaultBackgroundUrl) {
        const existing = getMediaLibrary().find(item => item.url === display.defaultBackgroundUrl);
        const id = existing?.id ?? `tri-background-${Date.now()}`;
        if (!existing) importMedia([{ id, label: 'Imported theme background', detail: 'From .tri package', seed: 0, style: 'smoke', source: 'local', url: display.defaultBackgroundUrl, kind: /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(display.defaultBackgroundUrl) ? 'video' : 'photo' }]);
        converted.backgroundId = id;
      }
      localStorage.setItem(TRI_THEME_KEY, JSON.stringify(converted));
      window.dispatchEvent(new CustomEvent(TRI_THEME_EVENT, { detail: converted }));
    }
  }
  const services = snapshot.categories.service ?? [];
  if (services.length && services.every(service => validRun(service.data?.segments))) {
    const segments = services.flatMap(service => service.data.segments);
    operatorRunStore.update(previous => openService ? segments : [...previous, ...segments]);
  }
  window.dispatchEvent(new Event('presentations-updated'));
  window.dispatchEvent(new Event('trilorah-package-imported'));
}

/**
 * A card deleted from the shelf, forgotten by the last saved service too.
 *
 * restoreTriRenderer (below) puts back any card missing from the shelf on
 * every LIVE mount, so without this a deleted picture that was in the last
 * .tri save came back on the next launch.
 */
export async function forgetTriMedia(id: string): Promise<void> {
  const api = window.api;
  if (!api?.getSetting || !api.setSetting) return;
  const saved = await api.getSetting('triRendererState').catch(() => undefined) as Partial<TriRendererState> | undefined;
  if (!saved || !Array.isArray(saved.media) || !saved.media.some(item => item?.id === id)) return;
  await api.setSetting('triRendererState', { ...saved, media: saved.media.filter(item => item?.id !== id) });
}

/** Restore only missing local data; this must never overwrite current edits. */
export async function restoreTriRenderer(): Promise<void> {
  const saved = await window.api?.getSetting('triRendererState') as Partial<TriRendererState> | undefined;
  if (!saved) return;
  if (Array.isArray(saved.media)) {
    const ids = new Set(getMediaLibrary().map(item => item.id));
    importMedia(saved.media.filter(item => item && typeof item.id === 'string' && !ids.has(item.id)));
  }
  if (Array.isArray(saved.customDecks)) {
    const current = readTriLocal<any[]>(TRI_DECKS_KEY, []);
    const ids = new Set(current.map(item => item.id));
    const extra = saved.customDecks.filter(item => item && typeof item.id === 'string' && !ids.has(item.id));
    if (extra.length) {
      localStorage.setItem(TRI_DECKS_KEY, JSON.stringify([...current, ...extra]));
      window.dispatchEvent(new Event(TRI_DECKS_EVENT));
    }
  }
}
