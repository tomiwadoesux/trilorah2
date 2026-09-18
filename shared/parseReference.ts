/**
 * Free-form scripture reference parsing (BUILD-MAP 2.19).
 *
 * The Live omnibox grew its own regex, and it could not see ranges — the
 * operator typing 'john 3:16-18' during a service got nothing. ProPresenter
 * users also carry the muscle memory of 'Matt 1 2 3' meaning Matthew 1:2-3,
 * where spaces alone stand in for every separator. Rather than widen that
 * regex again, the parsing lives here in shared/ so the renderer and the
 * engine's own reference resolver can agree on what a typed reference means.
 *
 * The hard part is the leading digit. In '1 cor 13:4' the 1 belongs to the
 * book and the 13 does not, but nothing about the characters themselves says
 * so — both are just digits with a space after them. The rule we use is
 * positional: a reference is an optional ordinal prefix, then the alphabetic
 * words of the book name, and only once the letters run out do digits start
 * meaning chapter and verse. So the tokenizer consumes at most one ordinal
 * (1/2/3, i/ii/iii, first/second/third) *before* any letters, takes every
 * word after it, and switches to number mode at the first digit that follows
 * a letter. '2 samuel 7 12 14' therefore splits as book '2 samuel' and
 * numbers 7, 12, 14 — never book '2' and chapter 'samuel'.
 *
 * Two deliberate leniencies, both because this runs against a live keyboard
 * mid-sermon and refusing to parse is worse than parsing generously:
 *
 * - Extra numbers are ignored, not fatal. 'john 3 16 18 20' takes the first
 *   three and drops the rest; a fumbled fourth digit should still put John
 *   3:16-18 on the screen rather than blanking the omnibox.
 * - A reversed range is swapped. 'john 3:18-16' cannot mean anything else,
 *   and the operator almost certainly typed the two ends out of order, so we
 *   read it as 16-18 instead of returning a range no lookup could satisfy.
 *
 * `partial` exists for the same reason: while the input still ends on a
 * separator the operator is mid-keystroke, and a caller can hold its search
 * for one more character instead of firing a doomed query on 'john 3:'.
 *
 * No imports — this module must stay usable from both processes.
 */

export interface ParsedReference {
  /** The book fragment as typed, e.g. '1 cor'. */
  bookQuery: string
  chapter: number | null
  verse: number | null
  endVerse: number | null
  /** True when the input ended mid-number, so a caller can debounce rather than search. */
  partial: boolean
}

/**
 * Ordinals that may precede a book name. Roman numerals stop at iii because
 * no book goes past a third; 'i' is also the only single letter here, and it
 * is safe because a real book name never *is* 'i'.
 */
const ORDINALS = new Set(['1', '2', '3', 'i', 'ii', 'iii', 'first', 'second', 'third'])

/**
 * Separators between the numbers. The two dash characters beyond ASCII are
 * the en and em dash, which is what macOS substitutes as you type and what
 * arrives when a reference is pasted from a document. The hyphen is escaped
 * because these go into a character class, where an unescaped '-' between two
 * other characters silently becomes a range instead of a literal.
 */
const DASHES = '\\-–—'
const SEPARATOR_RE = new RegExp(`[\\s.:${DASHES}]`)

/** Anything that could legally end an input while the operator is mid-type. */
const TRAILING_SEPARATOR_RE = new RegExp(`[\\s.:${DASHES}]$`)

