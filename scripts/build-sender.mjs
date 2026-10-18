#!/usr/bin/env node
/**
 * Builds Trilorah Sender, the small separate download for the computer the
 * sound desk is plugged into (electron/sender/main.ts).
 *
 *   node scripts/build-sender.mjs            installers for this computer
 *   node scripts/build-sender.mjs --dir      just the unpacked app, for testing
 *   node scripts/build-sender.mjs --win      the Windows installer (run on Windows)
 *
 * Anything after the flags goes to electron-builder as it is.
 *
 * The app is staged in dist-sender/ with its own package.json and only the
 * NDI® packages, so electron-builder (electron-builder.sender.yml) packs none
 * of the main app's dependencies — no engine, Bible, models or whisper.
 */

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'dist-sender')
const args = process.argv.slice(2)

// The platform the installer is for decides which NDI library goes in.
const target = args.includes('--win') ? 'win32-x64' : args.includes('--mac') ? 'darwin-arm64' : `${process.platform}-${process.arch}`

rmSync(out, { recursive: true, force: true })

// 1. The window.
await build({ root, configFile: join(root, 'vite.sender.config.ts'), logLevel: 'warn' })

// 2. Main and preload, one build each: a sandboxed preload cannot load a chunk shared with main.
const external = ['electron', 'grandi', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)]
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
      lib: { entry: join(root, `electron/sender/${name}.ts`), formats: ['cjs'], fileName: () => `${name}.js` },
      rollupOptions: { external },
    },
  })
}

// 3. Its own package.json: the name, version and entry the packaged app reports.
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
writeFileSync(join(out, 'package.json'), JSON.stringify({
  name: 'trilorah-sender',
  productName: 'Trilorah Sender',
  version: pkg.version,
  description: 'Trilorah Sender — sends this computer’s sound to Trilorah on another computer, over NDI®.',
  license: pkg.license,
  main: 'main.js',
  dependencies: { grandi: pkg.dependencies.grandi },
}, null, 2))
for (const file of ['LICENSE', 'NOTICE', 'THIRD-PARTY-NOTICES.md']) cpSync(join(root, file), join(out, file))
// The window's font (Geist) and icons (Nubo) carry their own licences.
cpSync(join(root, 'public/fonts/GEIST-LICENSE.txt'), join(out, 'renderer/fonts/GEIST-LICENSE.txt'))
cpSync(join(root, 'public/licenses'), join(out, 'renderer/licenses'), { recursive: true })

// 4. The NDI packages and nothing else: grandi, its loader, and this platform's library.
const modules = ['grandi', 'node-gyp-build', `@grandi/${target}`]
for (const name of modules) {
  const from = join(root, 'node_modules', name)
  if (!existsSync(from)) {
    console.error(`✗ node_modules/${name} is missing. It installs only on ${target}; build this installer there.`)
    process.exit(1)
  }
  mkdirSync(dirname(join(out, 'node_modules', name)), { recursive: true })
  cpSync(from, join(out, 'node_modules', name), { recursive: true })
}
console.log(`✓ staged Trilorah Sender ${pkg.version} for ${target} in dist-sender/`)

// 5. Package it.
const builderArgs = ['electron-builder', '--config', 'electron-builder.sender.yml', ...args]
const result = spawnSync('npx', builderArgs, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
process.exit(result.status ?? 1)
