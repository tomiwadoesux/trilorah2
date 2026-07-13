import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'
import type Database from 'better-sqlite3'

export function findDatabase(): string | null {
  const paths = [
    path.join(app.getAppPath(), 'bible.db'),
    path.join(process.cwd(), 'bible.db'),
    path.join(__dirname, '..', 'bible.db')
  ]
  for (const p of paths) {
    if (fs.existsSync(p)) {
      console.log('✅ Database found:', p)
      return p
    }
  }
  return null
}

/**
 * Recovery note: the original monolith held `db` as a mutable module-level
 * variable assigned inside app.whenReady(). We preserve those mechanics with
 * an exported live `let` binding plus a setter — importers read the live
 * binding, and main.ts assigns through setDb().
 */
export let db: Database.Database | null = null

export function setDb(handle: Database.Database | null): void {
  db = handle
}

export const bookIdMap: Record<string, number> = {
  Genesis: 0,
  Exodus: 1,
  Leviticus: 2,
  Numbers: 3,
  Deuteronomy: 4,
  Joshua: 5,
  Judges: 6,
  Ruth: 7,
  '1 Samuel': 8,
  '2 Samuel': 9,
  '1 Kings': 10,
  '2 Kings': 11,
  '1 Chronicles': 12,
  '2 Chronicles': 13,
  Ezra: 14,
  Nehemiah: 15,
  Esther: 16,
  Job: 17,
  Psalms: 18,
  Proverbs: 19,
  Ecclesiastes: 20,
  'Song of Solomon': 21,
  Isaiah: 22,
  Jeremiah: 23,
  Lamentations: 24,
  Ezekiel: 25,
  Daniel: 26,
  Hosea: 27,
  Joel: 28,
  Amos: 29,
  Obadiah: 30,
  Jonah: 31,
  Micah: 32,
  Nahum: 33,
  Habakkuk: 34,
  Zephaniah: 35,
  Haggai: 36,
  Zechariah: 37,
  Malachi: 38,
  Matthew: 39,
  Mark: 40,
  Luke: 41,
  John: 42,
  Acts: 43,
  Romans: 44,
  '1 Corinthians': 45,
  '2 Corinthians': 46,
  Galatians: 47,
  Ephesians: 48,
  Philippians: 49,
  Colossians: 50,
  '1 Thessalonians': 51,
  '2 Thessalonians': 52,
  '1 Timothy': 53,
  '2 Timothy': 54,
  Titus: 55,
  Philemon: 56,
  Hebrews: 57,
  James: 58,
  '1 Peter': 59,
  '2 Peter': 60,
  '1 John': 61,
  '2 John': 62,
  '3 John': 63,
  Jude: 64,
  Revelation: 65
}

export const bookNames = Object.fromEntries(
  Object.entries(bookIdMap).map(([name, id]) => [id, name])
) as Record<number, string>
