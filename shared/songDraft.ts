/*
 * The song editor's pure half: slide cards, what can be done to them, whether
 * anything changed, and the drafts that outlive a closed popup.
 *
 * It lives in shared/ for one reason — the renderer has no test runner, and
 * "split here lost a line" or "a draft came back as somebody else's song" are
 * exactly the bugs a church finds on Sunday. Nothing in here touches React,
 * window or the disk; the editor holds the state and the settings bridge
 * holds the bytes.
 *
 * A card keeps its words as ONE STRING, not as lines. A textarea is a string,
 * and turning it into trimmed lines on every keystroke eats the blank line
 * the operator has just typed on the way to a second stanza. Lines are made
 * once, at the edges: on the way to the projector's fit hint, and on save.
 */

import type { SongSection } from './lyricSplit'

export interface EditorCard {
  /** Stable for the life of the editing session; never stored on the song. */
  key: string
  label: string
  text: string
}

/** What the library holds for this song — what Reset goes back to. */
export interface SongBase {
  title: string
  author: string
  sections: SongSection[]
}

export interface SongDraft {
  title: string
  author: string
  cards: EditorCard[]
  /** Unedited lyrics while a new song is being split into slides. */
  sourceLyrics?: string
  /** Where the grid was scrolled to. */
  scrollTop: number
  /** The card that held the caret, and where in it. */
  focusKey: string | null
  caret: number
  updatedAt: number
  /**
   * Only on a song that is not in the library yet: the version the splitter
   * produced, so Reset and the dirty check still work after a restart, when
   * there is no stored song to compare against.
   */
  base?: SongBase
}

export type DraftMap = Record<string, SongDraft>

/** Ids of songs that exist only as a draft. */
export const NEW_PREFIX = 'new:'
export const isNewId = (id: string): boolean => id.startsWith(NEW_PREFIX)

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

let counter = 0
/** Unique within a session, which is all a React key and a focus target need. */
export function cardKey(): string {
  counter += 1
  return `c${Date.now().toString(36)}-${counter}`
}

