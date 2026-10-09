import { descendants, Proto, readXml, rtfText } from './text'

export interface ForeignSlide { label: string; text: string; media: string[]; notes?: string }
export interface ForeignPresentation {
  title: string
  authors?: string[]
  copyright?: string
  ccliNumber?: string
  slides: ForeignSlide[]
  notes?: string
  warnings: string[]
}
export interface ForeignPlaylistItem { label: string; path?: string; arrangement?: string; header?: boolean; media?: string[] }

// Wire paths were checked against the public ProPresenter 7.16.2 descriptors.
// See FOREIGN-IMPORT.md. Unknown protobuf fields are skipped, never recursively guessed.
const uuid = (message: Proto) => message.text(1)
// These are implicit proto3 bools: false is normally absent from the wire.
// Requiring an explicit zero would accidentally reactivate disabled content.
const enabledActions = (cue: Proto) => cue.messages(10).filter(action => action.number(6))
export function proUrl(value: Proto): string {
  return value.text(1) || value.text(2) || value.message(4).text(2) || value.message(5).text(3)
}
function cueMedia(cue: Proto): string[] {
  return enabledActions(cue).flatMap(action => {
    const media = proUrl(action.message(20).message(5).message(2))
    return media ? [media] : []
  })
}
function proSlide(cue: Proto, label: string): ForeignSlide {
  const text: string[] = [], media = cueMedia(cue), notes: string[] = []
  for (const action of enabledActions(cue)) {
    const presentation = action.message(23).message(2)
    const note = presentation.message(2).buffers(1)[0]
    if (note) notes.push(rtfText(note))
    for (const wrapper of presentation.message(1).messages(1)) {
      const element = wrapper.message(1)
      if (element.number(16)) continue // hidden design elements
      const rtf = element.message(13).buffers(5)[0]
      if (rtf) text.push(rtfText(rtf))
      const fill = proUrl(element.message(9).message(3).message(2))
      if (fill) media.push(fill)
    }
  }
  return { label, text: text.join('\n').trim(), media, ...(notes.length ? { notes: notes.join('\n') } : {}) }
}

export function parsePro(buffer: Buffer, filename: string, arrangementId?: string): ForeignPresentation {
  const pro = new Proto(buffer)
  const cues = pro.messages(13)
  if (!pro.text(3) || !pro.has(2) || !cues.length) throw new Error(`${filename}: no supported ProPresenter presentation was found.`)
  if (cues.length > 10_000) throw new Error(`${filename}: too many slides.`)
  const warnings = ['ProPresenter text uses Trilorah’s styling. Slide layouts, transitions, timers, macros, and other automation are not converted.']
  if (cues.some(cue => !cue.number(12) || cue.messages(10).some(action => !action.number(6)))) warnings.push('Disabled ProPresenter slides and actions were omitted.')
  const cueById = new Map(cues.map(cue => [uuid(cue.message(1)), cue]))
  const groups = pro.messages(12).map(group => ({
    id: uuid(group.message(1).message(1)), name: group.message(1).text(2),
    cues: group.messages(2).map(uuid),
  }))
  const selected = arrangementId || uuid(pro.message(10))
  const arrangement = pro.messages(11).find(item => uuid(item.message(1)) === selected)
  if (selected && !arrangement) warnings.push('The selected arrangement was not found; the original slide order is used.')
  const groupOrder = arrangement ? arrangement.messages(3).map(uuid).map(id => {
    const group = groups.find(g => g.id === id)
    if (!group) throw new Error(`${filename}: the arrangement refers to a missing group.`)
    return group
  }) : undefined
  const ordered = groupOrder?.length ? groupOrder.flatMap(group => group.cues.map(id => {
    const cue = cueById.get(id)
    if (!cue) throw new Error(`${filename}: the arrangement refers to a missing slide.`)
    return { cue, label: group.name }
  })) : cues.map(cue => ({ cue, label: groups.find(group => group.cues.includes(uuid(cue.message(1))))?.name || cue.text(2) }))
  const slides = ordered.filter(({ cue }) => cue.number(12) && (!cue.messages(10).length || enabledActions(cue).length))
    .map(({ cue, label }, i) => proSlide(cue, label || `Slide ${i + 1}`))
  if (!slides.length) throw new Error(`${filename}: no enabled slides were found.`)
  const ccli = pro.message(14)
  return {
    title: ccli.text(3) || pro.text(3),
    authors: [...new Set([ccli.text(1), ccli.text(2)].filter(Boolean))],
    copyright: [ccli.number(5) || '', ccli.text(4)].filter(Boolean).join(' '),
    ccliNumber: ccli.number(6) ? String(ccli.number(6)) : undefined,
    notes: pro.text(7), slides, warnings,
  }
}

