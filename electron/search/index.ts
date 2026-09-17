/**
 * Local search over the command registry.
 *
 * No LLM at runtime. Scoring is a blend of:
 *   - BM25 over title + keywords + description (tokenised, lowercased,
 *     lightly stemmed), with query tokens fuzzily expanded against the
 *     index vocabulary so "deepgrm" still hits "deepgram";
 *   - trigram (Dice) similarity between the whole query and the title /
 *     keywords, so "postog" finds "PostHog";
 *   - an exact-keyword boost when the query (or one of its tokens) is
 *     literally one of the entry's keywords;
 *   - optionally cosine similarity from an EmbeddingProvider, blended at
 *     0.5 weight against the lexical score.
 *
 * Results come back split: navigation (screens, sections, settings) and
 * actions, because the palette treats them differently (actions need
 * Shift+Enter).
 */
import type { CommandRegistry, RegistryEntry, RegistryKind } from './registry'

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>
}

/** Placeholder provider: no vectors, lexical scoring only. */
export class NullEmbedding implements EmbeddingProvider {
  async embed(): Promise<number[]> {
    return []
  }
}

export interface SearchHit {
  entry: RegistryEntry
  score: number
  kind: RegistryKind
}

export interface SearchResults {
  navigation: SearchHit[]
  actions: SearchHit[]
}

export interface SearchOptions {
  limit?: number
}

// ---------------------------------------------------------------- text utils

const STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'is', 'it',
  'i', 'my', 'me', 'we', 'you', 'do', 'does', 'how', 'where', 'what', 'can',
  'want', 'need', 'please', 'this', 'that', 'with', 'at', 'by', 'from', 'up'
])

export function stem(word: string): string {
  if (word.length <= 3) return word
  let w = word
  if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y'
  else if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3)
  else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2)
  else if (w.endsWith('es') && w.length > 4 && /[sxz]es$|[cs]hes$/.test(w)) w = w.slice(0, -2)
  else if (w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)
  // Fold "change"/"changed", "verse"/"verses" onto one key.
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1)
  return w
}

export function tokenize(text: string, { dropStopwords = true } = {}): string[] {
  const raw = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  const out: string[] = []
  for (const t of raw) {
    if (dropStopwords && STOPWORDS.has(t)) continue
    out.push(stem(t))
  }
  return out
}

