import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { VocabularyStore, applyVocabulary, deepgramKeywords, soundsLike } from './vocabulary'

describe('applyVocabulary', () => {
  it('rebuilds a name the ASR split into English words', () => {
    expect(applyVocabulary('pastor I owe to me one', ['Pastor Ayotomiwa'])).toBe('Pastor Ayotomiwa')
    expect(applyVocabulary('welcome pastor i owe to me one, to the pulpit', ['Pastor Ayotomiwa'])).toBe(
      'welcome Pastor Ayotomiwa, to the pulpit'
    )
  })

  it('fixes single-word near misses and keeps the term casing', () => {
    expect(applyVocabulary('brother olusegun is here', ['Brother Olusegun'])).toBe('Brother Olusegun is here')
    expect(applyVocabulary('philippians four thirteen', ['Phillippians'])).toBe('Phillippians four thirteen')
  })

  it('does not corrupt unrelated text', () => {
    const text = 'and then the next thing paul says is turn with me to romans eight'
    expect(applyVocabulary(text, ['Pastor Ayotomiwa', 'Grace Chapel'])).toBe(text)
    expect(applyVocabulary('i owe to me one dollar', ['Pastor Ayotomiwa'])).toBe('i owe to me one dollar')
    expect(applyVocabulary('one two three', ['One'])).toBe('One two three')
  })

  it('never replaces exact common words from a single token', () => {
    expect(applyVocabulary('go to the store', ['Tobi'])).toBe('go to the store')
    expect(applyVocabulary('we love the lord', ['Love'])).toBe('we Love the lord')
  })

  it('is a no-op with no terms', () => {
    expect(applyVocabulary('hello there', [])).toBe('hello there')
  })

  it('does not swallow a following word on an exact hit', () => {
    expect(applyVocabulary('ayotomiwa is preaching', ['Ayotomiwa'])).toBe('Ayotomiwa is preaching')
  })
})

describe('soundsLike', () => {
  it('rejects a partial split ("i owe to me" lacks a syllable)', () => {
    expect(soundsLike(['i', 'owe', 'to', 'me'], 'ayotomiwa')).toBe(false)
    expect(soundsLike(['i', 'owe', 'to', 'me', 'one'], 'ayotomiwa')).toBe(true)
  })
})

describe('deepgramKeywords', () => {
  it('emits one boosted keyword per distinct vocabulary word, skipping fillers', () => {
    expect(deepgramKeywords(['Pastor Ayotomiwa', 'Grace Chapel of the Lord', 'Ayotomiwa'])).toEqual([
      'Pastor:2',
      'Ayotomiwa:2',
      'Grace:2',
      'Chapel:2'
    ])
  })
})

describe('VocabularyStore', () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-test-'))
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('persists per preacher, dedupes, add/remove', () => {
    const store = new VocabularyStore(dir)
    expect(store.get('p1')).toEqual({ terms: [] })
    store.set('p1', ['Pastor Ayotomiwa', ' Grace Chapel ', 'Pastor Ayotomiwa'])
    expect(store.get('p1').terms).toEqual(['Pastor Ayotomiwa', 'Grace Chapel'])
    store.add('p1', 'Deacon Bola')
    store.remove('p1', 'grace chapel')
    expect(new VocabularyStore(dir).get('p1').terms).toEqual(['Pastor Ayotomiwa', 'Deacon Bola'])
    expect(fs.existsSync(path.join(dir, 'vocabulary', 'p1.json'))).toBe(true)
  })
})
