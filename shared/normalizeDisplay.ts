/**
 * Speech as it is SPOKEN, turned into speech as it should be READ.
 *
 * Whisper hands us an unbroken lowercase ribbon — 'so paul writes here um
 * turn with me to first corinthians chapter thirteen verse four'. That is a
 * faithful record of the audio and a poor thing to put on a projector. This
 * module is the one place that decides what the congregation actually sees:
 * a leading capital, no throat-clearing, and the sermon's citations rendered
 * as the symbol every literate churchgoer recognises before they have
 * finished reading it — '1 Corinthians 13:4'.
 *
 * WHY IT IS SO NARROW. The owner's constraint governs everything below: when
 * the preacher is reading a verse aloud, his wording must not be touched. Not
 * 'threescore and ten' to 70, not 'a hundred pence' to '$100'. Earlier drafts
 * of this feature carried six rules and leaned on a runtime gate to switch
 * the dangerous ones off mid-service. The gate turned out to measure topic
 * rather than reading, so four of the six rules were cut instead, and the
 * constraint now holds BY CONSTRUCTION: not one shipped rule can change which
 * words were said. Two only recase; the third only converts a spoken citation,
 * a token shape that cannot occur inside verse text because verse text does
 * not cite itself. `reading` is still threaded through and still filters on
 * RuleClass — so the day someone adds a rule that does touch wording, it is
 * suppressed during Scripture without anyone having to remember.
 *
 * WHY IT IS PURE, AND WHY `reading` IS A PARAMETER. Deciding whether the
 * preacher is mid-verse means reading the intent engine, the display timer and
 * the projector's screen state together — three stateful engine modules this
 * file must never see. So the caller owns that messy judgement and passes its
 * one-word conclusion in. The same inversion applies to numbers and book
 * names: both arrive as injected functions built from the resolver's own
 * tables, so the display layer speaks whatever language the resolver speaks
 * and there is no second copy of either table to drift.
 *
 * WHY IT LIVES IN shared/. The result travels to three surfaces that share no
 * code: the Electron main process logs and broadcasts it, the React LIVE panel
 * draws it for the operator, and the companion page renders it on the
 * congregation's phones. All three must agree on the same string and the same
 * span boundaries, so this module imports nothing at all — not even from
 * shared/ — and holds no state between calls.
 *
 * WHY SPANS RATHER THAN MARKUP. The companion renders its text as a React
 * text node on an unauthenticated public page; inline markup there would mean
 * dangerouslySetInnerHTML in front of a congregation. So an uncertain
 * conversion is structure, not syntax: each span carries its own text, the raw
 * text it replaced, and its offsets back into the original. Each surface
 * decides independently how (or whether) to show the mark, and `raw` is always
 * recoverable — joining `raw ?? text` across the spans reproduces the input
 * byte for byte, which is the invariant everything else here rests on.
 */

// ------------------------------------------------------------------- marks

/**
 * Certainty of a rewrite. Two levels, not three: a rule author reaching for a
 * third is really asking for a second rule.
 */
export type MarkLevel = 'certain' | 'uncertain'

/** The rules that ship. Three. Adding a fourth is a design decision, not a patch. */
export type RuleId = 'filler' | 'scripture-ref' | 'sentence-case'

/**
 * Rules split by whether they can touch WORDING — this is the mechanism that
 * enforces the owner's constraint, so the distinction is worth stating exactly.
 *
 * 'orthographic' — casing, or the removal of a non-word. Cannot change which
 *                  words were said, so it runs while inert. The owner blessed
 *                  this directly: it should appear as it actually is, with
 *                  proper capital letters, but the wording left exactly alone.
 * 'reference'    — converts a SPOKEN CITATION to its canonical form. Runs
 *                  while inert, because the trigger shape (a book alias, then
 *                  the literal word 'chapter' or 'verse', then a parsed
 *                  number) cannot occur inside verse text. There is exactly
 *                  one member, and adding a second requires that same
 *                  structural argument made in writing.
 * 'lexical'      — replaces words with other words or symbols. SUPPRESSED
 *                  while inert. A new rule is lexical by default, so a new
 *                  rule is suppressed by default.
 *
 * There are currently zero rules of class 'lexical'. The pipeline's inert
 * filter is kept anyway, precisely so the day someone adds one it is already
 * off during Scripture. Do not delete that branch as dead code.
 */
export type RuleClass = 'orthographic' | 'reference' | 'lexical'

/**
 * One contiguous piece of the display line.
 *
 * `raw` is present ONLY when it differs from `text`, so `span.raw === undefined`
 * is the fast "nothing happened here" test both renderers use. `start`/`end`
 * are half-open offsets into the RAW string, which makes the mapping
 * recoverable in both directions — that round trip is the module's first
 * invariant and it must never go red.
 */
export interface DisplaySpan {
  text: string
  raw?: string
  start: number
  end: number
  /** Absent on untouched spans and on 'certain' conversions. */
  mark?: MarkLevel
  rule?: RuleId
}

export interface NormalizedLine {
  /**
   * The input, untouched. Kept inside the result so nobody two years from now
   * feeds a normalized string back into the reference resolver.
   */
  raw: string
  /** Always exactly spans.map((s) => s.text).join(''). Precomputed. */
  text: string
  spans: DisplaySpan[]
  hasUncertain: boolean
  /** True when no lexical rule was permitted to run — see ReadingState. */
  inert: boolean
  /**
   * Whether this line ends on sentence-terminal punctuation. The caller keeps
   * it and threads it back in as the next line's `atSentenceStart`, which is
   * how a pure function participates in a running transcript.
   */
  endsSentence: boolean
}

