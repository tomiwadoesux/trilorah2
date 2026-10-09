// Small original fixtures, with independent encoders, shared by import regression tests.
import { deflateRawSync } from 'node:zlib'

export const pro6Fixture = `<RVPresentationDocument name="Sunday song" CCLISongTitle="Sunday song" CCLIArtistCredits="Test writer" CCLISongNumber="123">
 <array rvXMLIvarName="groups"><RVSlideGrouping name="Verse 1"><array rvXMLIvarName="slides">
 <RVDisplaySlide label="Verse 1"><array rvXMLIvarName="displayElements"><RVTextElement><NSString rvXMLIvarName="PlainText">${Buffer.from('First line\nSecond line').toString('base64')}</NSString></RVTextElement></array></RVDisplaySlide>
 </array></RVSlideGrouping></array></RVPresentationDocument>`

function uint(number: number): Buffer {
  const bytes: number[] = []
  do { const byte = number % 128; number = Math.floor(number / 128); bytes.push(byte | (number ? 128 : 0)) } while (number)
  return Buffer.from(bytes)
}
export function pb(...fields: Array<[number, number | string | Buffer]>): Buffer {
  return Buffer.concat(fields.map(([key, value]) => {
    if (typeof value === 'number') return Buffer.concat([uint(key * 8), uint(value)])
    const data = typeof value === 'string' ? Buffer.from(value) : value
    return Buffer.concat([uint(key * 8 + 2), uint(data.length), data])
  }))
}
const id = (value: string) => pb([1, value])
export function proFixture(): Buffer {
  const slide = (name: string, lyrics: string, media?: string) => {
    const graphicsText = pb([5, `{\\rtf1\\ansi ${lyrics}}`])
    const graphicsElement = pb([13, graphicsText])
    const element = pb([1, graphicsElement])
    const baseSlide = pb([1, element])
    const presentationSlide = pb([1, baseSlide])
    const action = pb([6, 1], [23, pb([2, presentationSlide])])
    const fields: Array<[number, number | string | Buffer]> = [[1, id(name)], [2, name], [12, 1], [10, action]]
    if (media) {
      const mediaElement = pb([2, pb([1, media])])
      fields.push([10, pb([6, 1], [20, pb([5, mediaElement])])])
    }
    return pb(...fields)
  }
  return pb([2, id('song')], [3, 'Sunday song'], [10, id('arrangement')],
    [11, pb([1, id('arrangement')], [2, 'Sunday'], [3, id('chorus')], [3, id('verse')], [3, id('chorus')])],
    [12, pb([1, pb([1, id('verse')], [2, 'Verse 1'])], [2, id('v1')])],
    [12, pb([1, pb([1, id('chorus')], [2, 'Chorus'])], [2, id('c1')])],
    [13, slide('v1', 'First verse\\line Another line')], [13, slide('c1', 'Sing together', 'file:///old-laptop/sky.png')],
    [14, pb([1, 'Test writer'], [3, 'Sunday song'], [4, 'Test publisher'], [5, 2026], [6, 123])])
}
export function playlistFixture(): Buffer {
  return pb([1, id('playlist')], [2, 'Sunday service'], [3, 1], [13, pb(
    [1, pb([1, id('header')], [2, 'Worship'], [3, Buffer.alloc(0)])],
    [1, pb([1, id('song1')], [2, 'Sunday song'], [4, pb([1, pb([1, 'file:///old-laptop/Sunday.pro'])], [2, id('arrangement')])])],
    [1, pb([1, id('song2')], [2, 'Sunday song again'], [4, pb([1, pb([1, 'Sunday.pro'])])])],
    [1, pb([1, id('missing')], [2, 'Missing song'], [4, pb([1, pb([1, 'Missing.pro'])])])],
  )])
}

function crc(data: Buffer) {
  let value = 0xffffffff
  for (const byte of data) { value ^= byte; for (let n = 0; n < 8; n++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1 }
  return (value ^ 0xffffffff) >>> 0
}
export function zipFixture(files: Array<{ name: string; data: Buffer; mode?: number; size?: number }>): Buffer {
  const bodies: Buffer[] = [], central: Buffer[] = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(file.name), data = deflateRawSync(file.data), local = Buffer.alloc(30), entry = Buffer.alloc(46)
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8)
    local.writeUInt32LE(crc(file.data), 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(file.size ?? file.data.length, 22); local.writeUInt16LE(name.length, 26)
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(0x314, 4); entry.writeUInt16LE(20, 6)
    local.copy(entry, 8, 6, 28); entry.writeUInt32LE(offset, 42)
    if (file.mode) entry.writeUInt32LE((file.mode << 16) >>> 0, 38)
    central.push(entry, name); bodies.push(local, name, data); offset += local.length + name.length + data.length
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...bodies, directory, end])
}
