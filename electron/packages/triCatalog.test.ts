import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { TriRendererState } from '../../shared/triBridge'
import type { TriSelection, TriSnapshot } from '../../shared/triPackage'
import { buildTriCatalog, selectTriContent } from './triCatalog'

let dir: string
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trilorah-tri-catalog-')) })
afterEach(() => {
  const resolved = path.resolve(dir)
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('trilorah-tri-catalog-')) throw new Error('Unexpected test directory')
  fs.rmSync(resolved, { recursive: true, force: true })
})

function save(relative: string, value: unknown) {
  const file = path.join(dir, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value))
}

function renderer(): TriRendererState {
  return {
    run: [{ key: 'worship', type: 'worship', label: 'Worship', startMin: 600, durationMin: 20, items: [
      { key: 'song', source: 'song', label: 'Grace', title: 'Grace', songId: 'song-1', lines: ['Amazing grace'] },
      { key: 'media', source: 'media', label: 'Welcome', path: 'local-media://file/C:/Church/Welcome%20home.png' },
      { key: 'deck', source: 'presentation', label: 'Sermon slide 2', title: 'Grace and Faith', path: 'file:///C:/Church/sermon/slide2.png' },
      { key: 'note', source: 'note', label: 'Introduce Pastor Anne' },
    ] }],
    media: [
      { id: 'welcome', label: 'Welcome', url: 'C:\\Church\\Welcome home.png', kind: 'photo' },
      { id: 'background', label: 'Sermon background', url: 'C:\\Church\\Sea.jpg', kind: 'photo' },
      { id: 'unused-media', label: 'Unused', url: 'C:\\Church\\Other.jpg', kind: 'photo' },
    ],
    customDecks: [{ id: 'custom-1', title: 'Announcements', spec: { title: 'Church notices', sections: [{ heading: 'Next week', bullets: ['Bring lunch'] }] } }],
    theme: { backgroundId: 'background', layout: 'top', safeMargin: 7, font: 'serif', refGap: 0.7 },
  }
}

function fixture(): TriSnapshot {
  save('presentations.json', [
    { id: 'pres-1', title: 'Grace and Faith', slides: ['C:\\Church\\sermon\\slide1.png', 'C:\\Church\\sermon\\slide2.png'], pptxPath: 'C:\\Church\\sermon.pptx' },
    { id: 'pres-unrelated', title: 'Unrelated deck', slides: ['C:\\Church\\unused.png'] },
  ])
  save('preacher-profiles/anne.json', { id: 'anne', name: 'Pastor Anne', favoriteVerses: [{ ref: 'John 3:16', frequency: 12 }], sermonHistory: [] })
  save('preacher-teaching/anne.json', { soundsLike: [{ heard: 'rome and', means: 'Romans', source: 'taught', hits: 0 }], vocabulary: ['Ayotomiwa'], ignoreTails: ['amen'], voiceCommands: true })
  save('preacher-ledgers/anne.json', { preacherId: 'anne', name: 'Pastor Anne', samples: [{ heard: 'rome and eight one', correctedTo: 'Romans 8:1', source: 'operator', ts: 123 }], services: [{ id: 'verified', verificationVersion: 2, detections: 100, confirmed: 98, corrections: 2 }], aliases: { rmnd: 'Romans' }, mature: true, autoModeEnabled: true, reviews: [{ id: 'review-1', preacherId: 'anne', heard: 'first john four eight' }] })
  save('vocabulary/anne.json', { terms: ['Ayotomiwa'] })
  save('preacher-commands/anne.json', { navNext: ['move forward'], ignoreTails: ['amen'] })
  save('command-log/anne.json', { preacherId: 'anne', entries: [], neverTreatAsCommand: ['move forward in faith'] })
  for (const libraryId of ['songs', 'media', 'presentations']) save(`library-folders/${libraryId}.json`, {
    version: 1, folders: [{ id: 'folder-1', name: 'Sunday', order: 0, createdAt: 1 }], items: { 'song-1': 'folder-1', welcome: 'folder-1', 'pres-1': 'folder-1' },
  })
  save('service-logs/service-sunday.json', { date: '2026-10-03', segments: [{ type: 'sermon', duration: 30 }], stats: { totalScriptures: 10 } })
  return buildTriCatalog(dir, {
    churchName: 'Grace Church', churchLogoUrl: 'C:\\Church\\logo.png', churchBrandColor: '#007755', givingCustomUrl: 'https://example.org/give', publicWebUrl: 'https://example.org',
    defaultFontFamily: 'Georgia', defaultFontSize: 1.2, verseLayout: 'top', safeMargin: 7, outputRoles: { main: 'projector' },
    timers: [{ id: 'countdown', name: 'Welcome', kind: 'countdown', durationSec: 300, overrun: true }], scheduleTemplates: [{ name: 'Sunday', entries: [] }], alertPresets: ['Welcome'], serviceStartTime: '10:00',
    deepgramApiKey: 'secret-deepgram', hfToken: 'secret-hf', obsPassword: 'secret-obs', accountSlug: 'private-account', outputDisplays: { main: 9831 }, remotePairToken: 'secret-remote', asrDevice: 'private-microphone', autoModeMinTrust: 0.1,
  }, renderer(), [
    { id: 'song-1', title: 'Grace', sections: [{ label: 'Verse 1', lines: ['Amazing grace'] }], authors: ['John Newton'], origin: 'manual' },
    { id: 'song-unused', title: 'Unrelated song', sections: [], origin: 'manual' },
  ], [{ id: 'transcript-1', label: 'Saved sermon notes', data: { kind: 'notes', text: 'Faith and grace' } }])
}

