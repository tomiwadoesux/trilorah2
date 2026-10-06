/**
 * Local recognition replay. No microphone, credentials, provider calls or uploads.
 *
 * node --import tsx evals/recognition-replay.ts
 * node --import tsx evals/recognition-replay.ts --quotes-only --repeat 5
 * node --import tsx evals/recognition-replay.ts --strict --out /tmp/recognition-report.json
 *
 * Timings are synchronous matching CPU time over the bundled full Bible index.
 * Chunk numbers measure early/interim detection in synthetic transcript streams;
 * neither metric is microphone-to-screen or provider latency.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { QuoteMatcher } from '../electron/engine/quoteMatcher'

type Engine = 'quote' | 'passage'
type Reference = { book: string; chapter: number; verse?: number }
type Source = { title: string; author: string; editionYear: number; url: string; locator: string }
type Provenance = { kind: 'synthetic' | 'published-sermon-excerpt'; description: string }
type Fixture = {
  id: string
  engine: Engine
  tags: string[]
  expected: Reference[]
  /** Zero-based chunk index by which the correct top result must appear. */
  byChunk?: number
  chunks: Array<{ text: string; isFinal: boolean }>
  source?: Source
  provenance?: Provenance['kind']
}
type Candidate = Reference & { ref: string; endVerse?: number; endChapter?: number }
type Observation = { chunk: number; isFinal: boolean; refs: string[]; topCorrect: boolean; anyCorrect: boolean }
type CaseResult = {
  id: string
  engine: Engine
  negative: boolean
  passed: boolean
  firstCorrectChunk: number | null
  firstCorrectWasInterim: boolean
  unexpectedTopRefs: string[]
  observations: Observation[]
  provenance: Provenance['kind']
  source?: Source
}
type PassageEngine = {
  updateTranscript(text: string, isFinal: boolean): Candidate | null
  reset(): void
}

const fixturesDir = fileURLToPath(new URL('./recognition/', import.meta.url))

function quiet<T>(fn: () => T): T {
  const previous = console.log
  console.log = () => undefined
  try { return fn() } finally { console.log = previous }
}

function quoteCandidate(ref: string): Candidate {
  const match = ref.match(/^(.+) (\d+):(\d+)$/)
  if (!match) throw new Error(`Unrecognised quote reference: ${ref}`)
  return { ref, book: match[1], chapter: Number(match[2]), verse: Number(match[3]) }
}

function matches(candidate: Candidate, expected: Reference): boolean {
  if (candidate.book !== expected.book) return false
  if (expected.chapter < candidate.chapter || expected.chapter > (candidate.endChapter ?? candidate.chapter)) return false
  if (expected.verse === undefined) return true
  if (candidate.verse === undefined) return false
  if (expected.chapter === candidate.chapter && expected.verse < candidate.verse) return false
  if (expected.chapter === (candidate.endChapter ?? candidate.chapter) && expected.verse > (candidate.endVerse ?? candidate.verse)) return false
  return true
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0
  const ordered = [...values].sort((a, b) => a - b)
  return Number(ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)].toFixed(3))
}

function timing(values: number[]) {
  return { calls: values.length, p50Ms: percentile(values, 0.5), p95Ms: percentile(values, 0.95), maxMs: values.length ? Number(Math.max(...values).toFixed(3)) : 0 }
}

function parseOptions() {
  const options = { quotesOnly: false, repeat: 5, strict: false, out: '' }
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--quotes-only') options.quotesOnly = true
    else if (args[i] === '--strict') options.strict = true
    else if (args[i] === '--repeat') {
      options.repeat = Number(args[++i])
      if (!Number.isInteger(options.repeat) || options.repeat < 1 || options.repeat > 100) throw new Error('--repeat must be an integer from 1 to 100')
    } else if (args[i] === '--out') {
      options.out = args[++i] ?? ''
      if (!options.out) throw new Error('--out needs a filename')
    } else throw new Error(`Unknown argument: ${args[i]}`)
  }
  return options
}

