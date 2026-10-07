import { describe, it, expect } from 'vitest'
import {
  SpokenReferenceResolver,
  parseSpokenNumber,
  parseNumberToken,
  normalizeWords,
  type ResolvedReference
} from './referenceResolver'

function collect(opts: { gate?: () => boolean } = {}) {
  const detections: ResolvedReference[] = []
  let t = 1_000_000
  const resolver = new SpokenReferenceResolver((d) => detections.push(d), {
    bareBookGate: opts.gate ?? (() => true),
    now: () => t
  })
  return {
    detections,
    feed: (text: string, isFinal = true) => resolver.process(text, isFinal),
    tick: (ms: number) => {
      t += ms
    }
  }
}

describe('parseSpokenNumber', () => {
  it('parses digits, words, tens, and hundreds', () => {
    expect(parseSpokenNumber(['16'], 0)).toEqual({ value: 16, consumed: 1 })
    expect(parseSpokenNumber(['three'], 0)).toEqual({ value: 3, consumed: 1 })
    expect(parseSpokenNumber(['twenty', 'three'], 0)).toEqual({ value: 23, consumed: 2 })
    expect(parseSpokenNumber(['ninety'], 0)).toEqual({ value: 90, consumed: 1 })
    expect(parseSpokenNumber(['one', 'hundred', 'and', 'nineteen'], 0)).toEqual({
      value: 119,
      consumed: 4
    })
  })
  it('parseNumberToken handles full-string numbers only', () => {
    expect(parseNumberToken('thirty four')).toBe(34)
    expect(parseNumberToken('34')).toBe(34)
    expect(parseNumberToken('thirty four please')).toBeNull()
  })
})

describe('normalizeWords', () => {
  it('expands colon references', () => {
    expect(normalizeWords('John 3:16')).toEqual(['john', '3', '16'])
  })
})

