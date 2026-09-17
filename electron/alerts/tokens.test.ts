import { describe, it, expect } from 'vitest'
import { parseTokens, fillTokens, hasUnfilledTokens, describeToken, formatClock } from './tokens'

/** 2026-09-08 10:32 local — built from parts so the test does not depend on TZ. */
const AT_10_32 = new Date(2026, 8, 8, 10, 32, 45).getTime()
const AT_NOON = new Date(2026, 8, 8, 12, 0, 0).getTime()
const AT_MIDNIGHT = new Date(2026, 8, 8, 0, 5, 0).getTime()

describe('parseTokens', () => {
  it('returns slots in source order with their kinds', () => {
    const slots = parseTokens('At {clock}, {child} to {room} — {timer:countdown} left')
    expect(slots.map((s) => [s.name, s.kind])).toEqual([
      ['clock', 'clock'],
      ['child', 'custom'],
      ['room', 'custom'],
      ['timer', 'timer']
    ])
    expect(slots[3].arg).toBe('countdown')
    expect(slots[3].raw).toBe('{timer:countdown}')
  })

  it('returns one slot per occurrence — dedup is the caller’s job', () => {
    const slots = parseTokens('{child} and {child} again, plus {other}')
    expect(slots.map((s) => s.name)).toEqual(['child', 'child', 'other'])
  })

  it('finds nothing in a plain message', () => {
    expect(parseTokens('Car blocking the driveway')).toEqual([])
    expect(parseTokens('')).toEqual([])
  })

  it('leaves malformed braces alone', () => {
    // Space, punctuation, empty name, and an unclosed brace are all not tokens.
    for (const bad of ['{the church}', '{child name}', '{}', '{hello!}', 'a { b', '{unclosed']) {
      expect(parseTokens(bad)).toEqual([])
    }
  })

  it('does not treat an unknown prefix:arg pair as a timer', () => {
    expect(parseTokens('{song:opener}')).toEqual([])
  })

  it('escaped braces never open a token', () => {
    expect(parseTokens('{{child}')).toEqual([])
    expect(parseTokens('{{ {child} }}').map((s) => s.name)).toEqual(['child'])
  })
})

describe('fillTokens', () => {
  const ctx = {
    now: AT_10_32,
    timers: { countdown: '4:07' },
    values: { child: '42' },
    constants: { church: 'Grace Chapel', child: 'ignored' }
  }

  it('fills clock, timer, value and constant', () => {
    expect(fillTokens('Parent of child {child} to the nursery', ctx)).toBe('Parent of child 42 to the nursery')
    expect(fillTokens('Service starts in {timer:countdown}', ctx)).toBe('Service starts in 4:07')
    expect(fillTokens('It is {clock} at {church}', ctx)).toBe('It is 10:32 AM at Grace Chapel')
  })

  it('values win over constants of the same name', () => {
    expect(fillTokens('{child}', ctx)).toBe('42')
  })

  it('leaves an unresolved timer or custom token visible', () => {
    const bare = { now: AT_10_32 }
    expect(fillTokens('in {timer:countdown}', bare)).toBe('in {timer:countdown}')
    expect(fillTokens('for {child}', bare)).toBe('for {child}')
    // A known timer id does not rescue an unknown one in the same message.
    expect(fillTokens('{timer:countdown} / {timer:offering}', ctx)).toBe('4:07 / {timer:offering}')
  })

  it('accepts an empty string as a real fill', () => {
    expect(fillTokens('[{child}]', { now: AT_10_32, values: { child: '' } })).toBe('[]')
  })

  it('renders {{ as a literal brace and keeps surrounding text', () => {
    expect(fillTokens('use {{child} for the name', ctx)).toBe('use {child} for the name')
    // Only '{{' is an escape; a closing brace has no special meaning of its own.
    expect(fillTokens('{{}}', ctx)).toBe('{}}')
    expect(fillTokens('{{{clock}', ctx)).toBe('{10:32 AM')
  })

  it('passes invalid tokens through verbatim', () => {
    expect(fillTokens('we meet at {the church}', ctx)).toBe('we meet at {the church}')
    expect(fillTokens('{hello!} {} a { b', ctx)).toBe('{hello!} {} a { b')
  })

  it('is single pass — an operator value is never re-expanded', () => {
    const hostile = {
      now: AT_10_32,
      timers: { countdown: '4:07' },
      values: { child: '{clock}', room: '{timer:countdown}' }
    }
    expect(fillTokens('{child} in {room}', hostile)).toBe('{clock} in {timer:countdown}')
  })

  it('returns the template unchanged when there is nothing to fill', () => {
    expect(fillTokens('Car blocking the driveway', ctx)).toBe('Car blocking the driveway')
    expect(fillTokens('', ctx)).toBe('')
  })
})

describe('formatClock', () => {
  it('uses 12-hour time with no seconds', () => {
    expect(formatClock(AT_10_32)).toBe('10:32 AM')
  })

  it('calls noon 12 PM and midnight 12 AM', () => {
    expect(formatClock(AT_NOON)).toBe('12:00 PM')
    expect(formatClock(AT_MIDNIGHT)).toBe('12:05 AM')
  })

  it('pads single-digit minutes', () => {
    expect(formatClock(new Date(2026, 8, 8, 9, 5, 0).getTime())).toBe('9:05 AM')
  })
})

describe('hasUnfilledTokens', () => {
  it('is false when every token resolves, or there are none', () => {
    const ctx = { now: AT_10_32, timers: { countdown: '4:07' }, values: { child: '42' } }
    expect(hasUnfilledTokens('{child} — {timer:countdown} — {clock}', ctx)).toBe(false)
    expect(hasUnfilledTokens('Car blocking the driveway', ctx)).toBe(false)
    expect(hasUnfilledTokens('we meet at {the church}', ctx)).toBe(false)
  })

  it('is true when any single token is missing', () => {
    const ctx = { now: AT_10_32, values: { child: '42' } }
    expect(hasUnfilledTokens('{child} in {timer:countdown}', ctx)).toBe(true)
    expect(hasUnfilledTokens('{child} to {room}', ctx)).toBe(true)
  })

  it('an empty fill counts as filled', () => {
    expect(hasUnfilledTokens('{child}', { now: AT_10_32, values: { child: '' } })).toBe(false)
  })
})

describe('describeToken', () => {
  it('labels each kind for the operator UI', () => {
    const [clock, timer, child, snake] = parseTokens('{clock}{timer:countdown}{child}{child_name}')
    expect(describeToken(clock)).toBe('Current time')
    expect(describeToken(timer)).toBe('Timer: countdown')
    expect(describeToken(child)).toBe('Child')
    expect(describeToken(snake)).toBe('Child name')
  })
})
