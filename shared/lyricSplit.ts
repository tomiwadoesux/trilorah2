/**
 * How a song's lyrics are cut into projector slides.
 *
 * Lyrics reach Trilorah four ways — pasted, imported from a file, lifted from
 * YouTube captions, fetched from a lyrics API — and only the first two tend
 * to arrive with the blank lines a human would put between verses. Captions
 * and API text are routinely ONE block of thirty lines. The existing parser
 * (electron/songs/import.ts, parsePlainText) splits on blank lines and reads
 * "Verse 1" / "Chorus" label lines, which is right for a tidy file and
 * useless for a wall of text: a thirty-line "Verse 1" is not a slide. This
 * module is the second pass. It produces the same `{ label, lines }` shape,
 * so its output drops straight into the song store, but every section it
 * returns is small enough to project.
 *
 * It is a FIRST DRAFT for a human. The operator fixes the slides in an editor
 * afterwards, so the goal is not to be clever, it is to be unsurprising: get
 * the cut right nine times in ten, and never do anything the operator has to
 * undo before they can start (lose a line, reorder one, merge two verses).
 *
 * The rules, and why each exists:
 *
 * - About four lines a slide, sometimes three. Four is what reads from the
 *   back row at the type sizes churches use; three is what you get when the
 *   arithmetic does not divide.
 *
 * - Never a one-line tail. Cutting greedily in fours turns a five-line verse
 *   into 4+1, and that orphaned last line is on screen for two seconds while
 *   the operator scrambles for the next slide. So the cut is chosen for the
 *   whole section at once (a small dynamic programme, not a greedy walk):
 *   5 → 3+2, 6 → 3+3, 9 → 3+3+3, 10 → 4+3+3.
 *
 * - Balance by how it is SUNG, not by line count. Two slides of four lines
 *   are not equal if one is "Holy / Holy / Holy / Lord" and the other is four
 *   long hymn lines; the congregation spends four times as long on the
 *   second. Time on screen tracks syllables far better than characters (a
 *   held "Ho-ly" is two beats however it is spelled), so each line gets a
 *   cheap syllable estimate and each slide a syllable budget. The estimate is
 *   a vowel-group count with a silent-e rule — wrong on individual words,
 *   right enough in aggregate, and above all deterministic: the same text
 *   must always cut the same way or the editor's "re-split" button becomes a
 *   slot machine. Two very long lines on a slide is fine, four very short
 *   ones is fine; what the budget prevents is two short lines followed by a
 *   bulky four when 3+3 was available.
 *
 * - Blank lines and label lines are HARD breaks. The author (or the API)
 *   told us where the verse ends; a slide that straddles the end of verse 2
 *   and the start of the chorus is the one mistake an operator cannot forgive
 *   because the band stops there and the screen does not. For the same reason
 *   a chorus that appears three times stays three sections — the slide list
 *   is a running order, not a set of unique parts.
 *
 * - Clean on the way in. Chord lines and inline [Am] chords are for the band,
 *   not the wall. "[Chorus]" is a label wearing brackets. "x2" and "(repeat)"
 *   are instructions, not words to sing, so they become a `repeat` hint the
 *   editor can show as a badge. Lyrics sites leave debris ("Embed", "You
 *   might also like") that would otherwise be projected verbatim.
 *
 * Every part of a cut section is labelled "Verse 1", "Verse 1 (2)",
 * "Verse 1 (3)": the first part keeps the bare label so an uncut song looks
 * exactly as it did before this module existed, and the suffix sorts and
 * reads naturally in a slide list.
 *
 * The output is a fixed point: write the sections back out with
 * `sectionsToText` and split again and nothing moves. That is what lets the
 * editor re-run the splitter on text the operator has already corrected
 * without fear. It falls out of the cost function being purely local to each
 * slide (no "average slide size" term), and costs being integers so that no
 * floating-point near-tie can flip between runs.
 *
 * Title detection is deliberately not here; parsePlainText owns that.
 *
 * No imports, not even `import type` — shared/ modules load in both the
 * Electron main process and the renderer. `SongSection` below mirrors the
 * interface of the same name in shared/types.ts (and electron/songs/
 * import.ts); `repeat` is an optional extra, so a value of this type is
 * assignable to theirs.
 */

/** Mirrors SongSection in shared/types.ts, plus the optional repeat hint. */
export interface SongSection {
  label: string
  lines: string[]
  /** Times this slide is sung in a row, from an "x2" / "(repeat)" marker. Absent = once. */
  repeat?: number
}

