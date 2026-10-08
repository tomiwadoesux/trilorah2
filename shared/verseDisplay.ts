/**
 * How a scripture reading is cut into slides (BUILD-MAP 2.18).
 *
 * Until now Trilorah rendered a reading as one blob — every verse of the
 * range joined with spaces, a reference line underneath. That is fine for
 * John 3:16 and awful for Romans 8:28-39, where the congregation reads a
 * wall of text and the operator has no way to walk the passage a verse at
 * a time. ProPresenter has trained church operators to expect three knobs
 * — break on new verse, show verse numbers, and where the reference sits —
 * so this module gives them the same vocabulary.
 *
 * Everything here is a decision about TEXT, never about pixels. The
 * renderer owns type size, the theme owns the background; this module only
 * answers "which words, and which reference, land on slide 3 of 5". Keeping
 * that split means the stage monitor, the projector, the QR recap page and
 * the eval harness all agree on the same slide boundaries without sharing a
 * single line of layout code.
 *
 * It lives in shared/ because both the Electron main process (which logs
 * and broadcasts slides) and the React renderer (which draws them) need the
 * identical answer — so it imports nothing but the version catalogue, which
 * itself imports nothing.
 *
 * Licensed translations (NKJV, NIV, …) carry their initials whatever the
 * theme says: the reference names the version even with "show translation"
 * off, the last slide of a reading always has its reference, and a licensed
 * second translation ends in "(NIV)". An online Bible's words also carry its
 * copyright line on every slide (`credit`). Deciding that here, not in the
 * projector, is what keeps the operator's preview and the wall identical.
 */

import { requiresInitials, versionCredit } from './bibleVersions'

export type ReferenceMode = 'each' | 'last' | 'first' | 'none'

export interface VerseText {
  verse: number
  text: string
}

export interface VerseDisplayOptions {
  /** One slide per verse, versus the whole range on one slide. */
  breakOnVerse: boolean
  /** Superscript-style verse numbers inline in the text. */
  showVerseNumbers: boolean
  /** Where the 'John 3:16' line appears across the generated slides. */
  referenceMode: ReferenceMode
  /** Append the translation code to the reference, e.g. 'John 3:16 · KJV'. A licensed version always has it. */
  showTranslation: boolean
  /** Optional second translation shown under the first. */
  secondary?: { version: string; verses: VerseText[] } | null
  /**
   * Soft cap on characters per slide; a long verse splits across slides at a
   * sentence or clause boundary when breakOnVerse is on. 0 or undefined = no
   * splitting.
   */
  maxCharsPerSlide?: number
  /**
   * When a range is shown together (breakOnVerse off): at most this many
   * words to a slide. A longer range becomes pages of whole verses, each
   * page but the last ending in CONTINUES — see pageVerses.
   */
  maxWordsPerSlide?: number
}

/**
 * How many words one slide of a reading may carry and still be read from
 * across a room (owner, 2026-10-07: "these will be on TV, nobody can read
 * these texts"). The screens shrink a page to fit its box, but never below
 * three quarters of the set size (src/lib/useFitText); on the default wall
 * about ninety words fit at that size, so eighty leaves room for a larger
 * theme. Genesis 3:3-5 is 71 words: one slide.
 */
export const PAGE_WORDS = 80

/** The end of every page of a reading but the last: there is more. */
export const CONTINUES = ' …'

export interface VerseSlide {
  /** Lines of scripture text for this slide (one entry per translation shown). */
  lines: { version: string; text: string }[]
  /** The reference line, or null when this slide shows none. */
  reference: string | null
  /** Which verses this slide covers — for the stage monitor and logging. */
  verseStart: number
  verseEnd: number
  /** 1-based position and total, so the UI can show 'slide 2 of 3'. */
  index: number
  total: number
  /**
   * The copyright line of an online Bible whose words are on this slide
   * (bibleVersions versionCredit) — every slide of it, small at the foot of
   * the screen. Absent for the bundled Bibles.
   */
  credit?: string
}

export interface VerseRef {
  book: string
  chapter: number
  version: string
}

/**
 * A thin space (U+2009) after the verse number. A normal space lets the
 * number drift away from its verse at projector type sizes, and no space at
 * all reads as part of the first word ('16For God').
 */
