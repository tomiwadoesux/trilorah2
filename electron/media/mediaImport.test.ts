import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  HEIC_ELSEWHERE,
  MAX_IMPORT_FILES,
  NOT_MEDIA,
  expandMediaPaths,
  importMediaFile,
  importMediaPaths,
  localPathFromUrl,
  mediaKindOf,
  pickerExtensions,
  saveClipPoster,
} from './mediaImport'

describe('adding pictures and clips from the laptop', () => {
  let temp: string
  let shelf: string
  let from: string

  beforeEach(() => {
    temp = fs.mkdtempSync(path.join(os.tmpdir(), 'media-import-'))
    shelf = path.join(temp, 'userData', 'media')
    from = path.join(temp, 'Desktop')
    fs.mkdirSync(from, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(temp, { recursive: true, force: true })
  })

  const write = (name: string, bytes = `bytes of ${name}`) => {
    const file = path.join(from, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, bytes)
    return file
  }
  const onShelf = () => (fs.existsSync(shelf) ? fs.readdirSync(shelf).sort() : [])

  it('copies a picture into the shelf folder under a name taken from its bytes', async () => {
    const out = await importMediaFile(write('Sanctuary Wide.jpg'), shelf)
    expect('item' in out).toBe(true)
    if (!('item' in out)) return
    const { item } = out
    expect(item.kind).toBe('photo')
    expect(item.name).toBe('Sanctuary Wide')
    expect(item.existed).toBe(false)
    expect(item.id).toMatch(/^local:[0-9a-f]{20}$/)
    expect(onShelf()).toEqual([`${item.id.slice(6)}.jpg`])
    /* Encoded both ways round, so a folder with a space in it draws. */
    expect(item.url.startsWith('file://')).toBe(true)
    expect(item.src.startsWith('local-media://file/')).toBe(true)
    expect(localPathFromUrl(item.url)).toBe(path.join(shelf, onShelf()[0]))
    expect(localPathFromUrl(item.src)).toBe(path.join(shelf, onShelf()[0]))
  })

  it('gives the same picture added twice one file and one id', async () => {
    const a = await importMediaFile(write('sunday.jpg', 'same bytes'), shelf)
    const b = await importMediaFile(write('copy of sunday.jpg', 'same bytes'), shelf)
    if (!('item' in a) || !('item' in b)) throw new Error('both should import')
    expect(b.item.id).toBe(a.item.id)
    expect(b.item.existed).toBe(true)
    expect(b.item.url).toBe(a.item.url)
    expect(onShelf()).toHaveLength(1)
  })

  it('leaves no half-written files behind when the same file lands twice at once', async () => {
    const file = write('clip.mp4', 'x'.repeat(256 * 1024))
    const [a, b] = await Promise.all([importMediaFile(file, shelf), importMediaFile(file, shelf)])
    if (!('item' in a) || !('item' in b)) throw new Error('both should import')
    expect(a.item.id).toBe(b.item.id)
    expect(a.item.kind).toBe('video')
    expect(onShelf().filter((f) => f.includes('.part'))).toEqual([])
    expect(onShelf()).toHaveLength(1)
  })

  it('skips what is not a picture or clip, and says why', async () => {
    const out = await importMediaFile(write('notes.pdf'), shelf)
    expect(out).toEqual({ skipped: { name: 'notes.pdf', reason: NOT_MEDIA } })
    expect(onShelf()).toEqual([])
  })

  it('imports through a shortcut (symlink) to a picture', async () => {
    const real = write('real.png')
    const link = path.join(from, 'shortcut.png')
    fs.symlinkSync(real, link)
    const out = await importMediaFile(link, shelf)
    expect('item' in out && out.item.kind).toBe('photo')
  })

  it('opens a dropped folder one level, and says when it holds nothing usable', async () => {
    write('Easter/2.jpg')
    write('Easter/10.jpg')
    write('Easter/readme.txt')
    write('Easter/deeper/ignored.jpg')
    fs.mkdirSync(path.join(from, 'Empty'))
    write('Empty/notes.txt')
    const { files, skipped } = await expandMediaPaths([path.join(from, 'Easter'), path.join(from, 'Empty')])
    expect(files.map((f) => path.basename(f))).toEqual(['2.jpg', '10.jpg'])
    expect(skipped).toEqual([{ name: 'Empty', reason: 'no pictures or clips in that folder' }])
  })

  it('imports a list in order and reports the skips beside the items', async () => {
    const result = await importMediaPaths([write('a.jpg'), write('b.txt'), write('c.webm')], shelf)
    expect(result.items.map((i) => i.name)).toEqual(['a', 'c'])
    expect(result.skipped).toEqual([{ name: 'b.txt', reason: NOT_MEDIA }])
  })

  it('refuses anything that is not a short list of paths', async () => {
    expect((await importMediaPaths('a.jpg', shelf)).items).toEqual([])
    expect((await importMediaPaths([1, 2], shelf)).items).toEqual([])
    expect((await importMediaPaths(Array.from({ length: MAX_IMPORT_FILES + 1 }, () => 'x.jpg'), shelf)).items).toEqual([])
  })

  it('turns an iPhone photo into a jpeg on macOS and keeps it under the photo’s own hash', async () => {
    const heic = write('IMG_0042.HEIC', 'heic bytes')
    const converted: string[] = []
    const convertHeic = async (_src: string, dest: string) => {
      converted.push(dest)
      fs.writeFileSync(dest, 'jpeg bytes')
    }
    const out = await importMediaFile(heic, shelf, { platform: 'darwin', convertHeic })
    if (!('item' in out)) throw new Error('should convert')
    expect(out.item.kind).toBe('photo')
    expect(out.item.name).toBe('IMG_0042')
    expect(onShelf()).toEqual([`${out.item.id.slice(6)}.jpg`])
    expect(converted[0].endsWith('.jpg')).toBe(true)
    /* The same phone photo again: one card, no second conversion. */
    const again = await importMediaFile(heic, shelf, { platform: 'darwin', convertHeic })
    expect('item' in again && again.item.existed).toBe(true)
    expect(converted).toHaveLength(1)
  })

  it('skips an iPhone photo elsewhere with a reason, and cleans up a failed conversion', async () => {
    const heic = write('IMG_0043.heic')
    expect(await importMediaFile(heic, shelf, { platform: 'win32' })).toEqual({ skipped: { name: 'IMG_0043.heic', reason: HEIC_ELSEWHERE } })
    const broken = await importMediaFile(heic, shelf, {
      platform: 'darwin',
      convertHeic: async (_src, dest) => {
        fs.writeFileSync(dest, 'half')
        throw new Error('sips failed')
      },
    })
    expect('skipped' in broken).toBe(true)
    expect(onShelf()).toEqual([])
  })

  it('keeps a clip poster as a small file the clip can still be added beside', async () => {
    const clip = await importMediaFile(write('baptism.mp4', 'clip bytes'), shelf)
    if (!('item' in clip)) throw new Error('the clip should import')
    const jpeg = `data:image/jpeg;base64,${Buffer.from('a tiny jpeg').toString('base64')}`
    const url = await saveClipPoster(clip.item.id, jpeg, shelf)
    expect(url?.startsWith('local-media://file/')).toBe(true)
    const file = localPathFromUrl(url ?? '')
    expect(path.dirname(file)).toBe(path.join(shelf, 'posters'))
    expect(fs.readFileSync(file, 'utf8')).toBe('a tiny jpeg')
    /* Saved again: the same file, nothing half-written. */
    expect(await saveClipPoster(clip.item.id, jpeg, shelf)).toBe(url)
    expect(fs.readdirSync(path.join(shelf, 'posters'))).toEqual([path.basename(file)])
    /* The posters folder does not read as the clip being on the shelf twice. */
    const again = await importMediaFile(write('baptism copy.mp4', 'clip bytes'), shelf)
    if (!('item' in again)) throw new Error('the clip should import again')
    expect(again.item.existed).toBe(true)
    expect(again.item.url).toBe(clip.item.url)
  })

  it('takes only a jpeg data URL for a card it made, within size', async () => {
    const id = `local:${'a'.repeat(20)}`
    const jpeg = `data:image/jpeg;base64,${Buffer.from('x').toString('base64')}`
    expect(await saveClipPoster('../../etc', jpeg, shelf)).toBeNull()
    expect(await saveClipPoster(`local:${'a'.repeat(20)}/../x`, jpeg, shelf)).toBeNull()
    expect(await saveClipPoster(id, 'data:image/png;base64,eA==', shelf)).toBeNull()
    expect(await saveClipPoster(id, 'file:///etc/passwd', shelf)).toBeNull()
    expect(await saveClipPoster(id, 42, shelf)).toBeNull()
    expect(await saveClipPoster(id, `data:image/jpeg;base64,${Buffer.alloc(600 * 1024).toString('base64')}`, shelf)).toBeNull()
    expect(fs.existsSync(path.join(shelf, 'posters'))).toBe(false)
  })

  it('knows which kinds each platform can bring in', () => {
    expect(mediaKindOf('a.JPG')).toBe('photo')
    expect(mediaKindOf('a.m4v')).toBe('video')
    expect(mediaKindOf('a.heic', 'darwin')).toBe('heic')
    expect(mediaKindOf('a.heic', 'win32')).toBeNull()
    expect(pickerExtensions('darwin')).toContain('heic')
    expect(pickerExtensions('linux')).not.toContain('heic')
  })
})

describe('localPathFromUrl', () => {
  it('reads every form a stored URL takes on macOS', () => {
    expect(localPathFromUrl('/Users/me/a.jpg', 'darwin')).toBe('/Users/me/a.jpg')
    expect(localPathFromUrl('file:///Users/me/Application%20Support/a.jpg', 'darwin')).toBe('/Users/me/Application Support/a.jpg')
    /* Written by hand by older builds: not encoded at all. */
    expect(localPathFromUrl('file:///Users/me/Application Support/Service #3.jpg', 'darwin')).toBe('/Users/me/Application Support/Service #3.jpg')
    expect(localPathFromUrl('local-media://file/Users/me/Application%20Support/a.jpg', 'darwin')).toBe('/Users/me/Application Support/a.jpg')
    expect(localPathFromUrl('local-media://file/Users/me/Application Support/a.jpg', 'darwin')).toBe('/Users/me/Application Support/a.jpg')
    expect(localPathFromUrl('file:///Users/me/100%.jpg', 'darwin')).toBe('/Users/me/100%.jpg')
  })

  it('drops the leading slash before a drive letter on Windows', () => {
    expect(localPathFromUrl('file:///C:/Users/me/a%20b.jpg', 'win32')).toBe('C:/Users/me/a b.jpg')
    expect(localPathFromUrl('local-media://file/C:/Users/me/a%20b.jpg', 'win32')).toBe('C:/Users/me/a b.jpg')
    expect(localPathFromUrl('local-media://file/C:/Users/me/a b.jpg', 'win32')).toBe('C:/Users/me/a b.jpg')
    /* Not on macOS, where '/C:/' would be a real folder. */
    expect(localPathFromUrl('file:///C:/x.jpg', 'darwin')).toBe('/C:/x.jpg')
  })
})
