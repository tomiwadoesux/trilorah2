import { isEmptyPreview } from '../emptyPreviewMode';
import { useSyncExternalStore } from 'react';
import { slideBackdrop, type BackdropStyle } from '../../ui';
import { toDisplayUrl } from '../../../shared/mediaUrl';
import type { ImportedMedia, SkippedMedia } from '../../../shared/importedMedia';
import { fromImported, importNotice, keepShelf, shelfFor, uniqueById, type ClipProbe, type Shelf } from '../../lib/laptopImport';

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
  collection?: 'themes' | 'media';
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
  if (isEmptyPreview) return [];
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

/*
 * The whole shelf, one localStorage entry. Says whether it was written: a
 * write over the quota throws, and swallowed, the cards stayed on screen and
 * were gone on the next launch with nothing said — an import has to be able
 * to tell the operator instead.
 */
function savePersistedMedia(all: ThemeMedia[]): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const seedIds = new Set(SEED.map((s) => s.id));
    const customOnly = all.filter((m) => !seedIds.has(m.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
    return true;
  } catch {
    return false;
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

/** Off the shelf. A stock wash has no file to delete and is not offered this.
    The file itself stays in userData/media — a run row or a saved service
    may still point at it. Hands back what it took off. */
export function removeMedia(id: string): ThemeMedia | undefined {
  const gone = items.find((m) => m.id === id);
  items = items.filter((m) => m.id !== id);
  savePersistedMedia(items);
  emit();
  return gone;
}

/** A package copies resources into this laptop's shelf in one update.
    False when the shelf could not be saved (savePersistedMedia). */
export function importMedia(media: ThemeMedia[]): boolean {
  if (!media.length) return true;
  const ids = new Set(media.map(item => item.id));
  items = [...media, ...items.filter(item => !ids.has(item.id))];
  const saved = savePersistedMedia(items);
  emit();
  return saved;
}

export function getMediaLibrary(): ThemeMedia[] {
  return items;
}

/**
 * Any still off the shelf — what the preview opens on while the one from
 * the online library is on its way, and what it keeps when there is no
 * network to fetch one over.
 *
 * A real picture while the church has one: the washes are what the shelf
 * draws in place of a file, and on a shelf of three photos and eight washes
 * a fair draw would open on a wash most mornings. They are the fallback for
 * a library nobody has added to yet.
 *
 * Never a clip: a video is something you play, not a wallpaper, and the
 * preview would open on a frozen frame of it. And only off the themes
 * shelf: a folder of announcement slides added to media is not a set of
 * backgrounds, and one of them must not open the next morning's preview.
 */
export function randomStill(): ThemeMedia | undefined {
  const stills = items.filter((m) => m.kind !== 'video' && (m.collection ?? 'themes') === 'themes');
  const photos = stills.filter((m) => m.url);
  const pool = photos.length ? photos : stills;
  return pool[Math.floor(Math.random() * pool.length)];
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
    /* A clip with no frame of its own — one this laptop cannot decode, or
       one whose frame took too long — wears its wash. The clip itself in
       an <img> is a broken-picture icon on the shelf. */
    return toDisplayUrl(media.poster) || slideBackdrop(media.seed, media.style);
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

/**
 * A clip's poster and length in one look, and whether this laptop can play
 * it at all.
 *
 * videoPoster folds "cannot decode" and "took too long" into the same
 * nothing, so a HEVC or ProRes .mov imported happily and the operator only
 * found out when the wall stayed black. Chromium says which it is — an
 * error with MEDIA_ERR_SRC_NOT_SUPPORTED or MEDIA_ERR_DECODE — and that is
 * worth saying at the moment of import, not in front of the congregation.
 * A timeout is not a verdict: the clip is kept as playable.
 */
export function probeClip(src: string): Promise<ClipProbe> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    let length: string | undefined;
    const done = (out: ClipProbe) => {
      window.clearTimeout(timer);
      v.removeAttribute('src');
      v.load();
      resolve(out);
    };
    const timer = window.setTimeout(() => done({ length, playable: true }), 8000);
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.preload = 'auto';
    v.addEventListener('loadedmetadata', () => {
      const s = Math.round(v.duration || 0);
      if (s > 0 && Number.isFinite(s)) length = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      v.currentTime = Math.min(1, (v.duration || 2) / 2);
    });
    v.addEventListener('seeked', () => {
      try {
        const w = 320;
        const h = Math.max(1, Math.round((w * v.videoHeight) / Math.max(1, v.videoWidth)));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d')?.drawImage(v, 0, 0, w, h);
        done({ poster: c.toDataURL('image/jpeg', 0.72), length, playable: true });
      } catch {
        done({ length, playable: true });
      }
    });
    v.addEventListener('error', () => {
      const code = v.error?.code;
      done({ length, playable: !(code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || code === MediaError.MEDIA_ERR_DECODE) });
    });
    v.src = src;
  });
}

