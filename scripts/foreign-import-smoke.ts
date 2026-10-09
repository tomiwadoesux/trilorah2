import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { parseEasyWorshipLibrary, parseEwsxDatabase } from '../electron/importers/easyworship'
import { convertForeign } from '../electron/importers/foreignImport'
import { zipFixture } from '../electron/importers/fixtures'
import { extractTri, inspectTri } from '../electron/packages/triArchive'
import { localPathFromUrl } from '../electron/media/mediaImport'

async function main() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'trilorah-ew-smoke-'))
  let preview: string | undefined
  try {
    const songsFile = path.join(dir, 'Songs.db'), wordsFile = path.join(dir, 'SongWords.db'), mainFile = path.join(dir, 'main.db')
    const songs = new Database(songsFile), words = new Database(wordsFile), schedule = new Database(mainFile)
    songs.exec('CREATE TABLE song (title TEXT, author TEXT, copyright TEXT, vendor_id TEXT)')
    songs.prepare('INSERT INTO song VALUES (?, ?, ?, ?)').run('Test song', 'Writer one;Writer two', 'Test credit', '123')
    words.exec('CREATE TABLE word (song_id INTEGER, words TEXT)')
    words.prepare('INSERT INTO word VALUES (?, ?)').run(1, String.raw`{\rtf1\ansi First line\par\par Chorus\par Caf\'e9 \u945?}`)
    songs.close(); words.close()
    const before = await fs.readFile(songsFile)
    const wordsBefore = await fs.readFile(wordsFile)
    const library = parseEasyWorshipLibrary(songsFile, wordsFile)
    assert.equal(library[0].slides[0].text, 'First line')
    assert.equal(library[0].slides[1].text, 'Café α')
    assert.deepEqual(library[0].authors, ['Writer one', 'Writer two'])
    assert.deepEqual(await fs.readFile(songsFile), before)
    assert.deepEqual(await fs.readFile(wordsFile), wordsBefore)
    schedule.exec(`CREATE TABLE presentation (title TEXT, author TEXT, copyright TEXT, reference_number TEXT, presentation_type INTEGER);
      CREATE TABLE slide (presentation_id INTEGER, order_index INTEGER);
      CREATE TABLE element (slide_id INTEGER, foreground_resource_id INTEGER, element_type INTEGER, element_style_type INTEGER);
      CREATE TABLE resource_text (resource_id INTEGER, rtf TEXT);`)
    schedule.prepare('INSERT INTO presentation VALUES (?, ?, ?, ?, ?)').run('Schedule song', 'Writer', 'Credit', '456', 6)
    schedule.prepare('INSERT INTO slide VALUES (?, ?)').run(1, 2)
    schedule.prepare('INSERT INTO slide VALUES (?, ?)').run(1, 1)
    schedule.prepare('INSERT INTO element VALUES (?, ?, ?, ?)').run(1, 10, 6, 4)
    schedule.prepare('INSERT INTO element VALUES (?, ?, ?, ?)').run(2, 11, 6, 4)
    schedule.prepare('INSERT INTO resource_text VALUES (?, ?)').run(10, String.raw`{\rtf1 Chorus\par Sing together}`)
    schedule.prepare('INSERT INTO resource_text VALUES (?, ?)').run(11, String.raw`{\rtf1 Verse 1\par Start here}`)
    schedule.close()
    const scheduleBefore = await fs.readFile(mainFile)
    assert.deepEqual(parseEwsxDatabase(mainFile)[0].slides.map(slide => slide.text), ['Start here', 'Sing together'])
    assert.deepEqual(await fs.readFile(mainFile), scheduleBefore)
    const archive = path.join(dir, 'Sunday.ewsx')
    await fs.writeFile(archive, zipFixture([{ name: 'main.db', data: await fs.readFile(mainFile) }, { name: 'Resources/sky.jpg', data: Buffer.from('portable image') }]))
    const result = await convertForeign([archive]); preview = result.directory
    assert.equal(result.manifest.categories.songs?.[0].data.sections[0].lines[0], 'Start here')
    assert.equal(result.manifest.assets.length, 1)
    assert.equal(result.manifest.categories.service, undefined)
    assert.deepEqual(await inspectTri(result.file), result.manifest)
    const wrapper = path.join(dir, 'Transfer.zip')
    await fs.writeFile(wrapper, zipFixture([{ name: 'Sunday.ewsx', data: await fs.readFile(archive) }]))
    const wrapped = await convertForeign([wrapper])
    try {
      assert.equal(wrapped.manifest.categories.songs?.[0].data.sections[0].lines[0], 'Start here')
      assert.equal(wrapped.manifest.assets.length, 1)
    } finally { await fs.rm(wrapped.directory, { recursive: true, force: true }) }
    await fs.rm(archive)
    const imported = await extractTri(result.file, path.join(dir, 'destination'))
    assert.equal(await fs.readFile(localPathFromUrl(imported.categories.media![0].data.url), 'utf8'), 'portable image')
    // A lyric that begins with a section word is still a lyric, not a section heading.
    const editSchedule = new Database(mainFile)
    editSchedule.prepare('UPDATE resource_text SET rtf=? WHERE resource_id=11').run(String.raw`{\rtf1 Chorus of angels singing\par Start here}`)
    editSchedule.close()
    assert.equal(parseEwsxDatabase(mainFile)[0].slides[0].text, 'Chorus of angels singing\nStart here')
    // EasyWorship's own tags include Slide/End and parenthetical leader notes.
    const editWords = new Database(wordsFile)
    editWords.prepare('UPDATE word SET words=? WHERE song_id=1').run(String.raw`{\rtf1 Verse 1 (Leader)\par First line\par\par Slide 2\par Second line\par\par End}`)
    editWords.close()
    assert.deepEqual(parseEasyWorshipLibrary(songsFile, wordsFile)[0].slides.map(slide => [slide.label, slide.text]), [
      ['Verse 1 (Leader)', 'First line'], ['Slide 2', 'Second line'], ['End', ''],
    ])
    // One damaged song must not discard every healthy song in a database.
    const editSongs = new Database(songsFile), corruptWords = new Database(wordsFile)
    editSongs.prepare('INSERT INTO song VALUES (?, ?, ?, ?)').run('Damaged song', '', '', '')
    editSongs.prepare('INSERT INTO song VALUES (?, ?, ?, ?)').run('Healthy song', 'Writer One, Writer Two', '', '')
    corruptWords.prepare('INSERT INTO word VALUES (?, ?)').run(2, String.raw`{\rtf1 Unclosed`)
    corruptWords.prepare('INSERT INTO word VALUES (?, ?)').run(3, String.raw`{\rtf1 Verse 1\par Still here}`)
    editSongs.close(); corruptWords.close()
    const recovered = parseEasyWorshipLibrary(songsFile, wordsFile)
    assert.equal(recovered.find(song => song.title === 'Healthy song')?.slides[0].text, 'Still here')
    assert.deepEqual(recovered.find(song => song.title === 'Healthy song')?.authors, ['Writer One', 'Writer Two'])
    assert.match(recovered.find(song => song.title === 'Damaged song')?.warnings.join(' ') ?? '', /incomplete/i)
    const partial = await convertForeign([songsFile, wordsFile])
    try {
      assert.deepEqual(partial.manifest.categories.songs?.map(song => song.label), ['Test song', 'Healthy song'])
      assert.ok(partial.warnings.some(warning => /Damaged song:.*incomplete/i.test(warning)))
    } finally { await fs.rm(partial.directory, { recursive: true, force: true }) }
    // Preserve legacy code-page bytes stored as SQLite BLOBs.
    const rawWords = new Database(wordsFile)
    rawWords.prepare('UPDATE word SET words=? WHERE song_id=3').run(Buffer.from('{\\rtf1\\ansi\\ansicpg1252 Verse 1\\par Caf\xe9}', 'latin1'))
    rawWords.close()
    assert.equal(parseEasyWorshipLibrary(songsFile, wordsFile).find(song => song.title === 'Healthy song')?.slides[0].text, 'Café')
    // Never silently truncate a song at a safety limit.
    const excessiveWords = new Database(wordsFile)
    excessiveWords.prepare('DELETE FROM word WHERE song_id=2').run()
    const insert = excessiveWords.prepare('INSERT INTO word VALUES (?, ?)')
    excessiveWords.transaction(() => { for (let i = 0; i < 10_001; i++) insert.run(2, '') })()
    excessiveWords.close()
    const bounded = parseEasyWorshipLibrary(songsFile, wordsFile)
    assert.match(bounded.find(song => song.title === 'Damaged song')?.warnings.join(' ') ?? '', /too many lyric records/)
    assert.equal(bounded.find(song => song.title === 'Healthy song')?.slides[0].text, 'Café')
    const badSchedule = new Database(mainFile)
    badSchedule.prepare('INSERT INTO presentation VALUES (?, ?, ?, ?, ?)').run('Damaged schedule song', '', '', '', 6)
    badSchedule.prepare('INSERT INTO slide VALUES (?, ?)').run(2, 1)
    badSchedule.prepare('INSERT INTO element VALUES (?, ?, ?, ?)').run(3, 12, 6, 4)
    badSchedule.prepare('INSERT INTO resource_text VALUES (?, ?)').run(12, String.raw`{\rtf1 Unclosed`)
    badSchedule.close()
    const recoveredSchedule = parseEwsxDatabase(mainFile)
    assert.equal(recoveredSchedule[0].slides[0].text, 'Chorus of angels singing\nStart here')
    assert.match(recoveredSchedule[1].warnings.join(' '), /incomplete/i)
    console.log('Native EasyWorship checks passed: library pair, Unicode/BLOB encodings, slide order, nested archives, packed media, unchanged sources, source-independent import, strict headings/blank tags, damaged-song recovery, and lyric limits.')
  } finally { await fs.rm(dir, { recursive: true, force: true }); if (preview) await fs.rm(preview, { recursive: true, force: true }) }
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
