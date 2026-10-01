import { afterEach, describe, expect, it, vi } from 'vitest'
import { DisplayTimingManager } from './displayTimingManager'

afterEach(() => vi.useRealTimers())
describe('manual live readings', () => {
  it('keeps an operator-selected verse up through silence and unrelated speech', () => {
    vi.useFakeTimers()
    const timing = new DisplayTimingManager(), dismiss = vi.fn()
    timing.setDismissCallback(dismiss)
    timing.onVerseDisplayed('But my God shall supply all your need', false)
    vi.advanceTimersByTime(60_000)
    timing.onTranscript('Let us move on to the next announcement', true)
    vi.advanceTimersByTime(60_000)
    expect(dismiss).not.toHaveBeenCalled()
    timing.clearTimers()
  })
  it('cancels an older automatic countdown when the operator sends a verse', () => {
    vi.useFakeTimers()
    const timing = new DisplayTimingManager(), dismiss = vi.fn()
    timing.setDismissCallback(dismiss)
    timing.onVerseDisplayed('previous automatic verse')
    vi.advanceTimersByTime(5_000)
    timing.onVerseDisplayed('operator reading', false)
    vi.advanceTimersByTime(60_000)
    expect(dismiss).not.toHaveBeenCalled()
  })
  it('retains timed dismissal for readings that explicitly enable it', () => {
    vi.useFakeTimers()
    const timing = new DisplayTimingManager(), dismiss = vi.fn()
    timing.setDismissCallback(dismiss)
    timing.onVerseDisplayed('automatic reading', true)
    vi.advanceTimersByTime(15_000)
    expect(dismiss).toHaveBeenCalledOnce()
  })
})