describe('SpokenReferenceResolver', () => {
  it('resolves "John chapter three verse sixteen" with high confidence', () => {
    const { detections, feed } = collect()
    feed('turn with me to john chapter three verse sixteen')
    const full = detections.find((d) => d.verse === 16)
    expect(full).toBeDefined()
    expect(full!.book).toBe('John')
    expect(full!.chapter).toBe(3)
    expect(full!.confidence).toBeGreaterThanOrEqual(0.95)
  })

  it('resolves "john three sixteen" (bare numbers)', () => {
    const { detections, feed } = collect()
    feed('john three sixteen')
    const full = detections.find((d) => d.verse === 16)
    expect(full).toBeDefined()
    expect(full!.book).toBe('John')
    expect(full!.chapter).toBe(3)
  })

  it('resolves ASR-style "john 3:16"', () => {
    const { detections, feed } = collect()
    feed('john 3:16')
    expect(detections.some((d) => d.book === 'John' && d.chapter === 3 && d.verse === 16)).toBe(true)
  })

  it('buffers numbers across chunks: "john" … "three" … "sixteen"', () => {
    const { detections, feed, tick } = collect()
    feed('turn to the book of john')
    tick(1500)
    feed('chapter three')
    tick(1500)
    feed('verse sixteen')
    const full = detections.find((d) => d.verse === 16)
    expect(full).toBeDefined()
    expect(full!.book).toBe('John')
    expect(full!.chapter).toBe(3)
  })

  it('joins an explicit chapter continuation after a book-only partial', () => {
    const { detections, feed } = collect()
    feed('turn to the book of john', false)
    feed('chapter three', true)
    feed('verse sixteen', true)
    expect(detections.at(-1)).toMatchObject({ book: 'John', chapter: 3, verse: 16 })
  })

  it('does not attach a new bare numeric utterance to a completed reference', () => {
    const { detections, feed, tick } = collect()
    feed('romans eight one')
    tick(1500)
    feed('six five')
    expect(detections).toHaveLength(1)
    feed('galatians six five')
    expect(detections.at(-1)).toMatchObject({ book: 'Galatians', chapter: 6, verse: 5 })
  })

  it('does NOT read the "1" of "1 John" as a chapter (book-name stripping)', () => {
    const { detections, feed } = collect()
    feed('first john three sixteen')
    const full = detections.find((d) => d.verse !== null)
    expect(full).toBeDefined()
    expect(full!.book).toBe('1 John')
    expect(full!.chapter).toBe(3)
    expect(full!.verse).toBe(16)
  })

  it('resolves aliases: "first corinthians thirteen four"', () => {
    const { detections, feed } = collect()
    feed('first corinthians thirteen four')
    const full = detections.find((d) => d.verse !== null)
    expect(full).toBeDefined()
    expect(full!.book).toBe('1 Corinthians')
    expect(full!.chapter).toBe(13)
    expect(full!.verse).toBe(4)
  })

  it('handles "psalm one hundred and nineteen verse eleven"', () => {
    const { detections, feed } = collect()
    feed('psalm one hundred and nineteen verse eleven')
    const full = detections.find((d) => d.verse === 11)
    expect(full).toBeDefined()
    expect(full!.book).toBe('Psalms')
    expect(full!.chapter).toBe(119)
  })

  it('handles ranges: "romans eight verses one to four"', () => {
    const { detections, feed } = collect()
    feed('romans chapter eight verses one to four')
    const full = detections.find((d) => d.verse === 1)
    expect(full).toBeDefined()
    expect(full!.book).toBe('Romans')
    expect(full!.rangeEnd).toBe(4)
  })

  it('handles "the third chapter of john"', () => {
    const { detections, feed } = collect()
    feed('the third chapter of john')
    const chap = detections.find((d) => d.chapter === 3)
    expect(chap).toBeDefined()
    expect(chap!.book).toBe('John')
    expect(chap!.verse).toBeNull()
  })

  it('suppresses bare book mentions when the gate says no (narrative mode)', () => {
    const { detections, feed } = collect({ gate: () => false })
    feed('when paul wrote to the romans he was in prison')
    expect(detections.filter((d) => d.book === 'Romans' && d.chapter === null)).toHaveLength(0)
  })

  it('still allows explicit references through a closed gate', () => {
    const { detections, feed } = collect({ gate: () => false })
    feed('romans chapter five verse eight')
    const full = detections.find((d) => d.verse === 8)
    expect(full).toBeDefined()
    expect(full!.book).toBe('Romans')
    expect(full!.chapter).toBe(5)
  })

  it('dedupes identical detections within the window', () => {
    const { detections, feed, tick } = collect()
    feed('john three sixteen')
    tick(1000)
    feed('john three sixteen')
    expect(detections.filter((d) => d.verse === 16)).toHaveLength(1)
    tick(5000)
    feed('john three sixteen')
    expect(detections.filter((d) => d.verse === 16)).toHaveLength(2)
  })

  it('expires pending book state after the TTL', () => {
    const { detections, feed, tick } = collect()
    feed('turn to john')
    tick(10_000)
    feed('three sixteen')
    // "three sixteen" with no live pending book must not invent John 3:16
    expect(detections.filter((d) => d.verse === 16)).toHaveLength(0)
  })

  it('emits bare "verse N" updates without book context', () => {
    const { detections, feed } = collect()
    feed('verse twenty four')
    const bare = detections.find((d) => d.verse === 24)
    expect(bare).toBeDefined()
    expect(bare!.book).toBe('')
  })
})

