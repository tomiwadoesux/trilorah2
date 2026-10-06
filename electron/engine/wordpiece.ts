/**
 * BERT uncased WordPiece, enough to feed the bundled sentence model.
 *
 * Written out rather than pulled from a tokenizer library: the library that
 * owns this also brings its own model runtime, image codecs and a browser
 * build, several hundred megabytes for sixty lines of string handling.
 */

const CLS = 101
const SEP = 102
const UNK = 100
const MAX_WORD = 100

const isPunctuation = (char: string) => /[\p{P}\p{S}]/u.test(char)

export class WordPiece {
  private vocab: Map<string, number>

  constructor(vocab: Record<string, number>) {
    this.vocab = new Map(Object.entries(vocab))
  }

  static fromTokenizerJson(json: string): WordPiece {
    return new WordPiece((JSON.parse(json) as { model: { vocab: Record<string, number> } }).model.vocab)
  }

  /** Token ids with [CLS] and [SEP], cut to `limit` tokens. */
  encode(text: string, limit = 256): number[] {
    const ids = [CLS]
    const clean = text.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/[\u0000-\u001f\u007f�]/g, ' ')
    for (const chunk of clean.split(/\s+/)) {
      if (!chunk) continue
      // Punctuation stands alone: "son," is "son" and ",".
      let word = ''
      const words: string[] = []
      for (const char of chunk) {
        if (isPunctuation(char)) {
          if (word) words.push(word)
          words.push(char)
          word = ''
        } else word += char
      }
      if (word) words.push(word)
      for (const piece of words) {
        for (const id of this.pieces(piece)) {
          if (ids.length >= limit - 1) return [...ids, SEP]
          ids.push(id)
        }
      }
    }
    return [...ids, SEP]
  }

  /**
   * Two texts for a model that reads them together: [CLS] a [SEP] b [SEP].
   * `b` is cut to fit; `types` marks which text each token belongs to.
   */
  encodePair(a: string, b: string, limit = 512): { ids: number[]; types: number[] } {
    const first = this.encode(a, Math.min(limit - 2, 128))
    const second = this.encode(b, limit - first.length + 1).slice(1)
    return { ids: [...first, ...second], types: [...first.map(() => 0), ...second.map(() => 1)] }
  }

  /** Longest piece first; a word with any unknown part is unknown whole. */
  private pieces(word: string): number[] {
    if (word.length > MAX_WORD) return [UNK]
    const out: number[] = []
    let start = 0
    while (start < word.length) {
      let end = word.length
      let found: number | undefined
      while (start < end) {
        found = this.vocab.get((start > 0 ? '##' : '') + word.slice(start, end))
        if (found !== undefined) break
        end--
      }
      if (found === undefined) return [UNK]
      out.push(found)
      start = end
    }
    return out
  }
}