/**
 * Whether the preacher is READING SCRIPTURE right now.
 *
 * It does not select WHICH rules run — it decides whether any LEXICAL rule
 * runs at all. 'maybe' collapses to 'reading'. That is the whole safety
 * argument: over-suppressing leaves a phrase as spoken words for one line,
 * which nobody notices; under-suppressing rewrites Scripture on a projector in
 * front of a congregation. Those costs are not comparable, so all doubt goes
 * inert.
 *
 *  'no'      — ordinary preaching. Every enabled rule runs.
 *  'maybe'   — hysteresis tail after a reading, or the signals disagree.
 *  'reading' — a verse is being read aloud.
 *
 * 'maybe' is a separate value only so the operator log and the eval harness
 * can tell hysteresis from a confirmed reading.
 */
export type ReadingState = 'no' | 'maybe' | 'reading'

/**
 * Signature is EXACTLY parseSpokenNumber's, so main.ts passes
 * makePackNumberParser(pack) and the display layer inherits the resolver's
 * language pack with no extra tables. `words` is the lowercased token stream;
 * the return mirrors the resolver's own { value, consumed } shape so the two
 * feel like one system.
 */
export type SpokenNumberParser = (
  words: string[],
  i: number
) => { value: number; consumed: number } | null

/**
 * Canonical book lookup, injected from the SAME alias table the resolver
 * builds (sorted longest-first, so '1 john' beats 'john'). Returns the
 * canonical name — '1 Corinthians', 'Psalms' — and how many tokens it ate.
 */
export type BookMatcher = (
  lowerWords: readonly string[],
  i: number
) => { canonical: string; consumed: number } | null

export interface NormalizeContext {
  reading: ReadingState
  isFinal: boolean
  /** Previous line's `endsSentence`. Defaults true — a service starts on one. */
  atSentenceStart?: boolean
  /**
   * Defaults to a DIGITS-ONLY parser. Degraded, never wrong: without injection
   * 'chapter thirteen' simply does not convert, while 'chapter 13' still does.
   */
  parseNumber?: SpokenNumberParser
  /** Omitted ⇒ scripture-ref can never fire. */
  matchBook?: BookMatcher
  /** Defaults to DEFAULT_RULES. Turning a rule off is editing an array of strings. */
  rules?: readonly RuleId[]
}

/**
 * Order IS precedence — the first rule to claim a position wins it. That is a
 * reviewable line of data rather than a nest of conditionals, and it is why
 * sentence-case is last: it cases the ASSEMBLED text, including the canonical
 * book names scripture-ref has already emitted.
 */
export const DEFAULT_RULES: readonly RuleId[] = ['filler', 'scripture-ref', 'sentence-case']

// --------------------------------------------------------------- tokenizer

/**
 * A token as the rules see it.
 *
 * `lower` is precomputed because every rule needs it and a per-rule
 * toLowerCase() is an allocation per token per rule in the ASR hot path.
 * `gap` is the exact whitespace that PRECEDED this token, kept verbatim so
 * reassembly is lossless without guessing how many spaces there were. `trail`
 * is the trailing punctuation split off the word ('percent.' → lower
 * 'percent', trail '.'), so rules match anchors exactly without each carrying
 * its own trailing-punctuation regex — and so a comma stays visible as the
 * hard adjacency break that scripture-ref depends on.
 *
 * Deliberately NOT the resolver's normalizeWords: that lowercases, folds
 * diacritics, strips ALL punctuation and carries no offsets. Comma-as-break is
 * load-bearing here, and normalizeWords destroys it.
 */
interface Token {
  /** Exactly raw.slice(start, end), punctuation included. */
  raw: string
  /** Lowercased, leading and trailing punctuation stripped. */
  lower: string
  /** The stripped trailing punctuation. */
  trail: string
  /** The stripped leading punctuation, so reassembly stays lossless. */
  lead: string
  start: number
  end: number
  /** The whitespace immediately before this token. */
  gap: string
}

/** Sentence-terminal marks. A line ending on one starts the next in capitals. */
const TERMINALS = '.?!'

function isTerminal(trail: string): boolean {
  for (const ch of trail) if (TERMINALS.includes(ch)) return true
  return false
}

/**
 * Punctuation stripped from a token's edges to expose the bare word. Kept as a
 * closed list rather than a Unicode class: an apostrophe must stay inside the
 * word ("that's", "o'clock") and a hyphen must stay too, because whisper emits
 * 'uh-uh' and 'ninety-nine' as single tokens and splitting them here would
 * change what the rules below believe they are looking at.
 */
const EDGE_PUNCT = new Set([
  '.', ',', '!', '?', ';', ':', '"', "'", '(', ')', '[', ']', '{', '}',
  '—', '–', '…', '“', '”', '‘', '’'
])

function tokenize(raw: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < raw.length) {
    const gapStart = i
    while (i < raw.length && /\s/.test(raw[i])) i++
    const gap = raw.slice(gapStart, i)
    if (i >= raw.length) {
      // Trailing whitespace belongs to no token; the assembler re-adds it from
      // the raw string, so nothing is lost.
      break
    }
    const start = i
    while (i < raw.length && !/\s/.test(raw[i])) i++
    const end = i
    const text = raw.slice(start, end)

    let a = 0
    let b = text.length
    while (a < b && EDGE_PUNCT.has(text[a])) a++
    while (b > a && EDGE_PUNCT.has(text[b - 1])) b--

    tokens.push({
      raw: text,
      lower: text.slice(a, b).toLowerCase(),
      lead: text.slice(0, a),
      trail: text.slice(b),
      start,
      end,
      gap
    })
  }
  return tokens
}

// ------------------------------------------------------------------ filler