export const linesOf = (text: string): string[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

export function sectionsToCards(sections: readonly SongSection[]): EditorCard[] {
  return sections.map((s) => ({ key: cardKey(), label: s.label, text: s.lines.join('\n') }))
}

/** Cards → what the library stores. An empty card is not a slide. */
export function cardsToSections(cards: readonly EditorCard[]): SongSection[] {
  const out: SongSection[] = []
  cards.forEach((c, i) => {
    const lines = linesOf(c.text)
    if (lines.length === 0) return
    out.push({ label: c.label.trim() || `Slide ${i + 1}`, lines })
  })
  return out
}

/**
 * "Verse 1" split in two is "Verse 1" and "Verse 1 (2)"; split again and the
 * new part is "(3)". Matches how the splitter names the parts of a long
 * section, so a hand split and a machine split read alike in the list.
 */
export function nextPartLabel(label: string, taken: readonly string[]): string {
  const stem = label.replace(/\s*\(\d+\)\s*$/, '').trim() || 'Slide'
  let n = 2
  while (taken.includes(`${stem} (${n})`)) n += 1
  return `${stem} (${n})`
}

/** Which line of `text` the caret at `offset` is on. */
export function lineAtOffset(text: string, offset: number): number {
  return text.slice(0, Math.max(0, offset)).split('\n').length - 1
}

/**
 * Cut a card in two ABOVE the caret's line: the line the caret is on starts
 * the new slide. A caret on the first line has nothing above it to leave
 * behind, so the cut moves down one; a cut that would leave either half
 * empty is refused and the list comes back untouched (same reference).
 */
export function splitCard(cards: readonly EditorCard[], index: number, caretOffset: number): EditorCard[] {
  const card = cards[index]
  if (!card) return cards as EditorCard[]
  const raw = card.text.split('\n')
  let at = lineAtOffset(card.text, caretOffset)
  if (at <= 0) at = 1
  const head = raw.slice(0, at)
  const tail = raw.slice(at)
  if (linesOf(head.join('\n')).length === 0 || linesOf(tail.join('\n')).length === 0) {
    return cards as EditorCard[]
  }
  const next = cards.slice()
  next.splice(
    index,
    1,
    { ...card, text: head.join('\n').replace(/\n+$/, '') },
    {
      key: cardKey(),
      label: nextPartLabel(card.label, cards.map((c) => c.label)),
      text: tail.join('\n').replace(/^\n+/, ''),
    },
  )
  return next
}

/** This card and the one after it become one, under this card's label. */
export function mergeWithNext(cards: readonly EditorCard[], index: number): EditorCard[] {
  const a = cards[index]
  const b = cards[index + 1]
  if (!a || !b) return cards as EditorCard[]
  const next = cards.slice()
  const text = [a.text.replace(/\n+$/, ''), b.text.replace(/^\n+/, '')].filter((t) => t.trim()).join('\n')
  next.splice(index, 2, { ...a, text })
  return next
}

export function duplicateCard(cards: readonly EditorCard[], index: number): EditorCard[] {
  const card = cards[index]
  if (!card) return cards as EditorCard[]
  const next = cards.slice()
  next.splice(index + 1, 0, { ...card, key: cardKey() })
  return next
}

/** The last card cannot be deleted — a song with no slides is not a song. */
export function deleteCard(cards: readonly EditorCard[], index: number): EditorCard[] {
  if (cards.length <= 1 || !cards[index]) return cards as EditorCard[]
  return cards.filter((_, i) => i !== index)
}

/** Move one card to a new position; out-of-range and no-op moves return the same list. */
export function moveCard(cards: readonly EditorCard[], from: number, to: number): EditorCard[] {
  if (from === to || from < 0 || to < 0 || from >= cards.length || to >= cards.length) {
    return cards as EditorCard[]
  }
  const next = cards.slice()
  next.splice(to, 0, next.splice(from, 1)[0])
  return next
}

/* ------------------------------------------------------------------ */
/* Dirty                                                               */
/* ------------------------------------------------------------------ */

const canon = (title: string, author: string, sections: readonly SongSection[]): string =>
  JSON.stringify([
    title.trim(),
    author.trim(),
    sections.map((s) => [s.label.trim(), s.lines.map((l) => l.trim()).filter(Boolean)]),
  ])

/**
 * Whether saving would change anything. Compared as it would be STORED —
 * trailing spaces, a blank line at the foot of a card and an empty card are
 * all nothing, and lighting Save for nothing teaches people to ignore it.
 */
export function isDirty(base: SongBase, now: { title: string; author: string; cards: readonly EditorCard[] }): boolean {
  return canon(base.title, base.author, base.sections) !== canon(now.title, now.author, cardsToSections(now.cards))
}

/** How many cards differ from the base, for "confirm if many edits". */
export function editCount(base: SongBase, cards: readonly EditorCard[]): number {
  const now = cardsToSections(cards)
  const len = Math.max(now.length, base.sections.length)
  let n = 0
  for (let i = 0; i < len; i += 1) {
    const a = base.sections[i]
    const b = now[i]
    if (!a || !b || canon('', '', [a]) !== canon('', '', [b])) n += 1
  }
  return n
}

/* ------------------------------------------------------------------ */
/* Drafts                                                              */
/* ------------------------------------------------------------------ */

export function putDraft(map: DraftMap, id: string, draft: SongDraft): DraftMap {
  return { ...map, [id]: draft }
}

export function dropDraft(map: DraftMap, id: string): DraftMap {
  if (!(id in map)) return map
  const next = { ...map }
  delete next[id]
  return next
}

const str = (v: unknown): v is string => typeof v === 'string'

function parseSections(v: unknown): SongSection[] | null {
  if (!Array.isArray(v)) return null
  const out: SongSection[] = []
  for (const s of v) {
    if (!s || typeof s !== 'object') return null
    const { label, lines } = s as { label?: unknown; lines?: unknown }
    if (!str(label) || !Array.isArray(lines) || !lines.every(str)) return null
    out.push({ label, lines })
  }
  return out
}

/**
 * Whatever came off disk → a map the editor can trust. Drafts are read from
 * a settings file a person can open in a text editor and from localStorage
 * that an older build may have written; one malformed entry is dropped, it
 * never takes the rest with it, and it never throws.
 */
export function parseDrafts(raw: unknown): DraftMap {
  let value = raw
  if (str(value)) {
    try {
      value = JSON.parse(value)
    } catch {
      return {}
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: DraftMap = {}
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue
    const d = entry as Record<string, unknown>
    if (!str(d.title) || !Array.isArray(d.cards) || d.cards.length === 0) continue
    const cards: EditorCard[] = []
    let ok = true
    for (const c of d.cards) {
      const card = c as Record<string, unknown> | null
      if (!card || !str(card.label) || !str(card.text)) {
        ok = false
        break
      }
      cards.push({ key: str(card.key) && card.key ? card.key : cardKey(), label: card.label, text: card.text })
    }
    if (!ok) continue
    const draft: SongDraft = {
      title: d.title,
      author: str(d.author) ? d.author : '',
      cards,
      scrollTop: typeof d.scrollTop === 'number' && Number.isFinite(d.scrollTop) ? Math.max(0, d.scrollTop) : 0,
      focusKey: str(d.focusKey) && cards.some((c) => c.key === d.focusKey) ? d.focusKey : null,
      caret: typeof d.caret === 'number' && Number.isFinite(d.caret) ? Math.max(0, d.caret) : 0,
      updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : 0,
    }
    if (str(d.sourceLyrics)) draft.sourceLyrics = d.sourceLyrics
    if (d.base && typeof d.base === 'object') {
      const b = d.base as Record<string, unknown>
      const sections = parseSections(b.sections)
      if (str(b.title) && sections) draft.base = { title: b.title, author: str(b.author) ? b.author : '', sections }
    }
    /* A draft of a song that was never saved is useless without its base:
       there would be nothing to reset to and nothing to compare against. */
    if (isNewId(id) && !draft.base) continue
    out[id] = draft
  }
  return out
}

/** Section labels and empty placeholder cards are not song content. */
export function hasSongDraftContent(draft: Pick<SongDraft, 'title' | 'author' | 'cards' | 'sourceLyrics'>): boolean {
  return Boolean(draft.title.trim() || draft.author.trim() ||
    (draft.sourceLyrics !== undefined ? draft.sourceLyrics.trim() : draft.cards.some(card => card.text.trim())))
}

/** Recovery expires thirty minutes after the editor is closed. */
export const SONG_RECOVERY_MS = 30 * 60 * 1000
export function activeDrafts(map: DraftMap, now = Date.now()): DraftMap {
  const entries = Object.entries(map).filter(([id, draft]) => (!isNewId(id) || hasSongDraftContent(draft)) && Number.isFinite(draft.updatedAt) && now - draft.updatedAt < SONG_RECOVERY_MS)
  return entries.length === Object.keys(map).length ? map : Object.fromEntries(entries)
}
