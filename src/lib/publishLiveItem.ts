import type { LiveItem } from '../design/screens/projector'
import { buildVerseSlides, type VerseDisplayOptions, type VerseText } from '../../shared/verseDisplay'
import { fitRules } from './slideRules'

/** How the operator's slides are cut (engine.tsx fitRules), so a reading main changed is cut again the same way. */
export type SlideRules = (verses: VerseText[], together?: boolean) => VerseDisplayOptions

/**
 * Await the engine's delivery before marking the operator's item live.
 * Null when main dropped the press: it waited for an online chapter and
 * something newer reached the wall meanwhile, which stays up.
 */
export async function publishLiveItem(item: LiveItem, api = window.api, rules: SlideRules = fitRules): Promise<LiveItem | null> {
  if (!api) return item // Design sandbox has no physical outputs.
  if (item.source === 'scripture') {
    /* Everything this needs is read BEFORE the push. Once mobileVerse
       replies the verse is already on the wall, and anything awaited after
       that lets the projector take news in the gap (a find card's push, a
       clear by voice) that send() would then paint over with this item. An
       item that comes without slides (a run of service line) was never sliced
       by the preview, so the wall slices its range by the church's own layout
       setting — and the LIVE pane has to page it the same way. A reading with
       no Bible of its own reads in this service's Bible — the one LIVE's
       dropdown and the preacher's "read it in the BSB" set — before the
       church's saved default. */
    const [selectedVersion, breakOnVerse] = await Promise.all([
      item.version ?? (async () => (await api.getSessionVersion?.()) ?? api.getSetting?.('displayVersion'))(),
      item.slides?.length ? undefined : api.getSetting?.('breakOnVerse'),
    ])
    const version = typeof selectedVersion === 'string' && selectedVersion ? selectedVersion : 'KJV'
    const reading = await api.mobileVerse(item.reference ?? item.label, version, true)
    if (reading.superseded) return null
    /* The item comes back the way the engine names it ("Psalms", not the run
       of service's "Psalm"; a hyphen, not the phone's en dash) and sliced, so
       the LIVE pane and the verse list read it without waiting for the
       engine's echo — which the projector now ignores as its own push. The
       id stays: it is what the row that sent it looks itself up by. Slides
       the item already has are the operator's together/apart choice: kept,
       unless main read other words (slidesFor), then cut again the same way. */
    const reference = reading.book
      ? `${reading.book} ${reading.chapter}:${reading.verse}${reading.endVerse && reading.endVerse !== reading.verse ? `-${reading.endVerse}` : ''}`
      : item.reference ?? item.label
    const delivered = reading.version ?? version
    const apart = !item.slides?.length && (reading.verses?.length ?? 0) > 1 && breakOnVerse === true
    const slides = item.slides?.length
      ? slidesFor(item, reading, rules)
      : !reading.book || !reading.verses?.length
        ? item.slides
        : buildVerseSlides({ book: reading.book, chapter: reading.chapter, version: delivered }, reading.verses, rules(reading.verses, apart ? false : undefined))
    return { ...item, reference, version: delivered, text: reading.text, verses: reading.verses, slides }
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
  /* An item staged without its verse list (a typed reference) has no words
     to compare: the same Bible means the same words, and its slides — the
     operator's together/apart — stay. */
  const sameWords = item.verses ? sameVerses(reading.verses, item.verses) : true
  if (!item.slides || (reading.version === item.version && sameWords)) return item.slides
  // No rules to cut with: no slides, and LIVE draws the reading whole (stageSlide) rather than the wrong words.
  if (!rules || !reading.verses?.length) return undefined
  const count = item.verses?.length ?? reading.verses.length
  const together = count > 1 ? item.slides.length < count : undefined
  return buildVerseSlides({ book: reading.book, chapter: reading.chapter, version: reading.version }, reading.verses, rules(reading.verses, together))
}
