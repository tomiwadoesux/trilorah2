#!/usr/bin/env node
/**
 * Generates build/icon.icns — minimal Trilorah app icon.
 * A white "T" on a black squircle, drawn pixel-by-pixel (no dependencies),
 * then converted with macOS built-in tools: sips (resize) + iconutil (icns).
 *
 * Usage: node scripts/make-icon.mjs
 */
import { deflateSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = path.join(root, 'build')
const iconsetDir = path.join(buildDir, 'icon.iconset')
const masterPng = path.join(buildDir, 'icon-1024.png')

// ---------- 1. Draw the 1024x1024 master PNG ----------
const SIZE = 1024
// macOS icon grid: squircle occupies ~824pt of the 1024 canvas
const HALF = 412
const CX = SIZE / 2
const CY = SIZE / 2
const SQUIRCLE_N = 5 // superellipse exponent ≈ Apple squircle

// "T" geometry (centered, blocky — no font needed)
const BAR = { x0: 312, x1: 712, y0: 330, y1: 446 } // horizontal bar
const STEM = { x0: 454, x1: 570, y0: 446, y1: 730 } // vertical stem

const px = Buffer.alloc(SIZE * SIZE * 4) // RGBA
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4
    const dx = Math.abs(x + 0.5 - CX) / HALF
    const dy = Math.abs(y + 0.5 - CY) / HALF
    const inSquircle = Math.pow(dx, SQUIRCLE_N) + Math.pow(dy, SQUIRCLE_N) <= 1
    if (!inSquircle) continue // transparent corner
    const inT =
      (x >= BAR.x0 && x < BAR.x1 && y >= BAR.y0 && y < BAR.y1) ||
      (x >= STEM.x0 && x < STEM.x1 && y >= STEM.y0 && y < STEM.y1)
    const v = inT ? 255 : 0 // white T on black
    px[i] = v
    px[i + 1] = v
    px[i + 2] = v
    px[i + 3] = 255
  }
}

// Minimal PNG encoder (RGBA, 8-bit, filter 0 per scanline)
function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // color type RGBA
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0 // filter: none
  px.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])
fs.mkdirSync(buildDir, { recursive: true })
fs.writeFileSync(masterPng, png)
console.log(`✅ wrote ${masterPng}`)

// ---------- 2. Build the .iconset with sips ----------
fs.rmSync(iconsetDir, { recursive: true, force: true })
fs.mkdirSync(iconsetDir, { recursive: true })
const sizes = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png']
]
for (const [size, name] of sizes) {
  execFileSync('sips', ['-z', String(size), String(size), masterPng, '--out', path.join(iconsetDir, name)], { stdio: 'ignore' })
}

// ---------- 3. iconutil → icon.icns ----------
const icnsPath = path.join(buildDir, 'icon.icns')
execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsPath])
fs.rmSync(iconsetDir, { recursive: true, force: true })
console.log(`✅ wrote ${icnsPath}`)
