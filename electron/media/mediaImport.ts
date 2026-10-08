import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileToDisplayUrl } from '../../shared/mediaUrl'
import type { ImportedMedia, MediaImportResult, SkippedMedia } from '../../shared/importedMedia'

export type { ImportedMedia, SkippedMedia }

/*
 * Pictures and clips from this laptop, onto the media shelf.
 *
 * The file is COPIED into userData/media, so a picture survives the original
 * being moved, renamed or left on a USB stick that went home after the
 * service. It is named after its own bytes (the first 20 hex digits of a
 * SHA-1), which is what makes adding the same picture twice give one file
 * and one card instead of two — the old picker named every copy after the
 * clock and had no way to tell.
 *
 * Nothing here blocks the main process. The old picker copied with
 * copyFileSync, and a 2 GB clip held up every IPC — projector pushes
 * included — for as long as the copy took; mid-service that is a frozen
 * wall. The hash is streamed and the copy is an async clone (instant on
 * APFS, a plain copy elsewhere).
 *
 * No 'electron' import, so vitest can load it; main hands in the folder.
 */

export const MEDIA_TYPES = {
  photo: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp'],
  video: ['.mp4', '.m4v', '.mov', '.webm'],
} as const

/** iPhone photos. Chromium cannot draw them; macOS can turn them into JPEGs. */
export const HEIC_TYPES = ['.heic', '.heif'] as const

/** How many files one call may bring in, folders included. */
export const MAX_IMPORT_FILES = 200

export type MediaKind = 'photo' | 'video'

export type ImportOutcome = { item: ImportedMedia } | { skipped: SkippedMedia }

export const NOT_MEDIA = 'not a picture or clip'
export const HEIC_ELSEWHERE = 'an iPhone photo (heic) — export it as a jpeg first'

export function mediaKindOf(file: string, platform: NodeJS.Platform = process.platform): MediaKind | 'heic' | null {
  const ext = path.extname(file).toLowerCase()
  if ((MEDIA_TYPES.photo as readonly string[]).includes(ext)) return 'photo'
  if ((MEDIA_TYPES.video as readonly string[]).includes(ext)) return 'video'
  if ((HEIC_TYPES as readonly string[]).includes(ext)) return platform === 'darwin' ? 'heic' : null
  return null
}

/** The picker's filter: what this platform can bring in, without the dots. */
export function pickerExtensions(platform: NodeJS.Platform = process.platform): string[] {
  const all: string[] = [...MEDIA_TYPES.photo, ...MEDIA_TYPES.video, ...(platform === 'darwin' ? HEIC_TYPES : [])]
  return all.map((ext) => ext.slice(1))
}

/**
 * Any URL or path the app stores for a local file → the path on disk.
 *
 * Three forms are in circulation: a bare path, file:// (Settings' picker and
 * every older install; sometimes encoded, sometimes not) and
 * local-media://file/… (what windows draw; encoded or not). On Windows each
 * of them comes out as '/C:/…', and the leading slash has to go — the
 * protocol handler knew that, read-image-data-url did not, so a laptop
 * photo never reached the wall on the Windows build.
 */
export function localPathFromUrl(u: string, platform: NodeJS.Platform = process.platform): string {
  if (!u) return ''
  let p = u
  if (/^file:/i.test(u)) {
    /* Not through URL: older writers built `file://${path}` by hand, so a
       '#' or '?' in a file name is part of the name, not a fragment. */
    p = safeDecode(u.replace(/^file:\/*/i, '/'))
  } else if (/^local-media:/i.test(u)) {
    try {
      p = safeDecode(new URL(u).pathname)
    } catch {
      p = safeDecode(u.replace(/^local-media:\/\/[^/]*/i, ''))
    }
  }
  if (platform === 'win32' && /^\/[A-Za-z]:[\\/]/.test(p)) p = p.slice(1)
  return p
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    /* A file:// written by hand around a name with a bare '%' in it. */
    return s
  }
}