/**
 * FROZEN. Must never be derived from, or compared against, the resolver's
 * EN_FILLER — that set contains 'ah', 'the', 'now', 'so', 'okay' and 'well',
 * because it is a MATCHING table for the reference walker, not a DISPLAY
 * table. Inheriting it would delete 'Ah!', the single most load-bearing word
 * in Nigerian Pentecostal delivery, and strip 'so'/'now'/'well' from every
 * sentence they open.
 *
 * 'mm', 'hm' and 'hmm' are deliberately absent: those are affirmations, and a
 * congregation's 'mmm' is content. Every member here is a transcription of
 * breath and is a word in no language this app ships.
 */
export const DISPLAY_FILLERS: ReadonlySet<string> = new Set([
  'um',
  'umm',
  'uh',
  'uhh',
  'erm',
  'uhm'
])

/**
 * The next token vetoes. 'uh huh' is an affirmation, and whether whisper emits
 * the hyphen is luck — so the guard is written against the following word
 * rather than against the hyphen, and holds either way.
 */
const FILLER_NEXT_VETO: ReadonlySet<string> = new Set(['huh', 'hmm', 'hm', 'uh', 'um'])

// ----------------------------------------------------------- sentence-case

/**
 * The 66 canonical book names, inlined rather than imported from
 * electron/data/books.ts because this module imports nothing. They are
 * duplicated as a LIST OF WORDS for capitalization only — the ids, the
 * ordering and the aliases all stay behind in the engine, and book MATCHING
 * here goes through the injected BookMatcher, never through this array. So
 * there is no second alias table to drift out of step.
 */
const BOOK_NAME_WORDS: readonly string[] = [
  'genesis', 'exodus', 'leviticus', 'deuteronomy', 'joshua',
  'ruth', 'samuel', 'chronicles', 'ezra', 'nehemiah', 'esther',
  'psalms', 'proverbs', 'ecclesiastes', 'song', 'of', 'solomon', 'isaiah',
  'jeremiah', 'lamentations', 'ezekiel', 'daniel', 'hosea', 'joel', 'amos',
  'obadiah', 'jonah', 'micah', 'nahum', 'habakkuk', 'zephaniah', 'haggai',
  'zechariah', 'malachi', 'matthew', 'luke', 'john', 'romans',
  'corinthians', 'galatians', 'ephesians', 'philippians', 'colossians',
  'thessalonians', 'timothy', 'titus', 'philemon', 'hebrews', 'james',
  'peter', 'jude', 'revelation'
]

/**
 * Book names that are also ordinary English words, excluded from the
 * capitalization list above even though they are books: job, mark, acts,
 * numbers, judges, kings. A lowercase 'job' on a projector costs nothing; a
 * capitalized 'Job' in 'he took a job in lagos' is a visible error, and 'Mark
 * my words' turns an idiom into a name. Note 'of' is present in the list above
 * only as a word of 'Song of Solomon' and is excluded here for the same
 * reason — capitalizing every 'of' would be absurd.
 *
 * Kept as its own named constant so the exclusion is greppable and so nobody
 * "fixes" the omission by adding the books back.
 */
const AMBIGUOUS_BOOK_WORDS: ReadonlySet<string> = new Set([
  'job', 'mark', 'acts', 'numbers', 'judges', 'kings', 'of', 'song'
])

/**
 * The standalone token 'i' is NEVER capitalized — not as a pronoun, and not as
 * a sentence capital either.
 *
 * The pronoun rule was cut outright, but leaving the sentence-capital path open
 * lets every case that killed it back in through a side door: Igbo 'i na-aga'
 * opens a line, and 'i john three sixteen' is a citation whose first token
 * would print as a pronoun. A lowercase 'i' opening a sentence is a visible
 * imperfection; 'I na-aga' is an assertion about someone's language. The
 * Nigerian corpus rows pin both.
 */
const NEVER_CAPITALIZED: ReadonlySet<string> = new Set(['i'])

/**
 * Book names that are also common given names, excluded from proper-noun
 * capitalization when they stand alone. 'second john took the stand' is a man,
 * not a citation, and the spoken corpus is full of Johns, Peters, Jameses and
 * Marys. When these words really are a book, scripture-ref has already emitted
 * the canonical name with its own capital and this pass never sees them
 * lowercase. So the exclusion costs nothing where it matters and prevents a
 * name being silently promoted to Scripture everywhere else.
 */
const AMBIGUOUS_GIVEN_NAMES: ReadonlySet<string> = new Set([
  'john', 'james', 'peter', 'mary', 'joseph', 'jude', 'philip', 'timothy', 'titus'
])

/**
 * Closed. Orthography, not theology: these are proper nouns in English, and
 * English capitalizes a proper noun wherever it falls. The alternative was
 * rejected and it is worse — against whisper's all-lowercase stream it puts
 * 'and god said unto moses' on a projector, and half-capitalized Scripture in
 * a church reads as carelessness about the thing the church is there for.
 *
 * Additions require a code review. Every entry is matched as a whole token, so
 * 'gods' is untouched, and only the first letter is ever changed.
 */
export const PROPER_NOUNS: ReadonlySet<string> = new Set(
  [
    ...BOOK_NAME_WORDS.filter(
      (w) => !AMBIGUOUS_BOOK_WORDS.has(w) && !AMBIGUOUS_GIVEN_NAMES.has(w)
    ),
    'god', 'lord', 'jesus', 'christ', 'jehovah', 'messiah', 'saviour', 'savior',
    'holy', 'spirit', 'moses', 'abraham', 'isaac', 'jacob',
    'david', 'solomon', 'elijah', 'elisha', 'paul',
    'israel', 'judah', 'jerusalem', 'bethlehem', 'egypt',
    'zion', 'calvary', 'galilee', 'nazareth', 'babylon', 'pharaoh', 'satan', 'devil'
  ].filter((w) => !AMBIGUOUS_GIVEN_NAMES.has(w))
)

