import { describe, it, expect, beforeEach } from 'vitest'
import {
  TimerStore,
  formatTimerDisplay,
  nextOccurrence,
  isTargetTime,
  type TimerSnapshot
} from './timers'

let now: number
let emissions: TimerSnapshot[][]

/** A fixed local Saturday 09:00 so wall-clock tests are not date-dependent. */
function localTime(h: number, m: number, dayOffset = 0): number {
  const d = new Date(2026, 8, 5, h, m, 0, 0)
  return d.getTime() + dayOffset * 86_400_000
}

function store() {
  return new TimerStore((t) => emissions.push(t), () => now)
}

beforeEach(() => {
  now = localTime(9, 0)
  emissions = []
})

describe('formatTimerDisplay', () => {
  it('shows M:SS under an hour', () => {
    expect(formatTimerDisplay(0)).toBe('0:00')
    expect(formatTimerDisplay(9_000)).toBe('0:09')
    expect(formatTimerDisplay(247_000)).toBe('4:07')
    expect(formatTimerDisplay(59_000)).toBe('0:59')
    expect(formatTimerDisplay(59_999)).toBe('0:59')
  })

  it('rolls to minutes and hours on the boundary', () => {
    expect(formatTimerDisplay(60_000)).toBe('1:00')
    expect(formatTimerDisplay(3_599_000)).toBe('59:59')
    expect(formatTimerDisplay(3_600_000)).toBe('1:00:00')
    expect(formatTimerDisplay(3_661_000)).toBe('1:01:01')
    expect(formatTimerDisplay(36_000_000)).toBe('10:00:00')
  })

  it('prefixes negatives and truncates toward zero', () => {
    expect(formatTimerDisplay(-12_000)).toBe('-0:12')
    expect(formatTimerDisplay(-1)).toBe('0:00')
    expect(formatTimerDisplay(-999)).toBe('0:00')
    expect(formatTimerDisplay(-60_000)).toBe('-1:00')
    expect(formatTimerDisplay(-3_600_000)).toBe('-1:00:00')
  })

  it('holds 0:00 for the whole final second rather than flicking to -0:01', () => {
    // 900ms left and 900ms past zero both read as zero.
    expect(formatTimerDisplay(900)).toBe('0:00')
    expect(formatTimerDisplay(-900)).toBe('0:00')
    expect(formatTimerDisplay(-1_000)).toBe('-0:01')
  })

  it('survives rubbish input', () => {
    expect(formatTimerDisplay(NaN)).toBe('0:00')
    expect(formatTimerDisplay(Infinity)).toBe('0:00')
  })
})

describe('isTargetTime / nextOccurrence', () => {
  it('accepts only 24-hour HH:MM', () => {
    expect(isTargetTime('10:30')).toBe(true)
    expect(isTargetTime('00:00')).toBe(true)
    expect(isTargetTime('23:59')).toBe(true)
    expect(isTargetTime('24:00')).toBe(false)
    expect(isTargetTime('9:30')).toBe(false)
    expect(isTargetTime('10:60')).toBe(false)
    expect(isTargetTime('half ten')).toBe(false)
    expect(isTargetTime(1030)).toBe(false)
  })

  it('resolves later today when the time is still ahead', () => {
    expect(nextOccurrence('10:30', localTime(9, 0))).toBe(localTime(10, 30))
  })

  it('rolls to tomorrow when the time has passed', () => {
    // The Saturday-night setup for a Sunday-morning countdown.
    expect(nextOccurrence('10:30', localTime(22, 0))).toBe(localTime(10, 30, 1))
  })

  it('treats the exact target instant as still ahead, not gone', () => {
    // Strictly '<' inside nextOccurrence: a countdown started at exactly
    // 10:30 must read 0:00, not jump a full day.
    expect(nextOccurrence('10:30', localTime(10, 30))).toBe(localTime(10, 30))
    // One second past, and the next occurrence really is tomorrow.
    expect(nextOccurrence('10:30', localTime(10, 30, 1))).toBe(localTime(10, 30) + 86_400_000)
  })
})

