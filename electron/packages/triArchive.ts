import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, rename, rm, stat } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import * as path from 'node:path'
import type { Readable } from 'node:stream'
import * as yauzl from 'yauzl'
import { TRI_CATEGORIES } from '../../shared/triPackage'
import type { TriAsset, TriManifest, TriSnapshot } from '../../shared/triPackage'

// Deliberately below ZIP32 limits. Streaming prevents large videos filling RAM.
export const TRI_LIMITS = { totalBytes: 2 * 1024 ** 3, assetBytes: 1024 ** 3, manifestBytes: 16 * 1024 ** 2, entries: 20_000, items: 50_000 } as const
const mediaExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif', '.ico', '.tif', '.tiff', '.heic', '.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv', '.wmv', '.mpeg', '.mpg', '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.pdf', '.ppt', '.pptx', '.odp', '.key', '.ttf', '.otf', '.woff', '.woff2'])
const assetPattern = /^assets\/[a-f0-9]{64}\.[a-z0-9]{1,8}$/
const tokenPattern = /^tri-asset:([a-f0-9]{64}):(path|url)$/
const hashPattern = /^[a-f0-9]{64}$/
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crcUpdate(crc: number, buffer: Buffer) {
  for (const value of buffer) crc = crcTable[(crc ^ value) & 0xff]! ^ (crc >>> 8)
  return crc >>> 0
}
function crc32(buffer: Buffer) { return (crcUpdate(0xffffffff, buffer) ^ 0xffffffff) >>> 0 }
function fail(message: string): never { throw new Error(`Invalid .tri package: ${message}`) }
function object(value: unknown): value is Record<string, any> { return value !== null && typeof value === 'object' && !Array.isArray(value) }

