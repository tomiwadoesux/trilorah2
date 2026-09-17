import { describe, it, expect, beforeEach } from 'vitest'
import { VoiceCommandEngine, type VoiceCommandCallbacks, type DisplayedRef } from './voiceCommands'
import type { VoiceCommandEvent } from '../../shared/types'

let now = 1_000_000
let displayed: DisplayedRef | null
let versions: string[]
let events: VoiceCommandEvent[]
let switched: string[]
let corrections: number[]
let chapterCorrections: number[]
let dismissed: number
let held: number
let navigated: Array<'next' | 'previous'>
let prayerStates: boolean[]

function makeEngine(opts: { isSuppressed?: (u: string) => boolean } = {}) {
  const cb: VoiceCommandCallbacks = {
    getDisplayedRef: () => displayed,
    getAvailableVersions: () => versions,
    onVersionSwitch: (v) => switched.push(v),
    onVerseCorrection: (v) => corrections.push(v),
    onChapterCorrection: (c) => chapterCorrections.push(c),
    onDismiss: () => dismissed++,
    onHold: () => held++,
    onNavigate: (d) => navigated.push(d),
    onPrayerChange: (p) => prayerStates.push(p),
    onCommand: (e) => events.push(e)
  }
  return new VoiceCommandEngine(cb, { now: () => now, ...opts })
}

beforeEach(() => {
  now = 1_000_000
  displayed = { book: 'Matthew', chapter: 6, verse: 24, displayedAt: now - 5000 }
  versions = ['KJV', 'BBE']
  events = []
  switched = []
  corrections = []
  chapterCorrections = []
  dismissed = 0
  held = 0
  navigated = []
  prayerStates = []
})

describe('VoiceCommandEngine — translation switching', () => {
  it('"in the king james version" switches to KJV', () => {
    const engine = makeEngine()
    expect(engine.process('let us read that in the king james version')).toBe(true)
    expect(switched).toEqual(['KJV'])
  })

  it('reports but does not switch to an uninstalled version', () => {
    const engine = makeEngine()
    expect(engine.process('read it in the new living translation')).toBe(false)
    expect(switched).toEqual([])
    expect(events.some((e) => e.kind === 'version-switch' && String(e.value).includes('not installed'))).toBe(true)
  })

  it('ignores version phrases when nothing is displayed', () => {
    displayed = null
    const engine = makeEngine()
    expect(engine.process('the king james version was published in 1611')).toBe(false)
    expect(switched).toEqual([])
  })
})

describe('VoiceCommandEngine — corrections', () => {
  it('"I said verse thirty four" corrects the verse', () => {
    const engine = makeEngine()
    expect(engine.process('no no i said verse thirty four')).toBe(true)
    expect(corrections).toEqual([34])
  })

  it('"not twenty four, thirty four" corrects the verse', () => {
    const engine = makeEngine()
    expect(engine.process('not verse twenty four verse thirty four')).toBe(true)
    expect(corrections).toEqual([34])
  })

  it('"I said chapter seven" corrects the chapter', () => {
    const engine = makeEngine()
    expect(engine.process('i said chapter seven')).toBe(true)
    expect(chapterCorrections).toEqual([7])
  })

  it('ignores "I said" matching the already-displayed verse', () => {
    const engine = makeEngine()
    expect(engine.process('i said verse twenty four')).toBe(false)
    expect(corrections).toEqual([])
  })

  it('dedupes repeated corrections inside the window', () => {
    const engine = makeEngine()
    engine.process('i said verse thirty four')
    engine.process('i said verse thirty four')
    expect(corrections).toEqual([34])
    now += 4000
    engine.process('i said verse thirty four')
    expect(corrections).toEqual([34, 34])
  })
})

describe('VoiceCommandEngine — prayer + display', () => {
  it('enters prayer on "let us pray" and exits on "amen"', () => {
    const engine = makeEngine()
    expect(engine.process('let us pray father we thank you')).toBe(true)
    expect(engine.isInPrayer()).toBe(true)
    expect(prayerStates).toEqual([true])
    expect(engine.process('in jesus name amen')).toBe(true)
    expect(engine.isInPrayer()).toBe(false)
    expect(prayerStates).toEqual([true, false])
  })

  it('"amen" outside prayer mode is not a command', () => {
    const engine = makeEngine()
    expect(engine.process('and all the church said amen')).toBe(false)
  })

  it('"take that down" dismisses, "leave it up" holds', () => {
    const engine = makeEngine()
    expect(engine.process('you can take that down now')).toBe(true)
    expect(dismissed).toBe(1)
    now += 4000
    expect(engine.process('leave it up there for a moment')).toBe(true)
    expect(held).toBe(1)
  })
})

describe('VoiceCommandEngine — navigation', () => {
  it('fires navigate-next on the safe multi-word phrases', () => {
    const engine = makeEngine()
    expect(engine.process('now the next verse')).toBe(true)
    expect(navigated).toEqual(['next'])
    expect(events.map((e) => e.kind)).toEqual(['navigate-next'])
    now += 4000
    expect(engine.process('go to the next verse')).toBe(true)
    now += 4000
    expect(engine.process('and the verse after that')).toBe(true)
    expect(navigated).toEqual(['next', 'next', 'next'])
  })

  it('fires navigate-previous on the safe multi-word phrases', () => {
    const engine = makeEngine()
    expect(engine.process('the previous verse please')).toBe(true)
    now += 4000
    expect(engine.process('go back a verse')).toBe(true)
    now += 4000
    expect(engine.process('look at the verse before that')).toBe(true)
    expect(navigated).toEqual(['previous', 'previous', 'previous'])
    expect(events.every((e) => e.kind === 'navigate-previous')).toBe(true)
  })

  it('does NOT fire on ordinary preaching containing "next" / "back"', () => {
    const engine = makeEngine()
    expect(engine.process('and then the next thing paul says is')).toBe(false)
    expect(engine.process('we have to go back to the beginning')).toBe(false)
    expect(engine.process('continue in prayer and keep going')).toBe(false)
    expect(navigated).toEqual([])
    expect(events).toEqual([])
  })

  it('dedupes repeated navigation inside the window', () => {
    const engine = makeEngine()
    engine.process('next verse')
    engine.process('next verse')
    expect(navigated).toEqual(['next'])
    now += 4000
    engine.process('next verse')
    expect(navigated).toEqual(['next', 'next'])
  })

  it('ignores navigation when nothing is displayed', () => {
    displayed = null
    const engine = makeEngine()
    expect(engine.process('next verse')).toBe(false)
    expect(navigated).toEqual([])
  })

  it('"hold that" holds the display', () => {
    const engine = makeEngine()
    expect(engine.process('hold that for a second')).toBe(true)
    expect(held).toBe(1)
  })
})

describe('VoiceCommandEngine — suppression', () => {
  it('skips matching entirely when isSuppressed returns true', () => {
    const engine = makeEngine({
      isSuppressed: (u) => u.toLowerCase().includes('take that down')
    })
    expect(engine.process('you can take that down now')).toBe(false)
    expect(dismissed).toBe(0)
    expect(events).toEqual([])
    expect(engine.process('next verse')).toBe(true)
    expect(navigated).toEqual(['next'])
  })
})
