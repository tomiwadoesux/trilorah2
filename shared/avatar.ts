/**
 * Generated avatars — deterministic, dependency-free, usable from both the
 * Electron main process and the renderer.
 *
 * The seed (a preacher id, a church name, a song title) is hashed with
 * FNV-1a and the hash picks hue offsets. When a brand colour is supplied
 * the palette is derived from it — hue rotated within ±30° and lightness
 * nudged around the brand's own — so every avatar in a church reads as one
 * family. Same seed + same options → byte-identical SVG.
 */

export interface AvatarOptions {
  /** Hex colour like '#3b82f6' or '3b82f6'. Ignored when unparseable. */
  brandColor?: string
  /** Square size in px (viewBox is always 0 0 100 100). Default 96. */
  size?: number
}

export interface Avatar {
  svg: string
  colors: [string, string, string]
  initials: string
}

export type Hsl = { h: number; s: number; l: number }

// ---------------------------------------------------------------- hashing

/** 32-bit FNV-1a. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

// ------------------------------------------------------------ colour utils

export function hexToHsl(hex: string): Hsl | null {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let hue: number
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) hue = ((b - r) / d + 2) * 60
  else hue = ((r - g) / d + 4) * 60
  return { h: hue, s, l }
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp01(s)
  const lig = clamp01(l)
  const c = (1 - Math.abs(2 * lig - 1)) * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = lig - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (hue < 60) [r, g, b] = [c, x, 0]
  else if (hue < 120) [r, g, b] = [x, c, 0]
  else if (hue < 180) [r, g, b] = [0, c, x]
  else if (hue < 240) [r, g, b] = [0, x, c]
  else if (hue < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

// ---------------------------------------------------------------- initials

export function initialsFor(seed: string): string {
  const words = seed
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0]
  const second = words.length > 1 ? words[1][0] : ''
  return (first + second).toUpperCase()
}

// ------------------------------------------------------------------ palette

/**
 * Three colours: a base and two gradient accents. Without a brand colour
 * the base hue is spread across the wheel by the hash; with one, all three
 * stay within ±30° of the brand hue and lightness moves around the brand's.
 */
export function paletteFor(seed: string, brandColor?: string): [string, string, string] {
  const hash = fnv1a(seed)
  const a = (hash & 0xff) / 255 // 0..1
  const b = ((hash >>> 8) & 0xff) / 255
  const c = ((hash >>> 16) & 0xff) / 255

  const brand = brandColor ? hexToHsl(brandColor) : null
  if (brand && brand.s > 0.05) {
    const h0 = brand.h + (a * 2 - 1) * 30
    const l0 = Math.min(0.62, Math.max(0.28, brand.l + (b - 0.5) * 0.16))
    const s0 = Math.min(0.85, Math.max(0.35, brand.s))
    return [
      hslToHex({ h: h0, s: s0, l: l0 }),
      hslToHex({ h: h0 + 18 + c * 12, s: s0, l: l0 + 0.18 }),
      hslToHex({ h: h0 - 18 - b * 12, s: s0 * 0.9, l: l0 - 0.14 })
    ]
  }

  const h0 = a * 360
  const s0 = 0.55 + b * 0.2
  const l0 = 0.38 + c * 0.14
  return [
    hslToHex({ h: h0, s: s0, l: l0 }),
    hslToHex({ h: h0 + 35, s: s0, l: l0 + 0.18 }),
    hslToHex({ h: h0 - 40, s: s0 * 0.9, l: l0 - 0.12 })
  ]
}

// ------------------------------------------------------------------ svg

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

function svgId(seed: string): string {
  return fnv1a(seed).toString(36)
}

export function avatarFor(seed: string, opts: AvatarOptions = {}): Avatar {
  const size = Math.max(8, Math.round(opts.size ?? 96))
  const colors = paletteFor(seed, opts.brandColor)
  const initials = initialsFor(seed)
  const hash = fnv1a(seed + '|pos')
  // Gradient centres wander with the hash so two avatars never share a shape.
  const cx1 = 20 + ((hash & 0xff) / 255) * 40
  const cy1 = 15 + (((hash >>> 8) & 0xff) / 255) * 40
  const cx2 = 55 + (((hash >>> 16) & 0xff) / 255) * 35
  const cy2 = 55 + (((hash >>> 24) & 0xff) / 255) * 35
  const id = svgId(seed + (opts.brandColor ?? ''))
  const fontSize = initials.length > 1 ? 40 : 46

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${escapeXml(initials)}">` +
    `<defs>` +
    `<radialGradient id="a${id}" cx="${cx1.toFixed(1)}%" cy="${cy1.toFixed(1)}%" r="70%">` +
    `<stop offset="0" stop-color="${colors[1]}" stop-opacity="0.95"/><stop offset="1" stop-color="${colors[1]}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<radialGradient id="b${id}" cx="${cx2.toFixed(1)}%" cy="${cy2.toFixed(1)}%" r="75%">` +
    `<stop offset="0" stop-color="${colors[2]}" stop-opacity="0.9"/><stop offset="1" stop-color="${colors[2]}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect width="100" height="100" fill="${colors[0]}"/>` +
    `<rect width="100" height="100" fill="url(#a${id})"/>` +
    `<rect width="100" height="100" fill="url(#b${id})"/>` +
    `<text x="50" y="50" dy="0.36em" text-anchor="middle" font-family="${FONT_STACK}" font-size="${fontSize}" font-weight="600" fill="#ffffff" fill-opacity="0.92">${escapeXml(initials)}</text>` +
    `</svg>`

  return { svg, colors, initials }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] as string)
}