export function parseReference(input: string): ParsedReference | null {
  if (typeof input !== 'string') return null
  const raw = input.trim()
  if (!raw) return null

  // Normalise the whitespace once so 'john   3' and 'john 3' tokenize alike.
  const text = raw.replace(/\s+/g, ' ')

  // Split into word-ish tokens, keeping separators out of the way. A token is
  // either a run of digits or a run of letters; punctuation only delimits.
  const tokens = text.match(/\d+|[a-z]+/gi)
  if (!tokens || tokens.length === 0) return null

  let i = 0
  const bookWords: string[] = []

  // An optional ordinal, but only if a letter follows it — a bare '3:16' has
  // no book and must be rejected rather than read as book '3'.
  if (ORDINALS.has(tokens[0].toLowerCase()) && tokens.length > 1 && /^[a-z]+$/i.test(tokens[1])) {
    bookWords.push(tokens[0])
    i = 1
  }

  // Letters now belong to the book until the first digit.
  const firstLetterIndex = i
  while (i < tokens.length && /^[a-z]+$/i.test(tokens[i])) {
    bookWords.push(tokens[i])
    i++
  }

  // No alphabetic part at all → not a reference ('3:16', '...', '42').
  if (i === firstLetterIndex) return null

  const numbers: number[] = []
  for (; i < tokens.length; i++) {
    if (!/^\d+$/.test(tokens[i])) {
      // Letters after the numbers started ('john 3 verse') — the numeric tail
      // has ended, and whatever follows is not ours to interpret.
      break
    }
    numbers.push(Number.parseInt(tokens[i], 10))
  }

  // Reconstruct the book fragment from the source so the caller sees what was
  // typed (spacing normalised), not our token list glued together with spaces
  // in places the operator never put one — '1john' must stay '1john'.
  const bookQuery = bookFragment(text, bookWords)

  // Overflow is ignored on purpose: three numbers are all a reference can hold.
  const [chapterRaw, verseRaw, endRaw] = numbers

  let chapter = numbers.length > 0 ? chapterRaw : null
  let verse = numbers.length > 1 ? verseRaw : null
  let endVerse = numbers.length > 2 ? endRaw : null

  // A zero chapter or verse is a typo, not a location; drop it and everything
  // that depended on it rather than inventing a lookup that cannot resolve.
  if (chapter !== null && chapter < 1) {
    chapter = null
    verse = null
    endVerse = null
  }
  if (verse !== null && verse < 1) {
    verse = null
    endVerse = null
  }
  if (endVerse !== null && endVerse < 1) endVerse = null

  // Reversed range: swap rather than reject (see module comment).
  if (verse !== null && endVerse !== null && endVerse < verse) {
    const t = verse
    verse = endVerse
    endVerse = t
  }

  // A single-verse "range" ('john 3:16-16') is just that verse.
  if (endVerse !== null && verse !== null && endVerse === verse) endVerse = null

  return {
    bookQuery,
    chapter,
    verse,
    endVerse,
    partial: isPartial(input, numbers.length)
  }
}

/**
 * The book fragment exactly as typed. We find the end of the last book word
 * in the normalised text and slice there, which preserves '1john' (no space)
 * while still collapsing '1   cor' to '1 cor'.
 */
function bookFragment(text: string, bookWords: string[]): string {
  if (bookWords.length === 0) return ''
  let cursor = 0
  for (const word of bookWords) {
    const at = text.toLowerCase().indexOf(word.toLowerCase(), cursor)
    if (at < 0) break
    cursor = at + word.length
  }
  return text.slice(0, cursor).trim()
}

/**
 * Mid-type detection. The input is partial when it ends on a separator that
 * only makes sense with something after it — a colon, a dot, a dash, or a
 * space that follows a number (the operator is reaching for the verse).
 * A trailing space after the *book* is not partial: 'john ' is still just
 * 'john', and the caller should go on offering book completions.
 */
function isPartial(input: string, numberCount: number): boolean {
  // Deliberately the untrimmed input: a trailing space is the whole signal
  // here, and trimming it away would erase the thing we are testing for.
  if (!TRAILING_SEPARATOR_RE.test(input)) return false
  if (/\s$/.test(input)) return numberCount > 0
  return true
}

/**
 * The canonical rendering: 'John 3', 'John 3:16', 'John 3:16-18'. The book
 * name comes from the caller because only it knows how the fragment resolved.
 */
export function formatParsed(p: ParsedReference, resolvedBook: string): string {
  const book = resolvedBook.trim()
  if (p.chapter === null) return book
  if (p.verse === null) return `${book} ${p.chapter}`
  if (p.endVerse === null) return `${book} ${p.chapter}:${p.verse}`
  return `${book} ${p.chapter}:${p.verse}-${p.endVerse}`
}

/** Exported for tests and for callers that want to know what counts as a break. */
export function isReferenceSeparator(ch: string): boolean {
  return SEPARATOR_RE.test(ch)
}