export interface SplitOptions {
  /** Most lines a slide may hold. Default 4. */
  maxLines?: number
  /** Fewest lines a slide should hold unless the section itself is shorter. Default 2. */
  minLines?: number
  /** Most sung syllables a slide should hold. Default SYLLABLE_BUDGET. */
  syllableBudget?: number
}

export type Fit = 'fits' | 'tight' | 'over'

export interface SlideFit {
  lines: number
  syllables: number
  chars: number
  fit: Fit
}

/** Four lines reads from the back row; five does not. */
export const MAX_LINES = 4
/** Below two lines a slide is a flash card — the operator cannot keep up. */
export const MIN_LINES = 2
/**
 * Four ordinary worship-song lines run 7–10 syllables each, so 40 admits a
 * full slide of normal lines and refuses a full slide of long hymn lines
 * ("Great is Thy faithfulness, O God my Father" is 11 on its own).
 */
export const SYLLABLE_BUDGET = 40
/** Characters are the projector's limit rather than the singer's: past this, type shrinks. */
export const MAX_CHARS = 180
/** Share of a budget at which the editor should start warning ("tight"). */
export const TIGHT_RATIO = 0.85

/* ------------------------------------------------------------------ */
/* Syllables                                                           */
/* ------------------------------------------------------------------ */

/** Spoken syllables of each digit, so "10,000 Reasons" is not counted as silent. */
const DIGIT_SYLLABLES = [2, 1, 1, 1, 1, 1, 1, 2, 1, 1]

function wordSyllables(raw: string): number {
  let count = 0
  for (const d of raw.match(/\d/g) ?? []) count += DIGIT_SYLLABLES[Number(d)]

  // Apostrophes are dropped rather than treated as vowels or breaks: in lyrics
  // they almost always mark a syllable the writer REMOVED to fit the metre
  // ("heav'n", "ev'ry", "o'er"), so closing the gap gives the sung count.
  //
  // Accents are folded first (NFD, then drop the combining marks) because
  // churches sing in more than English: Yoruba "Olúwa" must keep its ú.
  const w = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '')
  if (!w) {
    // Another script entirely. No vowel rule applies, but the line still takes
    // time to sing; half the letters is crude and keeps such lines comparable.
    const letters = (raw.match(/\p{L}/gu) ?? []).length
    return count + Math.ceil(letters / 2)
  }

  let n = (w.match(/[aeiouy]+/g) ?? []).length
  // Silent final e ("grace", "love") — but not "-le" after a consonant
  // ("people", "humble"), where the e is the only vowel the syllable has.
  if (n > 1 && /e$/.test(w) && !/[^aeiouy]le$/.test(w)) n--
  // "-ed" is silent except after t/d ("loved" vs "lifted"). Hymns do sing
  // "bless-ed"; one syllable either way never moves a slide boundary alone.
  else if (n > 1 && /[^aeiouytd]ed$/.test(w)) n--
  return count + Math.max(1, n)
}

/**
 * Rough sung-syllable count for one lyric line. A vowel-group heuristic: it
 * will miscount single words ("glorious" → 2), but slide balance only needs
 * lines to be comparable with each other, and it is stable across runs.
 */
export function estimateSyllables(line: string): number {
  let total = 0
  for (const word of line.split(/[\s\-–—/]+/)) if (word) total += wordSyllables(word)
  return total
}

/* ------------------------------------------------------------------ */
/* Fit                                                                 */
/* ------------------------------------------------------------------ */

interface Limits {
  maxLines: number
  minLines: number
  syllableBudget: number
}

