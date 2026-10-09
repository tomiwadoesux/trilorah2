import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { convertForeign, resolveSource } from './foreignImport'
import { parsePro, parsePro6, parseProPlaylist } from './propresenter'
import { Proto, readXml, rtfText } from './text'
import { IMPORT_LIMITS, unpack } from './archive'
import { extractTri, inspectTri } from '../packages/triArchive'
import { localPathFromUrl } from '../media/mediaImport'
import { playlistFixture, pro6Fixture, proFixture, zipFixture } from './fixtures'
import { foreignDependencies, unanswered } from '../../shared/foreignImport'
import { createRequire } from 'node:module'
import { detect, lyricShaped, textSong } from './generic'

let directory: string
const converted: string[] = []
beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'foreign-test-')) })
afterEach(async () => { for (const dir of [directory, ...converted.splice(0)]) await fs.rm(dir, { force: true, recursive: true }) })
async function file(name: string, data: string | Buffer) { const target = path.join(directory, name); await fs.writeFile(target, data); return target }

describe('foreign file readers', () => {
  it('reads RTF groups, escaped braces, cp1252, UTF-16 escapes, and line breaks without leaking font tables', () => {
    expect(rtfText(String.raw`{\rtf1\ansi{\fonttbl{\f0 Arial;}}Caf\'e9 \u945?\line \{Grace\} {\*\unknown hidden}shown}`)).toBe('Café α\n{Grace} shown')
    expect(rtfText(String.raw`{\rtf1\uc0 \u55357\u56832}`)).toBe('😀')
    expect(() => rtfText('{\\rtf1 unfinished')).toThrow('incomplete')
  })
  it('rejects truncated wire messages and XML external entities', () => {
    expect(() => new Proto(Buffer.from([26, 9, 65]))).toThrow('Truncated')
    expect(() => readXml('<!DOCTYPE a [<!ENTITY x SYSTEM "file:///secret">]><a>&x;</a>')).toThrow('entities')
    expect(() => readXml('<a><b></a>')).toThrow('Unmatched')
    expect(() => parsePro(Buffer.from('not a presentation'), 'bad.pro')).toThrow()
  })
  it('preserves ProPresenter repeated arrangement groups, slide lines, credits, and media references', () => {
    const presentation = parsePro(proFixture(), 'Sunday.pro')
    expect(presentation.title).toBe('Sunday song')
    expect(presentation.slides.map(slide => slide.label)).toEqual(['Chorus', 'Verse 1', 'Chorus'])
    expect(presentation.slides[1].text).toBe('First verse\nAnother line')
    expect(presentation.slides[0].media).toEqual(['file:///old-laptop/sky.png'])
    expect(presentation).toMatchObject({ authors: ['Test writer'], ccliNumber: '123', copyright: '2026 Test publisher' })
  })
  it('reads Pro6 base64 text and modern playlist order', () => {
    expect(parsePro6(pro6Fixture, 'Sunday.pro6').slides[0]).toMatchObject({ label: 'Verse 1', text: 'First line\nSecond line' })
    expect(parseProPlaylist(playlistFixture()).items.map(item => item.label)).toEqual(['Worship', 'Sunday song', 'Sunday song again', 'Missing song'])
  })
  it('does not follow filesystem references or choose arbitrarily between same-named media', () => {
    expect(resolveSource('/private/unselected.png', [])).toBeUndefined()
    const sources = [{ name: 'one/sky.png', file: '/tmp/one' }, { name: 'two/sky.png', file: '/tmp/two' }]
    expect(resolveSource('file:///old/sky.png', sources)).toBeUndefined()
    expect(resolveSource('file:///old/one/sky.png', sources)).toBe(sources[0])
  })
})

