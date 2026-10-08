import { describe, expect, it } from 'vitest'
import { chooseVersion } from './versionChoice'

const INSTALLED = ['KJV', 'BSB', 'WEB', 'ASV']

describe('chooseVersion', () => {
  it('uses the version asked for when this computer has it, whatever its case', () => {
    expect(chooseVersion('BSB', 'KJV', INSTALLED)).toEqual({ version: 'BSB', missing: null })
    expect(chooseVersion(' web ', 'KJV', INSTALLED)).toEqual({ version: 'WEB', missing: null })
  })

  it('falls back to the church default, then KJV, and names what was missing', () => {
    expect(chooseVersion('NIV', 'ASV', INSTALLED)).toEqual({ version: 'ASV', missing: 'NIV' })
    expect(chooseVersion('NIV', 'NKJV', INSTALLED)).toEqual({ version: 'KJV', missing: 'NIV' })
    expect(chooseVersion('NIV', 'NKJV', ['WEB', 'BSB'])).toEqual({ version: 'WEB', missing: 'NIV' })
  })

  it('a default that is not installed is itself reported when it is what was asked for', () => {
    // activeVersion() asks for the saved default when the service has not chosen one.
    expect(chooseVersion('NKJV', 'NKJV', INSTALLED)).toEqual({ version: 'KJV', missing: 'NKJV' })
  })

  it('asking for nothing is not a missing version', () => {
    expect(chooseVersion('', 'BSB', INSTALLED)).toEqual({ version: 'BSB', missing: null })
    expect(chooseVersion(undefined, undefined, INSTALLED)).toEqual({ version: 'KJV', missing: null })
    expect(chooseVersion(null, 42, [])).toEqual({ version: 'KJV', missing: null })
  })
})
