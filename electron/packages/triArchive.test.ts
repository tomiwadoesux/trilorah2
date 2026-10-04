import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { deflateRawSync } from 'node:zlib'
import { extractTri, inspectTri, TRI_LIMITS, writeTri } from './triArchive'
import type { TriManifest, TriSnapshot } from '../../shared/triPackage'

let dir: string
beforeEach(async () => { dir = await mkdtemp(path.join(os.tmpdir(), 'trilorah-package-')) })
afterEach(async () => { await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }) })

// Independent fixture writer also produces compressed ZIPs, forged paths and UNIX links.
function fixtureCrc(data: Buffer) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}
function fixtureZip(files: { name: string; data: Buffer; symlink?: boolean; declaredSize?: number }[]) {
  let offset = 0
  const bodies: Buffer[] = [], directory: Buffer[] = []
  for (const file of files) {
    const name = Buffer.from(file.name), data = deflateRawSync(file.data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(fixtureCrc(file.data), 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(file.declaredSize ?? file.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(0x314, 4)
    central.writeUInt16LE(20, 6)
    local.copy(central, 8, 6, 28)
    if (file.symlink) central.writeUInt32LE((0o120777 << 16) >>> 0, 38)
    central.writeUInt32LE(offset, 42)
    directory.push(central, name)
    bodies.push(local, name, data)
    offset += local.length + name.length + data.length
  }
  const central = Buffer.concat(directory), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(central.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...bodies, central, end])
}
function basicManifest(): TriManifest {
  return { format: 'trilorah', version: 1, id: 'test-package', title: 'Sunday', createdAt: '2026-10-03T12:00:00Z', categories: { songs: [{ id: 'song-1', label: 'Amazing Grace', data: { title: 'Amazing Grace', lyrics: ['Amazing grace'] } }] }, assets: [] }
}
async function fixture(manifest: any, extras: Parameters<typeof fixtureZip>[0] = []) {
  const file = path.join(dir, 'fixture.tri')
  await writeFile(file, fixtureZip([{ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest)) }, ...extras]))
  return file
}
function mediaFixture(data = Buffer.from('actual portable picture bytes')) {
  const sha256 = createHash('sha256').update(data).digest('hex')
  const asset = { id: sha256, sha256, entry: `assets/${sha256}.png`, size: data.length, name: 'picture.png' }
  const manifest = basicManifest()
  manifest.assets = [asset]
  manifest.categories.media = [{ id: 'picture', label: 'Sanctuary', data: { src: `tri-asset:${sha256}:url` } }]
  return { manifest, asset, data }
}