describe('conversion and portable media', () => {
  it('converts a playlist bundle with editable lyrics and durable media, reporting missing references', async () => {
    const archive = await file('Sunday.proPlaylist', zipFixture([
      { name: 'Sunday.pro', data: proFixture() }, { name: 'Playlist.proPlaylist', data: playlistFixture() },
      { name: 'media/sky.png', data: Buffer.from('original picture bytes') }, { name: 'audio.mp3', data: Buffer.from('audio') },
    ]))
    const result = await convertForeign([archive]); converted.push(result.directory)
    expect(result.manifest.categories.songs?.[0].data.sections.map((section: any) => section.label)).toEqual(['Chorus', 'Verse 1', 'Chorus'])
    expect(result.manifest.assets).toHaveLength(1)
    expect(result.manifest.categories.songs).toHaveLength(1)
    expect(foreignDependencies(result.manifest, { service: result.manifest.categories.service!.map(item => item.id) }).songs).toEqual(result.manifest.categories.songs!.map(item => item.id))
    expect(result.warnings.some(warning => warning.includes('Missing song'))).toBe(true)
    expect(result.warnings.some(warning => warning.includes('audio.mp3'))).toBe(true)
    await fs.rm(archive)
    expect(await inspectTri(result.file)).toEqual(result.manifest)
    const restored = await extractTri(result.file, path.join(directory, 'library'))
    await fs.rm(result.directory, { recursive: true })
    const media = restored.categories.media![0].data
    expect(await fs.readFile(localPathFromUrl(media.url), 'utf8')).toBe('original picture bytes')
    const segments = restored.categories.service![0].data.segments
    expect(segments[0].label).toBe('Worship')
    expect(segments[0].items.at(-1).label).toBe('Missing song — missing presentation')
  })
  it('converts PewBeam transcript and recognized theme settings without applying them', async () => {
    const transcript = await file('transcript.md', '# Sunday\n\nWelcome everyone.\nJohn 3:16')
    const theme = await file('evening-theme.json', JSON.stringify({ name: 'Evening', text: { fontSize: 64, color: '#ffffff', fontFamily: 'Arial' }, background: { color: '#123456' } }))
    const result = await convertForeign([transcript, theme]); converted.push(result.directory)
    expect(result.manifest.categories.themes?.[0].data).toMatchObject({ defaultFontSize: 64, defaultTextColor: '#ffffff' })
    expect(result.manifest.categories.service?.[0].data.segments[0].items.map((row: any) => row.label)).toEqual(['# Sunday', 'Welcome everyone.', 'John 3:16'])
    expect(result.manifest.assets).toHaveLength(1)
    expect(result.manifest.categories.preachers).toBeUndefined()
  })
  it('reads Word transcript paragraphs and rejects unknown theme structures', async () => {
    const docx = await file('notes.docx', zipFixture([{ name: 'word/document.xml', data: Buffer.from('<w:document><w:body><w:p><w:r><w:t>Hello &amp; welcome</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p></w:body></w:document>') }]))
    const result = await convertForeign([docx]); converted.push(result.directory)
    expect(result.manifest.categories.service![0].data.segments[0].items[0].label).toBe('Hello & welcome')
    const unknown = await file('unknown.json', '{"name":"New schema","secretPath":"/tmp/private.png"}')
    await expect(convertForeign([unknown])).rejects.toThrow('no song-shaped records')
  })
  it('preserves Word line breaks and tabs instead of joining separate words', async () => {
    const docx = await file('notes.docx', zipFixture([{ name: 'word/document.xml', data: Buffer.from('<w:document><w:body><w:p><w:r><w:t>First line</w:t><w:br/><w:t>Second</w:t><w:tab/><w:t>column</w:t><w:cr/><w:t>Third line</w:t></w:r></w:p></w:body></w:document>') }]))
    const result = await convertForeign([docx]); converted.push(result.directory)
    expect(result.manifest.categories.service![0].data.segments[0].items.map((row: any) => row.label)).toEqual(['First line', 'Second\tcolumn', 'Third line'])
  })
  it('reads exported bundles inside a transfer ZIP', async () => {
    const bundle = zipFixture([{ name: 'Sunday.pro6', data: Buffer.from(pro6Fixture) }])
    const archive = await file('transfer.zip', zipFixture([{ name: 'exports/Sunday.pro6x', data: bundle }]))
    const result = await convertForeign([archive]); converted.push(result.directory)
    expect(result.manifest.categories.songs?.[0].data.title).toBe('Sunday song')
    expect(result.manifest.categories.songs?.[0].data.sections[0].lines).toEqual(['First line', 'Second line'])
  })
  it('reports unreadable presentations while allowing other valid files through', async () => {
    const bad = await file('Broken.pro', 'bad'), good = await file('Sunday.pro6', pro6Fixture)
    const result = await convertForeign([bad, good]); converted.push(result.directory)
    expect(result.manifest.categories.songs).toHaveLength(1)
    expect(result.warnings.some(warning => warning.includes('Broken.pro'))).toBe(true)
  })
})

