import { findNamedPassage } from './namedPassages'
import { hasKnownStoryContradiction, isContemporaryTalk, type PassageCandidate } from './passageMatcher'
import type { Judge, SemanticCandidate, SemanticMatcher } from './semanticMatcher'
import { NameMemory } from './nameMemory'
import { SermonContext } from './sermonContext'

export interface FoundPassage {
  book: string
  chapter: number
  verse: number
  endVerse: number
  title: string
  evidence: string[]
  kind: 'named' | 'story' | 'meaning'
}

/** The judge's score above which a passage is suggested unasked. Measured. */
export const JUDGE_LINE = 4.6

/**
 * The judge's line for the button, which answers someone who asked and will
 * choose — far lower than JUDGE_LINE, which has to be sure enough to speak
 * unasked. Measured 2026-10-07 on evals/recognition/allusions.json (typed
 * sentences, not sermons): the right chapter is among the cards as often as
 * with no line at all (27 of 30, 24 of 24 fresh), while wrong cards fall from
 * about 2.6 to 0.9 a search and ordinary talk mostly finds nothing (plain
 * talk 20 of 20 empty, other non-Scripture 35 of 47).
 */
export const ASKED_LINE = 0
/** Spoken lookup needs evidence of the specific passage, not just a related topic. */
export const SPOKEN_LINE = 2

/** The most the button shows — one page of four, each worth reading (owner, 2026-10-07). */
export const FIND_LIMIT = 4

/**
 * The line for a meaning match inside the passage on the wall
 * (SermonContext): lower, because being in the chapter being preached is
 * evidence the judge cannot see. Measured 2026-10-07: with the passage on the
 * wall, no line at all found 30 of 32 allusions inside it but showed cards
 * for 18 of 67 non-Scripture sentences; -6 finds 28 of 32 and shows cards
 * for 12 of 67, the same as with the strict line.
 */
export const SERMON_LINE = -6

/**
 * A prayer said aloud. Prayers borrow the Bible's own words — Paul's
 * thanksgivings above all — and the judge read "Father, thank you for your
 * word" as Colossians 1 in the practice sermon (2026-10-07). A prayer is not
 * an allusion, so nothing is suggested unasked from one.
 */
export function isPrayerTalk(speech: string): boolean {
  const s = speech.toLowerCase()
  return /\b(?:let us pray|let's pray|in jesus'? name|in the name of jesus|amen)\b/.test(s)
    || /\b(?:father|lord|god),? (?:we|i) (?:thank|praise|ask|come|bless)\b/.test(s)
    || /^(?:father|lord|dear (?:god|lord|father))\b/.test(s.trim())
}

/**
 * Finds the passage a sentence points to, with what the sentence alone does
 * not say: who "he" is (NameMemory) and what is being preached (SermonContext).
 *
 * Two callers with opposite duties. `find` answers a person who pressed the
 * button (or typed a story) and will choose: up to four, each one the judge
 * does not rule out — so it may answer with one, or with none when nothing
 * was really alluded to. `suggest` speaks unasked, so it returns one passage
 * or nothing, on a much stricter line.
 */
export class AllusionFinder {
  readonly names = new NameMemory()
  readonly sermon = new SermonContext()

  constructor(private parts: {
    semantic: SemanticMatcher | null
    judge: Judge | null
    detectStory: (text: string) => PassageCandidate | null
  }) {}

  /** The models load after startup; names and stories work before they do. */
  install(semantic: SemanticMatcher, judge: Judge | null): void {
    this.parts.semantic = semantic
    this.parts.judge = judge
  }

  get meaning(): boolean { return !!this.parts.semantic?.ready }

  /** With the remembered name and without it; a wrong guess must not hide the right answer. */
  private readings(text: string, now: number): string[] {
    const carried = this.names.carry(text, now)
    return carried ? [text, `${carried} ${text}`] : [text]
  }

