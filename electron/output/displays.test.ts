import { describe, it, expect } from 'vitest'
import { placeOutput, type DisplayLike } from './displays'

const laptop: DisplayLike = { id: 1, bounds: { x: 0, y: 0, width: 1440, height: 900 } }
const projector: DisplayLike = { id: 2, bounds: { x: 1440, y: 0, width: 1920, height: 1080 } }
const stage: DisplayLike = { id: 3, bounds: { x: 3360, y: 0, width: 1280, height: 720 } }

describe('placeOutput — the projector gets the external screen', () => {
  it('sends main to the only external display, fullscreen', () => {
    expect(placeOutput('main', [laptop, projector], 1)).toEqual({ display: projector, fullscreen: true })
  })
  it('hands out externals in output order', () => {
    const all = [laptop, projector, stage]
    expect(placeOutput('main', all, 1).display).toBe(projector)
    expect(placeOutput('alternate', all, 1).display).toBe(stage)
  })
  it('stays windowed on the primary when no external is left', () => {
    expect(placeOutput('alternate', [laptop, projector], 1)).toEqual({ display: null, fullscreen: false })
    expect(placeOutput('main', [laptop], 1)).toEqual({ display: null, fullscreen: false })
  })
  it('never fullscreens over the operator', () => {
    for (const id of ['main', 'alternate', 'third']) {
      expect(placeOutput(id, [laptop], 1).fullscreen).toBe(false)
    }
  })
  it('does not depend on the primary being listed first', () => {
    expect(placeOutput('main', [projector, laptop], 1).display).toBe(projector)
  })
})

describe('placeOutput — an operator choice', () => {
  it('keeps no screen disabled with or without external displays', () => {
    for (const displays of [[laptop], [laptop, projector]]) {
      expect(placeOutput('main', displays, 1, { main: 'none' })).toEqual({ display: null, fullscreen: false, disabled: true })
    }
  })
  it('wins while that display is connected', () => {
    expect(placeOutput('main', [laptop, projector, stage], 1, { main: 3 }).display).toBe(stage)
  })
  it('may put an output on the primary, windowed', () => {
    expect(placeOutput('main', [laptop, projector], 1, { main: 1 })).toEqual({ display: laptop, fullscreen: false })
  })
  it('falls back to the rule once the chosen display is unplugged', () => {
    expect(placeOutput('main', [laptop, projector], 1, { main: 99 }).display).toBe(projector)
  })
})
