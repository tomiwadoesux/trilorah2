import type { ScriptureRecognition } from '../../shared/types'

export interface RecognitionCandidate {
  book: string
  chapter: number
  verse: number
  endVerse?: number | null
  source: ScriptureRecognition['source']
  passageId?: string
  evidence?: string[]
}

/** A growing description updates one suggestion. It never promotes it live. */
export class SuggestionTracker {
  private sequence = 0
  private previous: { candidate: RecognitionCandidate; id: string; at: number } | null = null

  reset(): void { this.previous = null }

  withdraw(suggestionId: string): void {
    if (this.previous?.id === suggestionId) this.previous = null
  }

  accept(candidate: RecognitionCandidate, now = Date.now()): ScriptureRecognition | null {
    const prev = this.previous
    const recent = !!prev && now - prev.at < 20_000
    const sameChapter = recent && prev.candidate.book === candidate.book && prev.candidate.chapter === candidate.chapter
    const samePassage = recent && !!candidate.passageId && candidate.passageId === prev.candidate.passageId
    const overlap = sameChapter && candidate.verse <= (prev.candidate.endVerse ?? prev.candidate.verse) &&
      (candidate.endVerse ?? candidate.verse) >= prev.candidate.verse
    const related = samePassage || overlap
    if (related && prev) {
      // Keep a precise quotation when a later, broader story description fits.
      // Advancing to a different verse inside the same passage still updates it.
      const sameReference = sameChapter && candidate.verse === prev.candidate.verse &&
        (candidate.endVerse ?? candidate.verse) === (prev.candidate.endVerse ?? prev.candidate.verse)
      const broadens = overlap && (candidate.endVerse ?? candidate.verse) - candidate.verse >
        (prev.candidate.endVerse ?? prev.candidate.verse) - prev.candidate.verse
      if (sameReference || broadens) {
        prev.at = now
        return null
      }
    }
    const id = related && prev ? prev.id : `recognition-${++this.sequence}`
    this.previous = { candidate, id, at: now }
    return { suggestionId: id, source: candidate.source, evidence: candidate.evidence ?? [] }
  }
}
