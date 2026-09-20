import { useSyncExternalStore } from 'react';
import { slideBackdrop, type BackdropStyle } from '../../ui';
import { toDisplayUrl } from '../../../shared/mediaUrl';

/*
 * The background library the live surface chooses from.
 *
 * It used to be a const in Live.tsx, which was fine while every background
 * shipped with the app. The stock search adds to it at runtime — an operator
 * picks a photo, it is downloaded, and it has to appear on the local shelf
 * and be choosable in the theme editor in the same breath. Three components
 * read the list and one writes it, so it is a tiny external store rather
 * than a prop threaded through the whole screen.
 */

export type MediaSource = 'local' | 'stock';

export interface ThemeMedia {
  id: string;
  label: string;
  detail: string;
  seed: number;
  style: BackdropStyle;
  /** Which shelf it sits on — what ships with Trilorah, or this laptop's own. */
  source: MediaSource;
  /** A real file, once there is one. Without it the card draws its wash. */
  url?: string;
  /** Video cannot sit in an <img>; this is the frame that stands for it. */
  poster?: string;
  kind?: 'photo' | 'video';
}

/* The library is deliberately small in the live surface: these are the
   service-safe choices an operator can recognise and switch without hunting
   through an editor while people are waiting. */
const SEED: ThemeMedia[] = [
  { id: 'quiet-sea', label: 'quiet sea', detail: 'dark blue motion', seed: 5, style: 'smoke', source: 'stock' },
  { id: 'deep-forest', label: 'deep forest', detail: 'muted green motion', seed: 2, style: 'smoke', source: 'stock' },
  { id: 'night-sky', label: 'night sky', detail: 'cool blue still', seed: 0, style: 'smoke', source: 'stock' },
  { id: 'warm-embers', label: 'warm embers', detail: 'soft amber motion', seed: 1, style: 'facets', source: 'stock' },
  { id: 'violet-glass', label: 'violet glass', detail: 'low-motion abstract', seed: 3, style: 'facets', source: 'stock' },
  /* The church's own — what somebody dropped in from a laptop. Kept apart
     from the stock shelf because the two are found differently: a stock
     background is recognised, a local one is remembered. */
  { id: 'anniversary-loop', label: 'anniversary loop', detail: 'from this laptop', seed: 7, style: 'facets', source: 'local' },
  { id: 'sanctuary-still', label: 'sanctuary still', detail: 'from this laptop', seed: 4, style: 'smoke', source: 'local' },
  { id: 'youth-week', label: 'youth week', detail: 'from this laptop', seed: 9, style: 'facets', source: 'local' },
];

const STORAGE_KEY = 'trilorah_saved_media_library';

function loadPersistedMedia(): ThemeMedia[] {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const custom: ThemeMedia[] = JSON.parse(raw);
    const existingIds = new Set(SEED.map((s) => s.id));
    const uniqueCustom = custom.filter((c) => !existingIds.has(c.id));
    return [...uniqueCustom, ...SEED];
  } catch {
    return SEED;
  }
}

function savePersistedMedia(all: ThemeMedia[]): void {
  if (typeof window === 'undefined') return;
  try {
    const seedIds = new Set(SEED.map((s) => s.id));
    const customOnly = all.filter((m) => !seedIds.has(m.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
  } catch {
    // Ignore storage quota errors
  }
}

let items: ThemeMedia[] = loadPersistedMedia();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Newest first — the thing just picked is the thing about to be used. */
export function addMedia(media: ThemeMedia): void {
  items = [media, ...items.filter((m) => m.id !== media.id)];
  savePersistedMedia(items);
  emit();
}

export function useMediaLibrary(): ThemeMedia[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
  );
}

/** What to put in an <img> for this background. */
export function mediaSrc(media: ThemeMedia): string {
  if (media.kind === 'video') {
    return toDisplayUrl(media.poster) || toDisplayUrl(media.url) || slideBackdrop(media.seed, media.style);
  }
  return toDisplayUrl(media.url) || slideBackdrop(media.seed, media.style);
}

/**
 * A still for a video's card, taken from the video itself.
 *
 * A video cannot sit in an <img>, so without this an imported clip shows as a
 * broken picture. One frame, a second in (the first is so often black), drawn
 * small: it lives in localStorage with the rest of the shelf, and a 320px
 * JPEG is ~15 KB where the clip is hundreds of megabytes. Resolves undefined
 * rather than rejecting — a clip with no readable frame still imports, it
 * just wears the procedural wash.
 */
export function videoPoster(src: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const done = (out?: string) => {
      v.removeAttribute('src');
      v.load();
      resolve(out);
    };
    const timer = window.setTimeout(() => done(), 8000);
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.preload = 'auto';
    v.addEventListener('loadedmetadata', () => {
      v.currentTime = Math.min(1, (v.duration || 2) / 2);
    });
    v.addEventListener('seeked', () => {
      window.clearTimeout(timer);
      try {
        const w = 320;
        const h = Math.max(1, Math.round((w * v.videoHeight) / Math.max(1, v.videoWidth)));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d')?.drawImage(v, 0, 0, w, h);
        done(c.toDataURL('image/jpeg', 0.72));
      } catch {
        done();
      }
    });
    v.addEventListener('error', () => {
      window.clearTimeout(timer);
      done();
    });
    v.src = src;
  });
}

/** "2:07" for a clip's badge. */
export function videoLength(src: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.addEventListener('loadedmetadata', () => {
      const s = Math.round(v.duration || 0);
      resolve(s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : undefined);
    });
    v.addEventListener('error', () => resolve(undefined));
    v.src = src;
  });
}
