/**
 * The songs library.
 *
 * A flat JSON file at <storageDir>/songs.json, deliberately not a database:
 * a church's whole song list is a few hundred short records, it is read once
 * at launch and written when somebody edits, and a file the operator can copy
 * onto a memory stick is worth more here than a query planner. Same shape and
 * same defensive habits as electron/library/folders.ts.
 *
 * Two rules the owner set that the code has to keep, not just document:
 *
 *  - IMPORT NEVER LOSES ANYTHING. A church that exports the same song twice
 *    from SongSelect gets two rows and a report saying so. We never silently
 *    drop the second file and never overwrite the first — the operator looks
 *    at both and decides, because only they know which export is the one the
 *    band actually rehearsed.
 *
 *  - DELETING A SEEDED HYMN IS PERMANENT. The seed exists so the library is
 *    not empty on first run; a hymn the church threw away must not reappear
 *    next Sunday. The row goes, its seedKey stays in `deletedSeeds` forever.
 *
 * And one rule the failure modes taught us, which is really the first rule
 * again from the other side: A FILE WE CANNOT READ IS NOT AN EMPTY LIBRARY.
 * Unlike a folder index, a church's songs cannot be recreated by shrugging
 * and starting over, so a damaged songs.json makes the store read-only
 * rather than a blank slate. See load(), save() and seedIfNeeded().
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Song, SongDuplicate, SongImportResult, SongPatch, SongSection } from '../../shared/types'
import type { ImportedSong } from './import'
import { SEED_HYMNS } from './seed'

interface SongFile {
  version: 1
  songs: Song[]
  /** seedKeys of hymns the church deleted. Grows, never shrinks. */
  deletedSeeds: string[]
}

export class SongStore {
  private songs: Song[] = []
  private deletedSeeds = new Set<string>()
  private readonly file: string
  /** Set while a bulk operation runs so save() writes once at the end, not per song. */
  private batching = false
  /**
   * Set when load() could not read a file that exists. While it is true the
   * store refuses to write — see save(). Everything else keeps working, so
   * the app still boots; it simply will not overwrite what it could not read.
   */
  private readonly damaged: string | null = null

  constructor(
    storageDir: string,
    private readonly now: () => number = () => Date.now(),
    private readonly makeId: () => string = defaultId
  ) {
    this.file = path.join(storageDir, 'songs.json')
    this.damaged = this.load()
  }

  // ----------------------------------------------------------- persistence

  /**
   * Reads the file. Returns null on success, or a reason the file could not be
   * read — which the constructor keeps, because an unreadable file is not an
   * empty library.
   *
   * That distinction is the whole point. The obvious catch-and-reset (which
   * folders.ts can afford, because a folder index is trivially recreatable)
   * would here mean: songs.json is truncated by a power cut, we boot with an
   * empty library, seedIfNeeded() cheerfully re-adds the hymns because
   * deletedSeeds went missing with everything else, and the first save
   * rename-clobbers the only copy of the church's four hundred imported
   * songs. Nobody is told; the Songs screen just looks like a fresh install.
   * So a damaged file makes the store read-only instead, the damaged bytes
   * are copied aside, and the operator gets a library they can see is wrong
   * rather than a library that is quietly gone.
   */
  private load(): string | null {
    let text: string
    try {
      if (!fs.existsSync(this.file)) return null
      text = fs.readFileSync(this.file, 'utf8')
    } catch (err) {
      return `songs.json could not be read (${errText(err)})`
    }
    try {
      const raw = JSON.parse(text) as Partial<SongFile>
      if (!raw || typeof raw !== 'object') throw new Error('not an object')
      // A songs key of the wrong type means the file is not what we wrote.
      // Missing entirely is fine — that is a file from before songs existed.
      if (raw.songs !== undefined && !Array.isArray(raw.songs)) throw new Error('songs is not an array')
      if (raw.deletedSeeds !== undefined && !Array.isArray(raw.deletedSeeds)) throw new Error('deletedSeeds is not an array')
      this.songs = Array.isArray(raw.songs) ? raw.songs.map(reviveSong).filter((s): s is Song => s !== null) : []
      this.deletedSeeds = new Set(Array.isArray(raw.deletedSeeds) ? raw.deletedSeeds.filter((k) => typeof k === 'string') : [])
      return null
    } catch (err) {
      this.songs = []
      this.deletedSeeds = new Set()
      this.quarantine(text)
      return `songs.json is unreadable (${errText(err)}) — a copy was kept beside it and the library is read-only until it is repaired or removed`
    }
  }

