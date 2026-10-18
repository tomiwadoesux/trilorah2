import { describe, expect, it } from 'vitest'
import { Resampler, floatToInt16, levelDb, planarToMono } from './pcm'

function planar(...channels: number[][]): Uint8Array {
  const samples = channels[0].length
  const buf = Buffer.alloc(channels.length * samples * 4)
  channels.forEach((ch, c) => ch.forEach((v, i) => buf.writeFloatLE(v, (c * samples + i) * 4)))
  return buf
}

describe('planarToMono', () => {
  it('averages the channels', () => {
    const mono = planarToMono(planar([1, 0.5], [0, -0.5]), 2, 2, 8)
    expect(Array.from(mono)).toEqual([0.5, 0])
  })

  it('passes one channel through', () => {
    expect(Array.from(planarToMono(planar([0.25, -0.25]), 1, 2, 8))).toEqual([0.25, -0.25])
  })

  it('respects a stride wider than the samples', () => {
    const buf = Buffer.alloc(2 * 3 * 4) // stride of 3 samples, 2 used
    buf.writeFloatLE(1, 0); buf.writeFloatLE(1, 4); buf.writeFloatLE(-1, 12); buf.writeFloatLE(-1, 16)
    expect(Array.from(planarToMono(buf, 2, 2, 12))).toEqual([0, 0])
  })
})

describe('Resampler', () => {
  const sine = (rate: number, hz: number, n: number, offset = 0) =>
    Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * hz * (i + offset)) / rate))

  it('leaves equal rates alone', () => {
    const input = Float32Array.from([0.1, 0.2])
    expect(new Resampler(48000, 48000).process(input)).toBe(input)
  })

  it('makes a third as many samples from 48 kHz to 16 kHz, across many frames', () => {
    const r = new Resampler(48000, 16000)
    let total = 0
    for (let f = 0; f < 100; f++) total += r.process(sine(48000, 200, 480, f * 480)).length
    expect(Math.abs(total - 16000)).toBeLessThanOrEqual(1)
  })

  const rms = (v: ArrayLike<number>, from = 0) => {
    let sum = 0
    for (let i = from; i < v.length; i++) sum += v[i] * v[i]
    return Math.sqrt(sum / (v.length - from))
  }
  const through = (hz: number) => {
    const r = new Resampler(48000, 16000)
    const out: number[] = []
    for (let f = 0; f < 20; f++) out.push(...r.process(sine(48000, hz, 480, f * 480)))
    return out
  }

  it('keeps a voice-range tone at full strength through the joins', () => {
    // A sine's RMS is 0.707; skip the filter's first moments.
    expect(rms(through(200), 200)).toBeGreaterThan(0.69)
    expect(rms(through(3000), 200)).toBeGreaterThan(0.69)
  })

  it('keeps hiss above 8 kHz out of the 16 kHz copy', () => {
    // 10 kHz cannot exist at 16 kHz; unfiltered it would fold back to 6 kHz at full strength.
    const db = 20 * Math.log10(rms(through(10000), 200) / 0.707)
    expect(db).toBeLessThan(-30)
  })

  it('has no clicks at the joins', () => {
    const out = through(200)
    const jumps = out.slice(201).map((v, i) => Math.abs(v - out[200 + i]))
    // 200 Hz at 16 kHz moves at most ~0.08 between samples.
    expect(Math.max(...jumps)).toBeLessThan(0.1)
  })

  it('goes up as well as down', () => {
    const r = new Resampler(44100, 48000)
    let total = 0
    for (let f = 0; f < 100; f++) total += r.process(sine(44100, 300, 441, f * 441)).length
    expect(Math.abs(total - 48000)).toBeLessThanOrEqual(1)
  })
})

describe('floatToInt16', () => {
  it('clips and scales like the window microphone', () => {
    const out = floatToInt16(Float32Array.from([0, 1, -1, 2, -2]))
    expect([0, 1, 2, 3, 4].map((i) => out.readInt16LE(i * 2))).toEqual([0, 32767, -32768, 32767, -32768])
  })
})

describe('levelDb', () => {
  it('floors silence at -60', () => {
    expect(levelDb(new Float32Array(10))).toBe(-60)
    expect(levelDb(new Float32Array(0))).toBe(-60)
  })

  it('reads a full-scale square as 0 dB', () => {
    expect(levelDb(Float32Array.from([1, -1, 1, -1]))).toBe(0)
  })
})
