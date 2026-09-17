import { describe, it, expect, beforeEach } from 'vitest'
import { ViewerStats, nullGeo, normalizeIp, type GeoLookup } from './viewerStats'

let now: number

const geo: GeoLookup = (ip) => {
  if (ip.startsWith('10.')) return { city: 'Lagos', country: 'NG' }
  if (ip.startsWith('20.')) return { city: 'London', country: 'GB' }
  return null
}

function stats(opts: { roundBelow?: number; geo?: GeoLookup } = {}) {
  return new ViewerStats({ now: () => now, geo: opts.geo ?? geo, roundBelow: opts.roundBelow ?? 5 })
}

beforeEach(() => {
  now = 1_700_000_000_000
})

describe('counts', () => {
  it('splits in-venue vs remote by the venue public IP', () => {
    const s = stats()
    s.setVenueIp('10.0.0.1')
    s.connect('a', '10.0.0.1')
    s.connect('b', '::ffff:10.0.0.1')
    s.connect('c', '20.1.1.1')
    const snap = s.snapshot()
    expect(snap).toMatchObject({ total: 3, inVenue: 2, remote: 1 })
    expect(s.isInVenue('b')).toBe(true)
    expect(s.isInVenue('c')).toBe(false)
  })
  it('everyone is remote until a venue IP is set', () => {
    const s = stats()
    s.connect('a', '10.0.0.1')
    expect(s.snapshot()).toMatchObject({ inVenue: 0, remote: 1 })
  })
  it('reconnecting the same viewer does not double count', () => {
    const s = stats()
    s.connect('a', '10.0.0.1')
    s.connect('a', '10.0.0.2')
    expect(s.snapshot().total).toBe(1)
    s.disconnect('a')
    s.disconnect('a')
    expect(s.snapshot().total).toBe(0)
  })
  it('tracks peak and when it happened', () => {
    const s = stats()
    s.connect('a', '10.0.0.1')
    now += 1000
    s.connect('b', '10.0.0.1')
    now += 1000
    s.disconnect('a')
    expect(s.snapshot()).toMatchObject({ total: 1, peak: 2, peakAt: 1_700_000_001_000 })
  })
})

describe('byCity', () => {
  it('groups by city and flags small counts as approximate', () => {
    const s = stats()
    for (let i = 0; i < 7; i++) s.connect(`l${i}`, `10.0.0.${i}`)
    s.connect('g1', '20.0.0.1')
    s.connect('g2', '20.0.0.2')
    s.connect('x', '30.0.0.1')
    const snap = s.snapshot()
    expect(snap.byCity).toEqual([
      { city: 'Lagos', country: 'NG', count: 7, approx: false },
      { city: 'London', country: 'GB', count: 5, approx: true },
    ])
    expect(snap.unknownCity).toBe(1)
  })
  it('nullGeo places nobody', () => {
    const s = stats({ geo: nullGeo })
    s.connect('a', '10.0.0.1')
    expect(s.snapshot().byCity).toEqual([])
    expect(s.snapshot().unknownCity).toBe(1)
  })
  it('a throwing geo lookup is treated as unknown', () => {
    const s = stats({
      geo: () => {
        throw new Error('db missing')
      },
    })
    s.connect('a', '10.0.0.1')
    expect(s.snapshot().unknownCity).toBe(1)
  })
})

describe('recap', () => {
  it('reports peak, unique viewers and average watch time', () => {
    const s = stats()
    s.connect('a', '10.0.0.1')
    now += 60_000
    s.connect('b', '10.0.0.1')
    now += 60_000
    s.disconnect('a') // watched 120s
    now += 60_000 // b still on: 120s
    expect(s.recap()).toEqual({ peak: 2, peakAt: 1_700_000_060_000, averageWatchSeconds: 120, totalUnique: 2 })
  })
  it('reset starts a new service but keeps the venue IP', () => {
    const s = stats()
    s.setVenueIp('10.0.0.1')
    s.connect('a', '10.0.0.1')
    s.reset()
    expect(s.recap()).toEqual({ peak: 0, peakAt: null, averageWatchSeconds: 0, totalUnique: 0 })
    s.connect('b', '10.0.0.1')
    expect(s.snapshot().inVenue).toBe(1)
  })
})

describe('normalizeIp', () => {
  it('strips the IPv4-mapped prefix', () => {
    expect(normalizeIp('::FFFF:1.2.3.4 ')).toBe('1.2.3.4')
    expect(normalizeIp('1.2.3.4')).toBe('1.2.3.4')
  })
})
