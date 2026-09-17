import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  DEFAULT_COMMANDS,
  mergeCommandConfigs,
  stripIgnoreTails,
  loadPreacherCommandConfig,
  savePreacherCommandConfig,
  addPreacherPhrase,
  removePreacherPhrase,
  preacherCommandFilePath
} from './commandConfig'

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmdcfg-test-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('DEFAULT_COMMANDS navigation phrases', () => {
  it('contains only multi-word phrases — no bare "next" / "back"', () => {
    const risky = ['next', 'back', 'continue', 'before', 'go on', 'move on', 'keep going', 'previous']
    for (const list of [DEFAULT_COMMANDS.navNext, DEFAULT_COMMANDS.navPrevious]) {
      for (const p of list) {
        expect(p.split(' ').length).toBeGreaterThan(1)
        expect(risky).not.toContain(p)
      }
    }
    expect(DEFAULT_COMMANDS.hold).toContain('hold that')
    expect(DEFAULT_COMMANDS.hold).toContain('hold it there')
  })
})

describe('mergeCommandConfigs', () => {
  it('unions ignoreTails like any other list', () => {
    const merged = mergeCommandConfigs(DEFAULT_COMMANDS, { ignoreTails: ['amen'] })
    expect(merged.ignoreTails).toEqual(['amen'])
    const again = mergeCommandConfigs(merged, { ignoreTails: ['amen', 'say verse ten'] })
    expect(again.ignoreTails).toEqual(['amen', 'say verse ten'])
    expect(again.navNext).toEqual(DEFAULT_COMMANDS.navNext)
  })
})

describe('stripIgnoreTails', () => {
  it('removes a habitual tail, repeatedly', () => {
    expect(stripIgnoreTails('romans eight twenty eight amen', ['amen'])).toBe('romans eight twenty eight')
    expect(stripIgnoreTails('romans eight twenty eight, amen amen!', ['amen'])).toBe('romans eight twenty eight')
  })
  it('handles multi-word tails and leaves the middle alone', () => {
    expect(stripIgnoreTails('john three sixteen say verse ten', ['say verse ten', 'amen'])).toBe('john three sixteen')
    expect(stripIgnoreTails('amen john three sixteen', ['amen'])).toBe('amen john three sixteen')
  })
  it('is a no-op with no tails', () => {
    expect(stripIgnoreTails('John 3:16', [])).toBe('John 3:16')
  })
})

describe('per-preacher command layer', () => {
  it('returns an empty layer when no file exists', () => {
    expect(loadPreacherCommandConfig(dir, 'pastor-a')).toEqual({})
    expect(fs.existsSync(preacherCommandFilePath(dir, 'pastor-a'))).toBe(false)
  })

  it('saves, unions and reloads phrases', () => {
    savePreacherCommandConfig(dir, 'pastor-a', { dismiss: ['drop that'], ignoreTails: ['amen'] })
    savePreacherCommandConfig(dir, 'pastor-a', { dismiss: ['drop that', 'lose it'] })
    const loaded = loadPreacherCommandConfig(dir, 'pastor-a')
    expect(loaded.dismiss).toEqual(['drop that', 'lose it'])
    expect(loaded.ignoreTails).toEqual(['amen'])
    const merged = mergeCommandConfigs(DEFAULT_COMMANDS, loaded)
    expect(merged.dismiss).toContain('drop that')
    expect(merged.dismiss).toContain('take that down')
  })

  it('addPreacherPhrase / removePreacherPhrase round-trip', () => {
    addPreacherPhrase(dir, 'pastor/b', 'navNext', 'Roll It Forward ')
    expect(loadPreacherCommandConfig(dir, 'pastor/b').navNext).toEqual(['roll it forward'])
    expect(fs.existsSync(path.join(dir, 'preacher-commands', 'pastor_b.json'))).toBe(true)
    removePreacherPhrase(dir, 'pastor/b', 'navNext', 'roll it forward')
    expect(loadPreacherCommandConfig(dir, 'pastor/b').navNext).toBeUndefined()
  })

  it('unions versionPhrases by code', () => {
    savePreacherCommandConfig(dir, 'p', { versionPhrases: [{ phrases: ['the king jimmy'], code: 'KJV' }] })
    savePreacherCommandConfig(dir, 'p', { versionPhrases: [{ phrases: ['king jimmy'], code: 'KJV' }] })
    expect(loadPreacherCommandConfig(dir, 'p').versionPhrases).toEqual([
      { code: 'KJV', phrases: ['the king jimmy', 'king jimmy'] }
    ])
  })
})
