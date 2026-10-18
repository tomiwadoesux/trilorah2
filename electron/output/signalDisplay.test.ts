import { describe, it, expect } from 'vitest'
import type { DisplayLike } from './displays'
import { pickSignalDisplay } from './signalDisplay'

const laptop: DisplayLike = { id: 1, bounds: { x: 0, y: 0, width: 1440, height: 900 } }
const projector: DisplayLike = { id: 2, bounds: { x: 1440, y: 0, width: 1920, height: 1080 } }
const second: DisplayLike = { id: 3, bounds: { x: -1920, y: 0, width: 1920, height: 1080 } }
const appOnLaptop = { x: 100, y: 50, width: 1200, height: 800 }

describe('pickSignalDisplay — the operator’s screen, never the projector’s', () => {
  it('lights the screen under the pointer', () => {
    expect(pickSignalDisplay([laptop, projector, second], { x: -500, y: 300 }, appOnLaptop, new Set([2]))).toBe(second)
    expect(pickSignalDisplay([laptop, projector], { x: 700, y: 300 }, appOnLaptop, new Set([2]))).toBe(laptop)
  })
  it('never lights a screen an output is on, even with the pointer on it', () => {
    expect(pickSignalDisplay([laptop, projector], { x: 2000, y: 300 }, appOnLaptop, new Set([2]))).toBe(laptop)
  })
  it('lights nothing when the app itself sits on an output’s screen', () => {
    const appOnProjector = { x: 1500, y: 50, width: 1200, height: 800 }
    expect(pickSignalDisplay([laptop, projector], { x: 2000, y: 300 }, appOnProjector, new Set([2]))).toBeNull()
    expect(pickSignalDisplay([laptop], { x: 700, y: 300 }, appOnLaptop, new Set([1]))).toBeNull()
  })
  it('falls back to the app window’s screen when the pointer is off every screen', () => {
    expect(pickSignalDisplay([laptop, projector], { x: 99999, y: 99999 }, appOnLaptop, new Set([2]))).toBe(laptop)
    expect(pickSignalDisplay([laptop, projector], { x: 99999, y: 99999 }, null, new Set([2]))).toBeNull()
  })
})
