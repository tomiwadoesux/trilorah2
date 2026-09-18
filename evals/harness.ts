/**
 * Eval harness for the spoken scripture-reference resolver.
 *
 * Pure logic — no Electron imports. Turns "it got 600 in a row" into
 * measured precision / recall / false-positive rate / latency, broken
 * down per language, per preacher and per tag.
 *
 * Scoring model (see evals/README.md):
 *  - Each fixture is fed chunk by chunk into a FRESH resolver with an
 *    injected clock (advanced by a fixed step per chunk).
 *  - A detection MATCHES an expected ref on book + chapter (+ verse unless
 *    the expected verse is null = chapter-only, + endVerse when given).
 *  - A detection that is a strict PREFIX of an expected ref (bare book, or
 *    same book+chapter with no verse yet) is a normal intermediate step of
 *    the state machine and is neither TP nor FP.
 *  - Bare "verse N" context updates (empty book) are ignored.
 *  - Every other detection is a false positive (counted once per unique
 *    book|chapter|verse|endVerse key).
 */

import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import {
  SpokenReferenceResolver,
  type ResolvedReference
} from '../electron/engine/referenceResolver'
import { getLanguagePack } from '../electron/engine/lang'

/* ------------------------------------------------------------------ */
/* Fixture format                                                      */
/* ------------------------------------------------------------------ */

export type FixtureLang = 'en' | 'es' | 'fr' | 'pt' | 'hi' | 'zh'

export interface ExpectedRef {
  book: string
  chapter: number
  /** null = chapter-only reference (any verse accepted). */
  verse: number | null
  /** Omit to ignore; null = must NOT be a range. */
  endVerse?: number | null
}

export interface Chunk {
  text: string
  isFinal: boolean
}

export interface Fixture {
  id: string
  lang: FixtureLang
  preacher?: string
  tags?: string[]
  chunks: Chunk[]
  /** Empty array = negative fixture: the transcript must produce nothing. */
  expected: ExpectedRef[]
  /** Resolver currently fails this fixture; the gate skips it, the report lists it. */
  known_failure?: boolean
  /** Open the bare-book gate for this fixture (default: closed / narrative mode). */
  gateOpen?: boolean
}

export const FIXTURE_LANGS: FixtureLang[] = ['en', 'es', 'fr', 'pt', 'hi', 'zh']

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

export function parseFixtureLines(text: string, sourceName = 'inline'): Fixture[] {
  const out: Fixture[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    let obj: unknown
    try {
      obj = JSON.parse(line)
    } catch (e) {
      throw new Error(`${sourceName}:${i + 1}: invalid JSON — ${(e as Error).message}`)
    }
    out.push(validateFixture(obj, `${sourceName}:${i + 1}`))
  }
  return out
}

export function validateFixture(obj: unknown, where: string): Fixture {
  const f = obj as Partial<Fixture>
  const fail = (msg: string): never => {
    throw new Error(`${where}: ${msg}`)
  }
  if (!f || typeof f !== 'object') fail('fixture must be an object')
  if (typeof f.id !== 'string' || !f.id) fail('missing id')
  if (!FIXTURE_LANGS.includes(f.lang as FixtureLang)) fail(`bad lang "${f.lang}"`)
  const chunks = f.chunks
  if (!Array.isArray(chunks) || chunks.length === 0) fail('chunks must be a non-empty array')
  for (const c of chunks as Chunk[]) {
    if (typeof c?.text !== 'string' || typeof c?.isFinal !== 'boolean') {
      fail('each chunk needs { text: string, isFinal: boolean }')
    }
  }
  const expected = f.expected
  if (!Array.isArray(expected)) fail('expected must be an array')
  for (const e of expected as ExpectedRef[]) {
    if (typeof e?.book !== 'string' || typeof e?.chapter !== 'number') {
      fail('each expected ref needs { book: string, chapter: number }')
    }
    if (e.verse !== null && typeof e.verse !== 'number') fail('expected.verse must be number|null')
  }
  return f as Fixture
}

export function loadFixtureFile(file: string): Fixture[] {
  return parseFixtureLines(fs.readFileSync(file, 'utf-8'), path.basename(file))
}

export function loadFixtureDir(dir: string): Fixture[] {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .sort()
  const all = files.flatMap((f) => loadFixtureFile(path.join(dir, f)))
  const seen = new Set<string>()
  for (const f of all) {
    if (seen.has(f.id)) throw new Error(`duplicate fixture id "${f.id}"`)
    seen.add(f.id)
  }
  return all
}

/* ------------------------------------------------------------------ */
/* Running one fixture                                                 */
/* ------------------------------------------------------------------ */

export interface Detection {
  book: string
  chapter: number | null
  verse: number | null
  endVerse: number | null
}

export interface FixtureResult {
  id: string
  lang: FixtureLang
  preacher?: string
  tags: string[]
  knownFailure: boolean
  tp: number
  fp: number
  fn: number
  passed: boolean
  latencyMs: number
  detections: Detection[]
  missed: ExpectedRef[]
  falsePositives: Detection[]
}