/**
 * 'father' and 'son' were in an earlier draft of this list and are deliberately
 * absent: capitalizing them is a theological reading, not orthography — 'my
 * father worked in the mines' and 'his son came home' are the ordinary uses,
 * and the sermon corpus contains far more of those than of the divine sense.
 */

// ---------------------------------------------------------- scripture-ref

/** The resolver's English keyword sets, restated. 'chapters' is not recognised, as there. */
const CHAPTER_WORDS: ReadonlySet<string> = new Set(['chapter'])
const VERSE_WORDS: ReadonlySet<string> = new Set(['verse', 'verses'])
const RANGE_WORDS: ReadonlySet<string> = new Set(['to', 'through', 'thru'])

/**
 * A determiner or possessive immediately before a book alias means it is not a
 * book. 'my job' is never the book of Job; 'the acts of giving' is never Acts.
 * 'the' belongs here deliberately — it disables the resolver's 'the acts',
 * 'the psalms' and 'the proverbs' aliases for display purposes, which is a net
 * win, because those aliases exist to help a stateful walker and only hurt here.
 */
const REF_DETERMINER_VETO: ReadonlySet<string> = new Set([
  'my', 'your', 'his', 'her', 'our', 'their', 'its',
  'the', 'a', 'an', 'this', 'that', 'these', 'those',
  'every', 'any', 'some', 'no'
])

/**
 * A noun right after the consumed span means the number was a quantity, not a
 * verse. 'he was in prison for acts chapter eleven years' must not become
 * 'Acts 11 years'.
 */
const REF_TRAILING_VETO: ReadonlySet<string> = new Set([
  'years', 'year', 'months', 'month', 'weeks', 'week', 'days', 'day',
  'hours', 'hour', 'minutes', 'minute', 'times', 'time', 'people',
  'men', 'women', 'children', 'miles', 'dollars', 'percent',
  'kilometers', 'kilometres', "o'clock"
])

// ------------------------------------------------------------------ rules

/** What a rule returns when it claims a position. */
interface RuleHit {
  /** The replacement text for the whole claimed span. */
  text: string
  /** How many tokens, starting at the anchor, this hit consumes. */
  consumed: number
  mark: MarkLevel
}

interface MatchContext {
  words: string[]
  parseNumber: SpokenNumberParser
  matchBook: BookMatcher | null
  isFinal: boolean
  /** True at the first token of the line, or after a terminal-punctuated token. */
  atSentenceStart: (i: number) => boolean
}

interface Rule {
  id: RuleId
  class: RuleClass
  /**
   * A cheap prefilter on tokens[i].lower — null means the rule is not
   * token-anchored and runs over the assembled text instead.
   */
  anchors: ReadonlySet<string> | null
  match: (tokens: Token[], i: number, mctx: MatchContext) => RuleHit | null
}

/**
 * Remove a standalone hesitation token at a sentence start.
 *
 * It is orthographic and runs while inert on purpose: a preacher clearing his
 * throat before John 3:16 is not part of John 3:16. The owner's constraint is
 * that HIS WORDING is not rewritten, and a hesitation token is not wording —
 * it is the ASR transcribing breath. The safety lives entirely in the anchor
 * set being closed and in the position being sentence-initial.
 *
 * Mid-sentence fillers are left alone deliberately. In preaching cadence,
 * especially Nigerian Pentecostal, a mid-clause hesitation is rhythm, and
 * removing it makes the transcript read faster than the man is speaking.
 */
const fillerRule: Rule = {
  id: 'filler',
  class: 'orthographic',
  anchors: DISPLAY_FILLERS,
  match(tokens, i, mctx) {
    const tok = tokens[i]
    // Whole-token match, never a prefix: 'Umberto', 'umbrella', 'Umar' stay.
    if (!DISPLAY_FILLERS.has(tok.lower)) return null
    // A line start is NOT a sentence start. When the previous chunk ended
    // mid-clause, this line's opening 'uh' may be the subject of the sentence
    // ('uh is not a word in Hebrew, but Abba is'), and deleting it is a
    // catastrophe dressed as a tidy-up.
    if (!mctx.atSentenceStart(i)) return null
    const next = tokens[i + 1]
    if (next && FILLER_NEXT_VETO.has(next.lower)) return null
    return { text: '', consumed: 1, mark: 'certain' }
  }
}