function isAssetField(keys: string[]) {
  const key = keys.findLast(part => !/^\d+$/.test(part)) || ''
  return /(?:src|url|path|paths|file|files|image|images|background|thumbnail|logo|photo|poster|preview|slides|pages|assets|sourcePptx)$/i.test(key)
}
function localReference(value: string): { file: string; mode: 'path' | 'url' } | null {
  if (/^(?:file|local-media):\/\//i.test(value)) {
    let file = value.replace(/^local-media:\/\/file/i, '').replace(/^file:\/\/(?:localhost(?=\/))?/i, '')
    try { file = decodeURIComponent(file) } catch { /* Old saved paths can contain a literal %. */ }
    if (/^\/[A-Za-z]:\//.test(file)) file = file.slice(1)
    if (!path.isAbsolute(file) && !path.win32.isAbsolute(file)) fail('a local media reference is not absolute')
    return { file, mode: 'url' }
  }
  if ((path.isAbsolute(value) || path.win32.isAbsolute(value)) && mediaExtensions.has(path.extname(value).toLowerCase())) return { file: value, mode: 'path' }
  return null
}
function localMediaUrl(file: string) {
  const posix = file.replace(/\\/g, '/')
  return `local-media://file${posix.startsWith('/') ? '' : '/'}${posix.split('/').map(part => encodeURIComponent(part).replace(/%3A/gi, ':')).join('/')}`
}

// Copies JSON data and rejects cycles, prototype keys, excessive nesting, or non-JSON input.
async function mapJson(value: any, string: (value: string, keys: string[]) => Promise<string>, depth = 0, budget = { nodes: 0 }, keys: string[] = []): Promise<any> {
  if (++budget.nodes > 500_000 || depth > 64) fail('content is too complex')
  if (typeof value === 'string') return string(value, keys)
  if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value
  if (Array.isArray(value)) {
    const out = []
    for (let index = 0; index < value.length; index++) out.push(await mapJson(value[index], string, depth + 1, budget, [...keys, String(index)]))
    return out
  }
  if (object(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    const out: Record<string, any> = {}
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('unsafe object key')
      // JSON.stringify's usual treatment of optional object properties.
      if (child === undefined) continue
      out[key] = await mapJson(child, string, depth + 1, budget, [...keys, key])
    }
    return out
  }
  fail('content must be plain JSON data')
}

function validateSnapshot(snapshot: unknown): asserts snapshot is TriSnapshot {
  if (!object(snapshot) || !object(snapshot.categories)) fail('categories are missing')
  let count = 0
  for (const [category, items] of Object.entries(snapshot.categories)) {
    if (!(TRI_CATEGORIES as readonly string[]).includes(category) || !Array.isArray(items)) fail('unsupported category')
    const ids = new Set<string>()
    for (const item of items) {
      if (++count > TRI_LIMITS.items) fail('too many library items')
      if (!object(item) || typeof item.id !== 'string' || !item.id || item.id.length > 2000 || typeof item.label !== 'string' || item.label.length > 2000 || !Object.hasOwn(item, 'data')) fail('invalid library item')
      if (ids.has(item.id)) fail('duplicate item identifier')
      ids.add(item.id)
    }
  }
}

async function validateManifest(value: unknown): Promise<TriManifest> {
  validateSnapshot(value)
  const data = value as any
  if (data.format !== 'trilorah') fail('not a Trilorah package')
  if (data.version !== 1) fail(`unsupported package version ${String(data.version)}`)
  if (typeof data.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(data.id) || typeof data.title !== 'string' || data.title.length > 2000 || typeof data.createdAt !== 'string' || !Number.isFinite(Date.parse(data.createdAt))) fail('invalid package metadata')
  if (!Array.isArray(data.assets) || data.assets.length >= TRI_LIMITS.entries) fail('invalid assets list')
  const ids = new Set<string>()
  const entries = new Set<string>()
  let total = 0
  for (const asset of data.assets) {
    if (!object(asset) || typeof asset.id !== 'string' || !hashPattern.test(asset.id) || !hashPattern.test(asset.sha256) || asset.id !== asset.sha256 || typeof asset.entry !== 'string' || !assetPattern.test(asset.entry) || !asset.entry.startsWith(`assets/${asset.id}.`) || typeof asset.name !== 'string' || !asset.name || asset.name.length > 1000 || /[\\/\x00]/.test(asset.name) || !Number.isSafeInteger(asset.size) || asset.size < 0 || asset.size > TRI_LIMITS.assetBytes) fail('invalid asset metadata')
    if (!mediaExtensions.has(path.extname(asset.entry))) fail('unsupported asset file type')
    if (ids.has(asset.id) || entries.has(asset.entry)) fail('duplicate asset')
    ids.add(asset.id)
    entries.add(asset.entry)
    total += asset.size
    if (total > TRI_LIMITS.totalBytes) fail('package exceeds the 2 GiB limit')
  }
  if (data.warnings !== undefined && (!Array.isArray(data.warnings) || data.warnings.length > 1000 || data.warnings.some((warning: unknown) => typeof warning !== 'string' || warning.length > 4000))) fail('invalid warnings')
  await mapJson(data.categories, async (str, keys) => {
    if (!isAssetField(keys)) return str
    if (str.startsWith('tri-asset:')) {
      const match = tokenPattern.exec(str)
      if (!match || !ids.has(match[1]!)) fail('missing or invalid embedded asset reference')
    } else if (localReference(str)) fail('package contains an external local file reference')
    return str
  })
  return data as TriManifest
}

type Source = { asset: TriAsset; file: string; crc: number }
async function fingerprint(file: string) {
  const info = await stat(file).catch(() => { throw new Error(`Cannot save .tri: missing or unreadable file ${file}`) })
  if (!info.isFile()) throw new Error(`Cannot save .tri: media is not a regular file ${file}`)
  if (info.size > TRI_LIMITS.assetBytes) throw new Error('Cannot save .tri: an individual file exceeds 1 GiB')
  const hash = createHash('sha256')
  let size = 0, crc = 0xffffffff
  for await (const chunk of createReadStream(file)) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > TRI_LIMITS.assetBytes) throw new Error('Cannot save .tri: an individual file exceeds 1 GiB')
    hash.update(buffer)
    crc = crcUpdate(crc, buffer)
  }
  return { size, sha256: hash.digest('hex'), crc: (crc ^ 0xffffffff) >>> 0 }
}
async function writeAll(handle: FileHandle, buffer: Buffer) {
  let offset = 0
  while (offset < buffer.length) {
    const result = await handle.write(buffer, offset, buffer.length - offset)
    if (!result.bytesWritten) throw new Error('Could not finish writing .tri file')
    offset += result.bytesWritten
  }
}