describe('create', () => {
  it('creates each kind with stable sequential ids', () => {
    const s = store()
    const a = s.create({ kind: 'countdown', durationSec: 300, name: 'Offering' })!
    const b = s.create({ kind: 'to-time', targetTime: '10:30' })!
    const c = s.create({ kind: 'elapsed', name: 'Sermon' })!
    expect([a.id, b.id, c.id]).toEqual(['timer-1', 'timer-2', 'timer-3'])
    expect(a.name).toBe('Offering')
    expect(a.state).toBe('stopped')
    expect(a.overrun).toBe(false)
    expect(s.list()).toHaveLength(3)
    expect(c.name).toBe('Sermon')
  })

  it('falls back to a default name when none is given', () => {
    const s = store()
    expect(s.create({ kind: 'countdown', durationSec: 60 })!.name).toBe('Countdown')
    expect(s.create({ kind: 'to-time', targetTime: '10:30' })!.name).toBe('Countdown to time')
    expect(s.create({ kind: 'elapsed', name: '   ' })!.name).toBe('Elapsed')
  })

  it('rejects a countdown without a positive duration', () => {
    const s = store()
    expect(s.create({ kind: 'countdown' })).toBeNull()
    expect(s.create({ kind: 'countdown', durationSec: 0 })).toBeNull()
    expect(s.create({ kind: 'countdown', durationSec: -30 })).toBeNull()
    expect(s.create({ kind: 'countdown', durationSec: NaN })).toBeNull()
    expect(s.list()).toHaveLength(0)
    expect(emissions).toHaveLength(0)
  })

  it('rejects a to-time without a valid target and an unknown kind', () => {
    const s = store()
    expect(s.create({ kind: 'to-time' })).toBeNull()
    expect(s.create({ kind: 'to-time', targetTime: '25:00' })).toBeNull()
    expect(s.create({ kind: 'sundial' as never })).toBeNull()
    expect(s.list()).toHaveLength(0)
  })
})

describe('countdown', () => {
  it('counts down from its duration', () => {
    const s = store()
    const t = s.create({ kind: 'countdown', durationSec: 300 })!
    expect(s.valueOf(t.id)!.display).toBe('5:00')

    s.start(t.id)
    now += 53_000
    const v = s.valueOf(t.id)!
    expect(v.remainingMs).toBe(247_000)
    expect(v.display).toBe('4:07')
    expect(v.state).toBe('running')
    expect(v.overrunning).toBe(false)
  })

  it('stops dead at zero when overrun is off', () => {
    const s = store()
    const t = s.create({ kind: 'countdown', durationSec: 10 })!
    s.start(t.id)
    now += 30_000
    const v = s.valueOf(t.id)!
    expect(v.remainingMs).toBe(0)
    expect(v.display).toBe('0:00')
    expect(v.overrunning).toBe(false)
  })

  it('goes negative when overrun is on', () => {
    const s = store()
    const t = s.create({ kind: 'countdown', durationSec: 10, overrun: true })!
    s.start(t.id)
    now += 22_000
    const v = s.valueOf(t.id)!
    expect(v.remainingMs).toBe(-12_000)
    expect(v.display).toBe('-0:12')
    expect(v.overrunning).toBe(true)
  })

  it('is not overrunning while it still has time on the clock', () => {
    const s = store()
    const t = s.create({ kind: 'countdown', durationSec: 60, overrun: true })!
    s.start(t.id)
    now += 59_000
    expect(s.valueOf(t.id)!.overrunning).toBe(false)
    now += 2_000
    expect(s.valueOf(t.id)!.overrunning).toBe(true)
  })

  it('formats a long countdown with hours', () => {
    const s = store()
    const t = s.create({ kind: 'countdown', durationSec: 5400 })!
    expect(s.valueOf(t.id)!.display).toBe('1:30:00')
  })
})

describe('elapsed', () => {
  it('counts up from start and never goes negative', () => {
    const s = store()
    const t = s.create({ kind: 'elapsed' })!
    expect(s.valueOf(t.id)!.remainingMs).toBe(0)

    s.start(t.id)
    now += 3_723_000
    const v = s.valueOf(t.id)!
    expect(v.remainingMs).toBe(3_723_000)
    expect(v.display).toBe('1:02:03')
    expect(v.overrunning).toBe(false)
  })

  it('does not advance while stopped', () => {
    const s = store()
    const t = s.create({ kind: 'elapsed' })!
    now += 60_000
    expect(s.valueOf(t.id)!.remainingMs).toBe(0)
  })
})

