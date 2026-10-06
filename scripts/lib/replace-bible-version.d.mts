import type { DatabaseSync } from 'node:sqlite'
import type { BibleRow } from './usfm-bible.mjs'
export function replaceBibleVersion(db: DatabaseSync, version: string, rows: BibleRow[]): void