/** At most `limit` at once — a dozen clips decoding together stalls the
    window, and the stage lives in this window. */
async function eachLimited<T, R>(list: readonly T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await run(list[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return out;
}

const baseName = (p: string) => p.split(/[\\/]/).pop() || p;

/** The line an import ends on when the shelf could not be saved. */
const SHELF_FULL = 'the shelf is full — new cards will not be kept after a restart';

export interface LaptopImport {
  /** Every card the pick or drop ended up as, in order — new or already there. */
  cards: ThemeMedia[];
  /** The one line that says how it went (lib/laptopImport importNotice). */
  notice: string;
  canceled?: boolean;
}

/**
 * Pictures and clips from this laptop onto the shelf: the native picker when
 * `paths` is not given, else the files a drop named.
 *
 * Files go to main one at a time, so `onProgress` can say "adding 2 of
 * 5…" — a folder of clips takes a while, and a pane that says nothing for
 * ten seconds reads as frozen. A main process from before this build has
 * only the single-file picker; that still works, one file at a time.
 */
export async function addFromLaptop({ paths, wanted, onProgress }: {
  paths?: string[];
  /** The shelf being looked at; clips go to media regardless (shelfFor). */
  wanted: Shelf;
  onProgress?: (text: string) => void;
}): Promise<LaptopImport> {
  const api = typeof window === 'undefined' ? undefined : window.api;
  const imported: ImportedMedia[] = [];
  const skipped: SkippedMedia[] = [];
  let list = paths;
  if (!list) {
    if (api?.pickMediaPaths) {
      const picked = await api.pickMediaPaths().catch(() => null);
      if (!picked) return { cards: [], notice: 'the file picker did not open — try again' };
      if (picked.canceled) return { cards: [], notice: '', canceled: true };
      list = picked.paths;
    } else if (api?.pickMediaFile) {
      const one = await api.pickMediaFile().catch(() => null);
      if (one?.canceled) return { cards: [], notice: '', canceled: true };
      if (!one?.success || !one.url) return { cards: [], notice: `could not add that${one?.error ? ` — ${one.error}` : ''}` };
      imported.push({ id: `local:${one.url}`, url: one.url, src: one.src ?? one.url, kind: one.kind === 'video' ? 'video' : 'photo', name: one.name ?? 'media', bytes: 0, existed: false });
      list = [];
    } else {
      return { cards: [], notice: 'adding from the laptop needs the desktop app' };
    }
  }
  if (list.length && !api?.importMediaFiles) return { cards: [], notice: 'restart trilorah to add files this way' };
  for (let i = 0; i < list.length; i++) {
    onProgress?.(list.length > 1 ? `adding ${i + 1} of ${list.length}…` : 'adding…');
    const result = await api!.importMediaFiles!([list[i]]).catch(() => null);
    if (!result) {
      skipped.push({ name: baseName(list[i]), reason: 'could not be read' });
      continue;
    }
    imported.push(...result.items);
    skipped.push(...result.skipped);
  }

  const files = uniqueById(imported);
  const before = new Map(items.map((m) => [m.id, m]));
  /* Posters only for clips new to the shelf; one already there has its own. */
  const clips = files.filter((f) => f.kind === 'video' && !before.has(f.id));
  if (clips.length) onProgress?.(clips.length > 1 ? `reading ${clips.length} clips…` : 'reading the clip…');
  const probes = await eachLimited(clips, 3, async (clip) => {
    const probe = await probeClip(clip.src);
    /* The frame as a file beside the clip, not a data: URL on the card: the
       shelf is one localStorage entry, and ~20 KB a clip fills it (main's
       saveClipPoster). Without that IPC, or if it fails, inline as before. */
    const file = probe.poster && api?.saveClipPoster ? await api.saveClipPoster(clip.id, probe.poster).catch(() => null) : null;
    return file ? { ...probe, poster: file } : probe;
  });
  const probed = new Map(clips.map((clip, i) => [clip.id, probes[i]]));
  const cards = keepShelf(files.map((f) => fromImported(f, shelfFor(f, wanted), probed.get(f.id))), items);
  /* Already-there cards come to the front too: what was just added is what
     is about to be used, and it should not have to be hunted for. */
  const kept = importMedia(cards);
  if (cards.length) window.dispatchEvent(new Event('trilorah-library-changed'));
  const added = cards.filter((c) => !before.has(c.id));
  const notice = importNotice({ added, already: cards.filter((c) => before.has(c.id)), skipped, wanted });
  /* On screen now, but the save failed: said, not found out on Sunday. */
  return { cards, notice: kept || !added.length ? notice : `${notice} · ${SHELF_FULL}` };
}
