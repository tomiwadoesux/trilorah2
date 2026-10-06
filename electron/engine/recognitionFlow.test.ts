import { beforeAll, describe, expect, it } from 'vitest'
import { QuoteMatcher } from './quoteMatcher'
import { PassageMatcher } from './passageMatcher'
import { SuggestionTracker, type RecognitionCandidate } from './suggestionTracker'
import { VerseDelivery, type VersePreview } from './verseDelivery'
import { ScriptureSession } from './scriptureSession'
import { findNamedPassage } from './namedPassages'
import { quotesForNamedPassage } from './recognitionPriority'

/** Component integration: real indexes + matchers + suggestion identity +
 * preview/live ownership. This does not launch Electron or exercise main.ts,
 * a microphone, ASR provider, IPC, or browser rendering. */
describe('streaming recognition component integration', () => {
  const quotes = new QuoteMatcher()
  beforeAll(() => { expect(quotes.loadIndex()).toBe(true) })

  function flow() {
    quotes.reset()
    const passages = new PassageMatcher()
    const tracker = new SuggestionTracker()
    const delivery = new VerseDelivery()
    const emitted: VersePreview[] = []
    let clock = 1000
    function feed(text: string, isFinal: boolean) {
      quotes.updateTranscript(text, isFinal)
      const passage = passages.updateTranscript(text, isFinal)
      const named = isFinal ? findNamedPassage(text) : null
      const quote = quotesForNamedPassage(quotes.findAllQuotedVerses(), named)[0]
      const candidate: RecognitionCandidate | null = quote
        ? { book: quote.ref.replace(/ \d+:\d+$/, ''), chapter: quote.chapter, verse: quote.verse, source: 'quote' }
        : named
          ? { book: named.book, chapter: named.chapter, verse: named.verse, endVerse: named.end, source: 'named' }
          : passage
      if (!candidate) return
      const recognition = tracker.accept(candidate, clock++)
      if (!recognition) return
      // Normalised KJV text from the real quote corpus; no invented verse text.
      const prefix = `${candidate.book} ${candidate.chapter}:`
      const rows = quotes.verses.filter(verse => verse.ref.startsWith(prefix) &&
        verse.verse >= candidate.verse && verse.verse <= (candidate.endVerse ?? candidate.verse))
      // The corpus indexes several translations. Keep its first (KJV) wording
      // per verse, just as display loads one requested translation.
      const oneTranslation = new Map<number, { verse: number; text: string }>()
      for (const verse of rows) if (!oneTranslation.has(verse.verse)) {
        oneTranslation.set(verse.verse, { verse: verse.verse, text: (verse.rawWords ?? verse.words).join(' ') })
      }
      const verses = [...oneTranslation.values()]
      expect(verses.length).toBe((candidate.endVerse ?? candidate.verse) - candidate.verse + 1)
      emitted.push(delivery.stage({
        book: candidate.book, chapter: candidate.chapter, verse: candidate.verse,
        endVerse: candidate.endVerse, recognition, source: candidate.source,
        text: verses.map(verse => verse.text).join(' '), verses,
        version: 'KJV', isRange: !!candidate.endVerse && candidate.endVerse !== candidate.verse,
      }))
    }
    return { feed, delivery, emitted }
  }

  it('updates the same suggestion as an interim story narrows to a quotation', () => {
    const { feed, delivery, emitted } = flow()
    feed('when david faced goliath', false)
    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toMatchObject({ book: '1 Samuel', chapter: 17, isPreview: true, recognition: { source: 'passage' } })
    const id = emitted[0].recognition!.suggestionId
    feed('when david faced goliath', true)
    expect(emitted).toHaveLength(1)
    const quote = 'thou comest to me with a sword and with a spear and with a shield but i come to thee in the name of the lord of hosts'
    feed(quote, false)
    expect(emitted).toHaveLength(2)
    expect(emitted[1]).toMatchObject({ book: '1 Samuel', chapter: 17, verse: 45, isPreview: true, recognition: { source: 'quote', suggestionId: id } })
    feed(quote, true)
    feed(quote, true)
    expect(emitted).toHaveLength(2)
    expect(delivery.live).toBeNull()
    expect(delivery.promote('auto mode')).toBeNull()
    expect(delivery.promote('operator')).toMatchObject({ verse: 45, isPreview: false })
  })

  it('recognises a distinctive short quote on the interim without repeating the final', () => {
    const { feed, delivery, emitted } = flow()
    feed('for god so loved', false)
    expect(emitted).toHaveLength(1)
    expect(delivery.preview).toMatchObject({ book: 'John', chapter: 3, verse: 16, isPreview: true })
    feed('for god so loved the world', false)
    feed('for god so loved the world', true)
    expect(emitted).toHaveLength(1)
    expect(delivery.live).toBeNull()
  })

  it('does not join replaced interim hypotheses into a story or a quotation', () => {
    const { feed, delivery, emitted } = flow()
    for (const text of ['david', 'goliath', 'world', 'only', 'begotten', 'sword']) feed(text, false)
    feed('lunch is ready', true)
    expect(emitted).toEqual([])
    expect(delivery.preview).toBeNull()
    expect(delivery.live).toBeNull()
  })

  it.each([
    ['the lord is my shepherd', 'Psalms', 23, 1],
    ['i am the good shepherd the good shepherd giveth his life for the sheep', 'John', 10, 11],
  ] as const)('keeps the precise quotation when its final also names a passage: %s', (text, book, chapter, verse) => {
    const { feed, delivery, emitted } = flow()
    feed(text, false)
    expect(emitted).toHaveLength(1)
    const suggestionId = emitted[0].recognition!.suggestionId
    expect(findNamedPassage(text)).not.toBeNull()
    feed(text, true)
    expect(emitted).toHaveLength(1)
    expect(delivery.preview).toMatchObject({ book, chapter, verse, recognition: { suggestionId, source: 'quote' } })
    expect(delivery.preview?.endVerse).toBeUndefined()
    expect(delivery.live).toBeNull()
  })

  it('switches from older story context to a newly named passage', () => {
    const { feed, delivery, emitted } = flow()
    feed('when david faced goliath', true)
    expect(delivery.preview?.book).toBe('1 Samuel')
    feed('the lords prayer', true)
    expect(emitted).toHaveLength(2)
    expect(delivery.preview).toMatchObject({ book: 'Matthew', chapter: 6, verse: 9, endVerse: 13, recognition: { source: 'named' } })
  })

  it('lets a new passage name override unrelated quotation candidates', () => {
    quotes.reset()
    quotes.updateTranscript('for god so loved the world', false)
    const matches = quotes.findAllQuotedVerses()
    expect(matches[0]?.ref).toBe('John 3:16')
    expect(quotesForNamedPassage(matches, findNamedPassage('the lords prayer'))).toEqual([])
  })

  it('does not auto-advance when a quotation finishes after its early suggestion', () => {
    const { feed, delivery, emitted } = flow()
    const sessionReferences: number[] = []
    const session = new ScriptureSession(display => { sessionReferences.push(display.verseStart) })
    feed('for god so loved', false)
    const early = delivery.preview!
    // Automatic recognition stages through ScriptureSession, then explicitly
    // disables reading mode. A suggestion has not started an operator reading.
    session.onReferenceDetected({ book: early.book, chapter: early.chapter, verse: early.verse })
    session.setCurrentVerseText(early.text)
    session.exitReadingMode()
    const completed = 'for god so loved the world that he gave his only begotten son that whosoever believeth in him should not perish but have everlasting life'
    for (const isFinal of [false, true]) {
      // main.ts processes reading navigation before recognition in each chunk.
      session.processTranscript(completed)
      feed(completed, isFinal)
    }
    expect(sessionReferences).toEqual([16])
    expect(session.currentVerse).toBe(16)
    expect(emitted).toHaveLength(1)
    expect(delivery.live).toBeNull()
  })

  it('leaves the operator’s live verse unchanged when another passage is recognised', () => {
    const { feed, delivery, emitted } = flow()
    feed('for god so loved the world', true)
    delivery.promote('remote')
    feed('when david faced goliath', false)
    expect(emitted.at(-1)).toMatchObject({ book: '1 Samuel', chapter: 17, isPreview: true })
    expect(delivery.live).toMatchObject({ book: 'John', chapter: 3, verse: 16, isPreview: false })
    expect(delivery.promote('auto (reading started)')).toBeNull()
    expect(delivery.live?.book).toBe('John')
  })
})