describe('portable .tri archives', () => {
  it('carries actual media, layout and preacher learning to a separate laptop directory, preserving references', async () => {
    const original = path.join(dir, 'laptop A'), destination = path.join(dir, 'laptop B')
    await mkdir(original)
    const picture = path.join(original, 'Sunday #1 é.png')
    const duplicate = path.join(original, 'copy.png')
    await writeFile(picture, 'picture contents')
    await writeFile(duplicate, 'picture contents')
    const snapshot: TriSnapshot = { categories: {
      service: [{ id: 'service', label: 'Sunday morning', data: { segments: [{ songId: 'song-1', presentationId: 'deck' }] } }],
      songs: [{ id: 'song-1', label: 'Amazing Grace', data: { sections: [{ lines: ['Amazing grace'] }], backgroundUrl: pathToFileURL(picture).href } }],
      media: [{ id: 'photo', label: 'Sunday photo', data: { path: picture, src: pathToFileURL(duplicate).href } }],
      presentations: [{ id: 'deck', label: 'Announcements', data: { slides: [{ src: picture }] } }],
      themes: [{ id: 'theme', label: 'Church theme', data: { fontSize: 64, textAlign: 'left', referenceGap: 12, defaultBackgroundUrl: pathToFileURL(picture).href } }],
      preachers: [{ id: 'pastor', label: 'Pastor James', data: { aliases: { Romanz: 'Romans' }, corrections: [{ heard: 'romans one', expected: 'Romans 1' }] } }],
    } }
    const file = path.join(dir, 'Sunday.tri')
    const written = await writeTri(file, snapshot, 'Sunday morning')
    expect(written.assets).toHaveLength(1)
    expect((await readFile(file)).subarray(0, 4).toString('hex')).toBe('504b0304')
    expect(written.categories.media![0]!.data.path).toMatch(/^tri-asset:/)
    expect(snapshot.categories.media![0]!.data.path).toBe(picture)
    await rm(original, { recursive: true })
    expect(await inspectTri(file)).toEqual(written)
    const restored = await extractTri(file, destination)
    const media = restored.categories.media![0]!.data
    expect(await readFile(media.path, 'utf8')).toBe('picture contents')
    expect(path.relative(destination, media.path).startsWith('..')).toBe(false)
    expect(media.src).toMatch(/^local-media:\/\/file\//)
    expect(restored.categories.songs![0]!.data.backgroundUrl).toBe(media.src)
    expect(restored.categories.service).toEqual(snapshot.categories.service)
    expect(restored.categories.preachers).toEqual(snapshot.categories.preachers)
    expect(restored.categories.themes![0]!.data).toMatchObject({ fontSize: 64, textAlign: 'left', referenceGap: 12 })
    await rm(file)
    expect(await readFile(media.path, 'utf8')).toBe('picture contents')
  })

  it('does not mistake preacher utterances or lyrics for files and warns about remote media', async () => {
    const manifest = await writeTri(path.join(dir, 'content.tri'), { categories: {
      preachers: [{ id: 'pastor', label: 'Pastor', data: { heard: 'C:\\missing\\song.mp3', expected: 'file:///missing.png' } }],
      media: [{ id: 'web', label: 'Remote background', data: { src: 'https://example.com/image.png' } }],
    } }, 'Portable learning')
    expect(manifest.assets).toEqual([])
    expect(manifest.warnings).toEqual(['1 remote link(s) are not embedded and still require internet access.'])
    expect((await inspectTri(path.join(dir, 'content.tri'))).categories.preachers![0]!.data.heard).toBe('C:\\missing\\song.mp3')
  })

  it('fails explicitly on missing local media and preserves the previous save', async () => {
    const file = path.join(dir, 'saved.tri')
    await writeTri(file, basicManifest(), 'Previous service')
    const before = await readFile(file)
    await expect(writeTri(file, { categories: { media: [{ id: 'missing', label: 'Missing', data: { src: path.join(dir, 'missing.png') } }] } }, 'New service')).rejects.toThrow(/missing or unreadable/)
    expect(await readFile(file)).toEqual(before)
    expect((await readdir(dir)).filter(name => name.endsWith('.tmp'))).toEqual([])
  })

  it('can replace a previous save atomically', async () => {
    const file = path.join(dir, 'saved.tri')
    await writeTri(file, basicManifest(), 'First')
    await writeTri(file, basicManifest(), 'Second')
    expect((await inspectTri(file)).title).toBe('Second')
  })

  it('accepts a standard deflated ZIP package', async () => {
    const { manifest, asset, data } = mediaFixture()
    const file = await fixture(manifest, [{ name: asset.entry, data }])
    expect(await inspectTri(file)).toEqual(manifest)
  })

  it.each(['../escape.png', '/escape.png', 'assets/../../escape.png', 'assets\\escape.png'])('rejects traversal or unsupported entries: %s', async name => {
    const file = await fixture(basicManifest(), [{ name, data: Buffer.from('bad') }])
    await expect(extractTri(file, path.join(dir, 'destination'))).rejects.toThrow()
    expect(await readdir(dir)).toEqual(['fixture.tri'])
  })

  it('rejects unsupported versions and missing embedded references', async () => {
    await expect(inspectTri(await fixture({ ...basicManifest(), version: 99 }))).rejects.toThrow(/unsupported package version/)
    const manifest = basicManifest()
    manifest.categories.media = [{ id: 'missing', label: 'Missing', data: { src: `tri-asset:${'a'.repeat(64)}:url` } }]
    await expect(inspectTri(await fixture(manifest))).rejects.toThrow(/missing or invalid embedded/)
  })

  it('rejects a bad asset SHA checksum and rolls back partially extracted files', async () => {
    const { manifest, asset, data } = mediaFixture()
    const destination = path.join(dir, 'destination')
    await mkdir(destination)
    await writeFile(path.join(destination, 'existing.txt'), 'keep me')
    const tampered = Buffer.from(data)
    tampered[0] = 0
    const file = await fixture(manifest, [{ name: asset.entry, data: tampered }])
    await expect(extractTri(file, destination)).rejects.toThrow(/checksum failed/)
    expect(await readdir(destination)).toEqual(['existing.txt'])
    expect(await readFile(path.join(destination, 'existing.txt'), 'utf8')).toBe('keep me')
  })

  it('rejects symbolic links and oversized expanded entries', async () => {
    const { manifest, asset, data } = mediaFixture()
    await expect(inspectTri(await fixture(manifest, [{ name: asset.entry, data, symlink: true }]))).rejects.toThrow(/links and directories/)
    await expect(inspectTri(await fixture(manifest, [{ name: asset.entry, data, declaredSize: TRI_LIMITS.assetBytes + 1 }]))).rejects.toThrow(/size limit/)
  })

  it('rejects duplicate entries, unlisted assets, and external local references', async () => {
    const { manifest, asset, data } = mediaFixture()
    await expect(inspectTri(await fixture(manifest, [{ name: asset.entry, data }, { name: asset.entry, data }]))).rejects.toThrow(/duplicate archive/)
    await expect(inspectTri(await fixture(basicManifest(), [{ name: asset.entry, data }]))).rejects.toThrow(/unlisted or missing/)
    manifest.categories.media![0]!.data.src = 'file:///local/not-in-package.png'
    await expect(inspectTri(await fixture(manifest, [{ name: asset.entry, data }]))).rejects.toThrow(/external local/)
  })

  it('rejects prototype keys and malformed categories', async () => {
    const manifest = basicManifest()
    manifest.categories.songs![0]!.data = JSON.parse('{"__proto__":{"polluted":true}}')
    await expect(inspectTri(await fixture(manifest))).rejects.toThrow(/unsafe object key/)
    await expect(inspectTri(await fixture({ ...basicManifest(), categories: { passwords: [] } }))).rejects.toThrow(/unsupported category/)
    expect(({} as any).polluted).toBeUndefined()
  })

  it('extracts only assets used by the chosen items and binds the selection to the inspected manifest', async () => {
    const { manifest, asset, data } = mediaFixture()
    const file = await fixture(manifest, [{ name: asset.entry, data }])
    const inspected = await inspectTri(file)
    const destination = path.join(dir, 'selected')
    const extracted = await extractTri(file, destination, { snapshot: { categories: { songs: inspected.categories.songs } }, expectedManifest: inspected })
    expect(extracted.assets).toEqual([])
    expect(extracted.categories.media).toBeUndefined()
    expect(await readdir(dir)).toEqual(['fixture.tri'])

    await expect(extractTri(file, destination, { expectedManifest: { ...inspected, title: 'Different reviewed service' } })).rejects.toThrow(/changed after/)
    const altered = structuredClone(inspected.categories.songs!)
    altered[0]!.data.title = 'Not reviewed'
    await expect(extractTri(file, destination, { snapshot: { categories: { songs: altered } } })).rejects.toThrow(/selection does not match/)
    expect(await readdir(dir)).toEqual(['fixture.tri'])
  })
})