  /**
   * Keeps the unreadable bytes. The salvage copy is what somebody pulls the
   * church's songs back out of by hand, so it is written before anything else
   * happens and never overwritten by a later, worse copy.
   */
  private quarantine(text: string): void {
    const bak = `${this.file}.corrupt`
    try {
      if (!fs.existsSync(bak)) fs.writeFileSync(bak, text)
    } catch {
      // Best effort. Failing to save the salvage copy must not stop the app
      // booting, and the original file is still on disk either way.
    }
  }

  /**
   * True when the file on disk could not be read and the store is refusing to
   * write over it. The UI surfaces this — a church whose library looks empty
   * needs to know why before it starts re-importing.
   */
  get problem(): string | null {
    return this.damaged
  }

  private save(): void {
    if (this.batching) return
    // Refusing to write is the point: see load(). The damaged file stays
    // exactly as it is until a human deals with it.
    if (this.damaged) throw new Error(this.damaged)
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const data: SongFile = { version: 1, songs: this.songs, deletedSeeds: [...this.deletedSeeds] }
    const tmp = `${this.file}.tmp`
    // fsync before the rename, not after: rename is atomic with respect to
    // ordering, but it does not make the tmp file's CONTENTS durable, and a
    // power cut between the two is exactly how a songs.json ends up existing,
    // valid-looking and truncated.
    const fd = fs.openSync(tmp, 'w')
    try {
      fs.writeFileSync(fd, JSON.stringify(data, null, 2))
      fs.fsyncSync(fd)
    } finally {
      fs.closeSync(fd)
    }
    fs.renameSync(tmp, this.file)
  }

  /**
   * Runs fn with saving suspended, then writes the file exactly once —
   * all of it or none of it.
   *
   * The rollback matters more than the batching. A malformed song reaching
   * importMany throws halfway through the loop, and without restoring the
   * arrays the store would sit there holding half a batch that never reached
   * disk: the renderer sees the rejection and shows no import, while the next
   * unrelated add() quietly writes those half-imported ghosts through. An
   * operation that failed has to leave the library exactly as it found it.
   */
  private batch<T>(fn: () => T): T {
    const outer = this.batching
    const songs = this.songs
    const deletedSeeds = this.deletedSeeds
    this.songs = [...songs]
    this.deletedSeeds = new Set(deletedSeeds)
    this.batching = true
    try {
      const out = fn()
      this.batching = outer
      this.save()
      return out
    } catch (err) {
      this.batching = outer
      this.songs = songs
      this.deletedSeeds = deletedSeeds
      throw err
    }
  }

  /**
   * Mutates, then writes — and puts the library back if the write fails.
   *
   * Every mutator goes through this. Pushing a row into the array and then
   * letting save() throw leaves list() reporting a song that is not on disk:
   * the renderer's refresh() shows it in the library all service and it is
   * gone at the next launch, which is worse than an error, because an error
   * is something the operator can act on.
   */
  private mutate<T>(fn: () => T): T {
    const songs = this.songs.map(cloneSong)
    const deletedSeeds = new Set(this.deletedSeeds)
    try {
      return fn()
    } catch (err) {
      this.songs = songs
      this.deletedSeeds = deletedSeeds
      throw err
    }
  }

  // --------------------------------------------------------------- reading

  list(): Song[] {
    return this.songs.map(cloneSong)
  }

  get(id: string): Song | null {
    const s = this.songs.find((x) => x.id === id)
    return s ? cloneSong(s) : null
  }

  count(): number {
    return this.songs.length
  }

  // --------------------------------------------------------------- writing

  /** Adds one parsed song. Never checks for duplicates — see importMany. */
  add(imported: ImportedSong, origin: Song['origin'] = 'imported', seedKey?: string): Song {
    return this.mutate(() => {
      const song = this.toSong(imported, origin, seedKey)
      this.songs.push(song)
      this.save()
      return cloneSong(song)
    })
  }

  update(id: string, patch: SongPatch): Song {
    return this.mutate(() => this.applyUpdate(id, patch))
  }

