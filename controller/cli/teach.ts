/**
 * Teach Trilorah an app from the terminal, at sound check:
 *
 *   npx tsx controller/cli/teach.ts <app> [--out recipes/<name>.json] [--only show,clear]
 *
 * Asks the four questions, runs the inspector's `watch` for each, and writes
 * the recipe. Then verifies it — every taught control looked up again without
 * pressing — so the file on disk is known good before anyone relies on it.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { findInspectorBinary, spawnInspector } from '../recipes/inspect'
import { verify } from '../recipes/runner'
import { QUESTIONS, teach, type WatchRecord } from '../recipes/teach'
import type { Ability } from '../recipes/schema'

const args = process.argv.slice(2)
const appQuery = args.find((a) => !a.startsWith('--'))
if (!appQuery) { console.error('which app? e.g. npx tsx controller/cli/teach.ts TextEdit'); process.exit(2) }
const flag = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined }
const only = flag('only')?.split(',').map((s) => s.trim()) as Ability[] | undefined
/** How long each question waits for its click before it is skipped. */
const seconds = Math.max(10, Number(flag('seconds') ?? 90) || 90)

const binary = findInspectorBinary()
if (!binary) { console.error('trilorah-inspect is not built — run scripts/build-inspect.sh'); process.exit(2) }
const inspect = spawnInspector(binary, 10 * 60 * 1000)

async function main() {
  const apps = await inspect.run(['apps']) as { apps?: Array<{ name: string; bundle: string; pid: number }> }
  const q = appQuery!.toLowerCase()
  const app = apps.apps?.find((a) => a.name.toLowerCase() === q || a.bundle.toLowerCase() === q) ?? apps.apps?.find((a) => a.name.toLowerCase().includes(q))
  if (!app) { console.error(`"${appQuery}" is not running — open it first`); process.exit(2) }

  console.error(`Teaching Trilorah about ${app.name}. Each question: click the control in ${app.name}; wait ${seconds} s to skip.\n`)
  const result = await teach(
    async (_ability, clicks) => {
      const r = await inspect.run(['watch', String(app.pid), '--count', String(clicks), '--seconds', String(seconds)])
      return ((r.recorded as WatchRecord[] | undefined) ?? [])
    },
    {
      platform: process.platform === 'win32' ? 'windows' : 'macos',
      app: { id: app.bundle, name: app.name },
      questions: only ? QUESTIONS.filter((x) => only.includes(x.ability)) : QUESTIONS,
      say: (ask) => console.error(`\n› ${ask}`),
    }
  )
  if (!result.recipe) { console.error(`\nNo recipe: ${result.problem}`); process.exit(1) }
  if (result.skipped.length) console.error(`\nskipped: ${result.skipped.join(', ')}`)

  console.error('\nChecking every taught control again, without pressing…')
  const report = await verify(result.recipe, inspect)
  for (const b of report.broken) console.error(`  ✗ ${b.ability}: ${b.label ?? 'step ' + b.index} — ${b.problem}`)
  console.error(report.ok ? `  ✓ all ${report.checked} controls found again` : `  ${report.broken.length} of ${report.checked} did not resolve cleanly`)

  const out = flag('out') ?? path.join('controller', 'recipes', 'taught', `${app.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify(result.recipe, null, 2))
  console.error(`\nwrote ${out}`)
  process.exit(report.ok ? 0 : 1)
}

void main()
