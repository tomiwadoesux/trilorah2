import { afterEach, expect, it, vi } from 'vitest'
import { ServiceAgent } from './serviceAgent'
import { TransitionDetector } from './transitionDetector'
import { FalsePositiveFilter } from './falsePositiveFilter'
import { DisplayTimingManager } from './displayTimingManager'
import type { MediaMatcher } from '../media/mediaMatcher'

afterEach(() => vi.useRealTimers())
it('retains the candidate opening once confirmed, includes sermon prayer, and resets for a new service', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-03T10:00:00Z'))
  const detector = new TransitionDetector()
  detector.setSchedule([{ type: 'sermon' }])
  const agent = new ServiceAgent(detector, new FalsePositiveFilter(), new DisplayTimingManager(), { reset: vi.fn() } as unknown as MediaMatcher)
  function hear(text: string) { detector.processTranscript(text); agent.processTranscript(text, true); vi.advanceTimersByTime(7000) }
  hear('We have a few announcements for the church today.')
  const start = Date.now()
  const opening = 'My message today is about hope and what happens when the road ahead of us is uncertain.'
  hear(opening)
  hear('Notice how Paul is writing to people who were afraid of tomorrow. He invites them to trust the promises of God through difficult circumstances.')
  hear('This means that our faith is not dependent on knowing every answer. We learn that God remains faithful when our own strength fails us.')
  hear('In this passage we see how that promise changes the way we treat our neighbours. Apply this to the conversation you have been avoiding this week.')
  expect(agent.getSermonText()).toBe('')
  detector.respondToSermonStart('confirm', detector.sermonStart.getState().requestId)
  expect(detector.getCurrentSegment().startedAt).toBe(start)
  expect(agent.getSermonText()).toContain(opening)
  expect(agent.getSermonText()).not.toContain('announcements')
  hear('Let us pray. Father we thank you for this word.')
  expect(agent.getSermonText()).toContain('Let us pray.')
  detector.respondToSermonStart('start')
  expect(agent.getSermonText().split(opening)).toHaveLength(2)
  agent.reset()
  expect(agent.getSermonText()).toBe('')
  expect(detector.sermonStart.getState().status).toBe('watching')
})
