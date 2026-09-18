/**
 * CI gate: run the evals and exit 1 when any overall metric falls below
 * evals/thresholds.json. Known-failure fixtures are excluded from the
 * numbers (but listed), so the gate measures what the resolver is
 * supposed to handle today.
 *
 *   npx tsx evals/gate.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatReport, type Metrics, type Report } from './harness'
import { runEvals, EVALS_DIR } from './run'

export interface Thresholds {
  precision: number
  recall: number
  falsePositiveRate: number
}

export const THRESHOLDS_FILE = path.join(EVALS_DIR, 'thresholds.json')

export function loadThresholds(file = THRESHOLDS_FILE): Thresholds {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as Thresholds
}

/** Returns human-readable violations; empty array = gate passes. */
export function checkThresholds(metrics: Metrics, t: Thresholds): string[] {
  const out: string[] = []
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`
  if (metrics.precision < t.precision) {
    out.push(`precision ${pct(metrics.precision)} < ${pct(t.precision)}`)
  }
  if (metrics.recall < t.recall) {
    out.push(`recall ${pct(metrics.recall)} < ${pct(t.recall)}`)
  }
  if (metrics.falsePositiveRate > t.falsePositiveRate) {
    out.push(`false-positive rate ${pct(metrics.falsePositiveRate)} > ${pct(t.falsePositiveRate)}`)
  }
  return out
}

export function gate(report: Report, t: Thresholds): { ok: boolean; violations: string[] } {
  const violations = checkThresholds(report.overall, t)
  return { ok: violations.length === 0, violations }
}

function main(): void {
  const t = loadThresholds()
  const report = runEvals()
  console.log(formatReport(report))
  console.log('')
  const { ok, violations } = gate(report, t)
  if (report.overall.fixtures === 0) {
    console.error('EVAL GATE: no fixtures ran')
    process.exit(1)
  }
  if (!ok) {
    console.error('EVAL GATE FAILED:')
    for (const v of violations) console.error(`  - ${v}`)
    if (report.failures.length > 0) {
      console.error(`  ${report.failures.length} failing fixture(s): ${report.failures.map((f) => f.id).join(', ')}`)
    }
    process.exit(1)
  }
  console.log(
    `EVAL GATE PASSED: precision ${(report.overall.precision * 100).toFixed(1)}%, ` +
      `recall ${(report.overall.recall * 100).toFixed(1)}%, ` +
      `FP rate ${(report.overall.falsePositiveRate * 100).toFixed(1)}% ` +
      `over ${report.overall.fixtures} fixtures (${report.overall.knownFailures} known failures skipped)`
  )
}

const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) main()
