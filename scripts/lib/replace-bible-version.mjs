/** Replace one translation and its search index atomically, preserving others. */
export function replaceBibleVersion(db, version, rows) {
  if (!rows.length) throw new Error(`Refusing to erase ${version} for an empty import`)
  const beforeOthers = db.prepare('SELECT COUNT(*) AS count FROM bible WHERE Version != ?').get(version).count
  const hasFts = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='bible_fts'").get())
  const insert = db.prepare('INSERT INTO bible (Book, Chapter, Versecount, verse, Version) VALUES (?, ?, ?, ?, ?)')
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('DELETE FROM bible WHERE Version = ?').run(version)
    for (const [book, chapter, verse, text] of rows) insert.run(book, chapter, verse, text, version)
    if (hasFts) db.exec("INSERT INTO bible_fts(bible_fts) VALUES('rebuild')")
    const actual = db.prepare('SELECT COUNT(*) AS count FROM bible WHERE Version = ?').get(version).count
    const afterOthers = db.prepare('SELECT COUNT(*) AS count FROM bible WHERE Version != ?').get(version).count
    if (actual !== rows.length || beforeOthers !== afterOthers) throw new Error(`Import validation failed for ${version}`)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
