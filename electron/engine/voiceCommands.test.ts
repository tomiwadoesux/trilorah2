import { describe, it, expect, beforeEach } from 'vitest'
import { VoiceCommandEngine, type VoiceCommandCallbacks, type DisplayedRef } from './voiceCommands'
import type { VoiceCommandEvent } from '../../shared/types'
import { DEFAULT_COMMANDS } from './commandConfig'
import { findCommandPhrase } from '../../shared/voiceCommandText'

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

  it('"the berean standard bible" switches to the bundled BSB', () => {
    versions = ['KJV', 'BSB', 'WEB']
    const engine = makeEngine()
    expect(engine.process('let us read it from the berean standard bible')).toBe(true)
    expect(switched).toEqual(['BSB'])
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

describe('VoiceCommandEngine — accepted phrase for transcript pills', () => {
  it('emits only the translation instruction, keeping the surrounding speech', () => {
    const engine = makeEngine()
    const text = 'Let us read this in the King James Version, please.'
    engine.process(text)
    expect(events[0]).toMatchObject({ kind: 'version-switch', phrase: 'King James Version', value: 'KJV' })
    const range = findCommandPhrase(text, events[0].phrase!)!
    expect(text.slice(0, range.start)).toBe('Let us read this in the ')
    expect(text.slice(range.end)).toBe(', please.')
  })

  it('marks the complete correction, including the spoken number', () => {
    const engine = makeEngine()
    const text = 'No, I said verse thirty-four, please read that.'
    engine.process(text)
    const range = findCommandPhrase(text, events[0].phrase!)!
    expect(text.slice(range.start, range.end)).toBe('I said verse thirty-four')
    now += 4000
    engine.process('Now I said chapter seven, let us read.')
    expect(events[1]).toMatchObject({ kind: 'correction-chapter', phrase: 'i said chapter seven', value: 7 })
  })

  it('uses the active preacher phrase instead of a second UI command parser', () => {
    const cb: VoiceCommandCallbacks = {
      getDisplayedRef: () => displayed, getAvailableVersions: () => versions,
      onVersionSwitch: () => {}, onVerseCorrection: () => {}, onChapterCorrection: () => {},
      onDismiss: () => {}, onHold: () => {}, onNavigate: () => {}, onPrayerChange: () => {},
      onCommand: (event) => events.push(event)
    }
    const engine = new VoiceCommandEngine(cb, { now: () => now,
      config: { ...DEFAULT_COMMANDS, navNext: [...DEFAULT_COMMANDS.navNext, 'carry us forward'] } })
    engine.process('Please carry us forward, church.')
    expect(events[0]).toMatchObject({ kind: 'navigate-next', phrase: 'carry us forward' })
  })

  it('identifies the prayer and hold phrases without swallowing surrounding words', () => {
    const engine = makeEngine()
    engine.process('Now let us pray together.')
    expect(events[0]).toMatchObject({ kind: 'prayer-start', phrase: 'let us pray' })
    engine.process('In Jesus name, amen.')
    expect(events[1]).toMatchObject({ kind: 'prayer-end', phrase: 'amen' })
    engine.process('Please leave that up for a moment.')
    expect(events[2]).toMatchObject({ kind: 'display-hold', phrase: 'leave that up' })
  })
})
