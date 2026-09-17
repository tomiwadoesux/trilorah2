import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { exportFixturesFromLedger, parseReference, canonicalBook } from './evalExport'
import type { LedgerData } from './correctionLedger'

let dir: string
let outFile: string

function writeLedger(id: string, samples: LedgerData['samples'], name = id): void {
  const data: LedgerData = {
    preacherId: id,
    name,
    samples,
    services: [],
    aliases: {},
    mature: false,
    autoModeEnabled: false
  }
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(data))
}

function readFixtures(): any[] {
  return fs
    .readFileSync(outFile, 'utf-8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l))
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-export-'))
  outFile = path.join(dir, 'out', 'from-ledger.jsonl')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('parseReference', () => {
  it('parses chapter:verse, chapter-only, ranges and aliases', () => {
    expect(parseReference('Romans 8:28')).toEqual({ book: 'Romans', chapter: 8, verse: 28 })
    expect(parseReference('Romans 8')).toEqual({ book: 'Romans', chapter: 8, verse: null })
    expect(parseReference('1 John 3:16-18')).toEqual({ book: '1 John', chapter: 3, verse: 16, endVerse: 18 })
    expect(parseReference('first corinthians 13:4')).toEqual({ book: '1 Corinthians', chapter: 13, verse: 4 })
    expect(parseReference('Psalm 23')).toEqual({ book: 'Psalms', chapter: 23, verse: null })
    expect(parseReference('song of songs 2:1')).toEqual({ book: 'Song of Solomon', chapter: 2, verse: 1 })
  })
  it('rejects unparsable forms', () => {
    expect(parseReference('Romans')).toBeNull()
    expect(parseReference('Hezekiah 3:1')).toBeNull()
    expect(parseReference('')).toBeNull()
    expect(parseReference('3:16')).toBeNull()
  })
  it('canonicalBook is case-insensitive', () => {
    expect(canonicalBook('ROMANS')).toBe('Romans')
    expect(canonicalBook('Second Peter')).toBe('2 Peter')
    expect(canonicalBook('nope')).toBeNull()
  })
})

describe('exportFixturesFromLedger', () => {
  it('converts samples to anonymised fixtures and skips unparsable ones', () => {
    writeLedger('pastor-a', [
      { heard: 'rome and eight twenty eight', correctedTo: 'Romans 8:28', source: 'operator', ts: 1 },
      { heard: 'sam twenty three', correctedTo: 'Psalm 23', source: 'voice', ts: 2 },
      { heard: 'garbage', correctedTo: 'not a reference', source: 'system', ts: 3 }
    ])
    const res = exportFixturesFromLedger(dir, outFile, { anonymise: true })
    expect(res.written).toBe(2)
    expect(res.duplicates).toBe(0)
    expect(res.skipped).toEqual([{ preacherId: 'pastor-a', heard: 'garbage', correctedTo: 'not a reference' }])

    const fixtures = readFixtures()
    expect(fixtures).toHaveLength(2)
    const hashed = createHash('sha1').update('pastor-a').digest('hex').slice(0, 8)
    expect(fixtures[0]).toEqual({
      id: expect.stringMatching(/^ledger-[0-9a-f]{10}$/),
      lang: 'en',
      preacher: hashed,
      tags: ['from-correction', 'operator'],
      chunks: [{ text: 'rome and eight twenty eight', isFinal: true }],
      expected: [{ book: 'Romans', chapter: 8, verse: 28 }]
    })
    expect(fixtures[1].expected).toEqual([{ book: 'Psalms', chapter: 23, verse: null }])
    expect(fixtures[1].tags).toEqual(['from-correction', 'voice'])
  })

  it('keeps raw preacher ids when not anonymising', () => {
    writeLedger('pastor-b', [{ heard: 'john three sixteen', correctedTo: 'John 3:16', source: 'voice', ts: 1 }])
    exportFixturesFromLedger(dir, outFile, { anonymise: false })
    expect(readFixtures()[0].preacher).toBe('pastor-b')
  })

  it('is append-only and dedupes by (heard, correctedTo) across runs and preachers', () => {
    writeLedger('a', [
      { heard: 'john three sixteen', correctedTo: 'John 3:16', source: 'voice', ts: 1 },
      { heard: 'john three sixteen', correctedTo: 'John 3:16', source: 'operator', ts: 2 },
      { heard: 'John three sixteen', correctedTo: 'john 3:16', source: 'operator', ts: 3 }
    ])
    writeLedger('b', [{ heard: 'john three sixteen', correctedTo: 'John 3:16', source: 'voice', ts: 4 }])
    const first = exportFixturesFromLedger(dir, outFile)
    expect(first.written).toBe(1)
    expect(first.duplicates).toBe(3)

    // a new pair on a later run is appended; existing ones stay untouched
    writeLedger('a', [
      { heard: 'john three sixteen', correctedTo: 'John 3:16', source: 'voice', ts: 1 },
      { heard: 'jeremiah twenty nine eleven', correctedTo: 'Jeremiah 29:11', source: 'voice', ts: 5 }
    ])
    const second = exportFixturesFromLedger(dir, outFile)
    expect(second.written).toBe(1)
    expect(second.duplicates).toBe(2)
    const fixtures = readFixtures()
    expect(fixtures.map((f) => f.chunks[0].text)).toEqual(['john three sixteen', 'jeremiah twenty nine eleven'])
    expect(new Set(fixtures.map((f) => f.id)).size).toBe(2)
  })

  it('reports unreadable ledger files and tolerates a missing dir', () => {
    fs.writeFileSync(path.join(dir, 'broken.json'), '{not json')
    const res = exportFixturesFromLedger(dir, outFile)
    expect(res.unreadable).toEqual(['broken.json'])
    expect(res.written).toBe(0)
    expect(fs.existsSync(outFile)).toBe(false)
    expect(exportFixturesFromLedger(path.join(dir, 'nope'), outFile)).toMatchObject({ written: 0 })
  })
})
