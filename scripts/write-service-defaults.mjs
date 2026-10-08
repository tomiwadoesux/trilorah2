/**
 * Bakes the Deepgram key and HF token into the build — and the YouVersion
 * app key that unlocks NKJV and NIV (electron/data/bibleOnline/youversionDefaults.ts).
 *
 * Runs before electron-builder. It reads the keys from the environment (the
 * same .env.local a developer already has) and writes them into
 * electron/asr/serviceDefaults.ts, whose committed copy holds empty strings.
 *
 * Without this step a packaged installer has no keys at all — there is no
 * .env.local inside an .app or .exe, and since the Settings screen no longer
 * offers a place to type one, "deepgram" in the speech-engine dropdown would
 * be an option that silently does nothing.
 *
 * The file is restored to its empty state by `--restore`, which `npm run
 * dist` calls afterwards so a real key never sits in the working tree where
 * `git add -A` could sweep it into a commit.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'electron/asr/serviceDefaults.ts')
const restore = process.argv.includes('--restore')

// .env.local is not loaded for us here; read it ourselves so `npm run dist`
// works from a plain shell the way the dev server does.
function fromEnvFile(key) {
  try {
    const line = readFileSync(join(root, '.env.local'), 'utf8')
      .split('\n')
      .find((l) => l.trimStart().startsWith(`${key}=`))
    return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : ''
  } catch {
    return ''
  }
}

const deepgram = restore ? '' : process.env.DEEPGRAM_API_KEY || fromEnvFile('DEEPGRAM_API_KEY')
const hf = restore ? '' : process.env.HF_API_TOKEN || fromEnvFile('HF_API_TOKEN')

const src = readFileSync(target, 'utf8')
const next = src.replace(
  /export const SERVICE_DEFAULTS = \{[\s\S]*?\} as const/,
  `export const SERVICE_DEFAULTS = {\n  deepgramApiKey: ${JSON.stringify(deepgram)},\n  hfToken: ${JSON.stringify(hf)}\n} as const`
)

if (next === src && !restore) {
  console.warn('⚠️  service defaults unchanged — check the SERVICE_DEFAULTS block still matches')
}
writeFileSync(target, next)

/* The YouVersion app key (NKJV, NIV) goes in a file of its own, so the
   owner's skip-worktree on serviceDefaults.ts is left as it is. */
const youversionTarget = join(root, 'electron/data/bibleOnline/youversionDefaults.ts')
const youversion = restore ? '' : process.env.YOUVERSION_APP_KEY || fromEnvFile('YOUVERSION_APP_KEY')
const yvSrc = readFileSync(youversionTarget, 'utf8')
const yvNext = yvSrc.replace(
  /export const YOUVERSION_DEFAULTS = \{[\s\S]*?\} as const/,
  `export const YOUVERSION_DEFAULTS = {\n  appKey: ${JSON.stringify(youversion)}\n} as const`
)
if (yvNext === yvSrc && !restore && youversion) {
  console.warn('⚠️  youversion default unchanged — check the YOUVERSION_DEFAULTS block still matches')
}
writeFileSync(youversionTarget, yvNext)

if (restore) {
  console.log('🧹 service defaults cleared from the working tree')
} else {
  console.log(
    `🔑 service defaults baked in — deepgram: ${deepgram ? 'yes' : 'MISSING'}, hugging face: ${hf ? 'yes' : 'MISSING'}, youversion: ${youversion ? 'yes' : 'MISSING'}`
  )
  if (!deepgram) {
    console.warn('⚠️  no DEEPGRAM_API_KEY found — this build ships without cloud speech')
  }
  if (!youversion) {
    console.warn('⚠️  no YOUVERSION_APP_KEY found — NKJV and NIV will show as unavailable in this build')
  }
}