/**
 * 'first corinthians chapter thirteen verse four' → '1 Corinthians 13:4'.
 *
 * The signature feature, and its value is recognition rather than compression:
 * '1 Corinthians 13:4' is a symbol a churchgoer parses pre-lexically, the way
 * a logo is parsed. Eight words that must be read serially become one shape.
 *
 * It is class 'reference', so it runs WHILE INERT, and that deserves its
 * argument stated plainly because it looks like a weakening. A preacher does
 * not speak the sequence book-alias + literal 'chapter'/'verse' + number
 * INSIDE verse text; verse text does not cite itself. Every false positive
 * this rule can produce is in ordinary speech, and every one of them is closed
 * off below. Meanwhile, leaving it gated means the headline feature is
 * silently dead for the minute after every announced-but-not-yet-read verse —
 * which is the single most common shape in preaching: announce, wait for
 * pages to turn, tell a story, then read.
 *
 * NINE guards, and they are counted here on purpose. Eight are closed-set
 * vetoes on a single adjacent token — greppable, testable, incapable of
 * leaking — and the ninth subtracts reach rather than adding cleverness.
 *
 * 1. NUMBER REQUIRED. The rule may only emit a string containing a digit it
 *    parsed. A bare book-name substitution is forbidden, which is what stops
 *    'second john took the stand' becoming '2 John took the stand' and
 *    silently rewriting a man's name into a citation.
 * 2. CONTIGUITY. Zero tokens between the book match and the keyword. The
 *    resolver's filler-skipping walk is stateful-engine behaviour and is not
 *    copied here.
 * 3. DETERMINER VETO. See REF_DETERMINER_VETO.
 * 4. IDIOM BLOCKLIST. 'chapter and verse' never anchors this rule, anywhere.
 *    It is a fixed English idiom and it appears in sermons constantly.
 * 5. TRAILING-NOUN VETO. See REF_TRAILING_VETO.
 * 6. TRAILING-NUMBER VETO. A dangling unconsumed number means the utterance
 *    was mis-segmented: 'ephesians chapter two verse eight nine' must not
 *    become 'Ephesians 2:8 nine'. A half-parsed citation is worse than none.
 * 7. NO CROSS-LINE MEMORY. There is no lastBook here and there never will be.
 *    A keyword-and-number run with no book in the same line converts to
 *    nothing — not even '8:28'. The resolver's 15-minute lastBook borrow would
 *    print 'Romans 8:28' onto a line whose raw text was 'chapter eight verse
 *    twenty eight', words the preacher did not say on that line. The miss is
 *    accepted.
 * 8. END-OF-CHUNK HOLD. A span ending at the last token with no verse keyword
 *    is held raw, so a citation bisected across two chunks ('turn to 1 John 1'
 *    / 'verse nine and confess') never renders half-converted. An unconverted
 *    line looks ordinary; a bisected one looks broken.
 * 9. Psalm STAYS SINGULAR. When the spoken alias was 'psalm', emit 'Psalm
 *    23:1', not 'Psalms 23:1'. One line, for the most-referenced book in the
 *    corpus — the app's most trusted feature must not show a word he did not
 *    say.
 *
 * Deliberately NOT implemented: bare adjacency ('John three sixteen') and the
 * ordinal form ('the third chapter of John'). Both are resolver patterns that
 * need cross-chunk state a pure function does not have. On the display layer a
 * missed conversion costs one unabbreviated line; a false one prints a wrong
 * reference inside the preacher's own sentence, on a screen, permanently.
 */
const scriptureRefRule: Rule = {
  id: 'scripture-ref',
  class: 'reference',
  anchors: null,
  match(tokens, i, mctx) {
    const matchBook = mctx.matchBook
    if (!matchBook) return null

    const prev = tokens[i - 1]
    // G3 — determiner/possessive veto, read before anything else is attempted.
    if (prev && REF_DETERMINER_VETO.has(prev.lower)) return null
    // A comma or full stop before the book is fine; punctuation AFTER the book
    // breaks the run, which is handled per-token below.

    const hit = matchBook(mctx.words, i)
    if (!hit || hit.consumed <= 0) return null

    // G3, second half — the determiner may be INSIDE the alias. The resolver's
    // table carries 'the acts', 'the psalms' and 'the proverbs' as spoken forms,
    // so a match can begin ON the determiner and the check above, which only
    // ever looks at the token before the match, never sees it. Reading the
    // match's own first token as well is what actually disables those aliases
    // here: 'the acts chapter two of our series' is a sermon series, not Acts 2.
    if (hit.consumed > 1 && REF_DETERMINER_VETO.has(tokens[i].lower)) return null

    // G2 — contiguity. Any punctuation inside the matched book span, or on its
    // final token, breaks the run: 'second john took the stand, chapter closed'
    // must not reach across the comma.
    for (let k = 0; k < hit.consumed; k++) {
      const t = tokens[i + k]
      if (!t) return null
      if (k < hit.consumed - 1 && t.trail.length > 0) return null
    }
    const bookEnd = i + hit.consumed
    const bookLast = tokens[bookEnd - 1]
    if (bookLast.trail.length > 0) return null

    let j = bookEnd
    let chapter: number | null = null
    let verse: number | null = null
    let rangeEnd: number | null = null
    let sawVerseKeyword = false

    // G4 — the idiom blocklist. 'chapter and verse' never anchors this rule,
    // whatever precedes or follows it.
    if (isChapterAndVerseIdiom(tokens, j)) return null

    const first = tokens[j]
    if (!first) return null

    if (CHAPTER_WORDS.has(first.lower) && first.trail.length === 0) {
      const num = mctx.parseNumber(mctx.words, j + 1)
      if (!num) return null
      chapter = num.value
      j = j + 1 + num.consumed
      // A terminal or comma right after the chapter number ends the citation
      // there; that is a legitimate 'John 3' and handled by the hold below.
      const afterChapter = tokens[j]
      const chapterNumLast = tokens[j - 1]
      if (
        afterChapter &&
        chapterNumLast &&
        chapterNumLast.trail.length === 0 &&
        VERSE_WORDS.has(afterChapter.lower) &&
        afterChapter.trail.length === 0
      ) {
        const v = mctx.parseNumber(mctx.words, j + 1)
        if (v) {
          sawVerseKeyword = true
          verse = v.value
          j = j + 1 + v.consumed
          const range = readRange(tokens, j, mctx)
          if (range) {
            rangeEnd = range.end
            j = range.next
          }
        }
      }
    } else if (VERSE_WORDS.has(first.lower) && first.trail.length === 0) {
      // 'Romans verse nine' — a verse keyword directly after the book. The
      // number is the verse and there is no chapter to print, so this cannot
      // produce a usable citation; decline rather than invent a chapter.
      return null
    } else {
      return null
    }

    // G1 — number required. Nothing without a parsed digit may be emitted, so
    // there is no path from here to a bare book-name rewrite.
    if (chapter === null) return null

    // G8 — END-OF-CHUNK HOLD. A citation that is still growing is held raw.
    //
    // A span with no verse keyword that runs to the end of the available tokens
    // may be the front half of 'turn to 1 John 1' / 'verse nine and confess',
    // and a bisected citation looks broken in a way an unconverted line does
    // not. On a PARTIAL the same reasoning applies to the whole rule, not just
    // the keyword-less shape: the recognizer is still appending, so a citation
    // that reaches the end of what has arrived will very likely be longer by
    // the final. Converting now means the operator watches '1 Corinthians 13'
    // become '1 Corinthians 13:4' — the citation rewriting itself on screen.
    // Holding the whole thing until the utterance settles is the only way a
    // many-words-to-one-symbol conversion can be flicker-free, and the cost is
    // that the words stay as spoken for one more chunk.
    const stillGrowing = !sawVerseKeyword || !mctx.isFinal
    if (stillGrowing && j >= tokens.length) return null

    const after = tokens[j]
    if (after) {
      // G5 — trailing-noun veto.
      if (REF_TRAILING_VETO.has(after.lower)) return null
      // G6 — trailing-number veto. An unconsumed number means mis-segmentation.
      if (mctx.parseNumber(mctx.words, j) !== null) return null
    }

    // G9 — Psalm stays singular when that is what was spoken.
    let book = hit.canonical
    if (book === 'Psalms' && tokens[i].lower === 'psalm') book = 'Psalm'

    let text = `${book} ${chapter}`
    if (verse !== null) {
      text += `:${verse}`
      if (rangeEnd !== null) text += `-${rangeEnd}`
    }

    // The conversion is trustworthy when it fires at all — the guards above are
    // what buy that, and a marked scripture reference would undermine the
    // feature it is the signature of.
    return { text, consumed: j - i, mark: 'certain' }
  }
}