  private applyUpdate(id: string, patch: SongPatch): Song {
    const song = this.songs.find((x) => x.id === id)
    if (!song) throw new Error(`Song not found: ${id}`)
    if (patch.title !== undefined) {
      const title = patch.title.trim()
      if (!title) throw new Error('Song title is required')
      song.title = title
    }
    if (patch.sections !== undefined) song.sections = cleanSections(patch.sections)
    if (patch.authors !== undefined) {
      const authors = patch.authors.map((a) => a.trim()).filter(Boolean)
      if (authors.length) song.authors = authors
      else delete song.authors
    }
    if (patch.ccliNumber !== undefined) {
      if (patch.ccliNumber) song.ccliNumber = patch.ccliNumber
      else delete song.ccliNumber
    }
    if (patch.copyright !== undefined) {
      if (patch.copyright) song.copyright = patch.copyright
      else delete song.copyright
    }
    song.updatedAt = this.now()
    this.save()
    return cloneSong(song)
  }

  /**
   * Deletes a song. A seeded hymn's key is remembered so seeding never
   * brings it back — that is the whole point of deletedSeeds.
   */
  remove(id: string): boolean {
    return this.mutate(() => {
      const idx = this.songs.findIndex((x) => x.id === id)
      if (idx < 0) return false
      const [gone] = this.songs.splice(idx, 1)
      // The key, not the origin flag: a row that lost its origin to a bad
      // parse but still carries a seedKey is still a hymn we shipped, and
      // re-adding it next launch is the one thing deletedSeeds exists to stop.
      if (gone.seedKey) this.deletedSeeds.add(gone.seedKey)
      this.save()
      return true
    })
  }

  /**
   * Imports a batch. Everything goes in; likely duplicates are reported, not
   * resolved. "Likely" is a normalised title match — lowercased, punctuation
   * and whitespace stripped — because that catches the real case (the same
   * song exported twice, once as "Oh How He Loves Us" and once as
   * "Oh, How He Loves Us") without pretending to know that two songs sharing
   * a title are the same song. The report lists every id now holding that
   * title, existing rows included, so the review screen can show them side by
   * side.
   *
   * One file write for the whole batch: a church importing 400 OpenLyrics
   * files should not rewrite songs.json 400 times.
   */
  importMany(imported: readonly ImportedSong[], origin: Song['origin'] = 'imported'): SongImportResult {
    return this.batch(() => {
      const byNormalised = new Map<string, string[]>()
      for (const s of this.songs) {
        const key = normaliseTitle(s.title)
        if (!key) continue
        const ids = byNormalised.get(key)
        if (ids) ids.push(s.id)
        else byNormalised.set(key, [s.id])
      }

      const added: Song[] = []
      const collided = new Set<string>()
      for (const one of imported) {
        const song = this.toSong(one, origin)
        this.songs.push(song)
        added.push(song)
        // No key at all — a title of '♪' or '...' — is not evidence of
        // anything, so it is never reported. Grouping every such song
        // together would be a confident, wrong answer.
        const key = normaliseTitle(song.title)
        if (!key) continue
        const ids = byNormalised.get(key)
        if (ids) {
          ids.push(song.id)
          collided.add(key)
        } else {
          byNormalised.set(key, [song.id])
        }
      }
      this.save()

      const duplicates: SongDuplicate[] = []
      for (const key of collided) {
        const ids = byNormalised.get(key) as string[]
        // Report under the title the operator will recognise: the first row holding it.
        const title = this.songs.find((s) => s.id === ids[0])?.title ?? key
        duplicates.push({ title, ids: [...ids] })
      }
      return { imported: added.map(cloneSong), duplicates }
    })
  }

  /**
   * First-run seeding. Adds any public-domain hymn that is neither already
   * present nor previously deleted, and writes once. Safe to call on every
   * launch: after the first it is a no-op, and after a church clears the
   * whole seed out it stays a no-op forever.
   */
  seedIfNeeded(): Song[] {
    // Never seed over a file we could not read. deletedSeeds lives in that
    // same file, so a damaged one takes the record of what the church threw
    // away with it — and seeding on top would hand back every hymn they
    // deliberately deleted, then write that over the damaged bytes. An empty
    // library we cannot explain is not a first run.
    if (this.damaged) return []
    const present = new Set(this.songs.filter((s) => s.seedKey).map((s) => s.seedKey as string))
    const missing = SEED_HYMNS.filter((h) => !present.has(h.key) && !this.deletedSeeds.has(h.key))
    if (!missing.length) return []
    return this.batch(() => {
      const added = missing.map((h) => this.toSong(h.song, 'seed', h.key))
      this.songs.push(...added)
      return added.map(cloneSong)
    })
  }

