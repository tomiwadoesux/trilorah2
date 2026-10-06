import fs from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { SemanticMatcher, loadEmbedder, semanticUnits } from './semanticMatcher'
import { WordPiece } from './wordpiece'

const vectors = path.join(process.cwd(), 'electron', 'data', 'passages', 'bsb-vectors.bin')
const model = path.join(process.cwd(), 'data', 'models', 'all-MiniLM-L6-v2')
// The model is fetched, not committed: npm run passages:model.
const installed = fs.existsSync(vectors) && fs.existsSync(path.join(model, 'model_quantized.onnx'))

describe('WordPiece', () => {
  const tokenizer = new WordPiece({ '[UNK]': 100, '[CLS]': 101, '[SEP]': 102, abraham: 1, son: 2, ',': 3, sacrific: 4, '##ed': 5, his: 6 })
  it('splits punctuation, lowercases and falls back to pieces', () => {
    expect(tokenizer.encode('Abraham, his son sacrificed')).toEqual([101, 1, 3, 6, 2, 4, 5, 102])
  })
  it('marks a word with no known pieces as unknown and respects the limit', () => {
    expect(tokenizer.encode('zzz son')).toEqual([101, 100, 2, 102])
    expect(tokenizer.encode('son son son son son', 4)).toEqual([101, 2, 2, 102])
  })
})

describe('SemanticMatcher without a model', () => {
  const matcher = new SemanticMatcher()
  it('stays silent rather than guessing', async () => {
    expect(matcher.ready).toBe(false)
    expect(await matcher.search('when God told Abraham to sacrifice his only son')).toEqual([])
  })
  it('refuses a vector file that does not fit the corpus', () => {
    const file = path.join(fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? '/tmp'), 'vec-')), 'bad.bin')
    fs.writeFileSync(file, Buffer.alloc(64))
    expect(matcher.loadVectors(file)).toBe(false)
  })
  it('covers every section with at least one unit', () => {
    expect(new Set(semanticUnits().map(unit => unit.passageId)).size).toBe(3086)
  })
})

describe.skipIf(!installed)('SemanticMatcher with the bundled model', () => {
  const matcher = new SemanticMatcher()
  beforeAll(async () => {
    expect(matcher.loadVectors(vectors)).toBe(true)
    matcher.setEmbedder(await loadEmbedder(model))
  })

  // Allusions in the preacher's words, not the Bible's.
  it.each([
    ["don't you think he was scared when God told Abraham that his only son, his only son should be sacrificed", 'Genesis', 22],
    ['Rachel was so desperate for a baby she told her husband give me children or I will die', 'Genesis', 30],
    ['he wrestled all night and would not let go until he got the blessing', 'Genesis', 32],
    ['Peter stepped out of the boat and started walking but when he looked at the wind he began to sink', 'Matthew', 14],
    ['she said where you go I will go and your people will be my people', 'Ruth', 1],
    ['he dipped himself seven times in the river and his skin became clean', '2 Kings', 5],
  ])('finds %s', async (said, book, chapter) => {
    const found = await matcher.search(said)
    expect(found.slice(0, 2).some(hit => hit.book === book && hit.chapter === chapter)).toBe(true)
  })

  it('is confident when meaning and wording agree', async () => {
    const [best] = await matcher.search('Moses saw a bush that was on fire but it was not burning up and God spoke to him from it')
    expect(best).toMatchObject({ book: 'Exodus', chapter: 3, confident: true })
  })

  // What the auto path must never put on the operator's screen.
  it.each([
    'we need to love one another more and forgive those who hurt us',
    'please remember that the youth meeting is tomorrow at five in the fellowship hall',
    'prayer is the key to everything in the life of a believer',
    'God is good all the time and all the time God is good',
    'he lost his house his car and his job in one month and still came to church',
    'we all face giants in our lives and we must stay strong',
  ])('is not confident about %s', async (said) => {
    const [best] = await matcher.search(said)
    expect(best?.confident ?? false).toBe(false)
  })
})
