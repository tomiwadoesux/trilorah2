import type { LiveItem } from '../design/screens/projector'
import { buildVerseSlides, type VerseDisplayOptions, type VerseText } from '../../shared/verseDisplay'

/** How the operator's slides are cut (engine.tsx fitRules), so a reading main changed is cut again the same way. */
export type SlideRules = (verses: VerseText[], together?: boolean) => VerseDisplayOptions

/**
 * Await the engine's delivery before marking the operator's item live.
 * Null when main dropped the press: it waited for an online chapter and
 * something newer reached the wall meanwhile, which stays up.
 */
export async function publishLiveItem(item: LiveItem, api = window.api, rules?: SlideRules): Promise<LiveItem | null> {
  if (!api) return item // Design sandbox has no physical outputs.
  if (item.source === 'scripture') {
    /* A reading with no Bible of its own (one saved in the run of service)
       reads in this service's Bible — the one LIVE's dropdown and the
       preacher's "read it in the BSB" set, and the catches and the library
       follow — before the church's saved default. */
    const selectedVersion = item.version ?? await api.getSessionVersion?.() ?? await api.getSetting?.('displayVersion')
    const version = typeof selectedVersion === 'string' && selectedVersion ? selectedVersion : 'KJV'
    const reading = await api.mobileVerse(item.reference ?? item.label, version, true)
    if (reading.superseded) return null
    return { ...item, reference: item.reference ?? item.label, version: reading.version, text: reading.text, verses: reading.verses,
      slides: slidesFor(item, reading, rules) }
  } else if (item.source === 'song' && item.lines) {
    if (!api.pushLiveContent) throw new Error('Restart the app to enable song output.')
    const result = await api.pushLiveContent({ id: item.id, kind: 'song', title: item.title ?? item.label, label: item.section ?? '', lines: item.lines })
    if (!result.success) throw new Error('The song could not be sent to the live screen.')
  } else if (item.source === 'presentation' && (item.path || item.lines)) {
    const result = await api.pushLiveContent?.({ id: item.id, kind: 'slide', title: item.title ?? item.label, label: item.section ?? '', lines: item.lines, path: item.path })
    if (!result?.success) throw new Error('The slide could not be sent to the live screen.')
  } else if (item.source === 'media' && item.path) {
    const result = await api.showMedia?.(item.path, item.mediaKind)
    if (!result?.success) throw new Error('The media could not be sent to the live screen.')
  }
  return item
}

function sameVerses(a: readonly VerseText[] | undefined, b: readonly VerseText[] | undefined): boolean {
  return !!a && !!b && a.length === b.length && a.every((v, i) => v.verse === b[i].verse && v.text === b[i].text)
}

/**
 * The slides LIVE shows: the operator's own, unless main read the passage
 * in another Bible than the item names (an online chapter that did not
 * come in time, so the fallback) or found other words (the chapter arrived
 * after the item was staged). Then the words the wall got are cut again the
 * way the operator's were — together or apart — so LIVE is the wall, never
 * the old slides under a new version's name.
 */
function slidesFor(
  item: LiveItem,
  reading: { book: string; chapter: number; version: string; verses: VerseText[] },
  rules: SlideRules | undefined,
): LiveItem['slides'] {
  if (!item.slides || (reading.version === item.version && sameVerses(reading.verses, item.verses))) return item.slides
  // No rules to cut with: no slides, and LIVE draws the reading whole (stageSlide) rather than the wrong words.
  if (!rules || !reading.verses?.length) return undefined
  const range = (item.verses?.length ?? 0) > 1
  const together = range ? item.slides.length < (item.verses?.length ?? 0) : undefined
  return buildVerseSlides({ book: reading.book, chapter: reading.chapter, version: reading.version }, reading.verses, rules(reading.verses, together))
}
