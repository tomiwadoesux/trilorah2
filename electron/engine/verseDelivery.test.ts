import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { VerseDelivery, detectionKey, readVersePreview, readVerseRange, type VersePreview } from './verseDelivery'

function verse(book = 'Romans'): VersePreview {
  return { book, chapter: 6, verse: 5, text: `${book} verse text`, verses: [{ verse: 5, text: `${book} verse text` }], isRange: false, version: 'KJV' }
}

describe('VerseDelivery', () => {
  it('counts every change to the wall, so a press that waited can tell it was overtaken', () => {
    const delivery = new VerseDelivery()
    expect(delivery.acts).toBe(0)
    delivery.stage(verse())
    expect(delivery.acts).toBe(0) // staging is the operator's preview, not the wall
    delivery.promote('operator')
    expect(delivery.acts).toBe(1)
    delivery.promote('auto mode') // refused: nothing reached the wall
    expect(delivery.acts).toBe(1)
    delivery.clearLive() // a song, a picture or a clear took the verse down
    expect(delivery.acts).toBe(2)
  })
  it('speech cannot publish even after a verse was manually sent live', () => {
    const delivery = new VerseDelivery()
    delivery.stage(verse())
    delivery.promote('operator')
    delivery.stage(verse('Galatians'))
    for (const source of ['auto mode', 'auto (reading started)', 'correction'] as const) expect(delivery.promote(source)).toBeNull()
    expect(delivery.preview?.book).toBe('Galatians')
    expect(delivery.live?.book).toBe('Romans')
    expect(delivery.live?.isPreview).toBe(false)
  })

  it('an operator or paired remote can deliberately promote the next preview', () => {
    const delivery = new VerseDelivery()
    delivery.stage(verse('Galatians'))
    expect(delivery.promote('remote')?.book).toBe('Galatians')
    delivery.clearLive()
    expect(delivery.live).toBeNull()
    expect(delivery.preview?.book).toBe('Galatians')
  })

  it('does not send a missing verse message to the congregation', () => {
    const delivery = new VerseDelivery()
    delivery.stage({ ...verse(), text: 'Verse 5 not found' })
    expect(delivery.promote('operator')).toBeNull()
  })

  it('distinguishes a chapter, verse one, and a growing range for duplicate checks', () => {
    const keys = [
      { book: 'John', chapter: 3, verse: null },
      { book: 'John', chapter: 3, verse: 1 },
      { book: 'John', chapter: 3, verse: 16 },
      { book: 'John', chapter: 3, verse: 16, endVerse: 18 }
    ].map(detectionKey)
    expect(new Set(keys).size).toBe(4)
  })
})

describe('readVersePreview — operator selections', () => {
  function database() {
    const db = new DatabaseSync(':memory:')
    db.exec("CREATE TABLE bible (Book INTEGER, Chapter INTEGER, Versecount INTEGER, verse TEXT, Version TEXT); INSERT INTO bible VALUES (44,6,5,'Romans text','KJV'), (47,6,5,'Galatians text','KJV'), (42,3,16,'John sixteen','KJV'), (42,3,17,'John seventeen','KJV'), (42,3,16,'John BBE','BBE')")
    return { db, read: (ref: string, version = 'KJV') => readVersePreview(db as unknown as Parameters<typeof readVersePreview>[0], ref, version) }
  }

  it('publishes the selected book even if a later speech preview is different', () => {
    const { db, read } = database()
    try {
      const delivery = new VerseDelivery()
      delivery.stage(read('Romans 6:5')!)
      delivery.stage(read('Galatians 6:5')!)
      delivery.stage(read('Romans 6:5')!)
      expect(delivery.promote('operator')).toMatchObject({ book: 'Romans', text: 'Romans text' })
    } finally { db.close() }
  })

  it('reads the requested translation and complete range', () => {
    const { db, read } = database()
    try {
      expect(read('John 3:16', 'BBE')).toMatchObject({ version: 'BBE', text: 'John BBE' })
      expect(read('John 3:16-17')).toMatchObject({ endVerse: 17, text: 'John sixteen John seventeen' })
    } finally { db.close() }
  })

  it('rejects missing verses, incomplete ranges, unknown books, and missing translations', () => {
    const { db, read } = database()
    try {
      for (const ref of ['John 3:99', 'John 3:16-18', 'Notabook 3:16', 'John 3:', 'John 0:1']) expect(read(ref)).toBeNull()
      expect(read('John 3:16', 'NIV')).toBeNull()
    } finally { db.close() }
  })
})

describe('readVersePreview — versions that leave a verse out', () => {
  /* Invented words; only the numbering is real. WEB has no Acts 8:37 and BSB
     no Mark 9:44 or 9:46 — the rows are absent, not empty. */
  function database() {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE bible (Book INTEGER, Chapter INTEGER, Versecount INTEGER, verse TEXT, Version TEXT);
      INSERT INTO bible VALUES (43,8,36,'Acts thirty-six','WEB'), (43,8,38,'Acts thirty-eight','WEB'), (43,8,39,'Acts thirty-nine','WEB');
      INSERT INTO bible VALUES (40,9,43,'Mark 43','BSB'), (40,9,45,'Mark 45','BSB'), (40,9,47,'Mark 47','BSB'), (40,9,48,'Mark 48','BSB');
      INSERT INTO bible VALUES (42,3,16,'John sixteen','KJV'), (42,3,17,'','KJV'), (42,3,18,'John eighteen','KJV');`)
    return { db, read: (ref: string, version: string) => readVersePreview(db as unknown as Parameters<typeof readVersePreview>[0], ref, version) }
  }

  it('reads across a missing number and keeps the real verse numbers', () => {
    const { db, read } = database()
    try {
      expect(read('Acts 8:36-38', 'WEB')).toMatchObject({
        verse: 36, endVerse: 38, isRange: true, text: 'Acts thirty-six Acts thirty-eight',
        verses: [{ verse: 36, text: 'Acts thirty-six' }, { verse: 38, text: 'Acts thirty-eight' }],
      })
      expect(read('Mark 9:43-48', 'BSB')?.verses.map((v) => v.verse)).toEqual([43, 45, 47, 48])
    } finally { db.close() }
  })

  it('still refuses a range whose first or last verse the version does not have, or an empty verse inside it', () => {
    const { db, read } = database()
    try {
      expect(read('Acts 8:37', 'WEB')).toBeNull()
      expect(read('Acts 8:37-39', 'WEB')).toBeNull()
      expect(read('Mark 9:43-44', 'BSB')).toBeNull()
      expect(read('John 3:16-18', 'KJV')).toBeNull()
    } finally { db.close() }
  })

  it('gives the wall exactly the rows the version has', () => {
    const { db } = database()
    try {
      const range = (...a: [number, number, number, number, string]) => readVerseRange(db as unknown as Parameters<typeof readVerseRange>[0], ...a)
      expect(range(40, 9, 43, 48, 'BSB').map((v) => v.verse)).toEqual([43, 45, 47, 48])
      expect(range(40, 9, 48, 43, 'BSB')).toEqual([])
      expect(range(40, 9, 0.5, 48, 'BSB')).toEqual([])
    } finally { db.close() }
  })
})
