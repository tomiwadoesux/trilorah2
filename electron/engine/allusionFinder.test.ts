import fs from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { AllusionFinder } from './allusionFinder'
import { bibleNames, bibleNamesIn } from './bibleNames'
import { NameMemory } from './nameMemory'
import { PassageMatcher } from './passageMatcher'
import { SemanticMatcher, loadEmbedder, loadJudge } from './semanticMatcher'
import { SermonContext } from './sermonContext'
import { WordPiece } from './wordpiece'

describe('bibleNames', () => {
  it('reads the names off the Bible text', () => {
    expect(bibleNames().size).toBeGreaterThan(1500)
    expect(bibleNamesIn('Mephibosheth ate at the table of David')).toEqual(['mephibosheth', 'david'])
  })
  it('does not hear everyday words or titles as people', () => {
    expect(bibleNamesIn('he lost his job on the eve of the wedding and the lord helped him')).toEqual([])
  })
})

describe('NameMemory', () => {
  it('hands the last name to a later he/she sentence', () => {
    const memory = new NameMemory()
    memory.note('think about Jacob for a moment', 0)
    expect(memory.carry('he wrestled all night and would not let go', 30_000)).toBe('jacob')
  })
  it('keeps out of sentences that name someone or talk about nobody', () => {
    const memory = new NameMemory()
    memory.note('think about Jacob for a moment', 0)
    expect(memory.carry('Esau ran to meet him and embraced him', 1_000)).toBe('')
    expect(memory.carry('we are starting a new class this month', 1_000)).toBe('')
  })
  it('does not hand a woman to "he" or a man to "she"', () => {
    const memory = new NameMemory()
    memory.note('Ruth went to the field of Boaz', 0)
    expect(memory.carry('he noticed and asked whose young woman is this', 1_000)).toBe('boaz')
    expect(memory.carry('she gathered what was left behind', 1_000)).toBe('ruth')
    expect(memory.carry('they sat down to eat together', 1_000)).toBe('ruth boaz')
  })
  it('forgets after a while, and when the subject becomes Jesus', () => {
    const memory = new NameMemory()
    memory.note('David was a shepherd', 0)
    expect(memory.carry('he was the youngest', 120_000)).toBe('')
    memory.note('David was a shepherd', 0)
    memory.note('but Jesus went to the cross', 1_000)
    expect(memory.carry('he died for us', 2_000)).toBe('')
  })
})

describe('SermonContext', () => {
  it('favours the chapter on the wall and its neighbours, for a while', () => {
    const sermon = new SermonContext()
    sermon.noteLive('Genesis', 22, 0)
    expect(sermon.boost('Genesis', 22, 1_000)).toBeGreaterThan(0)
    expect(sermon.boost('Genesis', 23, 1_000)).toBeGreaterThan(0)
    expect(sermon.boost('Genesis', 30, 1_000)).toBe(0)
    expect(sermon.boost('Numbers', 22, 1_000)).toBe(0)
    expect(sermon.boost('Genesis', 22, 60 * 60_000)).toBe(0)
  })
})

describe('WordPiece pairs', () => {
  it('joins two texts and marks which is which', () => {
    const tokenizer = new WordPiece({ '[UNK]': 100, '[CLS]': 101, '[SEP]': 102, he: 1, ran: 2, david: 3 })
    expect(tokenizer.encodePair('he ran', 'david ran')).toEqual({ ids: [101, 1, 2, 102, 3, 2, 102], types: [0, 0, 0, 0, 1, 1, 1] })
  })
})

const data = path.join(process.cwd(), 'data', 'models')
const vectors = path.join(process.cwd(), 'electron', 'data', 'passages', 'bsb-vectors.bin')
// The models are fetched, not committed: npm run passages:model.
const installed = fs.existsSync(vectors) && ['all-MiniLM-L6-v2', 'ms-marco-MiniLM-L-6-v2'].every(name => fs.existsSync(path.join(data, name, 'model_quantized.onnx')))

describe.skipIf(!installed)('AllusionFinder with the bundled models', () => {
  const stories = new PassageMatcher()
  const finder = new AllusionFinder({ semantic: null, judge: null, detectStory: text => stories.detect(text) })
  const words = (text: string) => text.split(' ')
  beforeAll(async () => {
    const semantic = new SemanticMatcher()
    expect(semantic.loadVectors(vectors)).toBe(true)
    semantic.setEmbedder(await loadEmbedder(path.join(data, 'all-MiniLM-L6-v2')))
    finder.install(semantic, await loadJudge(path.join(data, 'ms-marco-MiniLM-L-6-v2')))
  })

  it('uses the remembered name for a later "he" sentence', async () => {
    /* Without the name the judge rules the guesses out and the button finds
       nothing; with it, the flood. (Ruth used to be the example here, but
       since the judge gates the button it finds Ruth 1 even unnamed.) */
    const said = 'he kept building for years while people laughed and then the rain came'
    finder.names.reset()
    expect((await finder.find(words(said))).some(hit => hit.book === 'Genesis' && (hit.chapter === 6 || hit.chapter === 7))).toBe(false)
    finder.names.note('Think about Noah')
    expect((await finder.find(words(said)))[0]).toMatchObject({ book: 'Genesis', chapter: 7 })
    finder.names.reset()
  })

  it('answers the button with four at most, and with nothing for ordinary talk', async () => {
    finder.names.reset()
    finder.sermon.reset()
    const found = await finder.find(words('Abraham took his only son up the mountain to offer him and God provided a ram'))
    expect(found.length).toBeGreaterThan(0)
    expect(found.length).toBeLessThanOrEqual(4)
    expect(found[0]).toMatchObject({ book: 'Genesis', chapter: 22 })
    expect(await finder.find(words('the car park behind the church will be closed next sunday for repairs'))).toEqual([])
  })

  it('reads an unclear sentence in the light of the passage on the wall', async () => {
    const said = 'he waited two more days before going to them'
    finder.sermon.reset()
    expect((await finder.find(words(said))).slice(0, 4).some(hit => hit.book === 'John' && hit.chapter === 11)).toBe(false)
    finder.sermon.noteLive('John', 11)
    expect((await finder.find(words(said))).slice(0, 4).some(hit => hit.book === 'John' && hit.chapter === 11)).toBe(true)
    finder.sermon.reset()
  })

  it('suggests an allusion unasked and stays silent on ordinary talk', async () => {
    expect(await finder.suggest('Moses saw a bush that was on fire but it was not burning up and God spoke to him from it')).toMatchObject({ book: 'Exodus', chapter: 3 })
    for (const said of [
      'we need to love one another more and forgive those who hurt us',
      'every giant in your life is coming down this year',
      'he called me last night and said pastor I do not know what to do',
      'the car park behind the church will be closed next sunday for repairs',
      'Let us pray. Father, thank you for your word. In Jesus name, amen.',
      'Father we thank you for this morning and for every family here',
    ]) expect(await finder.suggest(said)).toBeNull()
  })
})
