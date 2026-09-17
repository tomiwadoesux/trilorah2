import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SongStore, normaliseTitle } from './store'
import { SEED_HYMNS, SEED_AUTHOR_DIED_BEFORE } from './seed'
import type { ImportedSong } from './import'

let dir: string
let file: string
let now: number
let seq: number

function make() {
  return new SongStore(dir, () => now, () => `id${++seq}`)
}

function song(title: string, extra: Partial<ImportedSong> = {}): ImportedSong {
  return { title, sections: [{ label: 'Verse 1', lines: ['a line'] }], ...extra }
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'songs-test-'))
  file = path.join(dir, 'songs.json')
  now = 1_700_000_000_000
  seq = 0
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('SongStore', () => {
  it('adds a parsed song, keeping sections and dropping empty metadata', () => {
    const store = make()
    const added = store.add(song('Amazing Grace', { authors: [' John Newton ', ''], ccliNumber: '22025', copyright: 'Public domain' }))
    expect(added).toEqual({
      id: 'id1',
      title: 'Amazing Grace',
      authors: ['John Newton'],
      ccliNumber: '22025',
      copyright: 'Public domain',
      sections: [{ label: 'Verse 1', lines: ['a line'] }],
      createdAt: now,
      updatedAt: now,
      origin: 'imported'
    })
    expect(store.get('id1')).toEqual(added)
    expect(store.get('nope')).toBeNull()
    // No authors at all means no key, not an empty array.
    expect(store.add(song('Rock of Ages'))).not.toHaveProperty('authors')
  })

  it('updates fields and clears the optional ones with an empty value', () => {
    const store = make()
    store.add(song('Old Title', { authors: ['A'], ccliNumber: '1', copyright: 'c' }))
    now += 1000
    const updated = store.update('id1', { title: '  New Title  ', sections: [{ label: 'Chorus', lines: ['one', 'two'] }] })
    expect(updated.title).toBe('New Title')
    expect(updated.sections).toEqual([{ label: 'Chorus', lines: ['one', 'two'] }])
    expect(updated.createdAt).toBe(1_700_000_000_000)
    expect(updated.updatedAt).toBe(now)
    const cleared = store.update('id1', { authors: [], ccliNumber: '', copyright: '' })
    expect(cleared).not.toHaveProperty('authors')
    expect(cleared).not.toHaveProperty('ccliNumber')
    expect(cleared).not.toHaveProperty('copyright')
    expect(() => store.update('id1', { title: '   ' })).toThrow()
    expect(() => store.update('missing', { title: 'x' })).toThrow()
  })

  it('keeps a wordless section that carries a label', () => {
    // Instrumental, Intro, Turnaround and Tag are slide stops the operator
    // still needs, and OpenLyrics encodes them as an empty verse. Dropping
    // them made update() lossy in a way no caller could detect.
    const store = make()
    const added = store.add({
      title: 'T',
      sections: [
        { label: 'Verse 1', lines: ['a'] },
        { label: 'Instrumental', lines: [] },
        { label: 'Verse 2', lines: ['b'] }
      ]
    })
    expect(added.sections.map((s) => s.label)).toEqual(['Verse 1', 'Instrumental', 'Verse 2'])
    // Round-tripping a patch gives back what was sent.
    const patched = store.update('id1', { sections: added.sections })
    expect(patched.sections).toEqual(added.sections)
    // A section that is neither labelled nor worded is still nothing.
    expect(store.add({ title: 'U', sections: [{ label: '  ', lines: [] }] }).sections).toEqual([])
  })

  it('removes songs and reports whether anything went', () => {
    const store = make()
    store.add(song('One'))
    store.add(song('Two'))
    expect(store.remove('id1')).toBe(true)
    expect(store.remove('id1')).toBe(false)
    expect(store.list().map((s) => s.title)).toEqual(['Two'])
    expect(store.count()).toBe(1)
  })

  it('returns copies, so a caller cannot edit the library by accident', () => {
    const store = make()
    store.add(song('Hymn', { authors: ['A'] }))
    const got = store.get('id1') as NonNullable<ReturnType<SongStore['get']>>
    got.title = 'Vandalised'
    got.sections[0].lines.push('extra')
    ;(got.authors as string[]).push('B')
    expect(store.get('id1')?.title).toBe('Hymn')
    expect(store.get('id1')?.sections[0].lines).toEqual(['a line'])
    expect(store.get('id1')?.authors).toEqual(['A'])
  })

  it('persists to <dir>/songs.json and reloads', () => {
    const store = make()
    store.add(song('Be Thou My Vision', { authors: ['Dallan Forgaill'] }))
    expect(fs.existsSync(file)).toBe(true)
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).version).toBe(1)
    const fresh = make()
    expect(fresh.list()).toEqual(store.list())
  })

  it('reads a valid file with junk rows in it, keeping what it can', () => {
    // A partial row with the two fields that matter survives; a junk row does not.
    fs.writeFileSync(file, JSON.stringify({
      version: 1,
      songs: [{ id: 'k', title: 'Kept' }, { title: 'No id' }, null, 7],
      deletedSeeds: ['gone', 42]
    }))
    const store = make()
    expect(store.problem).toBeNull()
    expect(store.list()).toEqual([
      { id: 'k', title: 'Kept', sections: [], createdAt: 0, updatedAt: 0, origin: 'imported' }
    ])
    // The one good deletedSeeds entry is kept; the number is dropped.
    store.add(song('x'))
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).deletedSeeds).toEqual(['gone'])
  })

  /**
   * The corrupt-file tests. These are the ones that matter most in this file:
   * a church's song library is the one thing here that cannot be recreated.
   *
   * The behaviour they pin down is deliberately awkward — a damaged file makes
   * the store REFUSE TO WRITE, so the app boots showing an empty library and
   * every edit throws. The obvious alternative, catching and starting empty,
   * reads as more robust and is catastrophic: the first save rename-clobbers
   * the damaged bytes and four hundred imported songs are gone with nothing
   * to recover them from. An error the operator can see beats a wipe they
   * cannot.
   */
  describe('a songs.json it cannot read', () => {
    const corrupt = () => {
      fs.writeFileSync(file, '{"version":1,"songs":[{"id":"a","title":"Church Song"},{"id":"b"')
    }

    it('boots, reports the problem, and does not pretend the library is empty', () => {
      corrupt()
      const store = make()
      expect(store.problem).toMatch(/unreadable/)
      expect(store.list()).toEqual([])
    })

    it('refuses to write, so the damaged bytes are still there to salvage', () => {
      corrupt()
      const before = fs.readFileSync(file, 'utf8')
      const store = make()
      expect(() => store.add(song('New'))).toThrow(/unreadable/)
      expect(fs.readFileSync(file, 'utf8')).toBe(before)
      // And a copy is kept beside it, because the next thing somebody does is
      // reinstall, and the original will not survive that.
      expect(fs.readFileSync(`${file}.corrupt`, 'utf8')).toBe(before)
    })

    it('does not reseed over it, however empty the library looks', () => {
      // The scenario in full: a church that deleted every shipped hymn, then
      // lost the file to a power cut. deletedSeeds went with it, so a naive
      // seeder hands back all fifteen hymns they threw away AND writes that
      // over the file still holding their own songs.
      const store = make()
      const seeded = store.seedIfNeeded()
      for (const s of seeded) store.remove(s.id)
      store.importMany([song('Their Own Song')])
      const good = fs.readFileSync(file, 'utf8')

      fs.writeFileSync(file, good.slice(0, Math.floor(good.length * 0.8)))
      const fresh = make()
      expect(fresh.seedIfNeeded()).toEqual([])
      expect(fresh.count()).toBe(0)
      // Nothing was written. Their song is still in the file on disk.
      expect(fs.readFileSync(file, 'utf8')).toContain('Their Own Song')
    })

    it('reads normally again once the file is repaired or removed', () => {
      corrupt()
      expect(make().problem).toMatch(/unreadable/)
      fs.rmSync(file)
      const fixed = make()
      expect(fixed.problem).toBeNull()
      expect(fixed.seedIfNeeded()).toHaveLength(SEED_HYMNS.length)
    })
  })

  it('leaves the library untouched when a write fails', () => {
    const store = make()
    store.add(song('Saved'))
    const err = Object.assign(new Error('EACCES'), { code: 'EACCES' })
    const spy = vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw err })

    // The song must not be sitting in list() claiming to be in the library:
    // refresh() would show it to the operator all service and it would be
    // gone at the next launch.
    expect(() => store.add(song('Lost'))).toThrow('EACCES')
    expect(store.list().map((s) => s.title)).toEqual(['Saved'])

    // A removal that did not reach disk must not drop the row either.
    expect(() => store.remove('id1')).toThrow('EACCES')
    expect(store.list().map((s) => s.title)).toEqual(['Saved'])

    expect(() => store.update('id1', { title: 'Renamed' })).toThrow('EACCES')
    expect(store.list().map((s) => s.title)).toEqual(['Saved'])

    spy.mockRestore()
    expect(make().list().map((s) => s.title)).toEqual(['Saved'])
  })

  describe('importMany', () => {
    it('imports everything and reports likely duplicates without dropping or overwriting', () => {
      const store = make()
      store.add(song('Amazing Grace', { authors: ['Existing copy'] }))
      const result = store.importMany([
        song('amazing  grace!', { authors: ['Second copy'] }),
        song('Rock of Ages'),
        song('Rock of Ages')
      ])
      expect(result.imported.map((s) => s.title)).toEqual(['amazing  grace!', 'Rock of Ages', 'Rock of Ages'])
      expect(store.count()).toBe(4)
      // The pre-existing row is untouched, not overwritten by the import.
      expect(store.get('id1')?.authors).toEqual(['Existing copy'])
      expect(result.duplicates).toEqual([
        { title: 'Amazing Grace', ids: ['id1', 'id2'] },
        { title: 'Rock of Ages', ids: ['id3', 'id4'] }
      ])
    })

    it('reports nothing when every title is distinct', () => {
      const store = make()
      const result = store.importMany([song('One'), song('Two')])
      expect(result.duplicates).toEqual([])
      expect(result.imported).toHaveLength(2)
    })

    it('writes the file once for the whole batch', () => {
      const store = make()
      const spy = vi.spyOn(fs, 'writeFileSync')
      store.importMany(Array.from({ length: 400 }, (_, i) => song(`Song ${i}`)))
      expect(spy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
      expect(store.count()).toBe(400)
      expect(make().count()).toBe(400)
    })

    it('normalises titles for the duplicate check only', () => {
      expect(normaliseTitle('Oh, How He Loves Us!')).toBe(normaliseTitle('oh how he loves us'))
      expect(normaliseTitle('Á Bênção')).toBe('abencao')
      expect(normaliseTitle('Amazing Grace')).not.toBe(normaliseTitle('Amazing Love'))
    })

    it('tells non-Latin titles apart instead of calling them all duplicates', () => {
      // Stripping to [a-z0-9] flattened every one of these to '', so a Korean
      // or Chinese church importing its songbook got one duplicate group
      // naming every song it owns as a copy of every other.
      const korean = ['주 은혜임을', '나 같은 죄인 살리신', '거룩하신 하나님']
      const others = ['奇異恩典', 'Великая благодать', 'ما أعظم', 'חסד נפלא']
      const keys = [...korean, ...others].map(normaliseTitle)
      expect(keys.every((k) => k !== '')).toBe(true)
      expect(new Set(keys).size).toBe(keys.length)

      const store = make()
      const result = store.importMany([...korean, ...others].map((t) => song(t)))
      expect(result.imported).toHaveLength(7)
      expect(result.duplicates).toEqual([])

      // Still catches a real one in the same script.
      expect(store.importMany([song('주 은혜임을')]).duplicates).toHaveLength(1)
    })

    it('reports nothing for titles that normalise to nothing at all', () => {
      // '♪' and '...' share an empty key, which is not evidence of anything.
      // Grouping them would be a confident, wrong answer.
      const store = make()
      const result = store.importMany([song('♪'), song('...'), song('---')])
      expect(result.imported).toHaveLength(3)
      expect(result.duplicates).toEqual([])
    })

    it('rolls the whole batch back when one song in it is malformed', () => {
      const store = make()
      store.add(song('Existing'))
      const bad = { title: 'Bad', sections: 'nope' } as unknown as ImportedSong

      expect(() => store.importMany([song('Good One'), bad, song('Never Reached')])).toThrow()
      // The half-imported batch must not survive in memory: the renderer saw
      // the rejection and shows no import, and the next unrelated add() would
      // otherwise write those ghosts through to disk.
      expect(store.list().map((s) => s.title)).toEqual(['Existing'])
      store.add(song('Later Edit'))
      expect(make().list().map((s) => s.title)).toEqual(['Existing', 'Later Edit'])
    })
  })

  describe('seeding', () => {
    it('seeds public-domain hymns once, then stays a no-op', () => {
      const store = make()
      const seeded = store.seedIfNeeded()
      expect(seeded).toHaveLength(SEED_HYMNS.length)
      expect(seeded.every((s) => s.origin === 'seed' && s.seedKey)).toBe(true)
      expect(store.seedIfNeeded()).toEqual([])
      expect(make().seedIfNeeded()).toEqual([])
      expect(make().count()).toBe(SEED_HYMNS.length)
    })

    it('writes the seed in one go', () => {
      const store = make()
      const spy = vi.spyOn(fs, 'writeFileSync')
      store.seedIfNeeded()
      expect(spy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
    })

    it('keeps a deleted seeded hymn deleted across restarts', () => {
      const store = make()
      const seeded = store.seedIfNeeded()
      const victim = seeded[0]
      store.remove(victim.id)
      expect(store.seedIfNeeded()).toEqual([])

      const fresh = make()
      expect(fresh.seedIfNeeded()).toEqual([])
      expect(fresh.list().some((s) => s.seedKey === victim.seedKey)).toBe(false)
      expect(fresh.count()).toBe(SEED_HYMNS.length - 1)

      // Even after the whole seed is cleared out, nothing comes back.
      for (const s of fresh.list()) fresh.remove(s.id)
      expect(make().seedIfNeeded()).toEqual([])
      expect(make().count()).toBe(0)
    })

    it('gives every seeded hymn a stable, unique key and some words', () => {
      // Deletions are remembered by the key, so a reused or renamed one
      // resurrects a hymn somebody deleted.
      expect(new Set(SEED_HYMNS.map((h) => h.key)).size).toBe(SEED_HYMNS.length)
      expect(SEED_HYMNS.every((h) => h.song.sections.length > 0 && h.song.title.trim())).toBe(true)
    })

    /**
     * The copyright guard, and the one test in this file that is not really
     * about code.
     *
     * The version this replaces asserted that one hardcoded title was absent
     * and called itself 'never ships a hymn that is still under copyright'.
     * It could not do what its name promised: a probe that dropped a 2018
     * Bethel worship song into the seed passed it green. A blocklist of one
     * title only ever catches that title, and the contributor who needs
     * catching is the one adding a hymn nobody has thought about yet.
     *
     * So this checks the PROPERTY the seed file claims of itself instead: for
     * every author whose words we ship, the entry's own comment states a
     * death year, and that year clears the bar in seed.ts's docblock. An
     * author with no death year in the file fails — not because the hymn is
     * necessarily encumbered, but because nobody has done the work to say it
     * is not, and an unverified hymn is exactly what must not ship.
     */
    it('never ships a hymn whose authors are not documented as long dead', () => {
      const src = fs.readFileSync(path.join(__dirname, 'seed.ts'), 'utf8')
      // Split on the key, so each entry is read with its own comment.
      const entries = SEED_HYMNS.map((h, i) => {
        const start = src.indexOf(`key: '${h.key}'`)
        expect(start, `${h.key} is not in seed.ts`).toBeGreaterThan(-1)
        const next = i + 1 < SEED_HYMNS.length ? src.indexOf(`key: '${SEED_HYMNS[i + 1].key}'`) : src.length
        // Back up over the comment that precedes the key.
        const commentStart = src.lastIndexOf('{', start)
        return { hymn: h, text: src.slice(commentStart, next) }
      })

      for (const { hymn, text } of entries) {
        const authors = hymn.song.authors ?? []
        expect(authors.length, `${hymn.key} names no author at all`).toBeGreaterThan(0)
        for (const author of authors) {
          // `Name (d. YYYY)` — the surname is enough, since that is how the
          // comments read, but the year has to be attached to this author.
          const surname = author.split(/\s+/).pop() as string
          const m = new RegExp(`${surname}[^)\\n]*\\(d\\.\\s*(\\d{4})\\)`).exec(text)
          expect(m, `${hymn.key}: no death year documented for ${author} — seed.ts requires "${author} (d. YYYY)"`).toBeTruthy()
          const died = Number((m as RegExpExecArray)[1])
          expect(
            died,
            `${hymn.key}: ${author} died ${died}; seed.ts only ships authors who died before ${SEED_AUTHOR_DIED_BEFORE}`
          ).toBeLessThan(SEED_AUTHOR_DIED_BEFORE)
        }
      }
    })

    it('ignores a seedKey on a row that is not a seed', () => {
      // A hand-edited or future-format row with origin:'bogus' and a real
      // seedKey used to be a ghost: seedIfNeeded saw the hymn as present and
      // never seeded it, while remove() would not record its deletion — so
      // the hymn was neither in the library nor re-seedable.
      fs.writeFileSync(file, JSON.stringify({
        version: 1,
        songs: [{ id: 'x', title: 'Ghost', origin: 'bogus', seedKey: 'amazing-grace', junk: 'kept forever' }]
      }))
      const store = make()
      expect(store.get('x')).not.toHaveProperty('seedKey')
      // Junk keys are not written back out either.
      expect(store.get('x')).not.toHaveProperty('junk')
      expect(store.seedIfNeeded().map((s) => s.seedKey)).toContain('amazing-grace')
    })

    it('leaves out the hymns whose singable English is still in copyright', () => {
      const titles = SEED_HYMNS.map((h) => normaliseTitle(h.song.title))
      // Named individually because each was considered and rejected, and the
      // next person to reach for one should find the reasoning in seed.ts
      // rather than re-deriving it. Chisholm 1923/renewed 1951; Hull d. 1935;
      // Draper d. 1933.
      for (const title of ['Great Is Thy Faithfulness', 'Be Thou My Vision', 'All Creatures of Our God and King']) {
        expect(titles, `${title} must not be seeded — see seed.ts`).not.toContain(normaliseTitle(title))
      }
    })
  })
})