describe('pause and resume', () => {
  it('accumulates elapsed across several segments', () => {
    const s = store()
    const t = s.create({ kind: 'elapsed' })!
    s.start(t.id)
    now += 10_000
    s.pause(t.id)

    // Frozen while paused, however long the operator leaves it.
    expect(s.valueOf(t.id)!.remainingMs).toBe(10_000)
    now += 60_000
    expect(s.valueOf(t.id)!.remainingMs).toBe(10_000)
    expect(s.valueOf(t.id)!.state).toBe('paused')

    s.start(t.id)
    now += 5_000
    expect(s.valueOf(t.id)!.remainingMs).toBe(15_000)

    s.pause(t.id)
    now += 1_000
    s.start(t.id)
    now += 2_000
    expect(s.valueOf(t.id)!.remainingMs).toBe(17_000)
  })

  it('preserves a countdown across a pause', () => {
    const s = store()
    const t = s.create({ kind: 'countdown', durationSec: 60 })!
    s.start(t.id)
    now += 20_000
    s.pause(t.id)
    now += 600_000
    expect(s.valueOf(t.id)!.display).toBe('0:40')
    s.start(t.id)
    now += 10_000
    expect(s.valueOf(t.id)!.remainingMs).toBe(30_000)
  })

  it('ignores a double start so the clock is never reset by a stray click', () => {
    const s = store()
    const t = s.create({ kind: 'elapsed' })!
    s.start(t.id)
    now += 5_000
    const again = s.start(t.id)!
    expect(again.state).toBe('running')
    now += 5_000
    expect(s.valueOf(t.id)!.remainingMs).toBe(10_000)
  })

  it('ignores a pause on a stopped timer', () => {
    const s = store()
    const t = s.create({ kind: 'elapsed' })!
    const paused = s.pause(t.id)!
    expect(paused.state).toBe('stopped')
    expect(paused.elapsedBeforePauseMs).toBe(0)
  })
})

describe('to-time', () => {
  it('counts down to the target later today', () => {
    const s = store() // 09:00
    const t = s.create({ kind: 'to-time', targetTime: '10:30' })!
    expect(s.valueOf(t.id)!.display).toBe('1:30:00')

    s.start(t.id)
    now += 60_000
    expect(s.valueOf(t.id)!.display).toBe('1:29:00')
  })

  it('rolls to tomorrow for a target that has already passed', () => {
    now = localTime(14, 0)
    const s = store()
    const t = s.create({ kind: 'to-time', targetTime: '10:30' })!
    // 14:00 Saturday to 10:30 Sunday is 20h30m.
    expect(s.valueOf(t.id)!.display).toBe('20:30:00')
    expect(s.valueOf(t.id)!.remainingMs).toBe(20.5 * 3_600_000)
  })

  it('overruns past the target instead of jumping a day forward', () => {
    now = localTime(10, 29)
    const s = store()
    const t = s.create({ kind: 'to-time', targetTime: '10:30', overrun: true })!
    s.start(t.id)
    now += 60_000 // exactly 10:30
    expect(s.valueOf(t.id)!.remainingMs).toBe(0)
    now += 45_000
    const v = s.valueOf(t.id)!
    expect(v.remainingMs).toBe(-45_000)
    expect(v.display).toBe('-0:45')
    expect(v.overrunning).toBe(true)
  })

  it('parks at zero past the target when overrun is off', () => {
    now = localTime(10, 29)
    const s = store()
    const t = s.create({ kind: 'to-time', targetTime: '10:30' })!
    s.start(t.id)
    now += 5 * 60_000
    const v = s.valueOf(t.id)!
    expect(v.remainingMs).toBe(0)
    expect(v.overrunning).toBe(false)
  })

  it('ignores pause, because a wall-clock target cannot be paused', () => {
    const s = store() // 09:00
    const t = s.create({ kind: 'to-time', targetTime: '10:30' })!
    s.start(t.id)
    now += 30 * 60_000 // 09:30, one hour to go
    s.pause(t.id)
    // Still running: pausing a to-time timer is a no-op, so it stays glued
    // to the clock instead of drifting away from the instant it chases.
    expect(s.valueOf(t.id)!.state).toBe('running')
    expect(s.valueOf(t.id)!.display).toBe('1:00:00')
    now += 45 * 60_000 // 10:15 — fifteen minutes to go, tracked honestly
    expect(s.valueOf(t.id)!.display).toBe('15:00')
  })
})

