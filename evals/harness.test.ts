import { describe, it, expect } from 'vitest'
import {
  aggregate,
  buildReport,
  median,
  parseFixtureLines,
  runAll,
  runFixture,
  score,
  type Detection,
  type Fixture,
  type FixtureResult
} from './harness'
import { checkThresholds } from './gate'

const det = (book: string, chapter: number | null, verse: number | null, endVerse: number | null = null): Detection => ({
  book,
  chapter,
  verse,
  endVerse
})

describe('score', () => {
  it('counts TP / FP / FN on book+chapter+verse', () => {
    const s = score(
      [det('John', 3, 16), det('Romans', 8, 28), det('Genesis', 1, 1)],
      [
        { book: 'John', chapter: 3, verse: 16 },
        { book: 'Romans', chapter: 8, verse: 28 },
        { book: 'Psalms', chapter: 23, verse: 1 }
      ]
    )
    expect(s.tp).toBe(2)
    expect(s.fp).toBe(1)
    expect(s.fn).toBe(1)
    expect(s.missed).toEqual([{ book: 'Psalms', chapter: 23, verse: 1 }])
    expect(s.falsePositives).toEqual([det('Genesis', 1, 1)])
  })

  it('treats null expected verse as chapter-only', () => {
    expect(score([det('Psalms', 23, null)], [{ book: 'Psalms', chapter: 23, verse: null }]).tp).toBe(1)
    expect(score([det('Psalms', 23, 4)], [{ book: 'Psalms', chapter: 23, verse: null }]).tp).toBe(1)
    expect(score([det('Psalms', 24, null)], [{ book: 'Psalms', chapter: 23, verse: null }]).fn).toBe(1)
  })

  it('ignores prefix steps and bare verse updates, dedupes FPs', () => {
    const s = score(
      [det('John', null, null), det('John', 3, null), det('', null, 7), det('John', 3, 16), det('Mark', 1, 1), det('Mark', 1, 1)],
      [{ book: 'John', chapter: 3, verse: 16 }]
    )
    expect(s).toMatchObject({ tp: 1, fp: 1, fn: 0 })
  })

  it('checks endVerse only when the expectation carries one', () => {
    const exp = { book: 'Romans', chapter: 8, verse: 1, endVerse: 5 }
    expect(score([det('Romans', 8, 1, 5)], [exp]).tp).toBe(1)
    // range not read yet = prefix, not FP
    expect(score([det('Romans', 8, 1)], [exp])).toMatchObject({ tp: 0, fp: 0, fn: 1 })
    expect(score([det('Romans', 8, 1, 5)], [{ book: 'Romans', chapter: 8, verse: 1 }]).tp).toBe(1)
    expect(score([det('Romans', 8, 1, 5)], [{ book: 'Romans', chapter: 8, verse: 1, endVerse: null }]).fp).toBe(1)
  })

  it('negative fixture: any detection is an FP', () => {
    expect(score([det('Romans', 3, null)], [])).toMatchObject({ tp: 0, fp: 1, fn: 0 })
    expect(score([], [])).toMatchObject({ tp: 0, fp: 0, fn: 0 })
  })
})