describe('archive boundaries', () => {
  it.each([
    [{ name: '../escape.png', data: Buffer.from('x') }],
    [{ name: 'link.png', data: Buffer.from('/etc/passwd'), mode: 0o120777 }],
    [{ name: 'a.png', data: Buffer.from('x') }, { name: 'A.png', data: Buffer.from('y') }],
    [{ name: 'large.png', data: Buffer.from('x'), size: IMPORT_LIMITS.entryBytes + 1 }],
  ])('rejects unsafe archives before extraction', async (...entries) => {
    const archive = await file('unsafe.zip', zipFixture(entries))
    await expect(unpack(archive, path.join(directory, 'out'))).rejects.toThrow()
    await expect(fs.stat(path.join(directory, 'escape.png'))).rejects.toThrow()
  })
  it('checks media CRCs and the remaining batch budget, with the explicit EasyWorship main.db exception', async () => {
    const bytes = zipFixture([{ name: 'sky.png', data: Buffer.from('image') }])
    const central = bytes.indexOf(Buffer.from('504b0102', 'hex'))
    bytes.writeUInt32LE(0, central + 16)
    const archive = await file('bad-crc.zip', bytes)
    await expect(unpack(archive, path.join(directory, 'out'))).rejects.toThrow('checksum')
    const safe = await file('large-batch.zip', zipFixture([{ name: 'image.png', data: Buffer.from('12345') }]))
    await expect(unpack(safe, path.join(directory, 'limit'), { maxBytes: 4 })).rejects.toThrow('too large')
    const ew = zipFixture([{ name: 'main.db', data: Buffer.from('database bytes') }])
    ew.writeUInt32LE(0, ew.indexOf(Buffer.from('504b0102', 'hex')) + 16)
    const ewFile = await file('Sunday.ewsx', ew)
    await expect(unpack(ewFile, path.join(directory, 'ew'), { easyWorshipCrc: true })).resolves.toHaveLength(1)
  })
  it('enforces archive depth and validates checksums inside nested exports', async () => {
    let nested = zipFixture([{ name: 'Sunday.pro6', data: Buffer.from(pro6Fixture) }])
    for (let i = 0; i < 4; i++) nested = zipFixture([{ name: 'nested.zip', data: nested }])
    const deep = await file('deep.zip', nested)
    await expect(convertForeign([deep])).rejects.toThrow('nested archives')
    const bad = zipFixture([{ name: 'Sunday.pro6', data: Buffer.from(pro6Fixture) }])
    bad.writeUInt32LE(0, bad.indexOf(Buffer.from('504b0102', 'hex')) + 16)
    const corrupt = await file('corrupt.zip', zipFixture([{ name: 'Sunday.pro6x', data: bad }]))
    await expect(convertForeign([corrupt])).rejects.toThrow('checksum')
  })
})

// better-sqlite3 is compiled for Electron's ABI; under plain Node these cases run only when the module loads.
const Database: typeof import('better-sqlite3') | undefined = (() => { try { const loaded = createRequire(import.meta.url)('better-sqlite3'); new loaded(':memory:').close(); return loaded } catch { return undefined } })()
const sqliteIt = Database ? it : it.skip