async function main() {
  const options = parseOptions()
  const collections = fs.readdirSync(fixturesDir).filter(file => file.endsWith('.json')).sort().map(file => {
    const collection = JSON.parse(fs.readFileSync(path.join(fixturesDir, file), 'utf8')) as { provenance: Provenance; cases: Fixture[] }
    if (!['synthetic', 'published-sermon-excerpt'].includes(collection.provenance.kind)) throw new Error(`Missing provenance: ${file}`)
    if (collection.provenance.kind === 'published-sermon-excerpt' && collection.cases.some(f => !f.source?.url)) throw new Error(`Missing source attribution: ${file}`)
    return collection
  })
  const cases = collections.flatMap(c => c.cases.map(f => ({ ...f, provenance: c.provenance.kind }))).filter(f => !options.quotesOnly || f.engine === 'quote')
  if (new Set(cases.map(f => f.id)).size !== cases.length) throw new Error('Fixture ids must be unique')

  const quote = new QuoteMatcher()
  const startup = performance.now()
  if (!quiet(() => quote.loadIndex())) throw new Error('Full Bible quote index could not load')
  const quoteIndexLoadMs = performance.now() - startup
  const knownRefs = new Set(quote.verses.map(v => v.ref))
  for (const fixture of cases) {
    for (const expected of fixture.expected) {
      if (expected.verse !== undefined && !knownRefs.has(`${expected.book} ${expected.chapter}:${expected.verse}`)) {
        throw new Error(`Ground truth does not exist in bundled Bible: ${fixture.id}`)
      }
    }
  }

  let passage: PassageEngine | null = null
  let passageIndexLoadMs: number | null = null
  if (!options.quotesOnly) {
    const before = performance.now()
    const { PassageMatcher } = await import('../electron/engine/passageMatcher')
    passage = quiet(() => new PassageMatcher())
    passageIndexLoadMs = performance.now() - before
  }

  const times: Record<Engine, number[]> = { quote: [], passage: [] }
  const results: CaseResult[] = []
  // One untimed warm-up per engine. Retain loaded indexes across fixtures.
  quiet(() => {
    quote.updateTranscript('for god so loved the world', false)
    quote.tryDetectQuotes()
    passage?.updateTranscript('when david faced goliath', false)
  })

  for (let repeat = 0; repeat < options.repeat; repeat++) {
    for (const fixture of cases) {
      quote.reset()
      passage?.reset()
      const observations: Observation[] = []
      const unexpected = new Set<string>()
      let firstCorrectChunk: number | null = null
      let firstCorrectWasInterim = false
      for (let chunk = 0; chunk < fixture.chunks.length; chunk++) {
        const speech = fixture.chunks[chunk]
        const begin = performance.now()
        const candidates: Candidate[] = quiet(() => {
          if (fixture.engine === 'quote') {
            quote.updateTranscript(speech.text, speech.isFinal)
            return quote.tryDetectQuotes().slice(0, 5).map(result => quoteCandidate(result.ref))
          }
          const result = passage!.updateTranscript(speech.text, speech.isFinal)
          return result ? [result] : []
        })
        times[fixture.engine].push(performance.now() - begin)
        const correct = (candidate: Candidate) => fixture.expected.some(expected => matches(candidate, expected))
        const topCorrect = candidates.length > 0 && correct(candidates[0])
        if (candidates[0] && !topCorrect) unexpected.add(candidates[0].ref)
        if (topCorrect && firstCorrectChunk === null) {
          firstCorrectChunk = chunk
          firstCorrectWasInterim = !speech.isFinal
        }
        observations.push({ chunk, isFinal: speech.isFinal, refs: candidates.map(c => c.ref), topCorrect, anyCorrect: candidates.some(correct) })
      }
      if (repeat === 0) {
        const found = fixture.expected.length === 0 || firstCorrectChunk !== null
        const onTime = fixture.byChunk === undefined || (firstCorrectChunk !== null && firstCorrectChunk <= fixture.byChunk)
        results.push({
          id: fixture.id, engine: fixture.engine, negative: !fixture.expected.length,
          passed: found && onTime && unexpected.size === 0,
          firstCorrectChunk, firstCorrectWasInterim, unexpectedTopRefs: [...unexpected], observations,
          provenance: fixture.provenance,
          ...(fixture.source ? { source: fixture.source } : {}),
        })
      }
    }
  }

  const report = {
    measuredAt: new Date().toISOString(),
    provenance: collections.map(c => c.provenance),
    scope: 'Text replay of labelled synthetic scenarios and published sermon excerpts over full bundled indexes. Timings exclude speech recognition, network, IPC, UI rendering and index startup. Not a recorded-sermon accuracy or microphone-to-screen latency result.',
    repeats: options.repeat,
    quoteIndexVerses: knownRefs.size,
    quoteIndexWordings: quote.verses.length,
    startup: { quoteIndexLoadMs: Number(quoteIndexLoadMs.toFixed(3)), passageIndexLoadMs: passageIndexLoadMs === null ? null : Number(passageIndexLoadMs.toFixed(3)) },
    matchingTime: { quote: timing(times.quote), passage: timing(times.passage) },
    summary: {
      cases: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      positiveCases: results.filter(r => !r.negative).length,
      positiveCasesRecognised: results.filter(r => !r.negative && r.firstCorrectChunk !== null).length,
      negativeCases: results.filter(r => r.negative).length,
      negativeCasesWithSuggestions: results.filter(r => r.negative && r.unexpectedTopRefs.length > 0).length,
      casesRecognisedOnInterim: results.filter(r => r.firstCorrectWasInterim).length,
      syntheticCases: results.filter(r => r.provenance === 'synthetic').length,
      publishedSermonExcerptCases: results.filter(r => r.provenance === 'published-sermon-excerpt').length,
    },
    results,
  }
  console.log(report.scope)
  console.log(`Full quote index: ${report.quoteIndexVerses} unique verse references, ${report.quoteIndexWordings} translation wordings. Text replay cases: ${report.summary.passed}/${report.summary.cases} pass (${report.summary.syntheticCases} synthetic, ${report.summary.publishedSermonExcerptCases} published sermon excerpts).`)
  console.log(`Matching CPU time (${options.repeat} repeats): ${JSON.stringify(report.matchingTime)}`)
  for (const failure of results.filter(r => !r.passed)) {
    console.log(`FAIL ${failure.id}: ${JSON.stringify({ firstCorrectChunk: failure.firstCorrectChunk, unexpected: failure.unexpectedTopRefs, observations: failure.observations })}`)
  }
  if (options.out) {
    fs.writeFileSync(path.resolve(options.out), `${JSON.stringify(report, null, 2)}\n`)
    console.log(`Report: ${path.resolve(options.out)}`)
  }
  if (options.strict && report.summary.failed) process.exitCode = 1
}

main().catch(error => { console.error(error); process.exitCode = 1 })
