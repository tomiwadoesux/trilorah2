import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { TeachingStore, applyBookAliases } from './teaching'

let dir: string
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teaching-test-')) })
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('local teaching', () => {
  it('persists all controls independently per preacher, including deletions', () => {
    const store = new TeachingStore(dir)
    store.patch('p1', { soundsLike: [{ heard: 'rawmeans', means: 'romans', source: 'taught', hits: 0 }], vocabulary: ['Bethel House'], ignoreTails: ['amen'], voiceCommands: false })
    const fresh = new TeachingStore(dir)
    expect(fresh.get('p1')).toMatchObject({ voiceCommands: false, vocabulary: ['Bethel House'], ignoreTails: ['amen'] })
    expect(fresh.get('p2').voiceCommands).toBe(true)
    fresh.patch('p1', { soundsLike: [], vocabulary: [], ignoreTails: [] })
    expect(new TeachingStore(dir).get('p1').soundsLike).toEqual([])
  })
  it('rejects a verse or ambiguous duplicate as a book-name alias', () => {
    const store = new TeachingStore(dir)
    const a = { heard: 'rawmeans', means: 'Romans 8:1', source: 'taught' as const, hits: 0 }
    expect(() => store.patch('p1', { soundsLike: [a] })).toThrow('Bible book')
    a.means = 'Romans'
    expect(() => store.patch('p1', { soundsLike: [a, a] })).toThrow('one correction')
  })
  it('corrects approved book names only beside reference cues and preserves numbers', () => {
    const aliases = new TeachingStore(dir).patch('p1', { soundsLike: [{ heard: 'raw means', means: 'Romans', source: 'taught', hits: 0 }] }).soundsLike
    expect(applyBookAliases('Turn to raw means chapter eight verse one.', aliases)).toBe('Turn to Romans chapter eight verse one.')
    expect(applyBookAliases('raw means 8:18', aliases)).toBe('Romans 8:18')
    expect(applyBookAliases('I explained what raw means in cooking.', aliases)).toBe('I explained what raw means in cooking.')
    expect(applyBookAliases('draw means chapter eight', aliases)).toBe('draw means chapter eight')
  })
  it('leaves a corrupt file untouched instead of silently overwriting it', () => {
    fs.writeFileSync(path.join(dir, 'p1.json'), '{bad')
    expect(() => new TeachingStore(dir).patch('p1', { voiceCommands: false })).toThrow('left unchanged')
    expect(fs.readFileSync(path.join(dir, 'p1.json'), 'utf8')).toBe('{bad')
  })
})
