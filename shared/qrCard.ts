/**
 * The companion code as something a congregation can actually act on.
 *
 * What went up before was a bare black-and-white square. A square tells
 * nobody what it is for, and half a room will not raise a phone to a thing
 * they cannot name — so the code now sits on a card with a line above it
 * saying what happens if you scan, and the address underneath for anyone
 * whose camera will not focus from row twenty.
 *
 * Built as SVG rather than a raster. It goes full-bleed on a projector that
 * might be 1080p or 4K, and vector text stays crisp at any of them where an
 * 800px PNG scaled up does not. It is also the reason the code itself can be
 * drawn as paths: a QR made of crisp rectangles reads faster than one that
 * has been resampled.
 *
 * Pure and import-free: the caller renders the QR modules and hands them in,
 * so this file can be tested without the qrcode package, and the projector
 * and any future print or web copy of the card share one layout.
 */

export interface QrCardInput {
  /** The QR itself, as a complete <svg>…</svg> string. */
  qrSvg: string
  /** The line above the code — "Follow along on your phone…". */
  caption: string
  /** The address, shown small beneath the code for anyone who cannot scan. */
  url: string
  /** The church's name, above everything, when it has one set. */
  churchName?: string
  /** Embedded local image; external URLs are deliberately not loaded by the SVG. */
  backgroundDataUrl?: string
  /** Canvas size. 1920×1080 matches the projector it is drawn on. */
  width?: number
  height?: number
}

const CANVAS = { width: 1920, height: 1080 }

/**
 * Sized against the height, not the width.
 *
 * A projector in a wide room is short, and a code scaled to the width of a
 * 21:9 screen runs off the top and bottom. Height is the constraint that is
 * always real, so the code takes a fixed share of it and the text sits in
 * what is left.
 *
 * The share is generous because a QR is only as good as the pixels a camera
 * gets per module, and a phone held up in row twenty is working from a small
 * and shaky crop of the wall. Verified with Apple's own detector — the one an
 * iPhone camera uses — against this card rasterised at 1920 and then resampled
 * down to 1600, 1280 and 960: readable at every one.
 */
const QR_SHARE = 0.62

/** Strip the wrapper the qrcode package adds, keeping the drawn shapes. */
export function qrInner(qrSvg: string): string {
  const open = qrSvg.indexOf('>', qrSvg.indexOf('<svg'))
  const close = qrSvg.lastIndexOf('</svg>')
  return open === -1 || close === -1 ? qrSvg : qrSvg.slice(open + 1, close).trim()
}

/** The viewBox the qrcode package gave its output, so the card can scale it. */
export function qrViewBox(qrSvg: string): string {
  return /viewBox="([^"]+)"/.exec(qrSvg)?.[1] ?? '0 0 33 33'
}

/**
 * XML-escape. The caption is operator-typed and the church name comes from
 * settings; an ampersand in "Grace & Peace Assembly" would otherwise produce
 * an SVG that will not parse, and the projector would show nothing at all.
 */
export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Trim the address to what is worth reading aloud.
 *
 * "https://" is noise on a wall — nobody types it and everybody's phone adds
 * it. A trailing slash is the same. What is left is short enough to read from
 * the back row, which is the entire point of printing it.
 */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}

