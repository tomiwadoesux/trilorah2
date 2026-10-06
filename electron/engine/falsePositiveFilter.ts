import type { SegmentType, VerseDetection } from '../../shared/types'

export const AMBIGUOUS_BOOKS = new Set([
  'Job',
  'Mark',
  'John',
  'Ruth',
  'Acts',
  'James',
  'Judges',
  'Numbers',
  'Amos',
  'Micah',
  'Nahum',
  'Titus'
])

export const SCRIPTURE_INTENT_PHRASES = [
  'the bible says',
  'the scripture says',
  'it is written',
  'the word of god says',
  'according to',
  'in the book of',
  'chapter',
  'verse',
  'the lord says',
  'thus saith',
  'as we read',
  'let us read',
  'turn to',
  'open your bibles to',
  'reading from'
]

export const FALSE_POSITIVE_PHRASES: Record<string, string[]> = {
  Job: [
    'job well done',
    'good job',
    'my job',
    'your job',
    'a job',
    'the job',
    'job opportunity',
    'job position'
  ],
  Mark: [
    'mark my words',
    'mark it',
    'leave a mark',
    'mark of',
    'benchmark',
    'mark the date'
  ],
  John: [
    'john is',
    'brother john',
    'sister john',
    'pastor john',
    'deacon john',
    'mr john'
  ],
  Ruth: [
    'sister ruth',
    'mama ruth',
    'auntie ruth',
    'miss ruth',
    'mrs ruth'
  ],
  Acts: ['acts of kindness', 'acts of service', 'random acts'],
  James: [
    'brother james',
    'pastor james',
    'deacon james',
    'mr james',
    'king james'
  ],
  Judges: ['the judges', 'judges decided', 'panel of judges'],
  Numbers: [
    'the numbers show',
    'numbers are',
    'by the numbers',
    'in numbers',
    'phone numbers'
  ]
}

export class FalsePositiveFilter {
  /**
   * Returns true if the detection should be BLOCKED (is a false positive).
   */
  shouldBlock(
    detection: VerseDetection,
    recentTranscript: string[],
    currentSegment: SegmentType
  ): boolean {
    // A named book with complete numbers is a reference, even outside a sermon.
    if (detection.explicitBook && detection.chapter > 0 && (detection.verse ?? 0) > 0 && (detection.confidence ?? 0) >= 0.85) return false
    if (currentSegment === 'worship') {
      console.log(
        `🚫 Blocked during worship: ${detection.book} ${detection.chapter}:${detection.verse}`
      )
      return true
    }
    const recentText = recentTranscript.join(' ').toLowerCase()
    if (currentSegment === 'announcements') {
      const hasIntent = SCRIPTURE_INTENT_PHRASES.some(
        (phrase) => recentText.includes(phrase)
      )
      if (!hasIntent) {
        console.log(
          `🚫 Blocked during announcements (no intent): ${detection.book} ${detection.chapter}:${detection.verse}`
        )
        return true
      }
    }
    // A quotation/passage matcher checked the actual text. Its book name was
    // looked up, not inferred from somebody saying "John" or "my job".
    if (!['quote', 'passage', 'named'].includes(detection.source ?? '') && AMBIGUOUS_BOOKS.has(detection.book)) {
      const bookPhrases = FALSE_POSITIVE_PHRASES[detection.book]
      if (bookPhrases) {
        for (const phrase of bookPhrases) {
          if (recentText.includes(phrase)) {
            console.log(
              `🚫 Blocked false positive: "${phrase}" → ${detection.book}`
            )
            return true
          }
        }
      }
      if (detection.confidence !== undefined && detection.confidence < 0.9) {
        const hasIntent = SCRIPTURE_INTENT_PHRASES.some(
          (phrase) => recentText.includes(phrase)
        )
        if (!hasIntent) {
          console.log(
            `🚫 Blocked ambiguous book (low confidence, no intent): ${detection.book}`
          )
          return true
        }
      }
    }
    return false
  }
}