/**
 * The files a drop or a pick names. A folder is opened one level — the
 * pictures in it, not the folders in those — and the whole list is capped,
 * so a drop of somebody's entire Pictures folder cannot queue up an hour of
 * copying. Folders with nothing usable in them are said, not swallowed.
 */
export async function expandMediaPaths(
  paths: readonly string[],
  platform: NodeJS.Platform = process.platform,
): Promise<{ files: string[]; skipped: SkippedMedia[] }> {
  const files: string[] = []
  const skipped: SkippedMedia[] = []
  for (const p of paths) {
    if (files.length >= MAX_IMPORT_FILES) {
      skipped.push({ name: path.basename(p), reason: `more than ${MAX_IMPORT_FILES} at once` })
      continue
    }
    const stat = await fs.stat(p).catch(() => null)
    if (!stat) {
      skipped.push({ name: path.basename(p), reason: 'could not be found' })
      continue
    }
    if (!stat.isDirectory()) {
      files.push(p)
      continue
    }
    const names = await fs.readdir(p).catch(() => [] as string[])
    const inside = names
      .filter((name) => !name.startsWith('.') && mediaKindOf(name, platform))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((name) => path.join(p, name))
    if (!inside.length) {
      skipped.push({ name: path.basename(p), reason: 'no pictures or clips in that folder' })
      continue
    }
    files.push(...inside.slice(0, MAX_IMPORT_FILES - files.length))
  }
  return { files, skipped }
}

export interface ImportOptions {
  platform?: NodeJS.Platform
  /** HEIC → JPEG. macOS's own `sips` by default; injected in tests. */
  convertHeic?: (src: string, dest: string) => Promise<void>
}

/**
 * One file into `dir`. Never throws: anything that goes wrong comes back as
 * a skip with a reason the operator can read.
 */
export async function importMediaFile(src: string, dir: string, opts: ImportOptions = {}): Promise<ImportOutcome> {
  const platform = opts.platform ?? process.platform
  const fileName = path.basename(src)
  const skip = (reason: string): ImportOutcome => ({ skipped: { name: fileName, reason } })
  /* stat, not lstat: a shortcut (symlink) to a picture is a picture. */
  const stat = await fs.stat(src).catch(() => null)
  if (!stat) return skip('could not be found')
  if (!stat.isFile()) return skip(NOT_MEDIA)
  const ext = path.extname(src).toLowerCase()
  const kind = mediaKindOf(src, platform)
  if (!kind) return skip((HEIC_TYPES as readonly string[]).includes(ext) ? HEIC_ELSEWHERE : NOT_MEDIA)
  if (stat.size === 0) return skip('the file is empty')

  let hash: string
  try {
    hash = (await sha1(src)).slice(0, 20)
  } catch {
    return skip('could not be read')
  }
  /* A HEIC is kept as the JPEG it becomes, named after the HEIC's own
     bytes — the same phone photo dropped twice is still one card. */
  const outExt = kind === 'heic' ? '.jpg' : ext
  const name = path.basename(src, path.extname(src))
  const finish = (dest: string, bytes: number, existed: boolean): ImportOutcome => ({
    item: {
      id: `local:${hash}`,
      url: pathToFileURL(dest).href,
      src: fileToDisplayUrl(dest),
      kind: kind === 'video' ? 'video' : 'photo',
      name,
      bytes,
      existed,
    },
  })

  try {
    await fs.mkdir(dir, { recursive: true })
    const already = (await fs.readdir(dir)).find((f) => f.startsWith(`${hash}.`) && !f.includes('.part'))
    if (already) {
      const dest = path.join(dir, already)
      const size = (await fs.stat(dest)).size
      return finish(dest, size, true)
    }
  } catch {
    return skip('could not be saved')
  }

  const dest = path.join(dir, `${hash}${outExt}`)
  /* A name of its own per attempt: the same file dropped twice at once (a
     double drop, or a pick and a drop together) must not write one .part
     from two copies. The rename that finishes either is atomic, and both
     carry the same bytes. */
  const part = path.join(dir, `${hash}.${randomUUID()}.part${outExt}`)
  try {
    if (kind === 'heic') await (opts.convertHeic ?? sipsToJpeg)(src, part)
    else await fs.copyFile(src, part, fs.constants.COPYFILE_FICLONE)
    await fs.rename(part, dest)
    return finish(dest, (await fs.stat(dest)).size, false)
  } catch (error) {
    await fs.unlink(part).catch(() => undefined)
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === 'ENOSPC') return skip('not enough disk space')
    if (kind === 'heic') return skip('this iPhone photo could not be converted — export it as a jpeg')
    return skip('could not be copied')
  }
}

