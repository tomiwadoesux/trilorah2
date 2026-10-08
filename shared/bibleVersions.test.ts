import { describe, expect, it } from 'vitest'
import {
  BIBLE_VERSIONS, VERSION_CODE_RE, requiresInitials, setVersionCredits, sortVersions, versionCredit, versionHint, versionLabel,
  versionName, versionOptions, versionRowOptions,
} from './bibleVersions'

describe('the Bible version catalogue', () => {
  it('names every version bible.db ships, and the two added with it', () => {
    for (const code of ['KJV', 'WEB', 'BBE', 'RVR', 'AA', 'APEE', 'CUV', 'BSB', 'ASV']) {
      expect(BIBLE_VERSIONS[code]?.bundled, code).toBe(true)
      expect(versionName(code)).not.toBe(code)
    }
    expect(versionLabel('WEB')).toBe('WEB · World English Bible')
    expect(versionLabel('BSB')).toBe('BSB · Berean Standard Bible')
    expect(versionLabel('RVR')).toBe('RVR · Reina-Valera · Spanish')
    expect(versionLabel('ZZZ')).toBe('ZZZ')
  })

  it('says the language for a Bible that is not English', () => {
    expect(versionHint('RVR')).toBe('Reina-Valera · Spanish')
    expect(versionHint('KJV')).toBe('King James Version')
    expect(versionHint('ZZZ')).toBe('')
  })

  it('marks every licensed translation as carrying its initials', () => {
    for (const code of ['NKJV', 'NIV', 'ESV', 'NLT', 'NASB', 'AMP', 'MSG', 'CSB']) {
      expect(BIBLE_VERSIONS[code].licence, code).toBe('licensed')
      expect(requiresInitials(code), code).toBe(true)
      expect(BIBLE_VERSIONS[code].bundled, code).toBe(false)
    }
    for (const code of ['KJV', 'WEB', 'BSB', 'ASV']) expect(requiresInitials(code), code).toBe(false)
    expect(requiresInitials('niv')).toBe(true)
    expect(requiresInitials('')).toBe(false)
    expect(requiresInitials(null)).toBe(false)
    // Unknown: nobody can vouch for its terms, so it carries its name.
    expect(requiresInitials('XYZ')).toBe(true)
  })

  it('orders a picker with the English Bibles first and unknown codes last', () => {
    expect(sortVersions(['WEB', 'AA', 'KJV', 'ZZ', 'BSB', 'CUV', 'KJV'])).toEqual(['KJV', 'BSB', 'WEB', 'AA', 'CUV', 'ZZ'])
    expect(versionOptions(['WEB', 'KJV'])).toEqual([
      { value: 'KJV', label: 'KJV', hint: 'King James Version' },
      { value: 'WEB', label: 'WEB', hint: 'World English Bible' },
    ])
  })

  it('keeps every code short enough for the pickers', () => {
    for (const code of Object.keys(BIBLE_VERSIONS)) expect(code).toMatch(VERSION_CODE_RE)
    expect('TOO-LONG').not.toMatch(VERSION_CODE_RE)
  })

  it('lists online Bibles as such, and greys the ones a key has not unlocked with the reason', () => {
    const options = versionRowOptions([
      { code: 'KJV', name: 'King James Version', source: 'bundled', available: true },
      { code: 'NIV', name: 'Invented NIV title', source: 'online', available: true, attribution: 'Invented copyright' },
      { code: 'TPT', name: 'Invented Passion title', source: 'online', available: true },
      { code: 'NKJV', name: 'New King James Version', source: 'online', available: false, note: 'needs a YouVersion key' },
    ])
    expect(options).toEqual([
      { value: 'KJV', label: 'KJV', hint: 'King James Version' },
      { value: 'NIV', label: 'NIV', hint: 'New International Version · online' },
      { value: 'TPT', label: 'TPT', hint: 'Invented Passion title · online' },
      { value: 'NKJV', label: 'NKJV', hint: 'needs a YouVersion key', disabled: true },
    ])
  })
})

describe("an online Bible's copyright line", () => {
  it('keeps the line main lists for each online Bible, tidied, and none for the rest', () => {
    setVersionCredits([
      { code: 'NIV', attribution: '  Invented copyright\n line for testing.  ' },
      { code: 'NKJV', attribution: null },
      { code: 'kjv', attribution: '' },
    ])
    expect(versionCredit('NIV')).toBe('Invented copyright line for testing.')
    expect(versionCredit('niv')).toBe('Invented copyright line for testing.')
    expect(versionCredit('NKJV')).toBeNull()
    expect(versionCredit('KJV')).toBeNull()
    expect(versionCredit(undefined)).toBeNull()
  })
  it('forgets a line main no longer lists (a key refused, a Bible withdrawn)', () => {
    setVersionCredits([{ code: 'NIV', attribution: 'Invented line' }])
    setVersionCredits([])
    expect(versionCredit('NIV')).toBeNull()
  })
})
