import { describe, expect, it } from 'vitest'
import { SuggestionTracker, type RecognitionCandidate } from './suggestionTracker'

const story: RecognitionCandidate = { book: '1 Samuel', chapter: 17, verse: 41, endVerse: 50, source: 'passage', passageId: 'david-goliath' }
describe('growing scripture suggestions', () => {
  it('updates one card when the story narrows to a quotation', () => {
    const tracker = new SuggestionTracker()
    const initial = tracker.accept(story, 1000)!
    const narrowed = tracker.accept({ book: '1 Samuel', chapter: 17, verse: 45, source: 'quote' }, 1100)!
    expect(narrowed.suggestionId).toBe(initial.suggestionId)
    expect(tracker.accept(story, 1200)).toBeNull()
  })
  it('does not repeat an interim match when the final arrives', () => {
    const tracker = new SuggestionTracker()
    tracker.accept(story, 1000)
    expect(tracker.accept(story, 1500)).toBeNull()
    expect(tracker.accept(story, 3000)).toBeNull()
  })
  it('keeps unrelated passages as separate suggestions without a hold timer', () => {
    const tracker = new SuggestionTracker()
    const first = tracker.accept(story, 1000)!
    const next = tracker.accept({ book: 'John', chapter: 3, verse: 16, source: 'quote' }, 1001)!
    expect(next.suggestionId).not.toBe(first.suggestionId)
  })
  it('can revisit a story after a pause or listening restart', () => {
    const tracker = new SuggestionTracker()
    const initial = tracker.accept(story, 1000)!
    expect(tracker.accept(story, 22000)!.suggestionId).not.toBe(initial.suggestionId)
    tracker.reset()
    expect(tracker.accept(story, 22001)).not.toBeNull()
  })

  it('can suggest a withdrawn interim again when fresh words support it', () => {
    const tracker = new SuggestionTracker()
    const provisional = tracker.accept(story, 1000)!
    tracker.withdraw(provisional.suggestionId)
    expect(tracker.accept(story, 1100)!.suggestionId).not.toBe(provisional.suggestionId)
  })

  it('withdrawing an older hypothesis preserves a newer unrelated match', () => {
    const tracker = new SuggestionTracker()
    const old = tracker.accept(story, 1000)!
    const quote: RecognitionCandidate = { book: 'John', chapter: 3, verse: 16, source: 'quote' }
    tracker.accept(quote, 1001)
    tracker.withdraw(old.suggestionId)
    expect(tracker.accept(quote, 1002)).toBeNull()
  })
})