function limits(opts?: SplitOptions): Limits {
  const whole = (v: number | undefined, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 1 ? Math.floor(v) : fallback
  const maxLines = whole(opts?.maxLines, MAX_LINES)
  return {
    maxLines,
    // A minimum above the maximum is unsatisfiable; clamp instead of throwing,
    // because this is fed by a settings slider.
    minLines: Math.min(whole(opts?.minLines, MIN_LINES), maxLines),
    syllableBudget: whole(opts?.syllableBudget, SYLLABLE_BUDGET)
  }
}

/**
 * The editor's live hint for one slide. 'over' means the splitter itself
 * would not have produced this slide; 'tight' means it would, but only just.
 * Line count alone never makes a slide tight — a full four short lines is
 * the normal case, not a warning.
 */
export function slideFit(lines: string[], opts?: SplitOptions): SlideFit {
  const lim = limits(opts)
  const kept = lines.filter((l) => l.trim())
  const syllables = kept.reduce((sum, l) => sum + estimateSyllables(l), 0)
  const chars = kept.reduce((sum, l) => sum + l.trim().length, 0)
  let fit: Fit = 'fits'
  if (kept.length > lim.maxLines || syllables > lim.syllableBudget || chars > MAX_CHARS) fit = 'over'
  else if (syllables > lim.syllableBudget * TIGHT_RATIO || chars > MAX_CHARS * TIGHT_RATIO) fit = 'tight'
  return { lines: kept.length, syllables, chars, fit }
}

/* ------------------------------------------------------------------ */
/* The cut                                                             */
/* ------------------------------------------------------------------ */

/**
 * Cost of putting `count` lines totalling `syllables` on one slide. Integer,
 * and a function of this slide ALONE — both properties are what make the
 * splitter a fixed point on its own output (see the header).
 *
 * The scale, in thousandths:
 * - Each line short of full costs triangularly (0, 1, 3, 6 …). That single
 *   curve yields every line-count preference the owner asked for: 3+3+3 (3)
 *   beats 4+3+2 (4), 3+3 (2) beats 4+2 (3), 4+3+3 beats 4+4+2.
 * - A slide under minLines costs more than any realistic section's total, so
 *   it appears only when arithmetic forces it (a one-line section).
 * - Over budget starts at 8 — more than the 6 it costs to break a four into
 *   2+2 — so an over-full slide is always split when it can be.
 * - The squared-share term is the balance: for a fixed total, a sum of
 *   squares is smallest when the parts are equal, so it chooses 3+4 over 4+3
 *   when the first lines are the long ones. It is weighted low enough never
 *   to buy an extra slide on its own.
 */
function slideCost(count: number, syllables: number, lim: Limits): number {
  const short = lim.maxLines - count
  let cost = (short * (short + 1)) / 2
  if (count < lim.minLines) cost += 1000
  const share = syllables / lim.syllableBudget
  if (share > 1) cost += 8 + 10 * (share - 1)
  cost += 2 * share * share
  return Math.round(cost * 1000)
}

/** Slide sizes, in order, for a run of lines that must stay together as one section. */
function partition(lines: string[], lim: Limits): number[] {
  const n = lines.length
  if (n === 0) return []
  const prefix = [0]
  for (const l of lines) prefix.push(prefix[prefix.length - 1] + estimateSyllables(l))

  const best: number[] = [0]
  const take: number[] = [0]
  for (let end = 1; end <= n; end++) {
    best[end] = Infinity
    take[end] = 1
    // Largest first with a strict '<': on an exact tie the fuller slide wins,
    // here and on any later re-split of that slide by itself.
    for (let k = Math.min(lim.maxLines, end); k >= 1; k--) {
      const cost = best[end - k] + slideCost(k, prefix[end] - prefix[end - k], lim)
      if (cost < best[end]) {
        best[end] = cost
        take[end] = k
      }
    }
  }
  const sizes: number[] = []
  for (let end = n; end > 0; end -= take[end]) sizes.unshift(take[end])
  return sizes
}

/** "Verse 1" → part 1; "Verse 1 (3)" → base "Verse 1", part 3. */
function splitPartSuffix(label: string): { base: string; part: number } {
  const m = label.match(/^(.*\S)\s*\((\d+)\)$/)
  return m ? { base: m[1], part: Number(m[2]) } : { base: label, part: 1 }
}

function partLabel(label: string, index: number): string {
  if (index === 0) return label
  const { base, part } = splitPartSuffix(label)
  return `${base} (${part + index})`
}

/**
 * Re-cut one section that is too long for a slide. Lines are taken as they
 * are — no clean-up — so this composes with any importer's output. A section
 * that already fits comes back alone and unchanged. A `repeat` hint stays
 * with the LAST part: "sing it again" is something you learn at the end.
 */
export function resliceSection(section: SongSection, opts?: SplitOptions): SongSection[] {
  const lines = section.lines.map((l) => l.trim()).filter(Boolean)
  const sizes = partition(lines, limits(opts))
  const out: SongSection[] = []
  let at = 0
  sizes.forEach((size, i) => {
    out.push({ label: partLabel(section.label, i), lines: lines.slice(at, at + size) })
    at += size
  })
  if (out.length && section.repeat && section.repeat > 1) out[out.length - 1].repeat = section.repeat
  return out
}

/* ------------------------------------------------------------------ */
/* Clean-up                                                            */
/* ------------------------------------------------------------------ */

/**
 * The same vocabulary as LABEL_LINE in electron/songs/import.ts, so both
 * passes agree on what a label is — plus an optional "(2)" part suffix, which
 * is how this module's own output is read back in.
 */
const LABEL =
  /^(verse|chorus|bridge|pre[- ]?chorus|intro|outro|tag|ending|interlude|refrain|vamp|coda)\s*(\d+[a-z]?)?\s*(?:\((\d+)\))?\s*:?$/i

function readLabel(text: string): string | null {
  const m = text.trim().match(LABEL)
  if (!m) return null
  const kind = m[1].toLowerCase().replace(/pre[- ]?chorus/, 'pre-chorus')
  let name = kind.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('-')
  if (m[2]) name += ` ${m[2]}`
  if (m[3]) name += ` (${m[3]})`
  return name
}

/** One chord symbol: G, F#m7, Bbmaj7, Dsus4, A/C#, N.C. — and bar lines between them. */
const CHORD = /^(?:[A-G][#b♯♭]?(?:maj|min|dim|aug|sus|add|m|M)?\d{0,2}(?:(?:sus|add)\d{1,2})?(?:\/[A-G][#b♯♭]?)?|N\.?C\.?|[|\-–%]+)$/

function isChordLine(line: string): boolean {
  const tokens = line.split(/\s+/).filter(Boolean)
  return tokens.length > 0 && tokens.every((t) => CHORD.test(t))
}

/**
 * A trailing (or whole-line) repeat marker: x2, 2x, ×3, (x2), [2x], (repeat),
 * (repeat x2). Bare "repeat" needs its brackets — "pray on repeat" is a lyric.
 */
const REPEAT =
  /(?:^|\s+)(?:[([]\s*(?:repeat\s*)?(?:[x×]\s*(\d+)|(\d+)\s*[x×])\s*[)\]]|(?:[x×](\d+)|(\d+)[x×])|[([]\s*repeat\s*[)\]])\s*$/i

function takeRepeat(line: string): { text: string; repeat: number } {
  const m = line.match(REPEAT)
  if (!m) return { text: line, repeat: 0 }
  const n = Number(m[1] ?? m[2] ?? m[3] ?? m[4] ?? 2)
  // "x1" and "x0" are noise; a three-digit count is a typo, not a liturgy.
  return { text: line.slice(0, m.index).trim(), repeat: n >= 2 && n <= 99 ? n : 0 }
}

/** Debris lyrics sites and caption tracks leave around the words. */
const JUNK = [
  /^lyrics$/i,
  /^\d*\s*embed$/i,
  /^you might also like$/i,
  /^\d+\s+contributors?\b/i,
  /^translations?$/i,
  /^see .+ live$/i,
  /^get tickets as low as\b/i,
  /^[^\p{L}\p{N}]*$/u, // nothing singable in ANY script: "♪ ♪", "---", "***"
  /^\((?:repeat|instrumental|music|applause)\b[^)]*\)$/i // "(Repeat Chorus)" is a stage direction
]

type Cleaned =
  | { kind: 'break' }
  | { kind: 'skip'; repeat: number }
  | { kind: 'label'; label: string; repeat: number }
  | { kind: 'line'; text: string; repeat: number }

function cleanLine(raw: string): Cleaned {
  let s = raw.replace(/[♪♫♬]|^\s*>>+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!s) return { kind: 'break' }

  // A line that is ONE bracket is structure, never lyric: a label if we know
  // the word ("[Verse 1: Chris Tomlin]"), a repeat, a chord, or else a stage
  // direction ("[Instrumental]", "[Music]") — which still ends the section.
  const whole = s.match(/^\[([^\]]*)\]$/)
  if (whole) {
    const marked = takeRepeat(s)
    if (!marked.text && marked.repeat) return { kind: 'skip', repeat: marked.repeat }
    const inner = takeRepeat(whole[1].split(':')[0].trim())
    const label = readLabel(inner.text)
    if (label) return { kind: 'label', label, repeat: inner.repeat }
    return CHORD.test(whole[1].trim()) ? { kind: 'skip', repeat: 0 } : { kind: 'break' }
  }

  if (isChordLine(s)) return { kind: 'skip', repeat: 0 }

  const marked = takeRepeat(s)
  s = marked.text
  // Whatever is still in square brackets mid-line is a chord or an aside.
  s = s.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()
  // Genius glues its footer onto the last lyric: "…my soul sings123Embed".
  s = s.replace(/\d*Embed$/, '').trim()

  if (!s) return { kind: 'skip', repeat: marked.repeat }
  const label = readLabel(s)
  if (label) return { kind: 'label', label, repeat: marked.repeat }
  if (JUNK.some((re) => re.test(s))) return { kind: 'skip', repeat: marked.repeat }
  return { kind: 'line', text: s, repeat: marked.repeat }
}

/* ------------------------------------------------------------------ */
/* splitLyrics                                                         */
/* ------------------------------------------------------------------ */

interface Block {
  label: string | null
  lines: string[]
  /** Per-line repeat, parallel to `lines`, so the hint lands on the right slide. */
  lineRepeat: number[]
  /** From the label line ("Chorus x2") or a marker before any lyric. */
  repeat: number
}

const blockKey = (b: Block) => b.lines.join('\n').toLowerCase().replace(/[^\p{L}\p{N}\n]/gu, '')

/**
 * Raw lyric text → slide-sized sections, in singing order.
 *
 * Unlabelled blocks are numbered "Verse N", skipping any number the text
 * already uses. One exception: an unlabelled block that comes round again
 * word for word is called "Chorus" — that is what a repeated block IS, and
 * "Verse 2 / Verse 4" for the same words reads as a bug in a slide list. It
 * only happens when the text names no chorus of its own.
 */
export function splitLyrics(text: string, opts?: SplitOptions): SongSection[] {
  const lim = limits(opts)
  const blocks: Block[] = []
  let current: Block | null = null
  const open = (label: string | null, repeat = 0): Block => {
    const block: Block = { label, lines: [], lineRepeat: [], repeat }
    blocks.push(block)
    return block
  }

  for (const raw of String(text ?? '').replace(/\r\n?|[\u2028\u2029]/g, '\n').split('\n')) {
    const c = cleanLine(raw)
    if (c.kind === 'break') current = null
    else if (c.kind === 'label') current = open(c.label, c.repeat)
    else if (c.kind === 'line') {
      current = current ?? open(null)
      current.lines.push(c.text)
      current.lineRepeat.push(c.repeat)
    } else if (c.repeat && current) {
      // A marker on a line of its own belongs to what was just sung — or, if
      // nothing has been sung yet, to the section it sits at the top of.
      const last = current.lines.length - 1
      if (last >= 0) current.lineRepeat[last] = Math.max(current.lineRepeat[last], c.repeat)
      else current.repeat = Math.max(current.repeat, c.repeat)
    }
  }

  const filled = blocks.filter((b) => b.lines.length > 0)

  const used = new Set(filled.map((b) => (b.label ? splitPartSuffix(b.label).base : '')))
  const seen: Record<string, number> = {}
  for (const b of filled) if (!b.label) seen[blockKey(b)] = (seen[blockKey(b)] ?? 0) + 1
  const nameChorus = ![...used].some((l) => /^chorus\b/i.test(l))

  let verse = 0
  const out: SongSection[] = []
  for (const b of filled) {
    let label = b.label
    if (!label && nameChorus && seen[blockKey(b)] > 1) label = 'Chorus'
    if (!label) {
      do verse++
      while (used.has(`Verse ${verse}`))
      label = `Verse ${verse}`
    }

    const sizes = partition(b.lines, lim)
    let at = 0
    sizes.forEach((size, i) => {
      const part: SongSection = { label: partLabel(label as string, i), lines: b.lines.slice(at, at + size) }
      let repeat = Math.max(0, ...b.lineRepeat.slice(at, at + size))
      if (i === sizes.length - 1) repeat = Math.max(repeat, b.repeat)
      if (repeat > 1) part.repeat = repeat
      out.push(part)
      at += size
    })
  }
  return out
}

/**
 * Sections → the plain text the editor shows, in the form `splitLyrics` (and
 * parsePlainText) read back: a label line, the lyric lines, a blank line.
 * `splitLyrics(sectionsToText(s))` returns `s` for any `s` this module made.
 */
export function sectionsToText(sections: SongSection[]): string {
  return sections
    .map((s) => [s.repeat && s.repeat > 1 ? `${s.label} x${s.repeat}` : s.label, ...s.lines].join('\n'))
    .join('\n\n')
}
