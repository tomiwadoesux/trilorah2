/**
 * Scripture → stock background preset.
 *
 * Given a reference (and optionally the church season) pick the preset the
 * operator would most likely reach for. Specific passages win first, then
 * the season, then the book's genre, then a safe text-friendly wash.
 *
 * Preset ids are duplicated from src/lib/stockPresets.ts (STOCK_PRESETS)
 * rather than imported: tsconfig.electron.json only includes electron/ and
 * shared/, and main-process code should not pull renderer modules. The
 * test cross-checks this list against the source of truth.
 */

export const PRESET_IDS = [
  'light', 'dawn', 'stars', 'mountains', 'ocean', 'river', 'forest', 'desert', 'fields', 'harvest',
  'rain', 'storm', 'fire', 'snow', 'rainbow', 'rock',
  'cross', 'bible', 'candle', 'communion', 'crown', 'shepherd', 'dove', 'path', 'door', 'anchor',
  'vine', 'seed', 'potter', 'water', 'boat', 'armor', 'lion', 'eagle', 'olive', 'tomb',
  'advent', 'christmas', 'epiphany', 'lent', 'palm', 'goodfriday', 'easter', 'pentecost', 'thanksgiving', 'newyear',
  'hands', 'prayer', 'congregation', 'children', 'unity', 'nations', 'city', 'family', 'generations',
  'bokeh', 'texture', 'marble', 'ink', 'gradient', 'smoke', 'glass', 'linen', 'geometric'
] as const

export type PresetId = (typeof PRESET_IDS)[number]

export interface ReferenceLike {
  /** Book name, abbreviation, or 0-based canonical index. */
  book: string | number
  chapter?: number
  verse?: number
}

export interface PresetPick {
  presetId: PresetId
  reason: string
}

// ----------------------------------------------------------------- books

const BOOKS: readonly string[] = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations',
  'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
  'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts',
  'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
  'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
  'Jude', 'Revelation'
]

const ALIASES: Record<string, string> = {
  psalm: 'Psalms', ps: 'Psalms', gen: 'Genesis', ex: 'Exodus', exo: 'Exodus', matt: 'Matthew', mt: 'Matthew',
  mk: 'Mark', lk: 'Luke', jn: 'John', rev: 'Revelation', revelations: 'Revelation', eph: 'Ephesians',
  rom: 'Romans', isa: 'Isaiah', jer: 'Jeremiah', ezek: 'Ezekiel', dan: 'Daniel', prov: 'Proverbs',
  song: 'Song of Solomon', 'song of songs': 'Song of Solomon', canticles: 'Song of Solomon', heb: 'Hebrews',
  jas: 'James', phil: 'Philippians', col: 'Colossians', gal: 'Galatians', eccl: 'Ecclesiastes', deut: 'Deuteronomy'
}