export interface RunOptions {
  /** Simulated ms between chunks (drives the resolver's injected clock). */
  chunkGapMs?: number
}

const DEFAULT_CHUNK_GAP_MS = 400

function toDetection(d: ResolvedReference): Detection {
  return {
    book: d.book,
    chapter: d.chapter,
    verse: d.verse,
    endVerse: d.endVerse ?? d.rangeEnd ?? null
  }
}

/** Feed a fixture through a fresh resolver; returns raw detections + latency. */
export function runResolver(
  fixture: Fixture,
  opts: RunOptions = {}
): { detections: Detection[]; latencyMs: number } {
  const gap = opts.chunkGapMs ?? DEFAULT_CHUNK_GAP_MS
  const detections: Detection[] = []
  let t = 1_000_000
  const resolver = new SpokenReferenceResolver((d) => detections.push(toDetection(d)), {
    pack: fixture.lang === 'en' ? null : getLanguagePack(fixture.lang),
    now: () => t,
    bareBookGate: () => fixture.gateOpen === true
  })
  const start = performance.now()
  for (const chunk of fixture.chunks) {
    resolver.process(chunk.text, chunk.isFinal)
    t += gap
  }
  const latencyMs = performance.now() - start
  return { detections, latencyMs }
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export function matches(det: Detection, exp: ExpectedRef): boolean {
  if (det.book !== exp.book) return false
  if (det.chapter !== exp.chapter) return false
  if (exp.verse !== null && det.verse !== exp.verse) return false
  if (exp.endVerse !== undefined && (det.endVerse ?? null) !== exp.endVerse) return false
  return true
}

/** Intermediate state-machine step on the way to `exp` (not an error). */
export function isPrefixOf(det: Detection, exp: ExpectedRef): boolean {
  if (det.book !== exp.book) return false
  if (det.chapter === null) return true
  if (det.chapter !== exp.chapter) return false
  if (det.verse === null && exp.verse !== null) return true
  // Same book/chapter/verse but range not yet read
  if (exp.endVerse !== undefined && exp.endVerse !== null && det.verse === exp.verse && det.endVerse === null) {
    return true
  }
  return false
}

export function detectionKey(d: Detection): string {
  return `${d.book}|${d.chapter}|${d.verse}|${d.endVerse ?? ''}`
}

export interface Score {
  tp: number
  fp: number
  fn: number
  missed: ExpectedRef[]
  falsePositives: Detection[]
}

export function score(detections: Detection[], expected: ExpectedRef[]): Score {
  const matched = new Array<boolean>(expected.length).fill(false)
  const fpByKey = new Map<string, Detection>()

  for (const det of detections) {
    if (!det.book) continue // bare "verse N" context update
    let hit = false
    for (let i = 0; i < expected.length; i++) {
      if (matches(det, expected[i])) {
        matched[i] = true
        hit = true
      }
    }
    if (hit) continue
    if (expected.some((e) => isPrefixOf(det, e))) continue
    const key = detectionKey(det)
    if (!fpByKey.has(key)) fpByKey.set(key, det)
  }

  const missed = expected.filter((_, i) => !matched[i])
  const tp = matched.filter(Boolean).length
  return {
    tp,
    fp: fpByKey.size,
    fn: missed.length,
    missed,
    falsePositives: [...fpByKey.values()]
  }
}

export function runFixture(fixture: Fixture, opts: RunOptions = {}): FixtureResult {
  const { detections, latencyMs } = runResolver(fixture, opts)
  const s = score(detections, fixture.expected)
  return {
    id: fixture.id,
    lang: fixture.lang,
    preacher: fixture.preacher,
    tags: fixture.tags ?? [],
    knownFailure: fixture.known_failure === true,
    tp: s.tp,
    fp: s.fp,
    fn: s.fn,
    passed: s.fp === 0 && s.fn === 0,
    latencyMs,
    detections,
    missed: s.missed,
    falsePositives: s.falsePositives
  }
}

/* ------------------------------------------------------------------ */
/* Aggregation                                                         */
/* ------------------------------------------------------------------ */

export interface Metrics {
  /** Fixtures counted (known failures excluded). */
  fixtures: number
  passed: number
  tp: number
  fp: number
  fn: number
  /** tp / (tp + fp); 1 when nothing was detected and nothing expected. */
  precision: number
  /** tp / (tp + fn); 1 when nothing expected. */
  recall: number
  /** Fraction of fixtures that produced at least one false positive. */
  falsePositiveRate: number
  medianLatencyMs: number
  /** Known-failure fixtures in this bucket (not in the numbers above). */
  knownFailures: number
}

export interface Report {
  ranAt: string
  totalFixtures: number
  overall: Metrics
  byLang: Record<string, Metrics>
  byPreacher: Record<string, Metrics>
  byTag: Record<string, Metrics>
  knownFailures: Array<{ id: string; nowPassing: boolean }>
  failures: Array<{
    id: string
    lang: FixtureLang
    missed: ExpectedRef[]
    falsePositives: Detection[]
  }>
  results: FixtureResult[]
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function aggregate(results: FixtureResult[]): Metrics {
  const counted = results.filter((r) => !r.knownFailure)
  const tp = counted.reduce((n, r) => n + r.tp, 0)
  const fp = counted.reduce((n, r) => n + r.fp, 0)
  const fn = counted.reduce((n, r) => n + r.fn, 0)
  const withFp = counted.filter((r) => r.fp > 0).length
  return {
    fixtures: counted.length,
    passed: counted.filter((r) => r.passed).length,
    tp,
    fp,
    fn,
    precision: tp + fp === 0 ? 1 : tp / (tp + fp),
    recall: tp + fn === 0 ? 1 : tp / (tp + fn),
    falsePositiveRate: counted.length === 0 ? 0 : withFp / counted.length,
    medianLatencyMs: median(results.map((r) => r.latencyMs)),
    knownFailures: results.length - counted.length
  }
}

function groupBy(results: FixtureResult[], keys: (r: FixtureResult) => string[]): Record<string, Metrics> {
  const groups = new Map<string, FixtureResult[]>()
  for (const r of results) {
    for (const k of keys(r)) {
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(r)
    }
  }
  const out: Record<string, Metrics> = {}
  for (const k of [...groups.keys()].sort()) out[k] = aggregate(groups.get(k)!)
  return out
}

export function buildReport(results: FixtureResult[]): Report {
  return {
    ranAt: new Date().toISOString(),
    totalFixtures: results.length,
    overall: aggregate(results),
    byLang: groupBy(results, (r) => [r.lang]),
    byPreacher: groupBy(results, (r) => (r.preacher ? [r.preacher] : [])),
    byTag: groupBy(results, (r) => r.tags),
    knownFailures: results
      .filter((r) => r.knownFailure)
      .map((r) => ({ id: r.id, nowPassing: r.passed })),
    failures: results
      .filter((r) => !r.knownFailure && !r.passed)
      .map((r) => ({ id: r.id, lang: r.lang, missed: r.missed, falsePositives: r.falsePositives })),
    results
  }
}

export function runAll(fixtures: Fixture[], opts: RunOptions = {}): Report {
  return buildReport(fixtures.map((f) => runFixture(f, opts)))
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

function fmtRef(e: { book: string; chapter: number | null; verse: number | null; endVerse?: number | null }): string {
  let s = `${e.book} ${e.chapter ?? '?'}`
  if (e.verse !== null && e.verse !== undefined) s += `:${e.verse}`
  if (e.endVerse !== null && e.endVerse !== undefined) s += `-${e.endVerse}`
  return s
}

function table(title: string, rows: Array<[string, Metrics]>): string {
  const header = ['bucket', 'n', 'pass', 'TP', 'FP', 'FN', 'precision', 'recall', 'FP rate', 'p50 ms', 'known']
  const data = rows.map(([name, m]) => [
    name,
    String(m.fixtures),
    String(m.passed),
    String(m.tp),
    String(m.fp),
    String(m.fn),
    pct(m.precision),
    pct(m.recall),
    pct(m.falsePositiveRate),
    m.medianLatencyMs.toFixed(3),
    String(m.knownFailures)
  ])
  const widths = header.map((h, i) => Math.max(h.length, ...data.map((r) => r[i].length)))
  const line = (cells: string[]) =>
    cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ')
  return [`${title}`, line(header), widths.map((w) => '-'.repeat(w)).join('  '), ...data.map(line)].join('\n')
}

export function formatReport(report: Report): string {
  const parts: string[] = []
  parts.push(table('Overall', [['all', report.overall]]))
  parts.push('')
  parts.push(table('By language', Object.entries(report.byLang)))
  if (Object.keys(report.byPreacher).length > 0) {
    parts.push('')
    parts.push(table('By preacher', Object.entries(report.byPreacher)))
  }
  if (Object.keys(report.byTag).length > 0) {
    parts.push('')
    parts.push(table('By tag', Object.entries(report.byTag)))
  }
  if (report.failures.length > 0) {
    parts.push('')
    parts.push(`Failures (${report.failures.length}):`)
    for (const f of report.failures) {
      const bits: string[] = []
      if (f.missed.length) bits.push(`missed ${f.missed.map(fmtRef).join(', ')}`)
      if (f.falsePositives.length) bits.push(`false ${f.falsePositives.map(fmtRef).join(', ')}`)
      parts.push(`  ${f.id} [${f.lang}] — ${bits.join('; ')}`)
    }
  }
  if (report.knownFailures.length > 0) {
    parts.push('')
    parts.push(`Known failures (${report.knownFailures.length}, excluded from metrics):`)
    for (const k of report.knownFailures) {
      parts.push(`  ${k.id}${k.nowPassing ? '  <- now passing, drop known_failure' : ''}`)
    }
  }
  return parts.join('\n')
}