describe('preaching-cadence fixes', () => {
  const ref = (d: ResolvedReference) => `${d.book} ${d.chapter}:${d.verse}${d.endVerse ? '-' + d.endVerse : ''}`

  it('"verse four and five" is one passage, not two detections', () => {
    const c = collect()
    c.feed('genesis chapter one verse four and five')
    expect(c.detections.map(ref)).toEqual(['Genesis 1:4-5'])
  })
  it('"verses four and verse five" too', () => {
    const c = collect()
    c.feed('genesis chapter one verses four and verse five')
    expect(c.detections.map(ref)).toEqual(['Genesis 1:4-5'])
  })
  it('non-consecutive "and" stays two places', () => {
    const c = collect()
    c.feed('genesis chapter one verse four and nine')
    expect(c.detections.map(ref)[0]).toBe('Genesis 1:4')
    expect(c.detections.some((d) => d.endVerse === 9)).toBe(false)
  })
  it('"and" followed by speech is not a range', () => {
    const c = collect()
    c.feed('genesis chapter one verse four and the lord said')
    expect(c.detections.map(ref)).toEqual(['Genesis 1:4'])
  })
  it('"chapter nine verse two" a minute later stays in the book being preached', () => {
    const c = collect()
    c.feed('exodus chapter four verse seven')
    c.tick(60_000)
    c.feed('then lets go to chapter nine verse two')
    expect(c.detections.map(ref)).toEqual(['Exodus 4:7', 'Exodus 9:2'])
  })
  it('a bare number never borrows the remembered book', () => {
    const c = collect()
    c.feed('exodus chapter four verse seven')
    c.tick(60_000)
    c.feed('there were nine of them and two came back')
    expect(c.detections.map(ref)).toEqual(['Exodus 4:7'])
  })
})

