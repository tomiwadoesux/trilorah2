/**
 * Photograph of an order of service -> schedule.
 *
 * This file used to hold its own keyword table and ask of each OCR line
 * "does it contain a word I know?" — so a bulletin that said "Preaching"
 * where the app says "sermon" lost the row, along with every clock time and
 * minister's name on the page. The reading now lives in shared/ (pure, and
 * tested against messy scans): runOfServiceParse reads each row's shape —
 * time, title, duration, person — and serviceAliases knows what churches
 * call things. All that is left here is the one step that needs Electron's
 * side of the fence: running Tesseract on the file.
 *
 * `rows` is the full answer, unknown rows included (type null — the operator
 * picks). `entries` and `unmatchedLines` are kept in their old shape for the
 * legacy Schedule screen: entries are the rows we could type, in order.
 */
import { extractTextAnyOrientation } from './ocrProcessor'
import type { ScheduleEntry } from '../../shared/types'
import { parseOrderOfService, formatClock, type ParsedRow } from '../../shared/runOfServiceParse'

export interface ParsedSchedule {
  entries: ScheduleEntry[]
  rows: ParsedRow[]
  rawText: string
  unmatchedLines: string[]
}

export function parseSchedule(text: string): ParsedSchedule {
  const rows = parseOrderOfService(text)
  const entries: ScheduleEntry[] = []
  const unmatched: string[] = []
  for (const row of rows) {
    if (!row.type) {
      unmatched.push(row.raw)
      continue
    }
    const entry: ScheduleEntry = { type: row.type, title: row.title }
    if (row.time) entry.time = formatClock(row.time.start)
    const notes = [row.person, row.durationMin !== undefined ? `${row.durationMin} min` : ''].filter(Boolean)
    if (notes.length > 0) entry.notes = notes.join(' · ')
    entries.push(entry)
  }
  return { entries, rows, rawText: text, unmatchedLines: unmatched }
}

export async function importScheduleFromImage(imagePath: string): Promise<ParsedSchedule> {
  const text = await extractTextAnyOrientation(imagePath)
  return parseSchedule(text)
}
