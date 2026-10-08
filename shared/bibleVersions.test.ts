import { describe, expect, it } from 'vitest'
import {
  BIBLE_VERSIONS, VERSION_CODE_RE, requiresInitials, sortVersions, versionHint, versionLabel, versionName, versionOptions,
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
})
