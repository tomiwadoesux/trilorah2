/**
 * The one place a stored file:// path becomes something a window can draw.
 *
 * Every window in this app is served from http://localhost in development and
 * from a file:// page in production, and in both a `file://` image URL is
 * dead on arrival: Chromium refuses file:// subresources from an http origin,
 * and the projector paints its background straight into CSS. That is why a
 * stock image (whose download step already hands back a `local-media://` src)
 * appeared on screen while a picture chosen from the laptop did not — the
 * picker copied the file correctly and then returned the wrong scheme.
 *
 * The setting keeps storing `file://`, because that is what every existing
 * install already holds and what the native picker writes. Conversion happens
 * on the way OUT, here, so a settings file from last month draws today.
 *
 * Pure and import-free: main writes these URLs, the renderer and the projector
 * read them, and all three must agree byte for byte.
 */

/** Turn `file:///abs/path.jpg` into `local-media://file/abs/path.jpg`. Anything
 *  that is not a file:// URL is returned untouched, so data: and http(s): and
 *  already-converted local-media: URLs pass straight through. */
export function toDisplayUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (!url.startsWith('file://')) return url
  // Strip the scheme and any run of slashes, then re-add the single leading
  // slash the handler expects in `pathname`. Windows paths ('C:/…') come out
  // as '/C:/…', which the handler already strips back on that platform.
  const posix = url.replace(/^file:\/+/, '/')
  return `local-media://file${posix}`
}