/** Writes a standard ZIP32 STORE archive. Media is already compressed; no additional dependency is needed. */
async function writeZip(target: string, manifest: Buffer, sources: Source[]) {
  const handle = await open(target, 'wx')
  let offset = 0
  const central: Buffer[] = []
  try {
    const entries = [{ name: 'manifest.json', size: manifest.length, crc: crc32(manifest), source: undefined as Source | undefined }, ...sources.map(source => ({ name: source.asset.entry, size: source.asset.size, crc: source.crc, source }))]
    for (const entry of entries) {
      const name = Buffer.from(entry.name)
      const header = Buffer.alloc(30)
      header.writeUInt32LE(0x04034b50, 0)
      header.writeUInt16LE(20, 4)
      header.writeUInt16LE(0x800, 6)
      header.writeUInt16LE(33, 12) // 1980-01-01
      header.writeUInt32LE(entry.crc, 14)
      header.writeUInt32LE(entry.size, 18)
      header.writeUInt32LE(entry.size, 22)
      header.writeUInt16LE(name.length, 26)
      const directory = Buffer.alloc(46)
      directory.writeUInt32LE(0x02014b50, 0)
      directory.writeUInt16LE(20, 4)
      directory.writeUInt16LE(20, 6)
      header.copy(directory, 8, 6, 28)
      directory.writeUInt32LE(offset, 42)
      central.push(Buffer.concat([directory, name]))
      await writeAll(handle, header)
      await writeAll(handle, name)
      if (entry.source) {
        let size = 0
        const hash = createHash('sha256')
        for await (const chunk of createReadStream(entry.source.file)) {
          const buffer = Buffer.from(chunk)
          size += buffer.length
          if (size > entry.size) throw new Error('Media changed during export; save again')
          hash.update(buffer)
          await writeAll(handle, buffer)
        }
        if (size !== entry.size || hash.digest('hex') !== entry.source.asset.sha256) throw new Error('Media changed during export; save again')
      } else await writeAll(handle, manifest)
      offset += header.length + name.length + entry.size
    }
    const directory = Buffer.concat(central)
    await writeAll(handle, directory)
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0)
    end.writeUInt16LE(entries.length, 8)
    end.writeUInt16LE(entries.length, 10)
    end.writeUInt32LE(directory.length, 12)
    end.writeUInt32LE(offset, 16)
    await writeAll(handle, end)
    await handle.sync()
  } finally { await handle.close() }
}

