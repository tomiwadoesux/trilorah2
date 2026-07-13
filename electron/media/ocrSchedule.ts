import { extractTextFromImage } from './ocrProcessor'
import type { ScheduleEntry } from '../../shared/types'

const SEGMENT_KEYWORDS: Record<string, string[]> = {
  worship: ['worship', 'praise', 'singing', 'songs', 'song', 'hymn', 'music'],
  prayer: ['prayer', 'intercession', 'pray', 'supplication'],
  sermon: [
    'sermon',
    'message',
    'preaching',
    'teaching',
    'word',
    'homily',
    'address'
  ],
  announcements: [
    'announce',
    'announcement',
    'news',
    'updates',
    'bulletin',
    'notices'
  ],
  offering: ['offering', 'tithe', 'tithes', 'giving', 'collection'],
  'altar-call': [
    'altar',
    'altar call',
    'salvation',
    'invitation',
    'response',
    'commitment'
  ],
  closing: [
    'closing',
    'benediction',
    'dismiss',
    'dismissal',
    'goodbye',
    'blessing',
    'departure',
    'end'
  ],
  welcome: ['welcome', 'greeting', 'opening'],
  communion: ['communion', "lord's supper", 'lords supper', 'eucharist'],
  baptism: ['baptism', 'baptize'],
  testimony: ['testimony', 'testimonies']
}

export interface ParsedSchedule {
  entries: ScheduleEntry[]
  rawText: string
  unmatchedLines: string[]
}

function normalizeLine(line: string) {
  return line.toLowerCase().replace(/[^a-z\s']/g, ' ').replace(/\s+/g, ' ').trim()
}

function classifyLine(line: string): string | null {
  if (!line) return null
  let best: { type: string; keywordLen: number } | null = null
  for (const [type, keywords] of Object.entries(SEGMENT_KEYWORDS)) {
    for (const kw of keywords) {
      if (line.includes(kw)) {
        if (!best || kw.length > best.keywordLen) {
          best = { type, keywordLen: kw.length }
        }
      }
    }
  }
  if (best?.type === 'welcome') return 'announcements'
  return best?.type ?? null
}

export function parseSchedule(text: string): ParsedSchedule {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const entries: ScheduleEntry[] = []
  const unmatched: string[] = []
  for (const raw of lines) {
    const norm = normalizeLine(raw)
    const type = classifyLine(norm)
    if (!type) {
      unmatched.push(raw)
      continue
    }
    if (entries.length > 0 && entries[entries.length - 1].type === type) {
      continue
    }
    entries.push({ type })
  }
  return { entries, rawText: text, unmatchedLines: unmatched }
}

export async function importScheduleFromImage(imagePath: string): Promise<ParsedSchedule> {
  const text = await extractTextFromImage(imagePath)
  return parseSchedule(text)
}
