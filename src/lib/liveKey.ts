import { bookIdFromName } from './books';
import { parseReference } from '../../shared/parseReference';
import type { LiveItem } from '../design/screens/projector';

/*
 * What a live item IS, as one string — so the projector can tell its own
 * push coming back from the engine apart from a new one.
 *
 * Every push this window makes is broadcast back to it a moment later
 * (on-verse-detected for a verse, on-live-content for a song or a slide,
 * on-show-media for a picture). Taken as news, that echo set the LIVE pane a
 * second time and restarted the words' entrance halfway through: the blink
 * an operator sees on every "next". The echo and the push name the same
 * reading differently — "Psalm 104:12" from the run of service, "Psalms
 * 104:12" from the engine, an en dash from the phone, "John 3 16" typed into a
 * run sheet, no translation on a run item until the engine picks one — so the
 * key is built from the book's number and the verse numbers, never the
 * spelling. The reference is read with the same parser main resolves the push
 * with (shared/parseReference), so whatever main put on the wall, this reads
 * as the same reading as the engine's canonical "John 3:16" echo.
 */

/** The reading a scripture item covers, or the trimmed text when it is not one. */
function scriptureSpan(item: LiveItem): string {
  /* The phone's items carry "John 3:16@KJV" as their id. */
  const raw = (item.reference ?? item.id).replace(/@[^@]*$/, '').trim();
  const parsed = parseReference(raw);
  /* Main refuses a reference without a verse or one cut off mid-type, so
     there is no reading to name — only the words. */
  const book = parsed && !parsed.partial && parsed.chapter !== null && parsed.verse !== null
    ? bookIdFromName(parsed.bookQuery)
    : null;
  if (!parsed || !book || parsed.chapter === null || parsed.verse === null) {
    return `scripture:${raw.replace(/\s*[–—]\s*/g, '-').replace(/\s+/g, ' ').toLowerCase()}`;
  }
  const last = parsed.endVerse ?? parsed.verse;
  return `scripture:${book.id}:${parsed.chapter}:${parsed.verse}-${last}`;
}

/**
 * The same reading in any translation, the same song card, the same slide or
 * picture. What a push in flight is known by: its translation may only be
 * settled inside the push itself.
 */
export function spanKey(item: LiveItem): string {
  if (item.source === 'scripture') return scriptureSpan(item);
  if (item.source === 'media') return `media:${item.path ?? item.id}`;
  return `${item.source}:${item.id}`;
}

/** Exactly what is on the wall: the reading AND its translation. */
export function liveKey(item: LiveItem | null | undefined): string | null {
  if (!item) return null;
  const span = spanKey(item);
  return item.source === 'scripture' ? `${span}@${(item.version ?? '').toUpperCase()}` : span;
}
