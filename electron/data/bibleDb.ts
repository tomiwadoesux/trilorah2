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
  if (app.isPackaged) {
    // Packaged: bible.db ships via electron-builder extraResources
    paths.unshift(path.join(process.resourcesPath, 'bible.db'))
  }
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

// Book tables moved to ./books (pure data, importable without Electron);
// re-exported here so recovered call sites keep working unchanged.
export { bookIdMap, bookNames, resolveBookId, canonicalBookName } from './books'
