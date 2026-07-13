import { describe, it, expect } from 'vitest'
import { IntentEngine, type IntentState } from './intentEngine'

function makeEngine() {
  let now = 1_000_000
  const states: IntentState[] = []
  const readings: string[] = []
  let defers = 0
  const engine = new IntentEngine(
    {
      onStateChange: (s) => states.push(s),
      onReadingStarted: (ref) => readings.push(ref),
      onDefer: () => defers++
    },
    () => now
  )
  return {
    engine,
    states,
    readings,
    getDefers: () => defers,
    tick: (ms: number) => {
      now += ms
    }
  }
}

describe('IntentEngine — states', () => {
  it('enters intent on "turn with me to"', () => {
    const { engine } = makeEngine()
    engine.process('turn with me to the book of john')
    expect(engine.getState()).toBe('intent')
    expect(engine.allowBareBook()).toBe(true)
  })

  it('narrative markers suppress bare book mentions', () => {
    const { engine } = makeEngine()
    engine.process('let me tell you a story about a farmer')
    expect(engine.getState()).toBe('commentary')
    expect(engine.allowBareBook()).toBe(false)
  })

  it('idle state does not allow bare books', () => {
    const { engine } = makeEngine()
    expect(engine.allowBareBook()).toBe(false)
  })

  it('intent decays back to idle after the hold window', () => {
    const { engine, tick } = makeEngine()
    engine.process('turn to matthew')
    expect(engine.getState()).toBe('intent')
    tick(25_000)
    engine.process('the weather was lovely this morning')
    expect(engine.getState()).toBe('idle')
  })
})

describe('IntentEngine — grace window', () => {
  it('fires onReadingStarted when opening words are spoken', () => {
    const { engine, readings } = makeEngine()
    engine.armGraceWindow('John 3:16', 'For God so loved the world that he gave his only begotten Son')
    engine.process('church are you there')
    expect(readings).toHaveLength(0)
    engine.process('for god so loved the world')
    expect(readings).toEqual(['John 3:16'])
    expect(engine.getState()).toBe('reading')
  })

  it('expires the armed verse after the window', () => {
    const { engine, readings, tick } = makeEngine()
    engine.armGraceWindow('John 3:16', 'For God so loved the world that he gave')
    tick(50_000)
    engine.process('for god so loved the world')
    expect(readings).toHaveLength(0)
  })

  it('disarm prevents firing', () => {
    const { engine, readings } = makeEngine()
    engine.armGraceWindow('John 3:16', 'For God so loved the world that he gave')
    engine.disarmGraceWindow()
    engine.process('for god so loved the world')
    expect(readings).toHaveLength(0)
  })
})

describe('IntentEngine — defer queue', () => {
  it('opens a defer window on "we\'ll come back to"', () => {
    const { engine, getDefers, tick } = makeEngine()
    expect(engine.shouldDefer()).toBe(false)
    engine.process("we'll come back to romans in a minute")
    expect(getDefers()).toBe(1)
    expect(engine.shouldDefer()).toBe(true)
    tick(10_000)
    expect(engine.shouldDefer()).toBe(false)
  })
})