/** Embeds local files recursively and atomically replaces the chosen .tri file only after success. */
export async function writeTri(filePath: string, snapshot: TriSnapshot, title: string): Promise<TriManifest> {
  validateSnapshot(snapshot)
  const sources = new Map<string, Source>()
  const paths = new Map<string, string>()
  const remote = new Set<string>()
  let total = 0
  const categories = await mapJson(snapshot.categories, async (value, keys) => {
    if (!isAssetField(keys)) return value
    if (value.startsWith('tri-asset:')) throw new Error('Cannot save .tri: an asset has not been imported')
    const ref = localReference(value)
    if (!ref) {
      if (/^https?:\/\//i.test(value)) remote.add(value)
      return value
    }
    let id = paths.get(ref.file)
    if (!id) {
      const result = await fingerprint(ref.file)
      id = result.sha256
      if (!sources.has(id)) {
        const ext = path.extname(ref.file).toLowerCase()
        if (!mediaExtensions.has(ext)) throw new Error(`Cannot save .tri: unsupported media file type ${ref.file}`)
        total += result.size
        if (total > TRI_LIMITS.totalBytes) throw new Error('Cannot save .tri: package exceeds 2 GiB')
        if (sources.size + 1 >= TRI_LIMITS.entries) throw new Error('Cannot save .tri: too many files')
        const asset = { id, sha256: id, entry: `assets/${id}${ext}`, name: path.basename(ref.file), size: result.size }
        sources.set(id, { asset, file: ref.file, crc: result.crc })
      }
      paths.set(ref.file, id)
    }
    return `tri-asset:${id}:${ref.mode}`
  })
  const manifest: TriManifest = { format: 'trilorah', version: 1, id: randomUUID(), title, createdAt: new Date().toISOString(), categories, assets: [...sources.values()].map(source => source.asset), ...(remote.size ? { warnings: [`${remote.size} remote link(s) are not embedded and still require internet access.`] } : {}) }
  await validateManifest(manifest)
  const json = Buffer.from(JSON.stringify(manifest))
  if (json.length > TRI_LIMITS.manifestBytes) throw new Error('Cannot save .tri: package metadata exceeds 16 MiB')
  const temp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`)
  try {
    await writeZip(temp, json, [...sources.values()])
    await rename(temp, filePath)
  } catch (error) { await rm(temp, { force: true }); throw error }
  return manifest
}

type OpenPackage = { zip: yauzl.ZipFile; manifest: TriManifest; entries: Map<string, yauzl.Entry> }
function entryStream(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<Readable> {
  return new Promise((resolve, reject) => zip.openReadStream(entry, (error, stream) => error ? reject(error) : resolve(stream)))
}
async function openPackage(filePath: string): Promise<OpenPackage> {
  const info = await stat(filePath)
  if (info.size > TRI_LIMITS.totalBytes + TRI_LIMITS.manifestBytes + 16 * 1024 ** 2) fail('archive exceeds the size limit')
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) => yauzl.open(filePath, { lazyEntries: true, autoClose: false, strictFileNames: true, validateEntrySizes: true }, (error, value) => error ? reject(error) : resolve(value)))
  // Keep an error listener after directory reading; stream operations handle their own failures.
  zip.on('error', () => {})
  try {
    if (zip.entryCount > TRI_LIMITS.entries) fail('too many archive entries')
    const entries = await new Promise<Map<string, yauzl.Entry>>((resolve, reject) => {
      const found = new Map<string, yauzl.Entry>()
      let total = 0
      const onError = (error: Error) => reject(error)
      zip.once('error', onError)
      zip.on('entry', (entry: yauzl.Entry) => {
        try {
          if (entry.fileName !== 'manifest.json' && !assetPattern.test(entry.fileName)) fail('unsafe or unsupported archive entry')
          if (found.has(entry.fileName)) fail('duplicate archive entry')
          const mode = (entry.externalFileAttributes >>> 16) & 0o170000
          if (mode !== 0 && mode !== 0o100000) fail('archive links and directories are not supported')
          if (entry.isEncrypted() || ![0, 8].includes(entry.compressionMethod)) fail('unsupported archive compression')
          const limit = entry.fileName === 'manifest.json' ? TRI_LIMITS.manifestBytes : TRI_LIMITS.assetBytes
          if (entry.uncompressedSize > limit) fail('archive entry exceeds the size limit')
          total += entry.uncompressedSize
          if (total > TRI_LIMITS.totalBytes + TRI_LIMITS.manifestBytes) fail('expanded archive exceeds the size limit')
          found.set(entry.fileName, entry)
          zip.readEntry()
        } catch (error) { reject(error) }
      })
      zip.once('end', () => { zip.removeListener('error', onError); resolve(found) })
      zip.readEntry()
    })
    const manifestEntry = entries.get('manifest.json')
    if (!manifestEntry) fail('manifest.json is missing')
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of await entryStream(zip, manifestEntry)) {
      size += chunk.length
      if (size > TRI_LIMITS.manifestBytes) fail('manifest exceeds the size limit')
      chunks.push(Buffer.from(chunk))
    }
    const json = Buffer.concat(chunks)
    if (crc32(json) !== manifestEntry.crc32) fail('manifest checksum failed')
    const manifest = await validateManifest(JSON.parse(json.toString('utf8')))
    if (manifest.assets.length + 1 !== entries.size) fail('archive contains unlisted or missing assets')
    for (const asset of manifest.assets) {
      const entry = entries.get(asset.entry)
      if (!entry || entry.uncompressedSize !== asset.size) fail('asset is missing or has the wrong size')
    }
    return { zip, manifest, entries }
  } catch (error) { zip.close(); throw error }
}

async function verifyAssets(pkg: OpenPackage, destination?: string) {
  for (const asset of pkg.manifest.assets) {
    const hash = createHash('sha256')
    let size = 0, crc = 0xffffffff
    const output = destination ? await open(path.join(destination, path.basename(asset.entry)), 'wx') : undefined
    try {
      for await (const chunk of await entryStream(pkg.zip, pkg.entries.get(asset.entry)!)) {
        const buffer = Buffer.from(chunk)
        size += buffer.length
        if (size > asset.size) fail('asset exceeds its declared size')
        hash.update(buffer)
        crc = crcUpdate(crc, buffer)
        if (output) await writeAll(output, buffer)
      }
      if (size !== asset.size || hash.digest('hex') !== asset.sha256 || ((crc ^ 0xffffffff) >>> 0) !== pkg.entries.get(asset.entry)!.crc32) fail(`checksum failed for ${asset.name}`)
    } finally { await output?.close() }
  }
}

/** Inspects metadata and verifies every embedded asset without extracting it. */
export async function inspectTri(filePath: string): Promise<TriManifest> {
  const pkg = await openPackage(filePath)
  try { await verifyAssets(pkg); return pkg.manifest } finally { pkg.zip.close() }
}

export interface TriExtractOptions {
  /** A selection already resolved to include its dependencies, using original asset tokens. */
  snapshot?: TriSnapshot
  /** Binds the import to the exact metadata that the operator reviewed. */
  expectedManifest?: TriManifest
  /** Reports this import's owned directory after extraction, for rollback if persistence fails. */
  onExtracted?: (directory: string) => void
}

/** Each import receives its own directory; failures remove only that import's staging files. */
export async function extractTri(filePath: string, destinationDir: string, options: TriExtractOptions = {}): Promise<TriManifest> {
  const pkg = await openPackage(filePath)
  const final = path.join(path.resolve(destinationDir), `tri-${randomUUID()}`)
  const staging = `${final}.tmp`
  try {
    if (options.expectedManifest && JSON.stringify(options.expectedManifest) !== JSON.stringify(pkg.manifest)) throw new Error('This package changed after it was opened. Open it again to review its contents.')
    if (options.snapshot) {
      validateSnapshot(options.snapshot)
      for (const category of TRI_CATEGORIES) {
        const originals = new Map((pkg.manifest.categories[category] ?? []).map(item => [item.id, item]))
        for (const item of options.snapshot.categories[category] ?? []) {
          if (JSON.stringify(item) !== JSON.stringify(originals.get(item.id))) fail('selection does not match the package contents')
        }
      }
      const referenced = new Set<string>()
      const categories = await mapJson(options.snapshot.categories, async (value, keys) => {
        const token = isAssetField(keys) && tokenPattern.exec(value)
        if (token) referenced.add(token[1]!)
        return value
      })
      pkg.manifest = { ...pkg.manifest, categories, assets: pkg.manifest.assets.filter(asset => referenced.has(asset.id)) }
    }
    if (pkg.manifest.assets.length) {
      await mkdir(destinationDir, { recursive: true })
      await mkdir(staging)
      await verifyAssets(pkg, staging)
    }
    const assets = new Map(pkg.manifest.assets.map(asset => [asset.id, path.join(final, path.basename(asset.entry))]))
    const categories = await mapJson(pkg.manifest.categories, async (value, keys) => {
      if (!isAssetField(keys)) return value
      const match = tokenPattern.exec(value)
      if (!match) return value
      const file = assets.get(match[1]!)!
      return match[2] === 'url' ? localMediaUrl(file) : file
    })
    if (pkg.manifest.assets.length) {
      await rename(staging, final)
      options.onExtracted?.(final)
    }
    return { ...pkg.manifest, categories }
  } catch (error) { await rm(staging, { recursive: true, force: true }); throw error }
  finally { pkg.zip.close() }
}
