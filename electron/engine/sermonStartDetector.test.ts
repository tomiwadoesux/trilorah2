import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SermonStartDetector } from './sermonStartDetector'
import { TransitionDetector } from './transitionDetector'

const teaching = [
  'Notice how Paul is writing to people who were afraid of what tomorrow would bring. He invites them to trust the promises of God through difficult circumstances.',
  'This means that our faith is not dependent on having everything figured out today. We learn that God remains faithful when the road ahead is uncertain for us.',
  'In this passage we see how that promise changes the way we treat our neighbours. Apply this to the difficult conversation you have been avoiding this week.',
]
function teach(d: SermonStartDetector, sermonNext = true) {
  teaching.forEach(text => { vi.advanceTimersByTime(7000); d.process(text, { sermonNext, speaker: 1 }) })
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-03T10:00:00Z')) })
afterEach(() => vi.useRealTimers())

describe('automatic sermon proposal with explicit confirmation', () => {
  it('can ask without a prepared schedule or sermon plan', () => {
    const d = new SermonStartDetector()
    d.process('My message today is about hope.', { sermonNext: false })
    teach(d, false)
    expect(d.getState().status).toBe('confirmation')
    expect(d.getState().startedAt).toBeNull()
  })
  it('a lone Bible cue, amen or scheduled time cannot start or prompt a sermon', () => {
    const d = new SermonStartDetector()
    d.process('Open your Bibles to John three verse sixteen.', { sermonNext: true })
    d.process('Amen.', { sermonNext: true })
    vi.advanceTimersByTime(50_000)
    expect(d.getState().status).not.toBe('confirmation')
    expect(d.getState().startedAt).toBeNull()
  })
  it('asks after an opening, schedule context and sustained teaching; only confirmation starts it', () => {
    const d = new SermonStartDetector()
    const openingAt = Date.now()
    d.process('My message today is about hope.', { sermonNext: true })
    teach(d)
    const proposal = d.getState()
    expect(proposal.status).toBe('confirmation')
    expect(proposal.startedAt).toBeNull()
    expect(proposal.evidence).toHaveLength(3)
    expect(d.respond('confirm', proposal.requestId)).toMatchObject({ status: 'active', startedAt: openingAt, confirmedAt: Date.now() })
  })
  it('uses a supplied sermon plan even without a service schedule', () => {
    const d = new SermonStartDetector()
    d.setPlan('Hope through the storm', [])
    d.process('My message today is Hope through the storm.', { sermonNext: false })
    teach(d, false)
    expect(d.getState().status).toBe('confirmation')
  })
  it('recognizes a handoff followed by continuing speech from another speaker', () => {
    const d = new SermonStartDetector()
    d.process('Please welcome our pastor.', { sermonNext: false, speaker: 0 })
    teach(d, false)
    expect(d.getState().status).toBe('confirmation')
    expect(d.getState().evidence).toContain('A new speaker is continuing')
  })
  it('requires new evidence after Not yet and rejects stale answers', () => {
    const d = new SermonStartDetector()
    d.process('My message today is about hope.', { sermonNext: true }); teach(d)
    const id = d.getState().requestId
    d.respond('not-yet', id)
    expect(() => d.respond('confirm', id)).toThrow(/changed/)
    teach(d)
    expect(d.getState().status).toBe('watching')
    vi.advanceTimersByTime(61_000)
    d.process('My message today is about hope.', { sermonNext: true }); teach(d)
    expect(d.getState().status).toBe('confirmation')
    expect(d.getState().requestId).not.toBe(id)
  })
  it('known singing, offering announcements and prayer invalidate pending evidence', () => {
    for (const negative of ['Father we come before you in prayer.', 'Prepare your offering and give online.', 'We have a few announcements.', 'Amazing grace how sweet the sound']) {
      const d = new SermonStartDetector()
      d.setLyrics('Amazing grace how sweet the sound that saved a wretch like me')
      d.process('My message today is about hope.', { sermonNext: true }); teach(d)
      d.process(negative, { sermonNext: true })
      expect(d.getState().status).toBe('watching')
    }
  })
  it('does not confuse sustained announcements or a plain reading with teaching', () => {
    const d = new SermonStartDetector()
    d.process('Open your Bibles.', { sermonNext: true })
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(8000)
      d.process('For God so loved the world that he gave his only begotten Son that whosoever believeth in him should not perish but have everlasting life.', { sermonNext: true })
    }
    expect(d.getState().status).not.toBe('confirmation')
  })
  it('expires an unanswered question and rejects a disconnected phone response', () => {
    const d = new SermonStartDetector()
    d.process('My message today is about hope.', { sermonNext: true }); teach(d)
    const id = d.getState().requestId
    vi.advanceTimersByTime(91_000)
    expect(() => d.respond('confirm', id)).toThrow(/changed/)
    expect(d.getState().status).toBe('watching')
  })
  it('manual start works without speech; duplicate starts do not reset the timestamp', () => {
    const d = new SermonStartDetector()
    const first = d.respond('start')
    vi.advanceTimersByTime(5000)
    expect(d.respond('start').startedAt).toBe(first.startedAt)
    d.process('Let us pray.', { sermonNext: false })
    expect(d.getState().status).toBe('active')
    d.respond('end')
    expect(d.getState().status).toBe('watching')
    d.respond('start'); d.reset()
    expect(d.getState().startedAt).toBeNull()
  })
  it('stopping listening cancels a proposal but preserves an active session', () => {
    const d = new SermonStartDetector()
    d.process('My message today is about hope.', { sermonNext: true }); teach(d)
    d.suspend()
    expect(d.getState().status).toBe('watching')
    d.respond('start'); d.suspend()
    expect(d.getState().status).toBe('active')
  })
})

describe('service transitions respect sermon confirmation', () => {
  it('prayer ending and Bible phrases cannot bypass confirmation', () => {
    const d = new TransitionDetector()
    d.setSchedule([{ type: 'prayer' }, { type: 'sermon' }])
    d.transitionTo('prayer', 1)
    d.processTranscript('Amen. Open your Bibles.')
    expect(d.getCurrentSegment().type).toBe('prayer')
    d.transitionTo('sermon', 0.9)
    expect(d.getCurrentSegment().type).toBe('prayer')
    d.respondToSermonStart('start')
    d.processTranscript('Let us pray. In closing, lift your hands.')
    expect(d.getCurrentSegment().type).toBe('sermon')
    d.respondToSermonStart('end')
    expect(d.getCurrentSegment().type).toBe('unknown')
  })
  it('follows repeated service stages by occurrence, including after schedule edits', () => {
    const d = new TransitionDetector()
    const schedule = [{ type: 'prayer' }, { type: 'worship' }, { type: 'prayer' }, { type: 'sermon' }]
    d.setSchedule(schedule)
    d.transitionTo('prayer', 1); d.transitionTo('worship', 1); d.transitionTo('prayer', 1)
    d.setSchedule([...schedule, { type: 'closing' }])
    expect(d.getNextScheduledSegment()).toBe('sermon')
    d.reset()
    expect(d.getNextScheduledSegment()).toBe('prayer')
  })
})
