import fs from 'node:fs/promises'
import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Transform, type Readable } from 'node:stream'
import * as yauzl from 'yauzl'

export const IMPORT_LIMITS = { bytes: 2 * 1024 ** 3, entryBytes: 1024 ** 3, textBytes: 16 * 1024 ** 2, entries: 20_000, files: 200 }
export interface SourceFile { name: string; file: string }
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

/** Extract to generated names, never archive paths. The caller owns and cleans the temporary directory. */
export async function unpack(file: string, directory: string, options: { maxBytes?: number; maxEntries?: number; easyWorshipCrc?: boolean; include?: Set<string> } = {}): Promise<SourceFile[]> {
  const stat = await fs.stat(file)
  if (!stat.isFile() || stat.size > IMPORT_LIMITS.bytes) throw new Error('Choose an archive smaller than 2 GiB.')
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) => yauzl.open(file, { lazyEntries: true, autoClose: false, strictFileNames: true, validateEntrySizes: true }, (error, value) => error ? reject(error) : resolve(value)))
  zip.on('error', () => {})
  try {
    if (zip.entryCount > (options.maxEntries ?? IMPORT_LIMITS.entries)) throw new Error('This archive contains too many files.')
    const entries = await new Promise<yauzl.Entry[]>((resolve, reject) => {
      const result: yauzl.Entry[] = [], names = new Set<string>()
      let bytes = 0
      zip.once('error', reject)
      zip.on('entry', (entry: yauzl.Entry) => {
        const name = entry.fileName
        const mode = (entry.externalFileAttributes >>> 16) & 0o170000
        if (!name || /[\x00-\x1f\\:]/.test(name) || name.startsWith('/') || name.split('/').some(p => p === '..' || p === '.') || names.has(name.toLowerCase()) || (mode && mode !== 0o100000 && mode !== 0o040000)) {
          reject(new Error('This archive contains an unsafe, duplicate, or linked file.')); return
        }
        names.add(name.toLowerCase())
        bytes += entry.uncompressedSize
        if (entry.isEncrypted() || ![0, 8].includes(entry.compressionMethod) || entry.uncompressedSize > IMPORT_LIMITS.entryBytes || bytes > (options.maxBytes ?? IMPORT_LIMITS.bytes)) {
          reject(new Error('This archive is encrypted, unsupported, or too large when unpacked.')); return
        }
        if (!name.endsWith('/')) result.push(entry)
        zip.readEntry()
      })
      zip.once('end', () => resolve(result))
      zip.readEntry()
    })
    await fs.mkdir(directory, { recursive: true })
    const files: SourceFile[] = []
    for (const entry of entries) {
      if (options.include && !options.include.has(entry.fileName)) continue
      const target = path.join(directory, `${files.length}${path.extname(entry.fileName).toLowerCase().replace(/[^.a-z0-9]/g, '')}`)
      const stream = await new Promise<Readable>((resolve, reject) => zip.openReadStream(entry, (error, value) => error ? reject(error) : resolve(value)))
      let bytes = 0, crc = 0xffffffff
      await pipeline(stream, new Transform({ transform(chunk, _encoding, callback) {
        bytes += chunk.length
        for (const byte of chunk) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
        callback(bytes > entry.uncompressedSize ? new Error('Archive entry exceeds its declared size.') : null, chunk)
      } }), createWriteStream(target, { flags: 'wx' }))
      if (bytes !== entry.uncompressedSize) throw new Error('Archive entry is incomplete.')
      // EasyWorship 6/7 stores a nonstandard CRC for main.db; all other entries use normal ZIP CRC32.
      if (!(options.easyWorshipCrc && entry.fileName.toLowerCase() === 'main.db') && ((crc ^ 0xffffffff) >>> 0) !== entry.crc32) throw new Error(`Archive checksum failed for ${entry.fileName}.`)
      files.push({ name: entry.fileName, file: target })
    }
    return files
  } finally { zip.close() }
}

export async function readSmall(file: string): Promise<Buffer> {
  const info = await fs.stat(file)
  if (!info.isFile() || info.size > IMPORT_LIMITS.textBytes) throw new Error('This text or presentation file is larger than 16 MiB.')
  const data = await fs.readFile(file)
  if (data.length > IMPORT_LIMITS.textBytes) throw new Error('The file grew while it was being read.')
  return data
}

export async function isZip(file: string): Promise<boolean> {
  const handle = await fs.open(file, 'r')
  try { const bytes = Buffer.alloc(4); await handle.read(bytes, 0, 4, 0); return bytes.readUInt32LE() === 0x04034b50 } finally { await handle.close() }
}