describe('SpokenReferenceResolver — a growing utterance emits once, complete', () => {
  const ref = (d: ResolvedReference) =>
    `${d.book} ${d.chapter}:${d.verse}${d.endVerse ? '-' + d.endVerse : ''}`
  // Deepgram re-sends the whole sentence as it grows, so every one of these
  // partials is a complete-looking parse of a sentence that is not over yet.
  // Before the hold, the projector showed each of them in turn.
  it('never shows the tens part of a compound verse number', () => {
    const c = collect()
    c.feed('romans', false)
    c.feed('romans four', false)
    c.feed('romans four twenty', false)
    c.feed('romans four twenty one', false)
    c.feed('romans four twenty one', true)
    expect(c.detections.map(ref)).toEqual(['Romans 4:21'])
  })

  it('delivers a closed reference before the utterance finishes', () => {
    const c = collect()
    c.feed('john three sixteen', false)
    expect(c.detections).toEqual([])
    c.feed('john three sixteen for god so loved the world', false)
    expect(c.detections.map(ref)).toEqual(['John 3:16'])
    c.tick(6000)
    c.feed('john three sixteen for god so loved the world', true)
    expect(c.detections.map(ref)).toEqual(['John 3:16'])
    c.feed('verse seventeen')
    expect(c.detections.map(ref)).toEqual(['John 3:16', 'John 3:17'])
  })

  it('keeps a growing range held until reading moves past its endpoint', () => {
    const c = collect()
    c.feed('romans four twenty', false)
    c.feed('romans four twenty one', false)
    c.feed('romans four twenty one to', false)
    c.feed('romans four twenty one to twenty two', false)
    expect(c.detections).toEqual([])
    c.feed('romans four twenty one to twenty two says', false)
    expect(c.detections.map(ref)).toEqual(['Romans 4:21-22'])
  })

  it('does not treat a name or chapter alone as a complete early reference', () => {
    const c = collect()
    c.feed('john was a boy', false)
    c.feed('john chapter three says', false)
    expect(c.detections).toEqual([])
  })

  it('recognizes a completed duplicate without replacing it with a quote guess', () => {
    const detections: ResolvedReference[] = []
    const resolver = new SpokenReferenceResolver((data) => detections.push(data))
    expect(resolver.process('john three sixteen for god so loved', false)).toBe(true)
    expect(resolver.process('john three sixteen for god so loved', true)).toBe(true)
    expect(detections).toHaveLength(1)
    expect(resolver.process('and the preacher continued teaching', true)).toBe(false)
  })

  it('holds every tens boundary, not just twenty', () => {
    for (const [spoken, expected] of [
      ['thirty one', 'Romans 4:31'],
      ['forty two', 'Romans 4:42'],
      ['fifty five', 'Romans 4:55']
    ] as const) {
      const c = collect()
      const words = spoken.split(' ')
      c.feed(`romans four ${words[0]}`, false)
      c.feed(`romans four ${spoken}`, false)
      c.feed(`romans four ${spoken}`, true)
      expect(c.detections.map(ref)).toEqual([expected])
    }
  })

  it('never shows the endpoints of a range before the range', () => {
    const c = collect()
    c.feed('romans 4 21', false)
    c.feed('romans 4 21 to', false)
    c.feed('romans 4 21 to 22', false)
    c.feed('romans 4 21 to 22', true)
    expect(c.detections.map(ref)).toEqual(['Romans 4:21-22'])
  })

  it('releases the held reference when the final adds no new words', () => {
    // Deepgram routinely closes an utterance with a chunk identical to the
    // last partial. The reference must not sit held forever.
    const c = collect()
    c.feed('john three sixteen', false)
    c.feed('john three sixteen', true)
    expect(c.detections.map(ref)).toEqual(['John 3:16'])
  })

  it('a finals-only provider is unaffected', () => {
    // whisper-local never sends a partial, so nothing is ever held.
    const c = collect()
    c.feed('romans four twenty one')
    expect(c.detections.map(ref)).toEqual(['Romans 4:21'])
  })

  it('drops a held reference the preacher abandoned mid-sentence', () => {
    const c = collect()
    c.feed('romans four twenty', false)
    c.tick(60_000)
    c.feed('anyway lets pray', true)
    expect(c.detections.map(ref)).toEqual([])
  })

  it('does not emit a bare verse from an unfinished hypothesis', () => {
    const c = collect()
    c.feed('verse twenty', false)
    c.feed('verse twenty four', false)
    expect(c.detections).toEqual([])
    c.feed('verse twenty four', true)
    expect(c.detections.map((d) => d.verse)).toEqual([24])
  })

  it('drops a reference removed from the final transcript', () => {
    const c = collect()
    c.feed('romans chapter four verse twenty', false)
    c.feed('remain in faith and love', true)
    expect(c.detections).toEqual([])
  })

  it('does not release an expired hypothesis on an empty final', () => {
    const c = collect()
    c.feed('romans four twenty', false)
    c.tick(10_000)
    c.feed('', true)
    expect(c.detections).toEqual([])
  })

  it('releases a fresh hypothesis despite older expired book context', () => {
    const c = collect()
    c.feed('romans eight one')
    c.tick(10_000)
    c.feed('galatians six five', false)
    c.feed('', true)
    expect(c.detections.map(ref)).toEqual(['Romans 8:1', 'Galatians 6:5'])
  })

  it('does not inherit a book removed from a revised partial', () => {
    const c = collect()
    c.feed('john', false)
    c.feed('there were three sixteen year olds', true)
    expect(c.detections).toEqual([])
  })

  it('marks a newly named book separately from remembered context', () => {
    const c = collect()
    c.feed('john 3:16')
    c.tick(60_000)
    c.feed('chapter four verse two')
    expect(c.detections.map((d) => d.explicitBook)).toEqual([true, false])
  })

  describe('numbers the transcriber mangles', () => {
    it('splits a run-together chapter and verse', () => {
      const { feed, detections } = collect()
      feed('exodus 165')
      expect(detections.at(-1)).toMatchObject({ book: 'Exodus', chapter: 16, verse: 5 })
      feed('john 3016')
      expect(detections.at(-1)).toMatchObject({ book: 'John', chapter: 3, verse: 16 })
    })
    it('leaves a real three-digit chapter alone', () => {
      const { feed, detections } = collect()
      feed('psalm 119')
      expect(detections.at(-1)).toMatchObject({ book: 'Psalms', chapter: 119 })
    })
    it('hears "six teen" as sixteen', () => {
      const { feed, detections } = collect()
      feed('exodus six teen five')
      expect(detections.at(-1)).toMatchObject({ book: 'Exodus', chapter: 16, verse: 5 })
    })
  })
})
