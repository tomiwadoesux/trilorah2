import { findNamedPassage } from './namedPassages'
import { isContemporaryTalk, type PassageCandidate } from './passageMatcher'
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
 * Finds the passage a sentence points to, with what the sentence alone does
 * not say: who "he" is (NameMemory) and what is being preached (SermonContext).
 *
 * Two callers with opposite duties. `find` answers a person who pressed the
 * button and will choose, so it never abstains and returns up to eight.
 * `suggest` speaks unasked, so it returns one passage or nothing.
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

  async find(heardWords: string[], now = Date.now()): Promise<FoundPassage[]> {
    const words = heardWords.slice(-25)
    if (!words.length) return []
    const found: FoundPassage[] = []
    const byMeaning: SemanticCandidate[] = []
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
      const windows = words.length > 14 ? [heard.split(/\s+/).filter((_, i, all) => i < lead || i >= all.length - 14).join(' '), heard] : [heard]
      for (const window of windows) byMeaning.push(...await this.parts.semantic.search(window, 8, boost))
    }
    for (const hit of byMeaning.sort((a, b) => b.score - a.score)) found.push({ ...hit, kind: 'meaning' })
    const kept: FoundPassage[] = []
    for (const hit of found) {
      if (kept.some(k => k.book === hit.book && k.chapter === hit.chapter && hit.verse <= k.endVerse && hit.endVerse >= k.verse)) continue
      // Two places in one chapter at most, so a long story cannot fill a page.
      if (kept.filter(k => k.book === hit.book && k.chapter === hit.chapter).length >= 2) continue
      kept.push(hit)
      if (kept.length === 8) break
    }
    return kept
  }

  /** One passage worth suggesting unasked for this finished sentence, or null. */
  async suggest(heard: string, now = Date.now()): Promise<SemanticCandidate | null> {
    const { semantic, judge } = this.parts
    if (!semantic?.ready || isContemporaryTalk(heard.toLowerCase())) return null
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
