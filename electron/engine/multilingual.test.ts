import { describe, it, expect } from 'vitest'
import {
  SpokenReferenceResolver,
  makePackNumberParser,
  type ResolvedReference
} from './referenceResolver'
import { getLanguagePack } from './lang'
import { chineseNumberValue } from './lang/zh'
import { VoiceCommandEngine, type VoiceCommandCallbacks } from './voiceCommands'
import { DEFAULT_COMMANDS, mergeCommandConfigs } from './commandConfig'

function collect(langCode: string) {
  const detections: ResolvedReference[] = []
  let t = 1_000_000
  const resolver = new SpokenReferenceResolver((d) => detections.push(d), {
    pack: getLanguagePack(langCode),
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

describe('Spanish (es)', () => {
  it('resolves "juan capitulo tres versiculo dieciseis"', () => {
    const { detections, feed } = collect('es')
    feed('vayamos a juan capitulo tres versiculo dieciseis')
    const full = detections.find((d) => d.verse === 16)
    expect(full).toBeDefined()
    expect(full!.book).toBe('John')
    expect(full!.chapter).toBe(3)
  })

  it('resolves "primera de corintios trece cuatro" with accents spoken', () => {
    const { detections, feed } = collect('es')
    feed('primera de corintios trece cuatro')
    const full = detections.find((d) => d.verse === 4)
    expect(full).toBeDefined()
    expect(full!.book).toBe('1 Corinthians')
    expect(full!.chapter).toBe(13)
  })

  it('parses "treinta y cuatro" via the pack number parser', () => {
    const parse = makePackNumberParser(getLanguagePack('es'))
    expect(parse(['treinta', 'y', 'cuatro'], 0)).toEqual({ value: 34, consumed: 3 })
    expect(parse(['veintiuno'], 0)).toEqual({ value: 21, consumed: 1 })
  })

  it('salmo + hundred chapter: "salmo ciento diecinueve versiculo once"', () => {
    const { detections, feed } = collect('es')
    feed('salmo ciento diecinueve versiculo once')
    const full = detections.find((d) => d.verse === 11)
    expect(full).toBeDefined()
    expect(full!.book).toBe('Psalms')
    expect(full!.chapter).toBe(119)
  })

  it('English still works with the Spanish pack active (code-switching)', () => {
    const { detections, feed } = collect('es')
    feed('turn with me to john chapter three verse sixteen')
    expect(detections.some((d) => d.book === 'John' && d.verse === 16)).toBe(true)
  })
})

describe('French (fr)', () => {
  it('resolves "jean chapitre trois verset seize"', () => {
    const { detections, feed } = collect('fr')
    feed('ouvrez vos bibles a jean chapitre trois verset seize')
    const full = detections.find((d) => d.verse === 16)
    expect(full).toBeDefined()
    expect(full!.book).toBe('John')
    expect(full!.chapter).toBe(3)
  })

  it('handles French compound numbers: "psaume cent dix neuf"', () => {
    const { detections, feed } = collect('fr')
    feed('psaume cent dix neuf verset onze')
    const full = detections.find((d) => d.verse === 11)
    expect(full).toBeDefined()
    expect(full!.book).toBe('Psalms')
    expect(full!.chapter).toBe(119)
  })

  it('parses quatre-vingt forms', () => {
    const parse = makePackNumberParser(getLanguagePack('fr'))
    expect(parse('quatre vingt dix neuf'.split(' '), 0)?.value).toBe(99)
    expect(parse('soixante quinze'.split(' '), 0)?.value).toBe(75)
  })

  it('resolves "premiere corinthiens treize quatre"', () => {
    const { detections, feed } = collect('fr')
    feed('premiere corinthiens treize quatre')
    const full = detections.find((d) => d.verse === 4)
    expect(full).toBeDefined()
    expect(full!.book).toBe('1 Corinthians')
  })
})

describe('Portuguese (pt)', () => {
  it('resolves "joao capitulo tres versiculo dezesseis"', () => {
    const { detections, feed } = collect('pt')
    feed('abram suas biblias em joao capitulo tres versiculo dezesseis')
    const full = detections.find((d) => d.verse === 16)
    expect(full).toBeDefined()
    expect(full!.book).toBe('John')
    expect(full!.chapter).toBe(3)
  })

  it('parses "trinta e quatro"', () => {
    const parse = makePackNumberParser(getLanguagePack('pt'))
    expect(parse(['trinta', 'e', 'quatro'], 0)).toEqual({ value: 34, consumed: 3 })
  })
})

describe('Hindi (hi)', () => {
  it('resolves "यूहन्ना अध्याय 3 आयत 16" (digits, as ASR emits)', () => {
    const { detections, feed } = collect('hi')
    feed('यूहन्ना अध्याय 3 आयत 16')
    const full = detections.find((d) => d.verse === 16)
    expect(full).toBeDefined()
    expect(full!.book).toBe('John')
    expect(full!.chapter).toBe(3)
  })

  it('resolves Hindi number words: "यूहन्ना अध्याय तीन आयत सोलह"', () => {
    const { detections, feed } = collect('hi')
    feed('यूहन्ना अध्याय तीन आयत सोलह')
    const full = detections.find((d) => d.verse === 16)
    expect(full).toBeDefined()
    expect(full!.book).toBe('John')
  })
})

describe('Chinese (zh) — substring mode', () => {
  it('converts Chinese numerals', () => {
    expect(chineseNumberValue('十六')).toBe(16)
    expect(chineseNumberValue('三')).toBe(3)
    expect(chineseNumberValue('二十三')).toBe(23)
    expect(chineseNumberValue('一百一十九')).toBe(119)
    expect(chineseNumberValue('23')).toBe(23)
  })

  it('resolves "约翰福音3章16节"', () => {
    const { detections, feed } = collect('zh')
    feed('请翻开约翰福音3章16节')
    const full = detections.find((d) => d.verse === 16)
    expect(full).toBeDefined()
    expect(full!.book).toBe('John')
    expect(full!.chapter).toBe(3)
  })

  it('resolves Chinese numerals "约翰福音三章十六节"', () => {
    const { detections, feed } = collect('zh')
    feed('约翰福音三章十六节')
    expect(detections.some((d) => d.book === 'John' && d.chapter === 3 && d.verse === 16)).toBe(true)
  })

  it('resolves Psalms with 篇: "诗篇23篇1节"', () => {
    const { detections, feed } = collect('zh')
    feed('诗篇23篇1节')
    expect(detections.some((d) => d.book === 'Psalms' && d.chapter === 23 && d.verse === 1)).toBe(true)
  })

  it('resolves colon style "罗马书8:28"', () => {
    const { detections, feed } = collect('zh')
    feed('罗马书8:28')
    expect(detections.some((d) => d.book === 'Romans' && d.chapter === 8 && d.verse === 28)).toBe(true)
  })
})

describe('Config merging + localized voice commands', () => {
  it('unions pack phrases with defaults (nothing removed)', () => {
    const merged = mergeCommandConfigs(DEFAULT_COMMANDS, getLanguagePack('es')!.commands)
    expect(merged.prayerStart).toContain('let us pray')
    expect(merged.prayerStart).toContain('oremos')
    expect(merged.verseWords).toContain('verse')
    expect(merged.verseWords).toContain('versiculo')
    const rvr = merged.versionPhrases.find((v) => v.code === 'RVR')
    expect(rvr!.phrases).toContain('reina valera')
  })

  it('user config adds custom phrases', () => {
    const merged = mergeCommandConfigs(DEFAULT_COMMANDS, {
      prayerStart: ['father we come to you'],
      versionPhrases: [{ phrases: ['the old king james'], code: 'KJV' }]
    })
    expect(merged.prayerStart).toContain('father we come to you')
    expect(merged.prayerStart).toContain('let us pray')
    const kjv = merged.versionPhrases.find((v) => v.code === 'KJV')
    expect(kjv!.phrases).toContain('the old king james')
    expect(kjv!.phrases).toContain('king james version')
  })

  it('Spanish corrections work: "yo dije versiculo treinta y cuatro"', () => {
    let now = 1_000_000
    const corrections: number[] = []
    const es = getLanguagePack('es')!
    const cb: VoiceCommandCallbacks = {
      getDisplayedRef: () => ({ book: 'Matthew', chapter: 6, verse: 24, displayedAt: now - 5000 }),
      getAvailableVersions: () => ['KJV', 'RVR'],
      onVersionSwitch: () => {},
      onVerseCorrection: (v) => corrections.push(v),
      onChapterCorrection: () => {},
      onDismiss: () => {},
      onHold: () => {},
      onPrayerChange: () => {},
      onCommand: () => {}
    }
    const engine = new VoiceCommandEngine(cb, {
      config: mergeCommandConfigs(DEFAULT_COMMANDS, es.commands),
      numberParser: makePackNumberParser(es),
      now: () => now
    })
    expect(engine.process('no no yo dije versiculo treinta y cuatro')).toBe(true)
    expect(corrections).toEqual([34])
  })

  it('Spanish version switch: "en la reina valera"', () => {
    let now = 1_000_000
    const switched: string[] = []
    const es = getLanguagePack('es')!
    const cb: VoiceCommandCallbacks = {
      getDisplayedRef: () => ({ book: 'John', chapter: 3, verse: 16, displayedAt: now - 2000 }),
      getAvailableVersions: () => ['KJV', 'RVR'],
      onVersionSwitch: (v) => switched.push(v),
      onVerseCorrection: () => {},
      onChapterCorrection: () => {},
      onDismiss: () => {},
      onHold: () => {},
      onPrayerChange: () => {},
      onCommand: () => {}
    }
    const engine = new VoiceCommandEngine(cb, {
      config: mergeCommandConfigs(DEFAULT_COMMANDS, es.commands),
      numberParser: makePackNumberParser(es),
      now: () => now
    })
    expect(engine.process('leamoslo en la reina valera')).toBe(true)
    expect(switched).toEqual(['RVR'])
  })
})