describe('reset', () => {
  it('returns a countdown to its full duration and stops it', () => {
    const s = store()
    const t = s.create({ kind: 'countdown', durationSec: 300 })!
    s.start(t.id)
    now += 120_000
    const r = s.reset(t.id)!
    expect(r.state).toBe('stopped')
    expect(r.elapsedBeforePauseMs).toBe(0)
    expect(r.startedAt).toBeNull()
    expect(s.valueOf(t.id)!.display).toBe('5:00')
    now += 60_000
    expect(s.valueOf(t.id)!.display).toBe('5:00')
  })

  it('returns an elapsed timer to zero', () => {
    const s = store()
    const t = s.create({ kind: 'elapsed' })!
    s.start(t.id)
    now += 90_000
    s.reset(t.id)
    expect(s.valueOf(t.id)!.remainingMs).toBe(0)
    expect(s.valueOf(t.id)!.display).toBe('0:00')
  })

  it('clears an overrun so the timer can run clean again', () => {
    const s = store()
    const t = s.create({ kind: 'countdown', durationSec: 10, overrun: true })!
    s.start(t.id)
    now += 30_000
    expect(s.valueOf(t.id)!.overrunning).toBe(true)
    s.reset(t.id)
    expect(s.valueOf(t.id)!.overrunning).toBe(false)
    expect(s.valueOf(t.id)!.remainingMs).toBe(10_000)
  })

  it('resets a paused timer', () => {
    const s = store()
    const t = s.create({ kind: 'elapsed' })!
    s.start(t.id)
    now += 30_000
    s.pause(t.id)
    const r = s.reset(t.id)!
    expect(r.state).toBe('stopped')
    expect(r.pausedAt).toBeNull()
  })
})

describe('update and remove', () => {
  it('renames, retimes and toggles overrun', () => {
    const s = store()
    const t = s.create({ kind: 'countdown', durationSec: 60 })!
    const u = s.update(t.id, { name: 'Offering', durationSec: 120, overrun: true })!
    expect(u.name).toBe('Offering')
    expect(u.durationSec).toBe(120)
    expect(u.overrun).toBe(true)
    expect(s.valueOf(t.id)!.display).toBe('2:00')
  })

  it('rejects a field that does not belong to the kind, leaving the timer untouched', () => {
    const s = store()
    const t = s.create({ kind: 'countdown', durationSec: 60 })!
    expect(s.update(t.id, { targetTime: '10:30' })).toBeNull()
    expect(s.update(t.id, { durationSec: 0 })).toBeNull()
    expect(s.update(t.id, { name: 'Kept', durationSec: -5 })).toBeNull()
    const after = s.list()[0]
    expect(after.durationSec).toBe(60)
    expect(after.name).toBe('Countdown')
    expect(after.targetTime).toBeUndefined()
  })

  it('rejects a bad target on a to-time timer', () => {
    const s = store()
    const t = s.create({ kind: 'to-time', targetTime: '10:30' })!
    expect(s.update(t.id, { targetTime: '99:99' })).toBeNull()
    expect(s.update(t.id, { durationSec: 60 })).toBeNull()
    expect(s.list()[0].targetTime).toBe('10:30')
  })

  it('removes a timer and leaves the others alone', () => {
    const s = store()
    const a = s.create({ kind: 'elapsed' })!
    const b = s.create({ kind: 'countdown', durationSec: 60 })!
    expect(s.remove(a.id)).toBe(true)
    expect(s.list().map((t) => t.id)).toEqual([b.id])
    expect(s.remove(a.id)).toBe(false)
  })
})