export function buildQrCard(input: QrCardInput): string {
  const width = input.width ?? CANVAS.width
  const height = input.height ?? CANVAS.height
  const wide = width / height >= 1.5
  const qr = Math.round(Math.min(height * QR_SHARE, width * 0.72))
  const cx = width / 2

  // The quiet zone is part of the spec, not decoration: a QR printed hard
  // against a dark background is measurably slower to acquire. White plate,
  // generously rounded so it reads as a card rather than a hole in the wall.
  const modules = Number(qrViewBox(input.qrSvg).split(/\s+/)[2]) || 33
  const pad = Math.ceil(Math.max(qr * 0.08, qr / modules * 4))
  const plate = qr + pad * 2
  const plateY = Math.round((height - plate) / 2 + (wide ? 0 : height * 0.04))

  const nameSize = Math.round(height * 0.042)
  const captionSize = Math.round(height * 0.038)
  const urlSize = Math.round(height * 0.028)

  // Above the plate: the church, then the instruction closest to the code.
  const captionY = plateY - Math.round(height * 0.045)
  const nameY = captionY - Math.round(nameSize * 1.5)
  const urlY = plateY + plate + Math.round(height * 0.075)

  const name = input.churchName?.trim()
  const caption = input.caption.trim()
  const background = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.backgroundDataUrl || '')
    ? `<image href="${input.backgroundDataUrl}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/><rect width="${width}" height="${height}" fill="#090b0c" fill-opacity="0.48"/>` : ''

  if (wide) {
    const inset = Math.round(height * 0.09)
    const plateX = width - inset - plate
    const textX = inset + Math.round(height * 0.035)
    const textWidth = plateX - textX - height * 0.09
    const lines: string[] = []
    for (const word of (caption || 'Follow along on your phone').split(/\s+/)) {
      const last = lines.length - 1
      if (last < 0 || (lines[last] + ' ' + word).length > 29) lines.push(word)
      else lines[last] += ' ' + word
    }
    const fit = (text: string, size: number) => text.length * size * 0.57 > textWidth
      ? ` textLength="${Math.round(textWidth)}" lengthAdjust="spacingAndGlyphs"` : ''
    const titleSize = Math.round(height * 0.063)
    const titleY = Math.round(height * 0.38)
    const lineHeight = Math.round(titleSize * 1.2)
    const titleLines = lines.slice(0, 3)
    if (lines.length > 3) titleLines[2] += '…'
    const detailY = Math.max(height * 0.64, titleY + titleLines.length * lineHeight + 30)
    const address = displayUrl(input.url)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="qr-title qr-description">
  <title id="qr-title">${esc(name || 'Trilorah')} — follow the service</title>
  <desc id="qr-description">Scan the QR code for live transcripts, scriptures and notes. ${esc(input.url)}</desc>
  <defs><linearGradient id="teal" x1="0" y1="1" x2="1" y2="0"><stop offset="10.054%" stop-color="#07271c"/><stop offset="36.448%" stop-color="#1d322f"/><stop offset="63.057%" stop-color="#1a3630"/><stop offset="89.946%" stop-color="#1a3336"/></linearGradient></defs>
  <rect width="${width}" height="${height}" fill="#090b0c"/>
  ${background}
  <rect x="${inset / 2}" y="${inset / 2}" width="${width - inset}" height="${height - inset}" rx="40" fill="url(#teal)" fill-opacity="${background ? '0.15' : '0.65'}" stroke="#8fd3c0" stroke-opacity="0.16"/>
  <g font-family="Segoe UI, Arial, sans-serif">
    <text x="${textX}" y="${height * 0.2}" font-size="${nameSize}" fill="#e5f3f2"${fit(name || 'trilorah', nameSize)}>${esc(name || 'trilorah')}</text>
    <text x="${textX}" y="${height * 0.27}" font-size="${height * 0.018}" letter-spacing="3" fill="#8fd3c0">FOLLOW THE SERVICE</text>
    ${titleLines.map((line, i) => `<text x="${textX}" y="${titleY + i * lineHeight}" font-size="${titleSize}" font-weight="600" fill="#e5f3f2"${fit(line, titleSize)}>${esc(line)}</text>`).join('\n    ')}
    <text x="${textX}" y="${detailY}" font-size="${height * 0.025}" fill="#e5f3f2"${fit('Live transcripts, scriptures and notes', height * 0.025)}>Live transcripts, scriptures and notes</text>
    <text x="${textX}" y="${detailY + height * 0.054}" font-size="${height * 0.024}" fill="#a7bfba">Open your camera. Scan to follow along.</text>
    <path d="M${textX} ${height * 0.79}h${textWidth}" stroke="#8fd3c0" stroke-opacity="0.2"/>
    <text x="${textX}" y="${height * 0.845}" font-size="${urlSize}" fill="#8fd3c0"${fit(address, urlSize)}>${esc(address)}</text>
  </g>
  <rect x="${plateX}" y="${plateY}" width="${plate}" height="${plate}" rx="24" fill="#ffffff"/>
  <svg x="${plateX + pad}" y="${plateY + pad}" width="${qr}" height="${qr}" viewBox="${qrViewBox(input.qrSvg)}" shape-rendering="crispEdges">${qrInner(input.qrSvg)}</svg>
  <text x="${plateX + plate / 2}" y="${plateY + plate + height * 0.045}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${height * 0.021}" fill="#a7bfba">SCAN WITH YOUR PHONE</text>
</svg>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><linearGradient id="teal" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#07271c"/><stop offset="1" stop-color="#1a3336"/></linearGradient></defs>
  <rect width="${width}" height="${height}" fill="#090b0c"/>
  ${background}
  <rect x="20" y="20" width="${width - 40}" height="${height - 40}" rx="30" fill="url(#teal)" fill-opacity="${background ? '0.15' : '0.65'}"/>
  ${
    name
      ? `<text x="${cx}" y="${nameY}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${nameSize}" fill="#8fd3c0" letter-spacing="${nameSize * 0.06}">${esc(name)}</text>`
      : ''
  }
  <text x="${cx}" y="${captionY}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${captionSize}" fill="#ffffff">${esc(caption)}</text>
  <text x="${cx}" y="${captionY + height * 0.027}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${height * 0.018}" fill="#e5f3f2">Live transcripts, scriptures and notes</text>
  <rect x="${cx - plate / 2}" y="${plateY}" width="${plate}" height="${plate}" rx="${Math.round(plate * 0.04)}" fill="#ffffff"/>
  <svg x="${cx - qr / 2}" y="${plateY + pad}" width="${qr}" height="${qr}" viewBox="${qrViewBox(input.qrSvg)}" shape-rendering="crispEdges">${qrInner(input.qrSvg)}</svg>
  <text x="${cx}" y="${urlY}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${urlSize}" fill="#ffffff" fill-opacity="0.62">${esc(displayUrl(input.url))}</text>
</svg>`
}
