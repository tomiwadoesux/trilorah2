/**
 * Stage the `trilorah` CLI as its own tiny download (like the Sender).
 *
 * The CLI is one dependency-free Node script, so "building" it is staging:
 * the script under the command's own name, executable, with a README that
 * says what it needs (the Trilorah app open, Node 18+). The zip is what a
 * release attaches.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const out = path.join(root, 'release', 'cli')
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version

fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
fs.copyFileSync(path.join(root, 'cli', 'trilorah.mjs'), path.join(out, 'trilorah'))
fs.chmodSync(path.join(out, 'trilorah'), 0o755)
fs.writeFileSync(
  path.join(out, 'README.txt'),
  [
    `Trilorah CLI ${version}`,
    '',
    'A remote control for the Trilorah app on this computer. The app must be',
    'open — all the intelligence lives there; this only sends it commands.',
    '',
    'Needs Node.js 18 or newer (nodejs.org).',
    '',
    'Put the `trilorah` file somewhere on your PATH, then:',
    '',
    '  trilorah help',
    '  trilorah status',
    '  trilorah scripture "John 3:16"',
    '  trilorah take',
    '',
  ].join('\n')
)
execFileSync('zip', ['-j', '-q', path.join(root, 'release', `Trilorah-CLI-${version}.zip`), path.join(out, 'trilorah'), path.join(out, 'README.txt')])
console.log(`CLI staged: release/cli/trilorah + release/Trilorah-CLI-${version}.zip`)