function sha1(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha1')
    const stream = createReadStream(file)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

/** macOS ships `sips`; it reads HEIC and writes JPEG without a dependency. */
function sipsToJpeg(src: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/sips', ['-s', 'format', 'jpeg', src, '--out', dest], { timeout: 60_000 }, (error) =>
      error ? reject(error) : resolve(),
    )
  })
}

/**
 * The files a renderer asked for, in order. Validated here because it comes
 * over IPC: an array of strings, capped.
 */
export async function importMediaPaths(
  paths: unknown,
  dir: string,
  opts: ImportOptions = {},
): Promise<MediaImportResult> {
  if (!Array.isArray(paths) || paths.length > MAX_IMPORT_FILES || !paths.every((p) => typeof p === 'string' && p.length > 0)) {
    return { items: [], skipped: [{ name: 'those files', reason: 'could not be read' }] }
  }
  const { files, skipped } = await expandMediaPaths(paths as string[], opts.platform)
  const items: ImportedMedia[] = []
  for (const file of files) {
    const outcome = await importMediaFile(file, dir, opts)
    if ('item' in outcome) items.push(outcome.item)
    else skipped.push(outcome.skipped)
  }
  return { items, skipped }
}

/** A clip's poster is a 320px JPEG (~15 KB); anything near this is not one. */
export const MAX_POSTER_BYTES = 512 * 1024

/**
 * A clip's card picture, as a small file beside the clip.
 *
 * The renderer draws the frame (only a window can decode video) and used to
 * keep it on the card as a data: URL — and the whole shelf lives in one
 * localStorage entry. At ~20 KB a clip, a few folders of clips filled the
 * quota, the write failed, and every card added after that was gone on the
 * next launch. As a file, the card holds a URL of a hundred bytes.
 *
 * In a folder of its own: the import's dedupe looks for `<hash>.*` in the
 * media folder, and `<hash>.jpg` there would read as the clip already being
 * on the shelf. Named after the clip's hash, so a clip added twice has one
 * poster. Resolves to the local-media:// URL, or null — the caller keeps the
 * data: URL then, so nothing is worse than before. Never throws.
 */
export async function saveClipPoster(id: unknown, dataUrl: unknown, dir: string): Promise<string | null> {
  const hash = typeof id === 'string' ? /^local:([0-9a-f]{20})$/.exec(id)?.[1] : undefined
  const prefix = 'data:image/jpeg;base64,'
  if (!hash || typeof dataUrl !== 'string' || !dataUrl.startsWith(prefix)) return null
  const bytes = Buffer.from(dataUrl.slice(prefix.length), 'base64')
  if (!bytes.length || bytes.length > MAX_POSTER_BYTES) return null
  const folder = path.join(dir, 'posters')
  const dest = path.join(folder, `${hash}.jpg`)
  try {
    await fs.mkdir(folder, { recursive: true })
    if (!(await fs.stat(dest).catch(() => null))?.size) {
      const part = path.join(folder, `${hash}.${randomUUID()}.part.jpg`)
      try {
        await fs.writeFile(part, bytes)
        await fs.rename(part, dest)
      } catch (error) {
        await fs.unlink(part).catch(() => undefined)
        throw error
      }
    }
    return fileToDisplayUrl(dest)
  } catch {
    return null
  }
}