describe('any-app imports: sniffing, harvesting, asking', () => {
  const lyrics = 'Amazing grace how sweet the sound\nThat saved a wretch like me\n\nI once was lost but now am found\nWas blind but now I see'
  sqliteIt('tells files apart by structure, not by the picker', async () => {
    const db = path.join(directory, 'library.db')
    const sqlite = new Database!(db)
    sqlite.exec("CREATE TABLE song (rowid INTEGER PRIMARY KEY, title TEXT, author TEXT); INSERT INTO song (title, author) VALUES ('Grace', 'Newton')")
    sqlite.close()
    expect((await detect({ name: 'whatever.bin', file: db })).kind).toBe('ew-songs')
    expect((await detect({ name: 'Sunday.pro6', file: await file('Sunday.pro6', pro6Fixture) })).kind).toBe('pro6')
    expect((await detect({ name: 'x.xml', file: await file('x.xml', pro6Fixture) })).kind).toBe('pro6')
    expect((await detect({ name: 'theme.json', file: await file('theme.json', '{"name":"Evening","text":{"fontSize":64}}') })).kind).toBe('theme')
    expect((await detect({ name: 'songs.json', file: await file('songs.json', '[{"title":"Grace","lyrics":"a\\nb"}]') })).kind).toBe('json')
    expect((await detect({ name: 'notes.txt', file: await file('notes.txt', 'Welcome everyone.') })).kind).toBe('text')
    expect((await detect({ name: 'blob.dat', file: await file('blob.dat', Buffer.from([0, 1, 2, 3, 0, 0, 7, 9, 0, 0, 0, 1])) })).kind).toBe('skip')
  })
  it('reads lyric shape and section markers from plain text', () => {
    expect(lyricShaped(lyrics)).toBe(true)
    expect(lyricShaped('Welcome everyone. Today we look at grace, and what it costs.\n\nSecond paragraph is also long prose with a full stop.')).toBe(false)
    const song = textSong('file', 'Amazing Grace\n\n[V1]\nline one\nline two\n\nChorus\nsing it')
    expect(song.title).toBe('Amazing Grace')
    expect(song.slides.map(slide => [slide.label, slide.text])).toEqual([['Verse 1', 'line one\nline two'], ['Chorus', 'sing it']])
  })
  it('asks about a lyric-shaped text file and imports it as a song once told', async () => {
    const txt = await file('Amazing Grace.txt', lyrics)
    const first = await convertForeign([txt]); converted.push(first.directory)
    expect(first.manifest.categories.songs).toBeUndefined()
    expect(unanswered(first.questions)).toHaveLength(1)
    expect(first.questions[0]).toMatchObject({ kind: 'text', file: 'Amazing Grace.txt', suggested: 'song' })
    const second = await convertForeign([txt], { answers: { [first.questions[0].id]: 'song' } }); converted.push(second.directory)
    expect(second.manifest.categories.songs?.[0].data.title).toBe('Amazing Grace')
    expect(second.manifest.categories.songs?.[0].data.sections).toHaveLength(2)
    expect(second.questions[0].answer).toBe('song')
    const third = await convertForeign([txt], { answers: { [first.questions[0].id]: 'note' } }); converted.push(third.directory)
    expect(third.manifest.categories.service?.[0].data.segments[0].items).toHaveLength(4)
  })
  sqliteIt('guesses an obvious song table, asks about an ambiguous one, and remembers the answer by structure', async () => {
    const obvious = path.join(directory, 'obvious.db')
    let sqlite = new Database!(obvious)
    sqlite.exec("CREATE TABLE tracks (id INTEGER PRIMARY KEY, name TEXT, body TEXT, added TEXT)")
    const insert = sqlite.prepare('INSERT INTO tracks (name, body, added) VALUES (?, ?, ?)')
    for (let i = 0; i < 5; i++) insert.run(`Song ${i}`, lyrics, '2026-01-01')
    sqlite.close()
    const auto = await convertForeign([obvious]); converted.push(auto.directory)
    expect(auto.manifest.categories.songs).toHaveLength(5)
    expect(auto.questions[0]).toMatchObject({ kind: 'table', answer: { title: 'name', lyrics: 'body' }, remembered: false })
    expect(auto.warnings.some(warning => warning.includes('guessing'))).toBe(true)

    const ambiguous = path.join(directory, 'ambiguous.db')
    sqlite = new Database!(ambiguous)
    sqlite.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, heading TEXT, label TEXT, body TEXT, extra TEXT)")
    const put = sqlite.prepare('INSERT INTO items (heading, label, body, extra) VALUES (?, ?, ?, ?)')
    for (let i = 0; i < 5; i++) put.run(`Heading ${i}`, `Label ${i}`, lyrics, `${lyrics}\nmore`)
    sqlite.close()
    const asked = await convertForeign([ambiguous]); converted.push(asked.directory)
    expect(asked.manifest.categories.songs).toBeUndefined()
    const question = unanswered(asked.questions)[0]
    expect(question).toMatchObject({ kind: 'table', columns: ['id', 'heading', 'label', 'body', 'extra'], rows: 5 })
    expect(question.signature).toMatch(/^sqlite:[a-f0-9]{64}$/)
    expect(question.preview[0]).not.toContain('\n')
    const answered = await convertForeign([ambiguous], { answers: { [question.id]: { title: 'label', lyrics: 'body' } } }); converted.push(answered.directory)
    expect(answered.manifest.categories.songs?.map(song => song.data.title)).toEqual(['Label 0', 'Label 1', 'Label 2', 'Label 3', 'Label 4'])
    // Same structure in another file, different content: the recipe applies without a question.
    const later = path.join(directory, 'later.db')
    sqlite = new Database!(later)
    sqlite.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, heading TEXT, label TEXT, body TEXT, extra TEXT); INSERT INTO items (heading, label, body, extra) VALUES ('h', 'Remembered song', 'line a\nline b', 'x')")
    sqlite.close()
    const remembered = await convertForeign([later], { recipes: { [question.signature!]: { title: 'label', lyrics: 'body' } } }); converted.push(remembered.directory)
    expect(unanswered(remembered.questions)).toHaveLength(0)
    expect(remembered.questions[0].remembered).toBe(true)
    expect(remembered.manifest.categories.songs?.[0].data.title).toBe('Remembered song')
    const skipped = await convertForeign([later, await file('sky.png', 'png')], { recipes: { [question.signature!]: 'skip' } }); converted.push(skipped.directory)
    expect(skipped.manifest.categories.songs).toBeUndefined()
    expect(skipped.manifest.categories.media).toHaveLength(1)
  })
  it('harvests song arrays from JSON and repeated records from XML', async () => {
    const json = await file('export.json', JSON.stringify({ library: { songs: [{ title: 'One', lyrics: ['la la', 'la la la'], id: 1 }, { title: 'Two', lyrics: ['do re mi', 'fa so'], id: 2 }] } }))
    const result = await convertForeign([json]); converted.push(result.directory)
    expect(result.manifest.categories.songs?.map(song => song.data.title)).toEqual(['One', 'Two'])
    expect(result.questions[0].signature).toMatch(/^json:/)
    const xml = await file('export.xml', '<library><song><name>Alpha</name><text>line one\nline two</text></song><song><name>Beta</name><text>line three\nline four</text></song></library>')
    const second = await convertForeign([xml]); converted.push(second.directory)
    expect(second.manifest.categories.songs?.map(song => song.data.title)).toEqual(['Alpha', 'Beta'])
  })
  it('reads OpenLyrics and OpenSong documents directly', async () => {
    const openLyrics = await file('grace.xml', '<song xmlns="http://openlyrics.info/namespace/2009/song"><properties><titles><title>Amazing Grace</title></titles><authors><author>John Newton</author></authors></properties><lyrics><verse name="v1"><lines>Amazing grace<br/>how sweet</lines></verse><verse name="c"><lines>Praise</lines></verse></lyrics></song>')
    const openSong = await file('mercy', '<song><title>Mercy</title><author>Test</author><lyrics>[V1]\n Line one\n.C   G\n Line two\n\n[C]\n Chorus line</lyrics></song>')
    const result = await convertForeign([openLyrics, openSong]); converted.push(result.directory)
    const songs = result.manifest.categories.songs!
    expect(songs.map(song => song.data.title)).toEqual(['Amazing Grace', 'Mercy'])
    expect(songs[0].data.authors).toEqual(['John Newton'])
    expect(songs[0].data.sections).toEqual([{ label: 'Verse 1', lines: ['Amazing grace', 'how sweet'] }, { label: 'Chorus', lines: ['Praise'] }])
    expect(songs[1].data.sections).toEqual([{ label: 'Verse 1', lines: ['Line one', 'Line two'] }, { label: 'Chorus', lines: ['Chorus line'] }])
    expect(unanswered(result.questions)).toHaveLength(0)
  })
  it('lists what it skipped instead of dropping it silently', async () => {
    const blob = await file('mystery.bin', Buffer.from([0, 1, 2, 3, 0, 0, 7, 9, 0, 0, 0, 1]))
    const result = await convertForeign([blob, await file('sky.png', 'png')]); converted.push(result.directory)
    expect(result.warnings.some(warning => warning.startsWith('mystery.bin:'))).toBe(true)
  })
})