/**
 * 'chapter and verse' as a literal sequence, checked from the token that
 * follows the book. Written as its own function so the idiom is greppable and
 * so the check reads the same way it is spoken.
 */
function isChapterAndVerseIdiom(tokens: Token[], j: number): boolean {
  const a = tokens[j]
  const b = tokens[j + 1]
  const c = tokens[j + 2]
  if (!a || !b || !c) return false
  return CHAPTER_WORDS.has(a.lower) && b.lower === 'and' && VERSE_WORDS.has(c.lower)
}

/** 'verses twenty eight through thirty' — the tail of a range, if there is one. */
function readRange(
  tokens: Token[],
  j: number,
  mctx: MatchContext
): { end: number; next: number } | null {
  const word = tokens[j]
  if (!word || !RANGE_WORDS.has(word.lower) || word.trail.length > 0) return null
  const prev = tokens[j - 1]
  if (prev && prev.trail.length > 0) return null
  const num = mctx.parseNumber(mctx.words, j + 1)
  if (!num) return null
  return { end: num.value, next: j + 1 + num.consumed }
}

/**
 * Capitalize the first alphabetic character of the line, of each sentence, and
 * of each proper noun. Runs LAST, over the assembled text, because the
 * canonical book names scripture-ref emits are already correctly cased and
 * this rule must be able to see them as they will appear.
 *
 * It only ever UPPERCASES — there is no downcasing path anywhere, so a capital
 * the recognizer supplied always survives. It replaces one character with one
 * character of equal length, so offsets never move.
 *
 * The 'i' → 'I' sub-rule does NOT exist and must not be added back. It was cut
 * three separate ways: Igbo 'i' is the second-person pronoun, so 'i na-aga'
 * becomes an English first-person assertion on an Igbo word; 'i john three
 * sixteen' prints a Roman-numeral book prefix as a pronoun; and Exodus 3:14
 * renders as 'And god said unto moses I am that I am', where the only
 * mid-sentence capital in a line of Scripture is the first-person pronoun,
 * next to a lowercase 'god'. That is the single most inflammatory string this
 * system can produce, and it is not recoverable with a lookahead — only by not
 * doing it.
 */
function applySentenceCase(text: string): string {
  const chars = [...text]
  let pendingCapital = true

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (/\s/.test(ch)) continue
    if (pendingCapital && isAlpha(ch)) {
      // The capital is owed to this word unless the word is one we never
      // capitalize. The first-alphabetic search has already skipped any leading
      // digits and opening quotes, so '1 corinthians says' keeps its capital on
      // the 'c' rather than losing it to a character that has none.
      if (!NEVER_CAPITALIZED.has(wordAt(chars, i))) {
        chars[i] = ch.toUpperCase()
      }
      pendingCapital = false
    }
    if (TERMINALS.includes(ch)) pendingCapital = true
  }

  return capitalizeProperNouns(chars.join(''))
}

/**
 * The bare word beginning at `i`, lowercased and stripped of edge punctuation.
 * Used only to ask whether a word is exempt from the sentence capital, so it
 * reads forward from the letter the capital would have landed on.
 */
function wordAt(chars: string[], i: number): string {
  let end = i
  while (end < chars.length && !/\s/.test(chars[end])) end++
  let word = chars.slice(i, end).join('')
  while (word.length > 0 && EDGE_PUNCT.has(word[word.length - 1])) {
    word = word.slice(0, -1)
  }
  return word.toLowerCase()
}

