import { describe, it, expect } from 'vitest'
import { toWordTimings, playheadSeconds, wordState, activeWordIndex, type WordTiming } from './wordTimings'

const W = (w: string, s: number, e: number): WordTiming => ({ w, s, e })

describe('toWordTimings — Deepgram’s words, trimmed to what a phone needs', () => {
  it('preserves valid session speaker labels and ignores invalid labels', () => {
    expect(toWordTimings([{ word: 'hello', start: 0, end: 1, speaker: 0 }, { word: 'there', start: 1, end: 2, speaker: -1 }])).toEqual([
      { w: 'hello', s: 0, e: 1, speaker: 0 }, { w: 'there', s: 1, e: 2 },
    ])
  })
  it('prefers the punctuated word, so the capital and comma survive', () => {
    expect(toWordTimings([{ word: 'lord', punctuated_word: 'Lord,', start: 1, end: 1.4 }])).toEqual([
      { w: 'Lord,', s: 1, e: 1.4 },
    ])
  })
  it('falls back to the bare word', () => {
    expect(toWordTimings([{ word: 'grace', start: 0, end: 0.5 }])).toEqual([{ w: 'grace', s: 0, e: 0.5 }])
  })
  it('drops a word it cannot place rather than guessing', () => {
    expect(
      toWordTimings([
        { word: 'kept', start: 1, end: 2 },
        { word: 'no-start', end: 3 },
        { word: 'backwards', start: 5, end: 4 },
        { word: '   ', start: 6, end: 7 },
      ]),
    ).toEqual([{ w: 'kept', s: 1, e: 2 }])
  })
  it('answers null when there is nothing usable', () => {
    for (const bad of [null, undefined, [], 'words', [{ word: '' }]]) {
      expect(toWordTimings(bad)).toBeNull()
    }
  })
  it('rounds to the millisecond', () => {
    expect(toWordTimings([{ word: 'a', start: 1.00049, end: 1.23456 }])).toEqual([{ w: 'a', s: 1, e: 1.235 }])
  })
})

describe('playheadSeconds — the phone’s clock, not the room’s', () => {
  const start = 1_000_000
  it('subtracts the stream delay and the deliberate hold', () => {
    // 60s into the service, watching a stream 25s behind, holding 4s more.
    expect(playheadSeconds(start + 60_000, start, 25_000, 4_000)).toBe(31)
  })
  it('never goes negative in the first seconds of a service', () => {
    expect(playheadSeconds(start + 1_000, start, 25_000, 4_000)).toBe(0)
  })
  it('with no stream and no hold, it is simply the elapsed time', () => {
    expect(playheadSeconds(start + 12_500, start, 0, 0)).toBe(12.5)
  })
})

describe('wordState', () => {
  const word = W('mercy', 2, 2.6)
  it('is coming before it starts', () => expect(wordState(word, 1.9)).toBe('coming'))
  it('is saying across its own span', () => {
    expect(wordState(word, 2)).toBe('saying')
    expect(wordState(word, 2.59)).toBe('saying')
  })
  it('is said once it ends', () => expect(wordState(word, 2.6)).toBe('said'))
})

describe('activeWordIndex', () => {
  const words = [W('one', 0, 0.4), W('two', 0.5, 0.9), W('three', 1, 1.4), W('four', 1.5, 1.9)]
  it('is -1 before the first word', () => expect(activeWordIndex(words, -0.2)).toBe(-1))
  it('finds the word being spoken', () => expect(activeWordIndex(words, 1.1)).toBe(2))
  it('holds the last finished word through a gap', () => expect(activeWordIndex(words, 0.95)).toBe(1))
  it('rests on the last word after the end', () => expect(activeWordIndex(words, 99)).toBe(3))
  it('reaches the same answer from any hint, including a stale one', () => {
    for (const hint of [0, 1, 2, 3, 99, -5]) expect(activeWordIndex(words, 1.6, hint)).toBe(3)
    for (const hint of [0, 1, 2, 3]) expect(activeWordIndex(words, 0.2, hint)).toBe(0)
  })
  it('survives an empty list', () => expect(activeWordIndex([], 5)).toBe(-1))
  it('walks a whole chunk forward one frame at a time without skipping', () => {
    const seen: number[] = []
    let hint = 0
    for (let t = 0; t <= 2; t += 1 / 60) {
      hint = activeWordIndex(words, t, hint)
      if (seen[seen.length - 1] !== hint) seen.push(hint)
    }
    expect(seen).toEqual([0, 1, 2, 3])
  })
})