describe('portable content catalog', () => {
  it('keeps the actual profile learning stores, layout and records while excluding unrelated settings', () => {
    const snapshot = fixture()
    const preacher = snapshot.categories.preachers![0]
    expect(preacher.data.profile.favoriteVerses[0].frequency).toBe(12)
    expect(preacher.data.teaching.soundsLike[0].means).toBe('Romans')
    expect(preacher.data.ledger.services[0].confirmed).toBe(98)
    expect(preacher.data.ledger.samples[0].correctedTo).toBe('Romans 8:1')
    expect(preacher.data.ledger.reviews[0].id).toBe('review-1')
    expect(preacher.data.vocabulary.terms).toEqual(['Ayotomiwa'])
    expect(preacher.data.commands.navNext).toEqual(['move forward'])
    expect(preacher.data.commandLog.neverTreatAsCommand).toEqual(['move forward in faith'])
    expect(snapshot.categories.themes!.find(item => item.id === 'layout')!.data).toEqual(renderer().theme)
    expect(snapshot.categories.presentations!.find(item => item.id === 'pres-1')!.data.value.slides).toHaveLength(2)
    expect(snapshot.categories.records!.find(item => item.id === 'service-log:service-sunday.json')!.data.value.stats.totalScriptures).toBe(10)
    expect(snapshot.categories.records!.find(item => item.id === 'transcript-1')!.data.text).toBe('Faith and grace')
    const serialized = JSON.stringify(snapshot)
    for (const excluded of ['secret-', 'private-account', 'private-microphone', 'outputRoles', 'outputDisplays', 'autoModeMinTrust', 'accountSlug']) expect(serialized).not.toContain(excluded)
  })

  it('preserves staged imported display appearance when exporting before it has gone live', () => {
    const snapshot = buildTriCatalog(dir, {
      defaultTextColor: '#ffffff', textTransition: 'fade',
      triThemeDisplay: { defaultTextColor: '#aabbcc', textTransition: 'slide', hfToken: 'secret-staged' },
    }, { run: [], media: [], customDecks: [] }, [])
    const display = snapshot.categories.themes!.find(item => item.id === 'display')!.data
    expect(display).toEqual({ defaultTextColor: '#aabbcc', textTransition: 'slide' })
  })

  it('recovers only confidently identified orphan learning without discarding its evidence', () => {
    save('preacher-ledgers/guest.json', { preacherId: 'guest', name: 'Guest Pastor', samples: [{ heard: 'rome and', correctedTo: 'Romans' }], services: [] })
    save('preacher-ledgers/unnamed.json', { preacherId: 'unnamed', name: '', samples: [], services: [] })
    const snapshot = buildTriCatalog(dir, {}, { run: [], media: [], customDecks: [] }, [])
    expect(snapshot.categories.preachers!.map(item => item.id)).toEqual(['guest'])
    expect(snapshot.categories.preachers![0].data.profile.name).toBe('Guest Pastor')
    expect(snapshot.categories.preachers![0].data.ledger.samples[0].correctedTo).toBe('Romans')
  })

  it.each([
    ['presentations.json', '{'],
    ['presentations.json', '{}'],
    ['preacher-profiles/anne.json', 'null'],
    ['preacher-ledgers/anne.json', '{'],
    ['service-logs/sunday.json', '[]'],
    ['library-folders/songs.json', '{"folders":[],"items":null}'],
  ])('does not silently omit corrupt saved content in %s', (relative, contents) => {
    const file = path.join(dir, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, contents)
    expect(() => buildTriCatalog(dir, {}, { run: [], media: [], customDecks: [] }, [])).toThrow('Could not read saved content')
  })

  it('refuses a preacher whose linked learning belongs to another identity', () => {
    save('preacher-profiles/anne.json', { id: 'anne', name: 'Anne' })
    save('command-log/anne.json', { preacherId: 'other', entries: [] })
    expect(() => buildTriCatalog(dir, {}, { run: [], media: [], customDecks: [] }, [])).toThrow('Could not read saved content')
  })
})

