import { describe, it, expect } from 'vitest'
import { AutoModeController, type AutoModeEvent } from './autoMode'
import type { Candidate } from './candidates'

const mk = (book: string, score: number): Candidate => ({
  book,
  chapter: 3,
  verse: 16,
  score,
  reasons: [],
  source: 'primary'
})

function setup(opts: { eligible?: boolean; enabled?: boolean } = {}) {
  const events: AutoModeEvent[] = []
  const ctl = new AutoModeController({
    isEligible: () => opts.eligible ?? true,
    isEnabled: () => opts.enabled ?? true,
    onEvent: (e) => events.push(e),
    now: () => 1000
  })
  return { ctl, events }
}

const clear = [mk('John', 90), mk('Jonah', 60)]
const clash = [mk('John', 70), mk('Jonah', 62)]

describe('AutoModeController.decide', () => {
  it('cannot auto-push when the live surface is controlled manually', () => {
    const { ctl, events } = setup()
    expect(ctl.decide('p1', clear, { manualOnly: true, graceWindow: true }).action).toBe('preview')
    expect(events).toEqual([])
  })
  it('previews when the switch is off, even if eligible', () => {
    const { ctl, events } = setup({ enabled: false })
    const d = ctl.decide('p1', clear)
    expect(d.action).toBe('preview')
    expect(d.reason).toBe('auto mode off')
    expect(events).toHaveLength(0)
  })

  it('previews when switched on but not eligible', () => {
    const { ctl } = setup({ eligible: false })
    const d = ctl.decide('p1', clear)
    expect(d.action).toBe('preview')
    expect(d.reason).toBe('auto mode not yet eligible')
  })

  it('arms the grace window instead of previewing when it is enabled', () => {
    const { ctl } = setup({ enabled: false })
    expect(ctl.decide('p1', clear, { graceWindow: true }).action).toBe('arm-grace')
  })

  it('auto-pushes a clear winner with a ping', () => {
    const { ctl, events } = setup()
    const d = ctl.decide('p1', clear)
    expect(d.action).toBe('auto-push')
    expect(d.candidates).toEqual(clear)
    expect(events).toEqual([{ type: 'auto-push', preacherId: 'p1', ref: clear[0], ping: true }])
  })

  it('arms the grace window when active and no clash', () => {
    const { ctl, events } = setup()
    expect(ctl.decide('p1', clear, { graceWindow: true }).action).toBe('arm-grace')
    expect(events).toHaveLength(0)
    expect(ctl.shouldAutoPushOnReadingStarted('p1')).toBe(true)
  })

  it('holds a clash and emits the candidate list', () => {
    const { ctl, events } = setup()
    const d = ctl.decide('p1', clash, { graceWindow: true })
    expect(d.action).toBe('hold-clash')
    expect(events).toEqual([{ type: 'clash', preacherId: 'p1', candidates: clash }])
    expect(ctl.hasPendingClash()).toBe(true)
  })

  it('previews on an empty list', () => {
    const { ctl } = setup()
    expect(ctl.decide('p1', []).action).toBe('preview')
  })
})

describe('clash lifecycle', () => {
  it('blocks reading-started auto-push while a clash is pending', () => {
    const { ctl } = setup()
    ctl.decide('p1', clash)
    expect(ctl.shouldAutoPushOnReadingStarted('p1')).toBe(false)
  })

  it('resolveClash returns the choice, emits, and clears', () => {
    const { ctl, events } = setup()
    ctl.decide('p1', clash)
    const chosen = ctl.resolveClash(1)
    expect(chosen).toBe(clash[1])
    expect(events[1]).toEqual({ type: 'clash-resolved', preacherId: 'p1', chosen: clash[1] })
    expect(ctl.hasPendingClash()).toBe(false)
    expect(ctl.shouldAutoPushOnReadingStarted('p1')).toBe(true)
  })

  it('resolveClash is a no-op with nothing pending or a bad index', () => {
    const { ctl, events } = setup()
    expect(ctl.resolveClash(0)).toBeNull()
    ctl.decide('p1', clash)
    expect(ctl.resolveClash(7)).toBeNull()
    expect(ctl.hasPendingClash()).toBe(true)
    expect(events.filter((e) => e.type === 'clash-resolved')).toHaveLength(0)
  })

  it('a later clear detection supersedes a pending clash', () => {
    const { ctl } = setup()
    ctl.decide('p1', clash)
    ctl.decide('p1', clear)
    expect(ctl.hasPendingClash()).toBe(false)
  })

  it('dismissClash clears and emits', () => {
    const { ctl, events } = setup()
    ctl.decide('p1', clash)
    ctl.dismissClash()
    expect(ctl.hasPendingClash()).toBe(false)
    expect(events[1]).toEqual({ type: 'clash-dismissed', preacherId: 'p1' })
  })

  it('shouldAutoPushOnReadingStarted is false when inactive', () => {
    const { ctl } = setup({ enabled: false })
    expect(ctl.shouldAutoPushOnReadingStarted('p1')).toBe(false)
  })
})
