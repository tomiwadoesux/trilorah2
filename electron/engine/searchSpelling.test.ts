import { describe, expect, it } from 'vitest'
import { correctSearchSpelling } from './searchSpelling'
import { PassageMatcher } from './passageMatcher'

describe('typed scripture spelling', () => {
  it('repairs swapped letters and missing letters, and reports the changes', () => {
    expect(correctSearchSpelling('Abraahm offers his son')).toEqual({
      text: 'Abraham offers his son', corrections: [{ from: 'Abraahm', to: 'Abraham' }],
    })
    expect(correctSearchSpelling('Jesus calms the stomr').text).toBe('Jesus calms the storm')
  })

  it('keeps real words, short ambiguous words, and non-English text', () => {
    const text = 'peace, piece, Job, job, love, lost, foi, miséricorde, 耶稣'
    expect(correctSearchSpelling(text)).toEqual({ text, corrections: [] })
  })

  it('leaves equally plausible corrections for the operator to clarify', () => {
    // Both “stone” and “store” are one edit away.
    expect(correctSearchSpelling('stoxe')).toEqual({ text: 'stoxe', corrections: [] })
    // Abram and Abraham are both valid names one edit from this spelling.
    expect(correctSearchSpelling('Abrahm')).toEqual({ text: 'Abrahm', corrections: [] })
  })

  it('corrects before retrieval so misspelled names reach the real passage matcher', () => {
    const query = correctSearchSpelling('Dvaid faced Goliath with five smooth stones')
    expect(query.text).toBe('David faced Goliath with five smooth stones')
    expect(new PassageMatcher().detect(query.text)).toMatchObject({ book: '1 Samuel', chapter: 17 })
  })

  it('preserves punctuation and never invents an answer from gibberish', () => {
    expect(correctSearchSpelling('“Abraahm”—his son!').text).toBe('“Abraham”—his son!')
    expect(correctSearchSpelling('zzxxqqrrtt')).toEqual({ text: 'zzxxqqrrtt', corrections: [] })
  })
})
