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

/** CSS needs a quoted URL for local paths such as "Application Support". */
export function cssImageUrl(url: string): string {
  return `url(${JSON.stringify(url)})`
}

/**
 * The same, for a value that may also be a bare filesystem path.
 *
 * Kept apart from toDisplayUrl on purpose: that one is fed theme and stock
 * URLs, where a leading "/" means "from the app's own web root", and turning
 * those into file lookups would break every bundled image. This one is for
 * media the OPERATOR put on the wall, where a leading "/" or "C:\" can only
 * be a file on disk — a run-of-service row saved by an older build carries
 * exactly that, and handed to a <video> as-is it resolves against
 * http://localhost and plays nothing.
 */
export function fileToDisplayUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return ''
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(pathOrUrl) || pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:')) {
    return toDisplayUrl(pathOrUrl)
  }
  const posix = pathOrUrl.replace(/\\/g, '/')
  const abs = posix.startsWith('/') ? posix : `/${posix}`
  return `local-media://file${abs.split('/').map(encodeURIComponent).join('/').replace(/%3A/gi, ':')}`
}

/** Imported/downloaded clips retain their extension; GIFs remain animated images. */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^data:video\//i.test(url) || /\.(?:mp4|m4v|mov|webm)(?:[?#]|$)/i.test(url);
}