describe('package dependency selection', () => {
  it('copies a service with matching songs/media/whole decks and selected theme background, without unrelated pastors', () => {
    const snapshot = fixture()
    const selected = selectTriContent(snapshot, { service: ['current'], themes: ['layout'] })
    expect(selected.categories.service![0].data.segments[0].startMin).toBe(600)
    expect(selected.categories.songs!.map(item => item.id)).toEqual(['song-1'])
    expect(selected.categories.media!.map(item => item.id)).toEqual(['welcome', 'background'])
    expect(selected.categories.presentations!.map(item => item.id)).toEqual(['pres-1'])
    expect(selected.categories.presentations![0].data.value.slides).toHaveLength(2)
    expect(selected.categories.folders!.map(item => item.id)).toEqual(['songs', 'media', 'presentations'])
    expect(selected.categories.preachers).toBeUndefined()
    expect(selected.categories.records).toBeUndefined()
    expect(selected.categories.church).toBeUndefined()
    expect(selected.categories.tools).toBeUndefined()
    selected.categories.songs![0].data.title = 'Changed copy'
    expect(snapshot.categories.songs![0].data.title).toBe('Grace')
  })

  it('refreshes dependencies for a newly changed current run and skips deleted selection IDs', () => {
    const snapshot = fixture()
    const selection: TriSelection = { service: ['current'], songs: ['deleted-song'], media: ['deleted-media'] }
    snapshot.categories.service![0].data.segments[0].items = [{ key: 'new', source: 'song', songId: 'song-unused', title: 'Unrelated song' }]
    const selected = selectTriContent(snapshot, selection)
    expect(selected.categories.songs!.map(item => item.id)).toEqual(['song-unused'])
    expect(selected.categories.media).toBeUndefined()
    expect(selected.categories.presentations).toBeUndefined()
  })

  it('uses presentation title fallback for custom decks when there are no matching file paths', () => {
    const snapshot = fixture()
    snapshot.categories.service![0].data.segments[0].items = [{ key: 'custom', source: 'presentation', title: 'Announcements', label: 'Announcements' }]
    const selected = selectTriContent(snapshot, { service: ['current'] })
    expect(selected.categories.presentations!.map(item => item.id)).toEqual(['custom-1'])
    expect(selected.categories.presentations![0].data.value.spec.sections[0].bullets).toEqual(['Bring lunch'])
  })

  it('prefers an asset match to a same-title deck and matches POSIX file/display URLs', () => {
    const snapshot: TriSnapshot = { categories: {
      service: [{ id: 'current', label: 'Current', data: { segments: [{ items: [{ source: 'presentation', title: 'Sunday', path: 'local-media://file/home/church/deck%201.png' }] }] } }],
      presentations: [
        { id: 'matching', label: 'Sunday', data: { kind: 'imported', value: { title: 'Sunday', slides: ['file:///home/church/deck%201.png'] } } },
        { id: 'other', label: 'Sunday', data: { kind: 'imported', value: { title: 'Sunday', slides: ['/home/church/other.png'] } } },
      ],
    } }
    expect(selectTriContent(snapshot, { service: ['current'] }).categories.presentations!.map(item => item.id)).toEqual(['matching'])
  })

  it('lets a preacher-only package carry its evidence without copying a service or church data', () => {
    const snapshot = fixture()
    const selected = selectTriContent(snapshot, { preachers: ['anne'] })
    expect(Object.keys(selected.categories)).toEqual(['preachers'])
    expect(selected.categories.preachers![0].data.ledger.samples).toEqual(snapshot.categories.preachers![0].data.ledger.samples)
  })

  it('reconnects archive references for the same asset saved in path and URL forms', () => {
    const hash = 'a'.repeat(64)
    const snapshot: TriSnapshot = { categories: {
      service: [{ id: 'current', label: 'Current', data: { segments: [{ items: [{ source: 'media', path: `tri-asset:${hash}:path` }] }] } }],
      media: [{ id: 'photo', label: 'Welcome', data: { id: 'photo', label: 'Welcome', url: `tri-asset:${hash}:url` } }],
    } }
    expect(selectTriContent(snapshot, { service: ['current'] }).categories.media!.map(item => item.id)).toEqual(['photo'])
  })

  it('ignores unknown categories and never follows a preacher ID from a service', () => {
    const snapshot = fixture()
    snapshot.categories.service![0].data.segments[0].preacherId = 'anne'
    const selected = selectTriContent(snapshot, { service: ['current'], unknown: ['x'], __proto__: ['x'] } as TriSelection)
    expect(selected.categories.preachers).toBeUndefined()
    expect((selected.categories as any).unknown).toBeUndefined()
  })
})
