import { describe, it, expect } from 'vitest'
import { ScreenStateMachine, roleFor, isScreenState } from './outputState'

describe('roleFor', () => {
  it('uses defaults and honours overrides', () => {
    expect(roleFor('main')).toBe('projector')
    expect(roleFor('alternate')).toBe('stream')
    expect(roleFor('third')).toBe('stage')
    expect(roleFor('alternate', { alternate: 'projector' })).toBe('projector')
    expect(roleFor('alternate', { alternate: 'nonsense' })).toBe('stream')
    expect(roleFor('unknown')).toBe('projector')
  })
})

describe('ScreenStateMachine', () => {
  it('changes state and reports only real transitions', () => {
    const seen: string[] = []
    const m = new ScreenStateMachine((s) => seen.push(s))
    expect(m.get()).toBe('live')
    expect(m.set('black')).toBe(true)
    expect(m.set('black')).toBe(false)
    expect(m.set('bogus' as never)).toBe(false)
    expect(seen).toEqual(['black'])
  })

  it('toggles and restores on content push', () => {
    const m = new ScreenStateMachine(() => undefined)
    expect(m.toggle('logo')).toBe('logo')
    expect(m.toggle('logo')).toBe('live')
    m.set('clear')
    m.onContentPushed()
    expect(m.get()).toBe('live')
    m.toggle('black')
    m.onContentPushed()
    expect(m.get()).toBe('black') // a deliberate hold survives an auto push
  })

  it('validates states', () => {
    expect(isScreenState('clear')).toBe(true)
    expect(isScreenState('off')).toBe(false)
  })
})
