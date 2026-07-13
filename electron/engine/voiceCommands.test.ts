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
let prayerStates: boolean[]

function makeEngine() {
  const cb: VoiceCommandCallbacks = {
    getDisplayedRef: () => displayed,
    getAvailableVersions: () => versions,
    onVersionSwitch: (v) => switched.push(v),
    onVerseCorrection: (v) => corrections.push(v),
    onChapterCorrection: (c) => chapterCorrections.push(c),
    onDismiss: () => dismissed++,
    onHold: () => held++,
    onPrayerChange: (p) => prayerStates.push(p),
    onCommand: (e) => events.push(e)
  }
  return new VoiceCommandEngine(cb, () => now)
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