function normaliseBookKey(s: string): string {
  return s.toLowerCase().replace(/^(\d)\s*(?=[a-z])/, '$1 ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

/** Resolve a name / abbreviation / 0-based index to the canonical book name, or null. */
export function canonicalBook(book: string | number): string | null {
  if (typeof book === 'number') return BOOKS[book] ?? null
  const key = normaliseBookKey(book)
  if (!key) return null
  if (ALIASES[key]) return ALIASES[key]
  const exact = BOOKS.find((b) => b.toLowerCase() === key)
  if (exact) return exact
  const prefix = BOOKS.filter((b) => b.toLowerCase().startsWith(key))
  return prefix.length === 1 ? prefix[0] : prefix[0] ?? null
}

// ------------------------------------------------------------- mapping

interface PassageRule {
  book: string
  chapter?: number
  presetId: PresetId
  reason: string
}

/** Specific passages. Chapter-less rules match the whole book. */
const PASSAGES: PassageRule[] = [
  { book: 'Genesis', chapter: 1, presetId: 'light', reason: 'Genesis 1 — "let there be light", creation' },
  { book: 'Genesis', chapter: 9, presetId: 'rainbow', reason: 'Genesis 9 — the rainbow covenant' },
  { book: 'Exodus', chapter: 3, presetId: 'fire', reason: 'Exodus 3 — the burning bush' },
  { book: 'Exodus', chapter: 14, presetId: 'ocean', reason: 'Exodus 14 — crossing the Red Sea' },
  { book: 'Psalms', chapter: 23, presetId: 'shepherd', reason: 'Psalm 23 — the Lord is my shepherd' },
  { book: 'Psalms', chapter: 1, presetId: 'river', reason: 'Psalm 1 — a tree planted by streams of water' },
  { book: 'Psalms', chapter: 8, presetId: 'stars', reason: 'Psalm 8 — the heavens, the work of your fingers' },
  { book: 'Psalms', chapter: 19, presetId: 'stars', reason: 'Psalm 19 — the heavens declare the glory of God' },
  { book: 'Psalms', chapter: 121, presetId: 'mountains', reason: 'Psalm 121 — I lift my eyes to the hills' },
  { book: 'Isaiah', chapter: 40, presetId: 'eagle', reason: 'Isaiah 40 — they shall mount up with wings as eagles' },
  { book: 'Isaiah', chapter: 53, presetId: 'cross', reason: 'Isaiah 53 — the suffering servant' },
  { book: 'Isaiah', chapter: 64, presetId: 'potter', reason: 'Isaiah 64 — we are the clay, you are the potter' },
  { book: 'Jeremiah', chapter: 18, presetId: 'potter', reason: 'Jeremiah 18 — at the potter\'s house' },
  { book: 'Jeremiah', chapter: 29, presetId: 'dawn', reason: 'Jeremiah 29 — plans to give you a hope and a future' },
  { book: 'Daniel', chapter: 6, presetId: 'lion', reason: 'Daniel 6 — the lions\' den' },
  { book: 'Jonah', chapter: 1, presetId: 'storm', reason: 'Jonah 1 — the storm at sea' },
  { book: 'Matthew', chapter: 2, presetId: 'epiphany', reason: 'Matthew 2 — the wise men follow the star' },
  { book: 'Matthew', chapter: 4, presetId: 'desert', reason: 'Matthew 4 — the wilderness temptation' },
  { book: 'Matthew', chapter: 8, presetId: 'boat', reason: 'Matthew 8 — Jesus calms the storm' },
  { book: 'Matthew', chapter: 13, presetId: 'seed', reason: 'Matthew 13 — the parable of the sower' },
  { book: 'Matthew', chapter: 21, presetId: 'palm', reason: 'Matthew 21 — the triumphal entry' },
  { book: 'Matthew', chapter: 26, presetId: 'communion', reason: 'Matthew 26 — the Last Supper' },
  { book: 'Matthew', chapter: 27, presetId: 'cross', reason: 'Matthew 27 — the crucifixion' },
  { book: 'Matthew', chapter: 28, presetId: 'tomb', reason: 'Matthew 28 — the empty tomb' },
  { book: 'Mark', chapter: 4, presetId: 'boat', reason: 'Mark 4 — the sower and the storm on the lake' },
  { book: 'Mark', chapter: 15, presetId: 'cross', reason: 'Mark 15 — the crucifixion' },
  { book: 'Mark', chapter: 16, presetId: 'tomb', reason: 'Mark 16 — the empty tomb' },
  { book: 'Luke', chapter: 2, presetId: 'christmas', reason: 'Luke 2 — the nativity' },
  { book: 'Luke', chapter: 5, presetId: 'boat', reason: 'Luke 5 — the miraculous catch of fish' },
  { book: 'Luke', chapter: 15, presetId: 'family', reason: 'Luke 15 — the prodigal son comes home' },
  { book: 'Luke', chapter: 22, presetId: 'communion', reason: 'Luke 22 — the Last Supper' },
  { book: 'Luke', chapter: 23, presetId: 'cross', reason: 'Luke 23 — the crucifixion' },
  { book: 'Luke', chapter: 24, presetId: 'tomb', reason: 'Luke 24 — the resurrection' },
  { book: 'John', chapter: 1, presetId: 'light', reason: 'John 1 — the light shines in the darkness' },
  { book: 'John', chapter: 3, presetId: 'dove', reason: 'John 3 — born of the Spirit' },
  { book: 'John', chapter: 4, presetId: 'water', reason: 'John 4 — living water at the well' },
  { book: 'John', chapter: 6, presetId: 'communion', reason: 'John 6 — the bread of life' },
  { book: 'John', chapter: 10, presetId: 'shepherd', reason: 'John 10 — the good shepherd' },
  { book: 'John', chapter: 15, presetId: 'vine', reason: 'John 15 — I am the vine' },
  { book: 'John', chapter: 19, presetId: 'cross', reason: 'John 19 — the crucifixion' },
  { book: 'John', chapter: 20, presetId: 'tomb', reason: 'John 20 — the empty tomb' },
  { book: 'Acts', chapter: 1, presetId: 'nations', reason: 'Acts 1 — to the ends of the earth' },
  { book: 'Acts', chapter: 2, presetId: 'pentecost', reason: 'Acts 2 — Pentecost' },
  { book: 'Acts', chapter: 27, presetId: 'storm', reason: 'Acts 27 — the shipwreck' },
  { book: 'Romans', chapter: 8, presetId: 'dawn', reason: 'Romans 8 — nothing can separate us from the love of God' },
  { book: 'Ephesians', chapter: 6, presetId: 'armor', reason: 'Ephesians 6 — the armour of God' },
  { book: 'Hebrews', chapter: 6, presetId: 'anchor', reason: 'Hebrews 6 — an anchor for the soul' },
  { book: 'Hebrews', chapter: 11, presetId: 'path', reason: 'Hebrews 11 — the walk of faith' },
  { book: 'Revelation', chapter: 3, presetId: 'door', reason: 'Revelation 3 — I stand at the door and knock' },
  { book: 'Revelation', chapter: 21, presetId: 'city', reason: 'Revelation 21 — the new Jerusalem' },
  { book: 'Revelation', chapter: 22, presetId: 'river', reason: 'Revelation 22 — the river of the water of life' },
  { book: 'Revelation', presetId: 'crown', reason: 'Revelation — the crown of life, the King of kings' },
  { book: 'Song of Solomon', presetId: 'fields', reason: 'Song of Solomon — gardens and vineyards' },
  { book: 'Ruth', presetId: 'harvest', reason: 'Ruth — gleaning in the barley fields' },
  { book: 'Job', presetId: 'storm', reason: 'Job — the Lord answers out of the whirlwind' }
]

const SEASON_PRESETS: Record<string, PresetId> = {
  advent: 'advent',
  christmas: 'christmas',
  epiphany: 'epiphany',
  lent: 'lent',
  'palm sunday': 'palm',
  'holy week': 'goodfriday',
  'good friday': 'goodfriday',
  easter: 'easter',
  eastertide: 'easter',
  pentecost: 'pentecost',
  thanksgiving: 'thanksgiving',
  harvest: 'harvest',
  'new year': 'newyear',
  newyear: 'newyear'
}

const PROPHETS = new Set([
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah',
  'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'
])
const GOSPELS = new Set(['Matthew', 'Mark', 'Luke', 'John'])
const EPISTLES = new Set([
  'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians',
  '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
  'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude'
])
const WISDOM = new Set(['Proverbs', 'Ecclesiastes', 'Job'])
const LAW = new Set(['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'])

export function presetForSeason(season: string | undefined): PresetId | null {
  if (!season) return null
  const key = season.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return SEASON_PRESETS[key] ?? null
}

export function presetForReference(ref: ReferenceLike, season?: string): PresetPick {
  const book = canonicalBook(ref.book)
  const chapter = ref.chapter

  if (book) {
    const specific =
      (chapter !== undefined && PASSAGES.find((r) => r.book === book && r.chapter === chapter)) ||
      PASSAGES.find((r) => r.book === book && r.chapter === undefined)
    if (specific) return { presetId: specific.presetId, reason: specific.reason }
  }

  const seasonal = presetForSeason(season)
  if (seasonal) return { presetId: seasonal, reason: `season: ${season}` }

  if (!book) return { presetId: 'gradient', reason: 'unknown book — safe text-friendly wash' }
  if (book === 'Psalms') return { presetId: 'bokeh', reason: 'Psalms — warm worship wash' }
  if (PROPHETS.has(book)) return { presetId: 'desert', reason: `${book} — a prophet, the wilderness` }
  if (GOSPELS.has(book)) return { presetId: 'path', reason: `${book} — a gospel, walking with Jesus` }
  if (EPISTLES.has(book)) return { presetId: 'gradient', reason: `${book} — an epistle, soft gradient` }
  if (book === 'Acts') return { presetId: 'nations', reason: 'Acts — the church goes to the nations' }
  if (WISDOM.has(book)) return { presetId: 'candle', reason: `${book} — wisdom literature` }
  if (LAW.has(book)) return { presetId: 'mountains', reason: `${book} — the law given on the mountain` }
  return { presetId: 'texture', reason: `${book} — history, neutral dark texture` }
}