export function trigrams(text: string): Set<string> {
  const s = `  ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
  const grams = new Set<string>()
  for (let i = 0; i + 3 <= s.length; i++) grams.add(s.slice(i, i + 3))
  return grams
}

/** Dice coefficient over trigram sets, 0..1. */
export function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const ga = trigrams(a)
  const gb = trigrams(b)
  if (ga.size === 0 || gb.size === 0) return 0
  let shared = 0
  for (const g of ga) if (gb.has(g)) shared++
  return (2 * shared) / (ga.size + gb.size)
}

function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// ------------------------------------------------------------------- index

interface IndexedDoc {
  entry: RegistryEntry
  tf: Map<string, number>
  length: number
  keywordSet: Set<string>
  keywordTokens: Set<string>
  titleLower: string
  vector?: number[]
}

const BM25_K1 = 1.4
const BM25_B = 0.6
/** Title / keyword tokens count this many times more than description tokens. */
const TITLE_WEIGHT = 3
const KEYWORD_WEIGHT = 2
const FUZZY_TOKEN_MIN_SIM = 0.5
const MIN_SCORE = 0.08

export class SearchIndex {
  private docs: IndexedDoc[] = []
  private df = new Map<string, number>()
  private vocabulary: string[] = []
  private avgLength = 1
  private embed: EmbeddingProvider | null
  private built = false
  private vectorsReady: Promise<void> | null = null

  constructor(
    private registry: CommandRegistry,
    opts: { embed?: EmbeddingProvider } = {}
  ) {
    this.embed = opts.embed && !(opts.embed instanceof NullEmbedding) ? opts.embed : null
  }

  /** Rebuild the lexical index from the registry. Called lazily by search(). */
  build(): void {
    this.docs = []
    this.df = new Map()
    let total = 0
    for (const entry of this.registry.all()) {
      const tf = new Map<string, number>()
      const add = (tokens: string[], weight: number) => {
        for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + weight)
      }
      add(tokenize(entry.title), TITLE_WEIGHT)
      add(tokenize(entry.keywords.join(' ')), KEYWORD_WEIGHT)
      add(tokenize(entry.description), 1)
      let length = 0
      for (const [term, n] of tf) {
        length += n
        this.df.set(term, (this.df.get(term) ?? 0) + 1)
      }
      total += length
      this.docs.push({
        entry,
        tf,
        length,
        keywordSet: new Set(entry.keywords.map((k) => k.toLowerCase().trim())),
        keywordTokens: new Set(tokenize(entry.keywords.join(' '))),
        titleLower: entry.title.toLowerCase()
      })
    }
    this.avgLength = this.docs.length ? total / this.docs.length : 1
    this.vocabulary = [...this.df.keys()]
    this.built = true
    this.vectorsReady = null
  }

  /** Precompute entry vectors when an embedding provider is present. */
  async ready(): Promise<void> {
    if (!this.built) this.build()
    if (!this.embed) return
    if (!this.vectorsReady) {
      const embed = this.embed
      this.vectorsReady = (async () => {
        for (const d of this.docs) {
          d.vector = await embed.embed(`${d.entry.title}. ${d.entry.keywords.join(', ')}. ${d.entry.description}`)
        }
      })()
    }
    await this.vectorsReady
  }

  private idf(term: string): number {
    const n = this.docs.length
    const df = this.df.get(term) ?? 0
    return Math.log(1 + (n - df + 0.5) / (df + 0.5))
  }

  /** Expand each query token to (token, weight) pairs using trigram similarity against the vocabulary. */
  private expandQuery(tokens: string[]): Map<string, number> {
    const terms = new Map<string, number>()
    for (const t of tokens) {
      if (this.df.has(t)) {
        terms.set(t, Math.max(terms.get(t) ?? 0, 1))
        continue
      }
      if (t.length < 4) continue
      for (const v of this.vocabulary) {
        if (Math.abs(v.length - t.length) > 3) continue
        const sim = trigramSimilarity(t, v)
        if (sim >= FUZZY_TOKEN_MIN_SIM) terms.set(v, Math.max(terms.get(v) ?? 0, sim * 0.8))
      }
    }
    return terms
  }

  private bm25(doc: IndexedDoc, terms: Map<string, number>): number {
    let score = 0
    for (const [term, weight] of terms) {
      const f = doc.tf.get(term)
      if (!f) continue
      const norm = f * (BM25_K1 + 1) / (f + BM25_K1 * (1 - BM25_B + BM25_B * (doc.length / this.avgLength)))
      score += weight * this.idf(term) * norm
    }
    return score
  }

  private fuzzyTitle(doc: IndexedDoc, query: string): number {
    let best = trigramSimilarity(query, doc.titleLower)
    for (const k of doc.keywordSet) {
      const s = trigramSimilarity(query, k)
      if (s > best) best = s
    }
    return best
  }

  private exactBoost(doc: IndexedDoc, query: string, tokens: string[]): number {
    if (doc.keywordSet.has(query) || doc.titleLower === query) return 1
    if (tokens.length === 0) return 0
    let hits = 0
    for (const t of tokens) if (doc.keywordTokens.has(t)) hits++
    return hits / tokens.length
  }

  /** Lexical-only search, synchronous. */
  searchSync(query: string, opts: SearchOptions = {}): SearchResults {
    return this.rank(query, opts, null)
  }

  /** Full search; awaits embeddings when a provider is configured. */
  async search(query: string, opts: SearchOptions = {}): Promise<SearchResults> {
    if (!this.built) this.build()
    let qv: number[] | null = null
    if (this.embed && query.trim()) {
      await this.ready()
      qv = await this.embed.embed(query)
    }
    return this.rank(query, opts, qv)
  }

  private rank(rawQuery: string, opts: SearchOptions, queryVector: number[] | null): SearchResults {
    if (!this.built) this.build()
    const limit = opts.limit ?? 8
    const query = rawQuery.toLowerCase().replace(/\s+/g, ' ').trim()
    if (!query) return { navigation: [], actions: [] }

    const tokens = tokenize(query)
    const terms = this.expandQuery(tokens.length ? tokens : tokenize(query, { dropStopwords: false }))

    const raw = this.docs.map((doc) => ({
      doc,
      bm25: this.bm25(doc, terms),
      fuzzy: this.fuzzyTitle(doc, query),
      exact: this.exactBoost(doc, query, tokens)
    }))
    const maxBm25 = raw.reduce((m, r) => Math.max(m, r.bm25), 0) || 1

    const useVectors = queryVector !== null && queryVector.length > 0
    const hits: SearchHit[] = []
    for (const r of raw) {
      const lexical = 0.55 * (r.bm25 / maxBm25) + 0.3 * r.fuzzy + 0.15 * r.exact
      let score = lexical
      if (useVectors && r.doc.vector && r.doc.vector.length) {
        score = 0.5 * lexical + 0.5 * Math.max(0, cosine(queryVector as number[], r.doc.vector))
      }
      if (score < MIN_SCORE) continue
      hits.push({ entry: r.doc.entry, score, kind: r.doc.entry.kind })
    }
    hits.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))

    const navigation: SearchHit[] = []
    const actions: SearchHit[] = []
    for (const h of hits) {
      if (h.kind === 'action') {
        if (actions.length < limit) actions.push(h)
      } else if (navigation.length < limit) {
        navigation.push(h)
      }
      if (navigation.length >= limit && actions.length >= limit) break
    }
    return { navigation, actions }
  }
}
