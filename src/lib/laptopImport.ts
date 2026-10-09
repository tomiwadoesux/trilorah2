import type { ImportedMedia, SkippedMedia } from '../../shared/importedMedia';
import type { ThemeMedia } from '../design/screens/mediaLibrary';
import { canBeBackground } from './backgroundDrop';

/*
 * Pictures and clips from the laptop, on the renderer's side — the pure
 * parts: what card a file becomes, which shelf it lands on, what a Finder
 * drag over a target means, and the one line that says how it went.
 *
 * The copying is main's (electron/media/mediaImport.ts); the store is
 * mediaLibrary's. Everything here is testable without a window.
 */

export type Shelf = 'themes' | 'media';

/** Photos and videos both stay on the shelf the operator chose. */
export function shelfFor(_item: Pick<ImportedMedia, 'kind'>, wanted: Shelf): Shelf {
  return wanted;
}

/** A small stable number from the content hash, so a picture keeps its wash. */
function seedOf(id: string): number {
  const hex = id.replace(/^local:/, '').slice(0, 6);
  const n = parseInt(hex, 16);
  return Number.isFinite(n) ? n % 10 : 4;
}

export interface ClipProbe {
  poster?: string;
  length?: string;
  /** False only when Chromium said it cannot decode the clip. */
  playable: boolean;
}

/** The card a file from the laptop becomes. */
export function fromImported(item: ImportedMedia, collection: Shelf, probe?: ClipProbe): ThemeMedia {
  const seed = seedOf(item.id);
  const detail = probe && !probe.playable ? 'will not play here' : probe?.length ? `${probe.length} · this laptop` : 'this laptop';
  return {
    id: item.id,
    label: item.name || 'untitled',
    detail,
    seed,
    style: seed % 2 ? 'facets' : 'smoke',
    source: 'local',
    /* The drawable form, as the old picker stored it: the panes, a run row
       and the wall all take local-media:// as it is. */
    url: item.src,
    poster: probe?.poster,
    kind: item.kind,
    collection,
  };
}

/** One of each, in the order they came — the same picture dropped twice in
    one go is still one card. */
export function uniqueById<T extends { id: string }>(list: readonly T[]): T[] {
  const seen = new Set<string>();
  return list.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

/**
 * The cards to put on the shelf. One already there is kept exactly as it is
 * — its shelf, its name, its poster — so adding a picture again never
 * quietly moves an announcement photo into the backgrounds, or back.
 */
export function keepShelf(incoming: readonly ThemeMedia[], shelf: readonly ThemeMedia[]): ThemeMedia[] {
  const have = new Map(shelf.map((m) => [m.id, m]));
  return uniqueById(incoming).map((card) => have.get(card.id) ?? card);
}

export interface ImportReport {
  /** New to the shelf. */
  added: readonly ThemeMedia[];
  /** On the shelf before this import. */
  already: readonly ThemeMedia[];
  skipped: readonly SkippedMedia[];
  /** The shelf the operator was looking at. */
  wanted: Shelf;
}

/**
 * The one line an import ends on. Never silent: a pick or a drop that added
 * nothing says why, because "nothing happened" reads exactly like broken.
 *
 *   added sanctuary to themes
 *   added 2 to themes and 1 to media
 *   sunday was already in media · skipped notes.pdf — not a picture or clip
 */
export function importNotice({ added, already, skipped }: ImportReport): string {
  const parts: string[] = [];
  const by: Record<Shelf, ThemeMedia[]> = { themes: [], media: [] };
  for (const card of added) by[card.collection ?? 'themes'].push(card);
  const shelves = (['themes', 'media'] as const).filter((s) => by[s].length);
  if (shelves.length) {
    const say = (s: Shelf) => `${by[s].length === 1 ? by[s][0].label : by[s].length} to ${s}`;
    let line = `added ${shelves.map(say).join(' and ')}`;
    parts.push(line);
  }
  if (already.length === 1) parts.push(`${already[0].label} was already in ${already[0].collection ?? 'themes'}`);
  else if (already.length > 1) parts.push(`${already.length} were already here`);
  const reasons = new Map<string, string[]>();
  for (const s of skipped) reasons.set(s.reason, [...(reasons.get(s.reason) ?? []), s.name]);
  for (const [reason, names] of reasons) {
    parts.push(`skipped ${names[0]}${names.length > 1 ? ` and ${names.length - 1} more` : ''} — ${reason}`);
  }
  const broken = [...added, ...already].filter((c) => c.detail === 'will not play here');
  if (broken.length === 1) parts.push(`${broken[0].label} will not play here — export it as an h.264 mp4`);
  else if (broken.length > 1) parts.push(`${broken.length} clips will not play here — export them as h.264 mp4`);
  return parts.length ? parts.join(' · ') : 'nothing to add there';
}

/* ---- a Finder drag over the window ------------------------------------ */

/** What is being carried in from Finder, as far as a drag can tell before
    the drop: the MIME type of each file, or '' for a folder or a type the
    system does not know. */
export type DragKinds = 'photo' | 'video' | 'mixed' | 'unknown';

export function dragKinds(items: ReadonlyArray<{ kind: string; type: string }>): DragKinds {
  const files = items.filter((i) => i.kind === 'file');
  if (!files.length) return 'unknown';
  const kinds = new Set(files.map((i) => (i.type.startsWith('image/') ? 'photo' : i.type.startsWith('video/') ? 'video' : 'unknown')));
  if (kinds.has('unknown')) return 'unknown';
  if (kinds.size > 1) return 'mixed';
  return kinds.has('video') ? 'video' : 'photo';
}

export type FinderStageKey = 'stage-preview' | 'stage-live';

/** Files dropped on a stage box become still or looping backgrounds. */
export function finderStageHint(key: FinderStageKey, kinds: DragKinds): string | null {
  const target = key === 'stage-live' ? 'on the wall now' : 'in preview';
  return `add to themes · ${kinds === 'video' ? 'looping video' : 'background'} ${target}`;
}

/** Pick the first playable background; keep other imported files on the shelf. */
export function finderStagePick(_key: FinderStageKey, cards: readonly ThemeMedia[]): ThemeMedia | undefined {
  return cards.find((card) => canBeBackground(card) && card.detail !== 'will not play here');
}

/**
 * The media pane's status line while files from Finder are over the window:
 * where a drop on the pane lands, and — while they are somewhere else, a
 * stage box most likely — every place that takes them, the way an in-app
 * carried card lists its targets.
 */
export function finderPaneHint(view: Shelf, _kinds: DragKinds, overPane = true): string {
  return overPane ? `drop to add to ${view}` : `drop here to add to ${view} · on the preview or the live screen to use it now`;
}
