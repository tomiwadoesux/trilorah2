#!/usr/bin/env node
/**
 * Builds Trilorah Stage Timer, the small separate download for the
 * preacher's countdown screen (electron/timerapp/main.ts).
 *
 *   node scripts/build-timerapp.mjs            installers for this computer
 *   node scripts/build-timerapp.mjs --dir      just the unpacked app, for testing
 *   node scripts/build-timerapp.mjs --win      the Windows installer
 *   node scripts/build-timerapp.mjs --mac      the Mac installer
 *
 * Anything after the flags goes to electron-builder as it is.
 *
 * The app is staged in dist-timerapp/ with its own package.json and no
 * dependencies at all — no engine, Bible, models, whisper or native modules
 * — which is why, unlike the sender, either platform's installer can be
 * built anywhere electron-builder can run.
 */

import { spawnSync } from 'node:child_process'
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'dist-timerapp')
const args = process.argv.slice(2)

rmSync(out, { recursive: true, force: true })

// 1. The window.
await build({ root, configFile: join(root, 'vite.timerapp.config.ts'), logLevel: 'warn' })

// 2. Main and preload, one build each: a sandboxed preload cannot load a chunk shared with main.
const external = ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)]
for (const name of ['main', 'preload']) {
  await build({
    root,
    configFile: false,
    logLevel: 'warn',
    publicDir: false,
    build: {
      outDir: out,
      emptyOutDir: false,
      minify: false,
      target: 'node22',
      lib: { entry: join(root, `electron/timerapp/${name}.ts`), formats: ['cjs'], fileName: () => `${name}.js` },
      rollupOptions: { external },
    },
  })
}

// 3. Its own package.json: the name, version and entry the packaged app reports.
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
writeFileSync(join(out, 'package.json'), JSON.stringify({
  name: 'trilorah-stage-timer',
  productName: 'Trilorah Stage Timer',
  version: pkg.version,
  description: 'Trilorah Stage Timer — the preacher’s countdown screen, with extra-time grants, on any display. Finds Trilorah on the same network to show the scriptures the preacher names.',
  license: pkg.license,
  main: 'main.js',
}, null, 2))
for (const file of ['LICENSE', 'NOTICE', 'THIRD-PARTY-NOTICES.md']) cpSync(join(root, file), join(out, file))

console.log(`✓ staged Trilorah Stage Timer ${pkg.version} in dist-timerapp/`)

// 4. Package it.
const builderArgs = ['electron-builder', '--config', 'electron-builder.timerapp.yml', ...args]
const result = spawnSync('npx', builderArgs, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
process.exit(result.status ?? 1)