export function parseProPlaylist(buffer: Buffer): { title: string; items: ForeignPlaylistItem[]; warnings: string[] } {
  const playlist = new Proto(buffer)
  if (!playlist.text(2) || !playlist.has(1) || ![1, 2, 3, 4].includes(playlist.number(3))) throw new Error('This is not a supported ProPresenter playlist.')
  const items: ForeignPlaylistItem[] = [], warnings: string[] = []
  const visit = (list: Proto, depth: number) => {
    if (depth > 20) throw new Error('The playlist is nested too deeply.')
    for (const item of list.message(13).messages(1)) {
      const label = item.text(2) || 'Untitled item'
      if (item.number(9)) { warnings.push(`${label}: hidden playlist item was omitted.`); continue }
      if (item.has(3)) items.push({ label, header: true })
      else if (item.has(4)) items.push({ label, path: proUrl(item.message(4).message(1)), arrangement: uuid(item.message(4).message(2)) })
      else if (item.has(5)) {
        const cue = item.message(5)
        if (!cue.number(12)) { warnings.push(`${label}: disabled playlist cue was omitted.`); continue }
        items.push({ label, media: cueMedia(cue) })
      }
      else { items.push({ label }); warnings.push(`${label}: linked or placeholder playlist item needs review.`) }
    }
    for (const cue of list.messages(8)) {
      if (!cue.number(12)) { warnings.push('A disabled legacy playlist cue was omitted.'); continue }
      items.push({ label: cue.text(2) || 'Media cue', media: cueMedia(cue) }); warnings.push('Legacy playlist cues were imported as media or notes; review their order.')
    }
    for (const child of [...list.messages(9), ...list.message(12).messages(1)]) { items.push({ label: child.text(2) || 'Playlist', header: true }); visit(child, depth + 1) }
    if (items.length > 20_000) throw new Error('The playlist contains too many items.')
  }
  visit(playlist, 0)
  if (!items.length) throw new Error('No supported items were found in this playlist. Export a playlist with its presentations and media included.')
  return { title: playlist.text(2), items, warnings }
}

export function parsePro6(xml: string, filename: string): ForeignPresentation {
  const root = readXml(xml)
  if (!/^RVPresentationDocument$/.test(root.name)) throw new Error(`${filename}: this is not a ProPresenter 6 presentation.`)
  const groups = descendants(root, 'RVSlideGrouping')
  const originalSlides = descendants(root, 'RVDisplaySlide')
  const slides = originalSlides.filter(slide => !/^(false|0)$/i.test(slide.attrs.enabled || '')).map((slide, i) => {
    const group = groups.find(g => descendants(g, 'RVDisplaySlide').includes(slide))
    const texts = descendants(slide, 'RVTextElement').map(element => {
      const strings = descendants(element, 'NSString')
      const plain = strings.find(s => s.attrs.rvXMLIvarName === 'PlainText')
      const rtf = strings.find(s => s.attrs.rvXMLIvarName === 'RTFData')
      return plain ? Buffer.from(plain.text.trim(), 'base64').toString('utf8').replace(/\r\n?/g, '\n') : rtf ? rtfText(Buffer.from(rtf.text.trim(), 'base64')) : ''
    })
    const media = [...descendants(slide, 'RVVideoElement'), ...descendants(slide, 'RVImageElement'), ...descendants(slide, 'RVMediaCue')]
      .map(node => node.attrs.source || node.attrs.displayName || '').filter(Boolean)
    return { label: group?.attrs.name || slide.attrs.label || `Slide ${i + 1}`, text: texts.join('\n').trim(), media, notes: slide.attrs.notes }
  })
  if (!slides.length) throw new Error(`${filename}: no readable slides were found.`)
  return {
    title: root.attrs.CCLISongTitle || root.attrs.name || filename.replace(/\.pro6$/i, ''),
    authors: [...new Set(['author', 'CCLIAuthor', 'artist', 'CCLIArtistCredits'].map(key => root.attrs[key]).filter(Boolean))],
    copyright: root.attrs.CCLICopyrightInfo || [root.attrs.CCLICopyrightYear, root.attrs.CCLIPublisher].filter(Boolean).join(' '), ccliNumber: root.attrs.CCLISongNumber,
    slides, warnings: ['ProPresenter 6 text uses Trilorah’s styling and original slide order. Saved arrangements, slide layouts, effects, and automation are not converted.',
      ...(slides.length < originalSlides.length ? ['Disabled ProPresenter 6 slides were omitted.'] : [])],
  }
}