export const VERSE_NUMBER_SPACE = ' '

/** The separator between reference and translation code, as ProPresenter uses. */
export const TRANSLATION_SEPARATOR = ' · '

/** Boundaries we would rather split on, best first. */
const SENTENCE_BREAKS = ['. ', '? ', '! ', '; ', ': ']

// ------------------------------------------------------------- reference

export function formatReference(
  ref: VerseRef,
  verseStart: number,
  verseEnd: number,
  opts: { showTranslation: boolean }
): string {
  const span = verseEnd > verseStart ? `${verseStart}-${verseEnd}` : `${verseStart}`
  const base = `${ref.book} ${ref.chapter}:${span}`
  // A blank version code would otherwise leave a dangling separator on screen.
  if (!ref.version || (!opts.showTranslation && !requiresInitials(ref.version))) return base
  return base + TRANSLATION_SEPARATOR + ref.version
}

// --------------------------------------------------------------- chunks

/**
 * A block of text destined for one slide, remembering which verses it came
 * from. Continuation chunks of a split verse keep that verse's own range,
 * so 'John 3:16' stays right across all three of its slides.
 */
interface Chunk {
  text: string
  verseStart: number
  verseEnd: number
}

/**
 * Split one already-composed string at `max` characters, preferring a
 * sentence or clause boundary, then any space, and hard-cutting only when a
 * single word is longer than the cap. Returns the pieces in order; joining
 * them reproduces the input exactly, so nothing is ever lost or doubled —
 * the property the round-trip test pins down.
 */