describe('unknown ids', () => {
  it('return null or false rather than throwing', () => {
    const s = store()
    s.create({ kind: 'elapsed' })
    expect(s.update('timer-99', { name: 'x' })).toBeNull()
    expect(s.start('timer-99')).toBeNull()
    expect(s.pause('timer-99')).toBeNull()
    expect(s.reset('timer-99')).toBeNull()
    expect(s.valueOf('timer-99')).toBeNull()
    expect(s.remove('timer-99')).toBe(false)
    expect(s.remove('')).toBe(false)
  })
})

describe('snapshot and onChange', () => {
  it('fires once per successful mutation and never on a read', () => {
    const s = store()
    const t = s.create({ kind: 'countdown', durationSec: 60 })! // 1
    expect(emissions).toHaveLength(1)

    s.start(t.id) // 2
    s.pause(t.id) // 3
    s.start(t.id) // 4
    s.reset(t.id) // 5
    s.update(t.id, { name: 'Offering' }) // 6
    expect(emissions).toHaveLength(6)

    now += 30_000
    s.snapshot()
    s.valueOf(t.id)
    s.list()
    expect(emissions).toHaveLength(6)

    s.remove(t.id) // 7
    expect(emissions).toHaveLength(7)
    expect(emissions[6]).toEqual([])
  })

  it('does not fire for rejected mutations', () => {
    const s = store()
    const t = s.create({ kind: 'elapsed' })!
    emissions.length = 0
    s.create({ kind: 'countdown', durationSec: 0 })
    s.update(t.id, { durationSec: 30 })
    s.update('nope', { name: 'x' })
    s.remove('nope')
    s.start('nope')
    expect(emissions).toHaveLength(0)
  })

  it('carries the computed value of every timer at that moment', () => {
    const s = store()
    const a = s.create({ kind: 'countdown', durationSec: 60, name: 'Offering' })!
    const b = s.create({ kind: 'elapsed', name: 'Sermon' })!
    s.start(a.id)
    s.start(b.id)
    now += 15_000

    const snap = s.snapshot()
    expect(snap).toHaveLength(2)
    expect(snap[0]).toMatchObject({ id: a.id, name: 'Offering', kind: 'countdown', display: '0:45' })
    expect(snap[1]).toMatchObject({ id: b.id, name: 'Sermon', kind: 'elapsed', display: '0:15' })
  })

  it('hands out copies, so a caller cannot mutate the store', () => {
    const s = store()
    const t = s.create({ kind: 'elapsed' })!
    t.name = 'hacked'
    s.list()[0].elapsedBeforePauseMs = 999
    expect(s.list()[0].name).toBe('Elapsed')
    expect(s.list()[0].elapsedBeforePauseMs).toBe(0)
  })
})

describe('dispose', () => {
  it('drops every timer without emitting', () => {
    const s = store()
    s.create({ kind: 'elapsed' })
    emissions.length = 0
    s.dispose()
    expect(s.list()).toEqual([])
    expect(s.snapshot()).toEqual([])
    expect(emissions).toHaveLength(0)
  })
})