function isAlpha(ch: string): boolean {
  return ch.toLowerCase() !== ch.toUpperCase()
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

/**
 * Whole-token proper-noun capitalization over the assembled line. Word
 * boundaries are computed on whitespace and edge punctuation only, so an
 * internal apostrophe or hyphen keeps the token intact and 'gods' never
 * matches 'god'.
 */
function capitalizeProperNouns(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      out += text[i]
      i++
      continue
    }
    const start = i
    while (i < text.length && !/\s/.test(text[i])) i++
    const word = text.slice(start, i)
    let a = 0
    let b = word.length
    while (a < b && EDGE_PUNCT.has(word[a])) a++
    while (b > a && EDGE_PUNCT.has(word[b - 1])) b--
    const core = word.slice(a, b)
    if (core.length > 0 && PROPER_NOUNS.has(core.toLowerCase())) {
      out += word.slice(0, a) + core[0].toUpperCase() + core.slice(1) + word.slice(b)
    } else {
      out += word
    }
  }
  return out
}

const RULES: Record<RuleId, Rule> = {
  filler: fillerRule,
  'scripture-ref': scriptureRefRule,
  // sentence-case has no token matcher — it runs over the assembled string at
  // the end of the pipeline, which is why its entry is a marker rather than a
  // matcher. Keeping it in the table means enabling and disabling it is the
  // same edit as for every other rule.
  'sentence-case': {
    id: 'sentence-case',
    class: 'orthographic',
    anchors: new Set<string>(),
    match: () => null
  }
}

// --------------------------------------------------------------- fallbacks

/**
 * The default number parser: digits only, and at most three of them. Degraded
 * but never wrong — without the resolver's table injected, 'chapter thirteen'
 * simply does not convert, while 'chapter 13' still does. The three-digit cap
 * mirrors the resolver's own, where a longer run is a year rather than a
 * chapter.
 */
const digitsOnlyParser: SpokenNumberParser = (words, i) => {
  const w = words[i]
  if (w === undefined) return null
  if (!/^\d{1,3}$/.test(w)) return null
  return { value: Number.parseInt(w, 10), consumed: 1 }
}

/**
 * On a partial, non-orthographic rules may not read the last two tokens.
 *
 * Two, not one, because every non-orthographic rule here is at least two
 * tokens wide — so a rule either sees its whole window or does not fire at
 * all, and the only partial-to-final change a viewer can see is more text
 * arriving, never text changing. Orthographic rules are exempt: they cannot
 * change meaning if a token grows, and holding them back would make the
 * sentence-initial capital appear two words late, which looks broken.
 */
const PARTIAL_TAIL_HOLD = 2

// ---------------------------------------------------------------- pipeline

