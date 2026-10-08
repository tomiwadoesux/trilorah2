import type { LiveItem } from '../design/screens/projector'
import { buildVerseSlides } from '../../shared/verseDisplay'
import { fitRules } from './slideRules'

/** Await the engine's delivery before marking the operator's item live. */
export async function publishLiveItem(item: LiveItem, api = window.api): Promise<LiveItem> {
  if (!api) return item // Design sandbox has no physical outputs.
  if (item.source === 'scripture') {
    /* Everything this needs is read BEFORE the push. Once mobileVerse
       replies the verse is already on the wall, and anything awaited after
       that lets the projector take news in the gap (a find card's push, a
       clear by voice) that send() would then paint over with this item. An
       item that comes without slides (a run of service line) was never sliced
       by the preview, so the wall slices its range by the church's own layout
       setting — and the LIVE pane has to page it the same way. */
    const [selectedVersion, breakOnVerse] = await Promise.all([
      item.version ?? api.getSetting?.('displayVersion'),
      item.slides?.length ? undefined : api.getSetting?.('breakOnVerse'),
    ])
    const version = typeof selectedVersion === 'string' && selectedVersion ? selectedVersion : 'KJV'
    const reading = await api.mobileVerse(item.reference ?? item.label, version, true)
    /* The item comes back the way the engine names it ("Psalms", not the run
       of service's "Psalm"; a hyphen, not the phone's en dash) and sliced, so
       the LIVE pane and the verse list read it without waiting for the
       engine's echo — which the projector now ignores as its own push. The
       id stays: it is what the row that sent it looks itself up by. Slides
       the item already has are the operator's together/apart choice and are
       never replaced. */
    const reference = reading.book
      ? `${reading.book} ${reading.chapter}:${reading.verse}${reading.endVerse && reading.endVerse !== reading.verse ? `-${reading.endVerse}` : ''}`
      : item.reference ?? item.label
    const delivered = reading.version ?? version
    const apart = !item.slides?.length && (reading.verses?.length ?? 0) > 1 && breakOnVerse === true
    const slides = item.slides?.length || !reading.book || !reading.verses?.length
      ? item.slides
      : buildVerseSlides({ book: reading.book, chapter: reading.chapter, version: delivered }, reading.verses, fitRules(reading.verses, apart ? false : undefined))
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
