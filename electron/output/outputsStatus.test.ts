import { describe, it, expect } from 'vitest'
import { describeOutputs, displayNames, pixelsOf, type DisplaySource } from './outputsStatus'

const laptop: DisplaySource = { id: 1, label: 'Built-in Retina Display', internal: true, scaleFactor: 2, bounds: { x: 0, y: 0, width: 1512, height: 982 } }
const projector: DisplaySource = { id: 2, label: 'EPSON PJ', internal: false, scaleFactor: 1, bounds: { x: 1512, y: 0, width: 1920, height: 1080 } }
const monitor: DisplaySource = { id: 3, label: 'DELL P2419H', internal: false, scaleFactor: 1, bounds: { x: 3432, y: 0, width: 1920, height: 1080 } }

const base = { primaryId: 1, openIds: [] as string[], screenState: 'live' as const, platform: 'darwin' }

describe('displayNames', () => {
  it('uses the name the OS gives each display', () => {
    expect(displayNames([laptop, projector])).toEqual(['Built-in Retina Display', 'EPSON PJ'])
  })
  it('falls back when the OS gives no name', () => {
    const unnamed = [{ ...laptop, label: '' }, { ...projector, label: '  ' }]
    expect(displayNames(unnamed)).toEqual(['built-in display', 'display 2'])
  })
  it('keeps two identical projectors apart', () => {
    expect(displayNames([laptop, projector, { ...projector, id: 4 }])).toEqual(['Built-in Retina Display', 'EPSON PJ', 'EPSON PJ (2)'])
  })
})

describe('pixelsOf', () => {
  it('reads points on macOS, as System Settings does', () => {
    expect(pixelsOf(laptop, 'darwin')).toEqual({ w: 1512, h: 982 })
  })
  it('reads device pixels on Windows, as its display settings do', () => {
    const scaled = { ...projector, scaleFactor: 1.25, bounds: { ...projector.bounds, width: 1536, height: 864 } }
    expect(pixelsOf(scaled, 'win32')).toEqual({ w: 1920, h: 1080 })
  })
})

describe('describeOutputs', () => {
  it('lists the real displays, not a specimen', () => {
    const { displays } = describeOutputs({ ...base, displays: [laptop, projector] })
    expect(displays).toEqual([
      { id: 1, name: 'Built-in Retina Display', w: 1512, h: 982, primary: true },
      { id: 2, name: 'EPSON PJ', w: 1920, h: 1080, primary: false }
    ])
  })

  it('says where each output lands, by the same rule the windows follow', () => {
    const { outputs } = describeOutputs({ ...base, displays: [laptop, projector] })
    expect(outputs.map((o) => [o.id, o.displayId, o.fullscreen])).toEqual([
      ['main', 2, true],
      ['alternate', null, false],
      ['third', null, false],
      ['timer', null, false]
    ])
  })

  it('gives each output its job, honouring the church’s own', () => {
    const { outputs } = describeOutputs({ ...base, displays: [laptop], roleOverrides: { alternate: 'stage' } })
    expect(outputs.map((o) => o.role)).toEqual(['projector', 'stage', 'stage', 'timer'])
  })

  it('knows which windows are open', () => {
    const { outputs } = describeOutputs({ ...base, displays: [laptop, projector], openIds: ['main'] })
    expect(outputs.map((o) => o.open)).toEqual([true, false, false, false])
  })

  it('reports a pinned display only while it is plugged in', () => {
    const pinned = describeOutputs({ ...base, displays: [laptop, projector, monitor], displayOverrides: { main: 3 } })
    expect(pinned.outputs[0]).toMatchObject({ displayId: 3, fullscreen: true, chosenDisplayId: 3 })
    const unplugged = describeOutputs({ ...base, displays: [laptop, projector], displayOverrides: { main: 3 } })
    expect(unplugged.outputs[0]).toMatchObject({ displayId: 2, chosenDisplayId: null })
  })

  it('lists an output opened some other way too', () => {
    const { outputs } = describeOutputs({ ...base, displays: [laptop], openIds: ['fourth'] })
    expect(outputs.map((o) => o.id)).toEqual(['main', 'alternate', 'third', 'timer', 'fourth'])
  })

  it('treats an empty settings store as no choices made', () => {
    const { outputs } = describeOutputs({ ...base, displays: [laptop, projector], roleOverrides: null, displayOverrides: null })
    expect(outputs[0]).toMatchObject({ role: 'projector', displayId: 2, chosenDisplayId: null })
  })

  it('carries the screen state', () => {
    expect(describeOutputs({ ...base, displays: [laptop], screenState: 'black' }).screenState).toBe('black')
  })
})
