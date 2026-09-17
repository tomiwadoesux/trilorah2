import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AlertManager, MAX_ALERT_CHARS } from './alerts'

describe('AlertManager', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows, trims, and expires on the default timer', () => {
    const changes: unknown[] = []
    const m = new AlertManager((a) => changes.push(a), 5)
    const a = m.show('  Parent of   child 42 to nursery  ')
    expect(a?.text).toBe('Parent of child 42 to nursery')
    expect(a?.target).toBe('all')
    expect(m.current()?.id).toBe(a?.id)
    vi.advanceTimersByTime(4999)
    expect(m.current()).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(m.current()).toBeNull()
    expect(changes).toEqual([a, null])
  })

  it('ignores empty text and caps length', () => {
    const m = new AlertManager(() => undefined)
    expect(m.show('   ')).toBeNull()
    expect(m.show('x'.repeat(500))?.text.length).toBe(MAX_ALERT_CHARS)
  })

  it('a new alert replaces the old and resets the timer', () => {
    const m = new AlertManager(() => undefined, 10)
    const first = m.show('one')
    vi.advanceTimersByTime(8000)
    const second = m.show('two', { target: 'stream', durationSec: 3 })
    expect(m.current()?.id).toBe(second?.id)
    vi.advanceTimersByTime(2500)
    expect(m.current()?.id).toBe(second?.id) // first's timer must not fire
    vi.advanceTimersByTime(600)
    expect(m.current()).toBeNull()
    expect(first?.id).not.toBe(second?.id)
  })

  it('sticky alerts never expire; dismiss by id only hits the active one', () => {
    const m = new AlertManager(() => undefined)
    const a = m.show('stay', { durationSec: null })
    expect(a?.expiresAt).toBeNull()
    vi.advanceTimersByTime(10 * 60 * 1000)
    expect(m.current()).not.toBeNull()
    expect(m.dismiss('alert-999')).toBe(false)
    expect(m.dismiss(a!.id)).toBe(true)
    expect(m.dismiss()).toBe(false)
  })

  it('targets outputs by role', () => {
    const m = new AlertManager(() => undefined)
    const all = m.show('a')!
    expect(AlertManager.appliesTo(all, 'projector')).toBe(true)
    const stream = m.show('b', { target: 'stream' })!
    expect(AlertManager.appliesTo(stream, 'projector')).toBe(false)
    expect(AlertManager.appliesTo(stream, 'stream')).toBe(true)
  })
})