export function normalizeForDisplay(raw: string, ctx: NormalizeContext): NormalizedLine {
  const inert = ctx.reading !== 'no'
  const enabled = (ctx.rules ?? DEFAULT_RULES)
    .map((id) => RULES[id])
    .filter((r): r is Rule => Boolean(r))
    // The inert filter. With no lexical rules shipping it currently suppresses
    // nothing — it is here so that it is already true the day someone adds one.
    .filter((r) => !inert || r.class !== 'lexical')

  const tokens = tokenize(raw)
  const words = tokens.map((t) => t.lower)
  const matchers = enabled.filter((r) => r.id !== 'sentence-case')
  const casing = enabled.some((r) => r.id === 'sentence-case')

  const lineStartsSentence = ctx.atSentenceStart ?? true

  // A spoken reference is the strongest in-line signal that Scripture follows,
  // and it is free to compute here. Tokens after a converted citation are
  // treated as reading regardless of the gate the caller passed in. With no
  // lexical rules shipping this suppresses nothing today; it is written now so
  // that the protection exists before the rule that needs it does.
  let forcedReadingFrom = Number.POSITIVE_INFINITY

  const mctx: MatchContext = {
    words,
    parseNumber: ctx.parseNumber ?? digitsOnlyParser,
    matchBook: ctx.matchBook ?? null,
    isFinal: ctx.isFinal,
    atSentenceStart: (i) => {
      if (i === 0) return lineStartsSentence
      const prev = tokens[i - 1]
      return prev ? isTerminal(prev.trail) : lineStartsSentence
    }
  }

  const horizon = ctx.isFinal ? tokens.length : Math.max(0, tokens.length - PARTIAL_TAIL_HOLD)

  const spans: DisplaySpan[] = []
  // Untouched tokens accumulate into ONE span. Without this a normal sentence
  // becomes forty spans and React re-keys the world on every chunk.
  let runStart = -1
  let runEnd = -1

  const flushRun = (): void => {
    if (runStart < 0) return
    spans.push({ text: raw.slice(runStart, runEnd), start: runStart, end: runEnd })
    runStart = -1
    runEnd = -1
  }

  let i = 0
  let cursor = 0
  while (i < tokens.length) {
    const tok = tokens[i]
    let hit: RuleHit | null = null
    let firedBy: Rule | null = null

    for (const rule of matchers) {
      // Orthographic rules see the whole line even on a partial.
      if (rule.class !== 'orthographic' && i >= horizon) continue
      if (rule.class === 'lexical' && i >= forcedReadingFrom) continue
      if (rule.anchors && !rule.anchors.has(tok.lower)) continue
      const candidate = rule.match(tokens, i, mctx)
      if (!candidate) continue
      // The held tail is about the WHOLE span, not just its anchor. A rule that
      // reaches past the horizon has read tokens the recognizer may still
      // revise, so it either sees its entire window or does not fire — which is
      // what makes partial-to-final purely additive.
      if (rule.class !== 'orthographic' && i + candidate.consumed > horizon) continue
      hit = candidate
      firedBy = rule
      break
    }

    if (!hit || !firedBy) {
      // Extend the pending untouched run to cover this token's gap and text.
      if (runStart < 0) runStart = cursor
      runEnd = tok.end
      cursor = tok.end
      i++
      continue
    }

    const last = tokens[i + hit.consumed - 1]
    const spanStart = tok.start
    const spanEnd = last.end

    // For a CONVERSION the gap in front belongs to the preceding run, so the
    // rewritten text never swallows the space before it. For a DELETION it does
    // not: the token is going away and exactly one of the two spaces around it
    // must go too, so the leading gap stays with the token and the run ends at
    // the previous token. That is the difference between 'He turned. Then he
    // wept.' and 'He turned.  Then he wept.'
    if (hit.text.length > 0 && (tok.gap.length > 0 || cursor < spanStart)) {
      if (runStart < 0) runStart = cursor
      runEnd = spanStart
      cursor = spanStart
    }

    if (hit.text.length === 0) {
      // A DELETION. Exactly one of the two spaces around the removed token must
      // go with it, or the transcript shows a double space where the preacher
      // cleared his throat. Normally the one AFTER goes, so the preceding run
      // keeps its single separating space; at the end of a line there is no
      // space after, so the one before goes instead and nothing is left
      // dangling. Either way the whole hole — gap, token and trail — becomes
      // this span's `raw`, so every character between the neighbouring spans is
      // still accounted for and the round trip holds across the gap.
      const next = tokens[i + hit.consumed]
      const holeStart = next ? spanStart : cursor
      const holeEnd = next ? next.start : raw.length

      if (next && cursor < holeStart) {
        if (runStart < 0) runStart = cursor
        runEnd = holeStart
      }

      // The deleted token's own trailing punctuation goes with it, EXCEPT a
      // sentence-terminal mark when the preceding token does not already carry
      // one. That is PROMOTED onto the run instead, so 'nine years. uh. and he
      // died.' neither loses its full stop nor gains a second one, and an
      // ellipsis is never left stranded at the start of the next line. The
      // run's `raw` stays its own untouched slice, which keeps the promotion
      // traceable: the mark it gained came from the token deleted after it.
      const trail = last.trail
      const before = tokens[i - 1]
      const beforeEndsSentence = before ? isTerminal(before.trail) : true
      if (isTerminal(trail) && !beforeEndsSentence && before && runStart >= 0) {
        const runText = raw.slice(runStart, runEnd)
        spans.push({
          text: runText + trail.replace(/[^.?!]/g, ''),
          raw: runText,
          start: runStart,
          end: runEnd
        })
        runStart = -1
        runEnd = -1
      } else {
        flushRun()
      }

      spans.push({
        text: '',
        raw: raw.slice(holeStart, holeEnd),
        start: holeStart,
        end: holeEnd,
        rule: firedBy.id
      })
      cursor = holeEnd
      i += hit.consumed
      continue
    }

    flushRun()

    // A conversion keeps its anchor's trailing punctuation: the citation is
    // rewritten, the sentence around it is not.
    const text = hit.text + last.trail
    const rawText = raw.slice(spanStart, spanEnd)
    const span: DisplaySpan = {
      text,
      start: spanStart,
      end: spanEnd,
      rule: firedBy.id
    }
    if (text !== rawText) span.raw = rawText
    if (hit.mark === 'uncertain') span.mark = 'uncertain'
    spans.push(span)

    if (firedBy.id === 'scripture-ref') {
      forcedReadingFrom = Math.min(forcedReadingFrom, i + hit.consumed)
    }

    cursor = spanEnd
    i += hit.consumed
  }

  flushRun()
  // Trailing whitespace belongs to nobody; append it so the round trip holds.
  if (cursor < raw.length) {
    spans.push({ text: raw.slice(cursor), start: cursor, end: raw.length })
  }

  const cased = casing ? applyCasingToSpans(spans, lineStartsSentence) : spans
  const text = cased.map((s) => s.text).join('')

  return {
    raw,
    text,
    spans: cased,
    hasUncertain: cased.some((s) => s.mark === 'uncertain'),
    inert,
    endsSentence: endsOnTerminal(text)
  }
}

/**
 * Sentence-case runs over the ASSEMBLED line and then maps the result back
 * onto the spans. Because it only ever replaces one character with one
 * character of the same length, the mapping is a straight offset walk and no
 * span boundary moves.
 */
function applyCasingToSpans(spans: DisplaySpan[], atSentenceStart: boolean): DisplaySpan[] {
  const joined = spans.map((s) => s.text).join('')
  // A line continuing a sentence from the previous chunk keeps its opening
  // lowercase; anything else would capitalize mid-clause.
  const cased = atSentenceStart ? applySentenceCase(joined) : capitalizeProperNouns(joined)
  if (cased === joined) return spans

  const out: DisplaySpan[] = []
  let at = 0
  for (const span of spans) {
    const next = at + span.text.length
    const text = cased.slice(at, next)
    at = next
    if (text === span.text) {
      out.push(span)
      continue
    }
    // Casing never invents a difference from the raw text on its own: a span
    // that was untouched before still reports its original slice as `raw`, so
    // the round trip is preserved.
    const copy: DisplaySpan = { ...span, text }
    if (copy.raw === undefined) copy.raw = span.text
    out.push(copy)
  }
  return out
}

function endsOnTerminal(text: string): boolean {
  const trimmed = text.trimEnd()
  if (trimmed.length === 0) return false
  for (let i = trimmed.length - 1; i >= 0; i--) {
    const ch = trimmed[i]
    if (TERMINALS.includes(ch)) return true
    if (!EDGE_PUNCT.has(ch)) return false
  }
  return false
}

/**
 * The raw text, reassembled from the spans. This is the recoverability
 * guarantee stated as a function rather than left as a comment: every surface
 * that stores spans can get back exactly what the preacher's microphone heard,
 * and the equality `recoverRaw(line.spans) === line.raw` is the invariant the
 * test suite pins first.
 */
export function recoverRaw(spans: readonly DisplaySpan[]): string {
  return spans.map((s) => s.raw ?? s.text).join('')
}
