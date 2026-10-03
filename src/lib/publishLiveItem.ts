import type { LiveItem } from '../design/screens/projector'

/** Await the engine's delivery before marking the operator's item live. */
export async function publishLiveItem(item: LiveItem, api = window.api): Promise<LiveItem> {
  if (!api) return item // Design sandbox has no physical outputs.
  if (item.source === 'scripture') {
    const selectedVersion = item.version ?? await api.getSetting?.('displayVersion')
    const version = typeof selectedVersion === 'string' && selectedVersion ? selectedVersion : 'KJV'
    const reading = await api.mobileVerse(item.reference ?? item.label, version, true)
    return { ...item, reference: item.reference ?? item.label, version: reading.version, text: reading.text, verses: reading.verses }
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
