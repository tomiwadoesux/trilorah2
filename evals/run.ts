/**
 * Eval runner CLI.
 *
 *   npx tsx evals/run.ts                 # all fixtures in evals/fixtures/
 *   npx tsx evals/run.ts --lang es       # only one language
 *   npx tsx evals/run.ts --tag range     # only fixtures carrying a tag
 *   npx tsx evals/run.ts --id en-001     # a single fixture (prints detections)
 *   npx tsx evals/run.ts --json          # print the report JSON instead of tables
 *
 * Always writes evals/last-run.json.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadFixtureDir, runAll, formatReport, type Fixture, type Report } from './harness'

export const EVALS_DIR = path.dirname(fileURLToPath(import.meta.url))
export const FIXTURES_DIR = path.join(EVALS_DIR, 'fixtures')
export const LAST_RUN_FILE = path.join(EVALS_DIR, 'last-run.json')

export interface RunCliOptions {
  lang?: string
  tag?: string
  id?: string
  fixturesDir?: string
  outFile?: string | null
}

export function runEvals(opts: RunCliOptions = {}): Report {
  let fixtures: Fixture[] = loadFixtureDir(opts.fixturesDir ?? FIXTURES_DIR)
  if (opts.lang) fixtures = fixtures.filter((f) => f.lang === opts.lang)
  if (opts.tag) fixtures = fixtures.filter((f) => (f.tags ?? []).includes(opts.tag!))
  if (opts.id) fixtures = fixtures.filter((f) => f.id === opts.id)
  const report = runAll(fixtures)
  const out = opts.outFile === undefined ? LAST_RUN_FILE : opts.outFile
  if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2))
  return report
}

function parseArgs(argv: string[]): RunCliOptions & { json: boolean } {
  const opts: RunCliOptions & { json: boolean } = { json: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--lang') opts.lang = argv[++i]
    else if (a === '--tag') opts.tag = argv[++i]
    else if (a === '--id') opts.id = argv[++i]
    else if (a === '--json') opts.json = true
    else throw new Error(`unknown argument ${a}`)
  }
  return opts
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2))
  const report = runEvals(opts)
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  if (report.totalFixtures === 0) {
    console.log('No fixtures matched.')
    return
  }
  console.log(formatReport(report))
  if (opts.id) {
    for (const r of report.results) {
      console.log(`\nDetections for ${r.id}:`)
      for (const d of r.detections) console.log(`  ${JSON.stringify(d)}`)
    }
  }
  console.log(`\nWrote ${path.relative(process.cwd(), LAST_RUN_FILE)}`)
}

const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) main()