  async find(heardWords: string[], now = Date.now(), options: { spoken?: boolean } = {}): Promise<FoundPassage[]> {
    const words = heardWords.slice(options.spoken ? -60 : -25)
    if (!words.length) return []
    const sentence = words.join(' ')
    if (options.spoken && (isPrayerTalk(sentence) || isContemporaryTalk(sentence.toLowerCase()) || hasKnownStoryContradiction(sentence))) return []
    const found: FoundPassage[] = []
    /* Each meaning match keeps the words that found it, for the judge. */
    const byMeaning: { hit: SemanticCandidate; query: string }[] = []
    const boost = (book: string, chapter: number) => this.sermon.boost(book, chapter, now)
    for (const heard of this.readings(words.join(' '), now)) {
      const named = findNamedPassage(heard)
      if (named) found.push({ book: named.book, chapter: named.chapter, verse: named.verse, endVerse: named.end, title: named.name, evidence: [named.name], kind: 'named' })
      const story = this.parts.detectStory(heard)
      if (story) found.push({ book: story.book, chapter: story.chapter, verse: story.verse, endVerse: story.endVerse ?? story.verse, title: story.title, evidence: story.evidence, kind: 'story' })
      if (!this.parts.semantic?.ready) continue
      // The last sentence on its own, and with what led up to it: an allusion
      // is usually one sentence, but its subject is often named in the one before.
      const lead = heard.split(/\s+/).length - words.length
      const focusedWords = options.spoken ? 25 : 14
      const windows = words.length > focusedWords
        ? [heard, heard.split(/\s+/).filter((_, i, all) => i < lead || i >= all.length - focusedWords).join(' ')]
        : [heard]
      for (const window of windows) for (const hit of await this.parts.semantic.search(window, 8, boost)) byMeaning.push({ hit, query: window })
    }
    const meaning = byMeaning.sort((a, b) => b.hit.score - a.hit.score)
    const queryOf = new Map<FoundPassage, { query: string; text: string; confident: boolean }>()
    for (const { hit, query } of meaning) {
      const passage: FoundPassage = { ...hit, kind: 'meaning' }
      queryOf.set(passage, { query, text: hit.text, confident: hit.confident })
      found.push(passage)
    }
    const kept: FoundPassage[] = []
    for (const hit of found) {
      if (kept.some(k => k.book === hit.book && k.chapter === hit.chapter && hit.verse <= k.endVerse && hit.endVerse >= k.verse)) continue
      // Two places in one chapter at most, so a long story cannot fill a page.
      if (kept.filter(k => k.book === hit.book && k.chapter === hit.chapter).length >= 2) continue
      // A named passage or a known story is matched on its own words and
      // stands. A meaning match must get past the judge — on a lower line in
      // the passage being preached, which is evidence the judge cannot see.
      const asked = queryOf.get(hit)
      if (asked) {
        if (this.parts.judge) {
          const line = options.spoken ? SPOKEN_LINE : this.sermon.boost(hit.book, hit.chapter, now) ? SERMON_LINE : ASKED_LINE
          const relevance = await this.parts.judge(asked.query, asked.text)
          if (!Number.isFinite(relevance) || relevance < line) continue
        } else if (options.spoken && !asked.confident) {
          continue
        }
      }
      kept.push(hit)
      if (kept.length === FIND_LIMIT) break
    }
    return kept
  }

  /** One passage worth suggesting unasked for this finished sentence, or null. */
  async suggest(heard: string, now = Date.now()): Promise<SemanticCandidate | null> {
    const { semantic, judge } = this.parts
    if (!semantic?.ready || isContemporaryTalk(heard.toLowerCase()) || isPrayerTalk(heard)) return null
    let best: { hit: SemanticCandidate; score: number } | null = null
    for (const reading of this.readings(heard, now)) {
      const [hit] = await semantic.search(reading, 1)
      if (!hit) continue
      // Without the judge installed, fall back to the two-score thresholds.
      const score = judge ? await judge(reading, hit.text) : hit.confident ? JUDGE_LINE + 1 : 0
      if (score > JUDGE_LINE && (!best || score > best.score)) best = { hit, score }
    }
    return best?.hit ?? null
  }
}