export function splitText(text: string, max: number): string[] {
  if (!Number.isFinite(max) || max <= 0 || text.length <= max) return [text]
  const out: string[] = []
  let rest = text
  while (rest.length > max) {
    const window = rest.slice(0, max)
    let cut = -1
    for (const mark of SENTENCE_BREAKS) {
      // The break belongs to the piece we are closing, hence + mark.length.
      const at = window.lastIndexOf(mark)
      if (at >= 0 && at + mark.length > cut) cut = at + mark.length
    }
    if (cut <= 0) {
      const space = window.lastIndexOf(' ')
      cut = space > 0 ? space + 1 : max
    }
    out.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  // A trailing empty remainder would be an empty slide; the loop only exits
  // with rest.length <= max, and rest is empty only if the text was empty.
  if (rest.length > 0) out.push(rest)
  if (out.length === 0) out.push(text)
  return out
}

export type VersePart = { kind: 'text'; text: string } | { kind: 'verse'; verse: string }

/**
 * A composed line cut into words and verse numbers, so a screen can raise
 * the numbers the way a printed Bible does (owner, 2026-10-07: "space, then
 * 12 at the top, then continue that sentence"). A verse number is the one
 * thing compose() follows with VERSE_NUMBER_SPACE, so that space is the
 * mark: it is consumed here, and the raised number sits directly before
 * its verse's first word. The space BEFORE the number — between one verse
 * and the next — stays in the words.
 */
export function splitVerseNumbers(text: string): VersePart[] {
  const parts: VersePart[] = []
  const mark = new RegExp(`(^|\\s)(\\d{1,3})${VERSE_NUMBER_SPACE}`, 'g')
  let at = 0
  for (const m of text.matchAll(mark)) {
    const start = (m.index ?? 0) + m[1].length
    if (start > at) parts.push({ kind: 'text', text: text.slice(at, start) })
    parts.push({ kind: 'verse', verse: m[2] })
    at = start + m[2].length + VERSE_NUMBER_SPACE.length
  }
  if (at < text.length) parts.push({ kind: 'text', text: text.slice(at) })
  return parts
}

const wordsIn = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

/**
 * Whole verses into the fewest pages of at most `max` words, the pages as
 * even as they can be — Psalm 119:1-16 as four pages of four verses, not
 * three full pages and a verse on its own. A verse longer than `max` is a
 * page by itself; it is never cut.
 */
export function pageVerses(verses: VerseText[], max: number): VerseText[][] {
  const counts = verses.map((v) => wordsIn(v.text))
  const total = counts.reduce((a, b) => a + b, 0)
  if (!(max > 0) || total <= max) return [verses]
  const target = total / Math.ceil(total / max)
  const pages: VerseText[][] = []
  let page: VerseText[] = []
  let words = 0
  verses.forEach((verse, i) => {
    const w = counts[i]
    const over = words + w > max
    const further = Math.abs(words + w - target) > Math.abs(words - target)
    if (page.length && (over || (words >= target * 0.75 && further))) {
      pages.push(page)
      page = []
      words = 0
    }
    page.push(verse)
    words += w
  })
  if (page.length) pages.push(page)
  return pages
}

function compose(verses: VerseText[], showVerseNumbers: boolean): string {
  return verses
    .map((v) => (showVerseNumbers ? `${v.verse}${VERSE_NUMBER_SPACE}${v.text}` : v.text))
    .join(' ')
}

// ---------------------------------------------------------------- slides

export function buildVerseSlides(
  ref: VerseRef,
  verses: VerseText[],
  options: VerseDisplayOptions
): VerseSlide[] {
  if (verses.length === 0) return []

  const max = options.maxCharsPerSlide && options.maxCharsPerSlide > 0 ? options.maxCharsPerSlide : 0
  const chunks: Chunk[] = []

  if (!options.breakOnVerse) {
    // The whole reading together, numbers on every verse so the reader can
    // still find their place in it — on one slide while it can be read from
    // the back, otherwise on pages of whole verses (pageVerses).
    const pages = options.maxWordsPerSlide ? pageVerses(verses, options.maxWordsPerSlide) : [verses]
    pages.forEach((page, i) => {
      chunks.push({
        text: compose(page, options.showVerseNumbers) + (i < pages.length - 1 ? CONTINUES : ''),
        verseStart: page[0].verse,
        verseEnd: page[page.length - 1].verse
      })
    })
  } else {
    for (const v of verses) {
      const composed = compose([v], options.showVerseNumbers)
      // Splitting only happens under breakOnVerse: without it the operator
      // has explicitly asked for one slide, and silently making three would
      // surprise them mid-service.
      for (const piece of max ? splitText(composed, max) : [composed]) {
        chunks.push({ text: piece, verseStart: v.verse, verseEnd: v.verse })
      }
    }
  }

  const secondary = options.secondary ?? null
  const secondaryByVerse = new Map<number, VerseText>()
  if (secondary) for (const v of secondary.verses) secondaryByVerse.set(v.verse, v)

  const total = chunks.length
  return chunks.map((chunk, i) => {
    const lines: { version: string; text: string }[] = [{ version: ref.version, text: chunk.text }]

    if (secondary) {
      const picked: VerseText[] = []
      for (let n = chunk.verseStart; n <= chunk.verseEnd; n++) {
        const hit = secondaryByVerse.get(n)
        if (hit) picked.push(hit)
      }
      // A ragged secondary translation (missing verse, shorter book) simply
      // drops its line rather than throwing or showing an empty row.
      if (picked.length > 0) {
        const text = compose(picked, options.showVerseNumbers)
        lines.push({
          version: secondary.version,
          // The second line has no reference of its own to carry the initials.
          text: requiresInitials(secondary.version) ? `${text} (${secondary.version})` : text
        })
      }
    }

    /* A licensed reading may not end without saying whose words they were,
       so its last slide keeps the reference whatever referenceMode says. */
    const cited = requiresInitials(ref.version) && i === total - 1
    /* An online Bible's words carry its copyright line on every slide they
       are on — the second translation's too, when it has a line here. */
    const credit = [...new Set(lines.map((line) => versionCredit(line.version)).filter((c): c is string => !!c))].join(' · ')
    return {
      lines,
      reference: showsReference(options.referenceMode, i, total) || cited
        ? formatReference(ref, chunk.verseStart, chunk.verseEnd, { showTranslation: options.showTranslation })
        : null,
      verseStart: chunk.verseStart,
      verseEnd: chunk.verseEnd,
      index: i + 1,
      total,
      ...(credit ? { credit } : {})
    }
  })
}

/**
 * Reference placement is decided by SLIDE position, not by verse — a verse
 * split over three slides in 'first' mode shows its reference once, on the
 * first slide of the reading.
 */
export function showsReference(mode: ReferenceMode, index: number, total: number): boolean {
  switch (mode) {
    case 'each':
      return true
    case 'first':
      return index === 0
    case 'last':
      return index === total - 1
    case 'none':
      return false
  }
}
