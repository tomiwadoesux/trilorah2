import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { commitTriImport, planTriImport } from './triImport'
import { CorrectionLedger } from '../preachers/correctionLedger'
import { TeachingStore } from '../preachers/teaching'
import type { TriSnapshot } from '../../shared/triPackage'

let dir: string
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tri-import-')) })
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(dir, { recursive: true, force: true }) })
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))
function save(relative: string, value: any) {
  const file = path.join(dir, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value))
  return file
}
function incoming(): TriSnapshot {
  return { categories: {
    songs: [{ id: 'song', label: 'Amazing Grace', data: { id: 'song', title: 'Amazing Grace', sections: [{ label: 'Verse 1', lines: ['Amazing grace'] }], seedKey: 'old-seed' } }],
    media: [{ id: 'media', label: 'Church photo', data: { id: 'media', label: 'Church photo', url: 'local-media://file/package/photo.png' } }],
    presentations: [{ id: 'deck', label: 'Announcements', data: { kind: 'imported', value: { id: 'deck', title: 'Announcements', slides: ['package/slide.png'] } } }],
    themes: [
      { id: 'layout', label: 'Layout', data: { backgroundId: 'media', textAlign: 'left', refGap: 12 } },
      { id: 'display', label: 'Appearance', data: { defaultFontSize: 60, overlayOpacity: 0.4 } },
    ],
    preachers: [{ id: 'pastor', label: 'Pastor James', data: {
      profile: { id: 'pastor', name: 'Pastor James', favoriteVerses: [{ ref: 'John 3:16', frequency: 5 }], commonTopics: ['Faith'], speechPatterns: [], createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-03T10:00:00Z', sermonHistory: [{ date: '2026-10-01', title: 'Living faith', versesUsed: ['John 3:16'], topics: ['Faith'], durationMinutes: 30 }] },
      teaching: { soundsLike: [{ heard: 'rome and', means: 'Romans', source: 'taught', hits: 5 }], vocabulary: ['Ayotomiwa'], ignoreTails: ['amen'], voiceCommands: true },
      vocabulary: { terms: ['Ayotomiwa'] },
      commands: { navNext: ['continue to the next verse'] },
      commandLog: { preacherId: 'pastor', entries: [{ id: 'command', preacherId: 'pastor', kind: 'navigate-next', utterance: 'continue to the next verse', ts: 1 }], neverTreatAsCommand: ['the next generation'] },
      ledger: { preacherId: 'pastor', name: 'Pastor James', samples: [{ heard: 'rome and', correctedTo: 'Romans', source: 'operator', ts: 1 }], services: [{ id: 'service-evidence', date: '2026-10-01', detections: 50, confirmed: 49, corrections: 1, endedAt: 10, verificationVersion: 1 }], aliases: { rmnd: 'Romans' }, mature: true, matureSince: '2026-10-01T10:00:00Z', autoModeEnabled: true, verificationVersion: 1, activeService: { date: '2026-10-03', detections: 1, confirmed: 1, corrections: 0 }, reviews: [{ id: 'review', preacherId: 'pastor', status: 'confirmed', text: 'Romans 1' }] },
    } }],
    service: [{ id: 'current', label: 'Sunday', data: { segments: [{ key: 'segment', type: 'worship', label: 'Worship', startMin: 600, durationMin: 30, items: [{ key: 'song-row', source: 'song', label: 'Amazing Grace', songId: 'song' }, { key: 'deck-row', source: 'presentation', label: 'Announcements', deckId: 'deck', path: 'package/slide.png' }] }] } }],
    folders: [{ id: 'songs', label: 'Song folders', data: { libraryId: 'songs', version: 1, folders: [{ id: 'folder', name: 'Hymns', color: '#abcdef', order: 0 }], items: { song: 'folder' } } }],
    church: [{ id: 'identity', label: 'Church', data: { churchName: 'Visiting church', deepgramApiKey: 'package-secret', outputDisplayId: 99 } }],
    tools: [{ id: 'settings', label: 'Tools', data: { alertDefaultSeconds: 20, hfToken: 'package-secret', autoModeEnabled: true } }],
    records: [{ id: 'service-log:old.json', label: 'Past service', data: { kind: 'service-log', filename: 'old.json', value: { date: '2026-10-01', preacherId: 'pastor', versesShown: ['John 3:16'] } } }],
  } }
}

describe('.tri import planning and commit', () => {
  it('keeps destination libraries and copies full preacher learning under fresh connected identities', () => {
    const oldSong = { id: 'song', title: 'Existing local song', sections: [] }
    const songFile = save('songs.json', { version: 1, songs: [oldSong], deletedSeeds: ['keep-deleted'] })
    const oldDeck = { id: 'deck', title: 'Existing local deck', slides: [] }
    const deckFile = save('presentations.json', [oldDeck])
    const profileFile = save('preacher-profiles/pastor.json', { id: 'pastor', name: 'Existing local pastor' })
    const ledgerFile = save('preacher-ledgers/pastor.json', { preacherId: 'pastor', samples: ['local evidence'] })
    const existingBytes = [profileFile, ledgerFile].map(file => fs.readFileSync(file))
    const folderFile = save('library-folders/songs.json', { version: 1, folders: [{ id: 'folder', name: 'Local favourites' }], items: { song: 'folder' } })
    let settings: Record<string, any> = { deepgramApiKey: 'local-secret', outputDisplayId: 3, triRendererState: { media: [{ id: 'media', label: 'Local photo' }], customDecks: [] }, operatorRunV1: { segments: [{ key: 'existing', type: 'sermon', label: 'Existing', items: [] }] } }
    const source = incoming(), untouched = structuredClone(source)
    const plan = planTriImport(dir, source, settings, false)
    expect(source).toEqual(untouched)
    commitTriImport(plan, () => settings, value => { settings = value })
    const imported = plan.snapshot.categories
    const songId = imported.songs![0]!.id, mediaId = imported.media![0]!.id, deckId = imported.presentations![0]!.id, pastorId = imported.preachers![0]!.id
    for (const id of [songId, mediaId, deckId, pastorId]) expect(id).toMatch(/^tri-/)
    expect(read(songFile).songs[0]).toEqual(oldSong)
    expect(read(songFile).deletedSeeds).toEqual(['keep-deleted'])
    expect(read(songFile).songs[1]).toMatchObject({ id: songId, title: 'Amazing Grace' })
    expect(read(songFile).songs[1].seedKey).toBeUndefined()
    expect(read(deckFile)[0]).toEqual(oldDeck)
    expect(read(deckFile)[1].id).toBe(deckId)
    expect(settings.triRendererState.media.map((item: any) => item.id)).toEqual(['media', mediaId])
    expect(settings.triThemeLayout).toMatchObject({ backgroundId: mediaId, textAlign: 'left', refGap: 12 })
    expect(settings.operatorRunV1.segments[0].key).toBe('existing')
    const run = settings.operatorRunV1.segments[1]
    expect(run).toMatchObject({ startMin: 600, durationMin: 30 })
    expect(run.key).not.toBe('segment')
    expect(run.items[0].songId).toBe(songId)
    expect(run.items[1].deckId).toBe(deckId)
    expect(read(folderFile).items.song).toBe('folder')
    const importedFolder = read(folderFile).folders[1]
    expect(importedFolder).toMatchObject({ name: 'Hymns', color: '#abcdef' })
    expect(read(folderFile).items[songId]).toBe(importedFolder.id)
    expect([profileFile, ledgerFile].map(file => fs.readFileSync(file))).toEqual(existingBytes)
    expect(read(path.join(dir, 'preacher-profiles', `${pastorId}.json`))).toMatchObject({ id: pastorId, name: 'Pastor James', favoriteVerses: [{ ref: 'John 3:16', frequency: 5 }], commonTopics: ['Faith'] })
    const evidence = read(path.join(dir, 'preacher-ledgers', `${pastorId}.json`))
    expect(evidence.samples).toEqual(untouched.categories.preachers![0]!.data.ledger.samples)
    expect(evidence.services).toEqual(untouched.categories.preachers![0]!.data.ledger.services)
    expect(evidence.aliases).toEqual({ rmnd: 'Romans' })
    expect(evidence.matureSince).toBe('2026-10-01T10:00:00Z')
    expect(evidence.autoModeEnabled).toBe(false)
    expect(evidence.activeService).toBeUndefined()
    expect(evidence.reviews[0].preacherId).toBe(pastorId)
    const ledger = new CorrectionLedger(path.join(dir, 'preacher-ledgers'))
    expect(ledger.isAutoModeEnabled(pastorId)).toBe(false)
    expect(ledger.load(pastorId).samples).toEqual(evidence.samples)
    const teaching = new TeachingStore(path.join(dir, 'preacher-teaching')).get(pastorId)
    expect(teaching.soundsLike[0]).toMatchObject({ heard: 'rome and', means: 'Romans' })
    expect(teaching.vocabulary).toEqual(['Ayotomiwa'])
    expect(read(path.join(dir, 'preacher-teaching', `${pastorId}.json`)).soundsLike[0].hits).toBe(5)
    expect(read(path.join(dir, 'vocabulary', `${pastorId}.json`))).toEqual({ terms: ['Ayotomiwa'] })
    expect(read(path.join(dir, 'preacher-commands', `${pastorId}.json`))).toEqual({ navNext: ['continue to the next verse'] })
    expect(read(path.join(dir, 'command-log', `${pastorId}.json`)).entries[0].preacherId).toBe(pastorId)
    expect(settings.deepgramApiKey).toBe('local-secret')
    expect(settings.outputDisplayId).toBe(3)
    expect(settings.hfToken).toBeUndefined()
    expect(settings.autoModeEnabled).toBeUndefined()
    expect(settings.churchName).toBe('Visiting church')
  })

  it('opens a service by replacing the run but ordinary import appends it', () => {
    const source = { categories: { service: incoming().categories.service } }
    const local = { operatorRunV1: { segments: [{ key: 'local', type: 'sermon', label: 'Local', items: [] }] } }
    expect((planTriImport(dir, source, local, false).settings.operatorRunV1 as any).segments).toHaveLength(2)
    const opened = planTriImport(dir, source, local, true)
    expect((opened.settings.operatorRunV1 as any).segments).toHaveLength(1)
    expect((opened.settings.operatorRunV1 as any).segments[0].label).toBe('Worship')
    expect(local.operatorRunV1.segments[0].key).toBe('local')
  })

  it.each([false, true])('retains every selected service in source order when openService is %s', (openService) => {
    const source: TriSnapshot = { categories: { service: ['First', 'Second'].map(label => ({
      id: label, label, data: { segments: [{ key: label, type: 'custom', label, items: [] }] },
    })) } }
    const local = { operatorRunV1: { segments: [{ key: 'local', type: 'custom', label: 'Local', items: [] }] } }
    const plan = planTriImport(dir, source, local, openService)
    expect((plan.settings.operatorRunV1 as any).segments.map((segment: any) => segment.label)).toEqual(openService ? ['First', 'Second'] : ['Local', 'First', 'Second'])
    expect(plan.snapshot.categories.service).toHaveLength(1)
    expect(plan.snapshot.categories.service![0].id).toBe('current')
    expect(plan.snapshot.categories.service![0].data.segments.map((segment: any) => segment.label)).toEqual(['First', 'Second'])
    expect(source.categories.service).toHaveLength(2)
    expect(local.operatorRunV1.segments.map(segment => segment.label)).toEqual(['Local'])
  })

  it('stores service record contents in the format the destination reader expects', () => {
    const source = { categories: { records: incoming().categories.records } }
    const plan = planTriImport(dir, source, {}, false)
    commitTriImport(plan, () => ({}), () => {})
    const files = fs.readdirSync(path.join(dir, 'service-logs'))
    expect(read(path.join(dir, 'service-logs', files[0]!))).toEqual({ date: '2026-10-01', preacherId: 'pastor', versesShown: ['John 3:16'] })
  })

  it('limits staged display settings to portable appearance keys', () => {
    const source: TriSnapshot = { categories: { themes: [{ id: 'display', label: 'Appearance', data: { defaultFontSize: 48, outputDisplayId: 999, deepgramApiKey: 'package-secret', hfToken: 'package-secret' } }] } }
    const plan = planTriImport(dir, source, { defaultFontSize: 64 }, false)
    expect(plan.settings.triThemeDisplay).toEqual({ defaultFontSize: 48 })
    expect(plan.settings.defaultFontSize).toBeUndefined()
  })

  it('rejects malformed selected content before changing any destination files', () => {
    const songFile = save('songs.json', { version: 1, songs: [], deletedSeeds: [] })
    const before = fs.readFileSync(songFile)
    const source = incoming()
    source.categories.songs![0]!.data.sections = [{ label: 'Verse', lines: [null] }]
    expect(() => planTriImport(dir, source, {}, false)).toThrow(/Invalid song lyrics/)
    expect(fs.readFileSync(songFile)).toEqual(before)
    expect(fs.readdirSync(dir)).toEqual(['songs.json'])
    const badLearning: TriSnapshot = { categories: { preachers: incoming().categories.preachers } }
    badLearning.categories.preachers![0]!.data.teaching.soundsLike = 'not a list'
    expect(() => planTriImport(dir, badLearning, {}, false)).toThrow()
    expect(fs.readdirSync(dir)).toEqual(['songs.json'])
  })

  it('restores original bytes and removes newly written files when a later rename fails', () => {
    const songFile = save('songs.json', { version: 1, songs: [{ id: 'local', title: 'Keep local' }], deletedSeeds: [] })
    const before = fs.readFileSync(songFile)
    const source: TriSnapshot = { categories: { songs: incoming().categories.songs, presentations: incoming().categories.presentations } }
    let settings: Record<string, any> = { deepgramApiKey: 'local-secret' }
    const originalSettings = structuredClone(settings)
    const plan = planTriImport(dir, source, settings, false)
    const realRename = fs.renameSync
    let calls = 0
    vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (++calls === 2) throw new Error('simulated disk failure')
      realRename(from, to)
    })
    expect(() => commitTriImport(plan, () => settings, value => { settings = value })).toThrow(/simulated disk failure/)
    expect(fs.readFileSync(songFile)).toEqual(before)
    expect(fs.existsSync(path.join(dir, 'presentations.json'))).toBe(false)
    expect(settings).toEqual(originalSettings)
    expect(fs.readdirSync(dir)).toEqual(['songs.json'])
  })

  it('rolls back committed library files when settings persistence fails', () => {
    const songFile = save('songs.json', { version: 1, songs: [], deletedSeeds: [] })
    const before = fs.readFileSync(songFile)
    const source: TriSnapshot = { categories: { songs: incoming().categories.songs, media: incoming().categories.media } }
    let settings: Record<string, any> = { churchName: 'Local church' }
    const originalSettings = structuredClone(settings)
    const plan = planTriImport(dir, source, settings, false)
    let calls = 0
    expect(() => commitTriImport(plan, () => settings, value => {
      if (++calls === 1) throw new Error('simulated settings failure')
      settings = value
    })).toThrow(/simulated settings failure/)
    expect(fs.readFileSync(songFile)).toEqual(before)
    expect(settings).toEqual(originalSettings)
    expect(fs.readdirSync(dir)).toEqual(['songs.json'])
  })
})
