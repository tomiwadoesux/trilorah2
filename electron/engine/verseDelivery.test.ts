import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { VerseDelivery, detectionKey, readVersePreview, type VersePreview } from './verseDelivery'

function verse(book = 'Romans'): VersePreview {
  return { book, chapter: 6, verse: 5, text: `${book} verse text`, verses: [{ verse: 5, text: `${book} verse text` }], isRange: false, version: 'KJV' }
}

describe('VerseDelivery', () => {
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