describe('aggregate', () => {
  const result = (over: Partial<FixtureResult>): FixtureResult => ({
    id: 'x',
    lang: 'en',
    tags: [],
    knownFailure: false,
    tp: 0,
    fp: 0,
    fn: 0,
    passed: true,
    latencyMs: 1,
    detections: [],
    missed: [],
    falsePositives: [],
    ...over
  })

  it('2 TP, 1 FP, 1 FN → precision 0.667, recall 0.667', () => {
    const m = aggregate([
      result({ id: 'a', tp: 1, latencyMs: 1 }),
      result({ id: 'b', tp: 1, fp: 1, passed: false, latencyMs: 3 }),
      result({ id: 'c', fn: 1, passed: false, latencyMs: 2 })
    ])
    expect(m.precision).toBeCloseTo(0.667, 3)
    expect(m.recall).toBeCloseTo(0.667, 3)
    expect(m.falsePositiveRate).toBeCloseTo(1 / 3, 6)
    expect(m.medianLatencyMs).toBe(2)
    expect(m.passed).toBe(1)
    expect(m.fixtures).toBe(3)
  })

  it('excludes known failures from the numbers but counts them', () => {
    const m = aggregate([result({ id: 'a', tp: 1 }), result({ id: 'k', fn: 1, passed: false, knownFailure: true })])
    expect(m).toMatchObject({ fixtures: 1, tp: 1, fn: 0, recall: 1, knownFailures: 1 })
  })

  it('empty set is vacuously perfect', () => {
    expect(aggregate([])).toMatchObject({ precision: 1, recall: 1, falsePositiveRate: 0, medianLatencyMs: 0 })
  })

  it('median handles even and odd counts', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})

describe('end to end on inline fixtures', () => {
  const lines = [
    { id: 'p1', lang: 'en', preacher: 'a', tags: ['explicit'], chunks: [{ text: 'john chapter three verse sixteen', isFinal: true }], expected: [{ book: 'John', chapter: 3, verse: 16 }] },
    { id: 'p2', lang: 'es', preacher: 'b', tags: ['explicit'], chunks: [{ text: 'romanos capitulo ocho versiculo veintiocho', isFinal: true }], expected: [{ book: 'Romans', chapter: 8, verse: 28 }] },
    { id: 'n1', lang: 'en', preacher: 'a', tags: ['negative'], chunks: [{ text: 'paul wrote to the romans', isFinal: true }], expected: [] },
    { id: 'wrong', lang: 'en', tags: ['negative'], chunks: [{ text: 'john chapter three verse sixteen', isFinal: true }], expected: [{ book: 'John', chapter: 3, verse: 17 }] },
    { id: 'kf', lang: 'en', known_failure: true, chunks: [{ text: 'nothing here', isFinal: true }], expected: [{ book: 'Mark', chapter: 1, verse: 1 }] }
  ]
  const fixtures = parseFixtureLines(lines.map((l) => JSON.stringify(l)).join('\n'))

  it('parses JSONL and runs the real resolver', () => {
    expect(fixtures).toHaveLength(5)
    const r = runFixture(fixtures[0])
    expect(r.passed).toBe(true)
    expect(r.detections.some((d) => d.book === 'John' && d.verse === 16)).toBe(true)
    expect(r.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('builds per-lang / per-preacher / per-tag buckets', () => {
    const report = runAll(fixtures)
    expect(report.overall).toMatchObject({ fixtures: 4, tp: 2, fp: 1, fn: 1, knownFailures: 1 })
    expect(report.overall.precision).toBeCloseTo(0.667, 3)
    expect(report.overall.recall).toBeCloseTo(0.667, 3)
    expect(report.byLang.en).toMatchObject({ fixtures: 3, tp: 1, fp: 1, fn: 1 })
    expect(report.byLang.es).toMatchObject({ fixtures: 1, tp: 1, precision: 1, recall: 1 })
    expect(report.byPreacher.a).toMatchObject({ fixtures: 2, passed: 2 })
    expect(report.byPreacher.b).toMatchObject({ fixtures: 1 })
    expect(report.byTag.negative).toMatchObject({ fixtures: 2, passed: 1 })
    expect(report.failures.map((f) => f.id)).toEqual(['wrong'])
    expect(report.knownFailures).toEqual([{ id: 'kf', nowPassing: false }])
  })

  it('rejects malformed fixtures with a line number', () => {
    expect(() => parseFixtureLines('{"id":"x"}', 'f.jsonl')).toThrow(/f\.jsonl:1/)
    expect(() => parseFixtureLines('not json')).toThrow(/invalid JSON/)
  })
})

describe('gate', () => {
  const t = { precision: 0.95, recall: 0.9, falsePositiveRate: 0.05 }
  it('passes at or above thresholds', () => {
    const report = buildReport([])
    expect(checkThresholds(report.overall, t)).toEqual([])
  })
  it('names each violated metric', () => {
    const m = { ...aggregate([]), precision: 0.5, recall: 0.8, falsePositiveRate: 0.2 }
    const v = checkThresholds(m, t)
    expect(v).toHaveLength(3)
    expect(v[0]).toMatch(/precision 50\.0% < 95\.0%/)
    expect(v[1]).toMatch(/recall/)
    expect(v[2]).toMatch(/false-positive rate/)
  })
})

// Type-level sanity: Fixture shape compiles with optional fields omitted.
const _minimal: Fixture = { id: 'm', lang: 'en', chunks: [{ text: 'x', isFinal: true }], expected: [] }
void _minimal
