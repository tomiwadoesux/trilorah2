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
 * identical answer — so it imports nothing at all, not even from shared/.
 */

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
  /** Append the translation code to the reference, e.g. 'John 3:16 · KJV'. */
  showTranslation: boolean
  /** Optional second translation shown under the first. */
  secondary?: { version: string; verses: VerseText[] } | null
  /**
   * Soft cap on characters per slide; a long verse splits across slides at a
   * sentence or clause boundary when breakOnVerse is on. 0 or undefined = no
   * splitting.
   */
  maxCharsPerSlide?: number
}

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
  if (!opts.showTranslation || !ref.version) return base
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
    // The whole reading collapses to one slide, numbers on every verse so the
    // reader can still find their place inside the blob.
    chunks.push({
      text: compose(verses, options.showVerseNumbers),
      verseStart: verses[0].verse,
      verseEnd: verses[verses.length - 1].verse
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
        lines.push({ version: secondary.version, text: compose(picked, options.showVerseNumbers) })
      }
    }

    return {
      lines,
      reference: showsReference(options.referenceMode, i, total)
        ? formatReference(ref, chunk.verseStart, chunk.verseEnd, { showTranslation: options.showTranslation })
        : null,
      verseStart: chunk.verseStart,
      verseEnd: chunk.verseEnd,
      index: i + 1,
      total
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