describe('preacher extension (extraSec)', () => {
  /** A 45-minute sermon, overrunning, as the dashboard creates it. */
  function sermon(s: TimerStore) {
    return s.create({ kind: 'countdown', durationSec: 45 * 60, overrun: true })!
  }

  it('does not touch the countdown while the agreed time is still running', () => {
    const s = store()
    const t = sermon(s)
    s.start(t.id)
    s.update(t.id, { extraSec: 5 * 60 })
    now += 44 * 60_000

    const v = s.valueOf(t.id)!
    expect(v.inExtension).toBe(false)
    expect(v.remainingMs).toBe(60_000)
    expect(v.phaseTotalMs).toBe(45 * 60_000)
  })

  it('restarts at the extension full value the moment the duration runs out', () => {
    const s = store()
    const t = sermon(s)
    s.start(t.id)
    s.update(t.id, { extraSec: 5 * 60 })
    now += 45 * 60_000

    const v = s.valueOf(t.id)!
    expect(v.inExtension).toBe(true)
    expect(v.remainingMs).toBe(5 * 60_000)
    expect(v.display).toBe('5:00')
    expect(v.phaseTotalMs).toBe(5 * 60_000)
  })

  it('counts the extension down, then overruns past the end of it', () => {
    const s = store()
    const t = sermon(s)
    s.start(t.id)
    s.update(t.id, { extraSec: 3 * 60 })

    now += 46 * 60_000 // one minute into the three granted
    expect(s.valueOf(t.id)!.display).toBe('2:00')
    expect(s.valueOf(t.id)!.overrunning).toBe(false)

    now += 2 * 60_000 // exactly spent
    expect(s.valueOf(t.id)!.remainingMs).toBe(0)

    now += 30_000 // past the extension too
    const v = s.valueOf(t.id)!
    expect(v.overrunning).toBe(true)
    expect(v.display).toBe('-0:30')
  })

  /**
   * The bug this whole model exists to kill: folding grace into durationSec
   * grows the denominator, so remaining/total jumps back UP and the face
   * cools from red to green at the worst possible moment.
   */
  it('keeps the phase total at the extension length, so the face does not cool', () => {
    const s = store()
    const t = sermon(s)
    s.start(t.id)
    now += 45 * 60_000
    s.update(t.id, { extraSec: 5 * 60 })

    const v = s.valueOf(t.id)!
    expect(v.durationSec).toBe(45 * 60)
    expect(v.phaseTotalMs).toBe(5 * 60_000)
    expect(v.remainingMs / v.phaseTotalMs).toBe(1)
  })

  it('accumulates a second grant onto the first', () => {
    const s = store()
    const t = sermon(s)
    s.start(t.id)
    now += 45 * 60_000
    s.update(t.id, { extraSec: 3 * 60 })
    now += 60_000
    expect(s.valueOf(t.id)!.display).toBe('2:00')

    s.update(t.id, { extraSec: 3 * 60 + 5 * 60 })
    expect(s.valueOf(t.id)!.display).toBe('7:00')
    expect(s.valueOf(t.id)!.inExtension).toBe(true)
  })

  it('parks the extension at zero when overrun is off', () => {
    const s = store()
    const t = s.create({ kind: 'countdown', durationSec: 60 })!
    s.start(t.id)
    s.update(t.id, { extraSec: 60 })
    now += 200_000
    const v = s.valueOf(t.id)!
    expect(v.remainingMs).toBe(0)
    expect(v.overrunning).toBe(false)
  })

  it('lets a grant be taken back with zero', () => {
    const s = store()
    const t = sermon(s)
    s.start(t.id)
    now += 45 * 60_000
    s.update(t.id, { extraSec: 5 * 60 })
    expect(s.valueOf(t.id)!.inExtension).toBe(true)

    s.update(t.id, { extraSec: 0 })
    const v = s.valueOf(t.id)!
    expect(v.inExtension).toBe(false)
    expect(v.remainingMs).toBe(0)
  })

  it('rejects grace that is negative, unreal, or on the wrong kind of timer', () => {
    const s = store()
    const t = sermon(s)
    expect(s.update(t.id, { extraSec: -60 })).toBeNull()
    expect(s.update(t.id, { extraSec: Number.NaN })).toBeNull()
    expect(s.update(t.id, { extraSec: '5' as never })).toBeNull()
    expect(s.valueOf(t.id)!.extraSec).toBeUndefined()

    const e = s.create({ kind: 'elapsed' })!
    expect(s.update(e.id, { extraSec: 60 })).toBeNull()
  })

  it('lapses the grant on reset, so next week starts clean', () => {
    const s = store()
    const t = sermon(s)
    s.start(t.id)
    now += 45 * 60_000
    s.update(t.id, { extraSec: 5 * 60 })
    s.reset(t.id)

    const v = s.valueOf(t.id)!
    expect(v.extraSec).toBe(0)
    expect(v.inExtension).toBe(false)
    expect(v.display).toBe('45:00')
  })

  it('holds the extension still across a pause', () => {
    const s = store()
    const t = sermon(s)
    s.start(t.id)
    now += 45 * 60_000
    s.update(t.id, { extraSec: 5 * 60 })
    now += 60_000
    s.pause(t.id)
    expect(s.valueOf(t.id)!.display).toBe('4:00')

    now += 10 * 60_000 // the world moves on; a paused clock does not
    expect(s.valueOf(t.id)!.display).toBe('4:00')

    s.start(t.id)
    now += 60_000
    expect(s.valueOf(t.id)!.display).toBe('3:00')
  })
})