  // --------------------------------------------------------------- helpers

  private toSong(imported: ImportedSong, origin: Song['origin'], seedKey?: string): Song {
    const ts = this.now()
    const song: Song = {
      id: this.makeId(),
      title: imported.title?.trim() || 'Untitled',
      sections: cleanSections(imported.sections ?? []),
      createdAt: ts,
      updatedAt: ts,
      origin
    }
    const authors = (imported.authors ?? []).map((a) => a.trim()).filter(Boolean)
    if (authors.length) song.authors = authors
    if (imported.ccliNumber) song.ccliNumber = imported.ccliNumber
    if (imported.copyright) song.copyright = imported.copyright
    if (seedKey) song.seedKey = seedKey
    return song
  }
}

/**
 * Title key for duplicate detection: case, punctuation and spacing all go,
 * so "Oh, How He Loves Us!" and "oh how he loves us" collide. Accents are
 * folded too — an OpenLyrics export and a hand-typed title rarely agree
 * about them.
 *
 * Letters and digits are kept in EVERY script, not just Latin. Stripping to
 * [a-z0-9] flattened '주 은혜임을', '奇異恩典' and 'Великая благодать' all to
 * the empty string, which made them each other's duplicates: a Korean church
 * importing its two hundred songs got one report claiming every song in its
 * library was a copy of every other. \p{L}\p{N} keeps CJK, Hangul, Cyrillic,
 * Greek, Arabic, Hebrew and Thai intact while still folding the punctuation
 * and spacing this is here for.
 */
export function normaliseTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * Sections as the library stores them.
 *
 * A section with a label and no words is kept, not dropped. 'Instrumental',
 * 'Intro', 'Turnaround' and 'Tag' are real parts of a set — the operator
 * still needs them as slide stops, an OpenLyrics export encodes them as an
 * empty verse, and silently eating them would make update() lossy in a way
 * the caller cannot detect. What gets dropped is a section that is neither:
 * no usable lines AND nothing that came in as a label.
 */
function cleanSections(sections: readonly SongSection[]): SongSection[] {
  return sections
    .filter((s) => s && Array.isArray(s.lines))
    .map((s) => ({
      raw: String(s.label ?? '').trim(),
      lines: s.lines.filter((l) => typeof l === 'string')
    }))
    .filter((s) => s.lines.length > 0 || s.raw !== '')
    .map((s) => ({ label: s.raw || 'Verse', lines: s.lines }))
}

function cloneSong(s: Song): Song {
  const copy: Song = { ...s, sections: s.sections.map((x) => ({ label: x.label, lines: [...x.lines] })) }
  if (s.authors) copy.authors = [...s.authors]
  return copy
}

/**
 * Accepts a row off disk only if it has the two fields nothing works without,
 * and rebuilds it field by field rather than spreading whatever was there.
 *
 * Spreading the raw object kept every junk key a hand-edit or a future
 * version's format left behind, and wrote them back out forever. Worse, a
 * seedKey survived on a row whose origin had been coerced — a ghost that
 * told seedIfNeeded() the hymn was already present while remove() no longer
 * treated it as one, so the hymn ended up neither in the library nor
 * re-seedable. A seedKey is now only honoured on a row that really is a seed.
 */
function reviveSong(x: unknown): Song | null {
  if (!x || typeof x !== 'object') return null
  const s = x as Partial<Song>
  if (typeof s.id !== 'string' || typeof s.title !== 'string') return null
  const song: Song = {
    id: s.id,
    title: s.title,
    sections: Array.isArray(s.sections) ? cleanSections(s.sections) : [],
    createdAt: typeof s.createdAt === 'number' ? s.createdAt : 0,
    updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : 0,
    origin: s.origin === 'seed' || s.origin === 'manual' ? s.origin : 'imported'
  }
  const authors = Array.isArray(s.authors) ? s.authors.filter((a): a is string => typeof a === 'string') : []
  if (authors.length) song.authors = authors
  if (typeof s.ccliNumber === 'string' && s.ccliNumber) song.ccliNumber = s.ccliNumber
  if (typeof s.copyright === 'string' && s.copyright) song.copyright = s.copyright
  if (song.origin === 'seed' && typeof s.seedKey === 'string' && s.seedKey) song.seedKey = s.seedKey
  return song
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function defaultId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
