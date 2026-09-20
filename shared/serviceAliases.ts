/**
 * What churches CALL the parts of a service — and which of Trilorah's segment
 * types each name means.
 *
 * The first schedule importer looked for the app's own words. A bulletin that
 * said "Sermon" imported; one that said "Preaching", "The Word", "Charge" or
 * "Ministration" lost the most important row of the morning, silently. That
 * is backwards: the app has nine words for a service and the church world has
 * a few hundred, so the app must learn the church's vocabulary, not the other
 * way round. This table is that vocabulary.
 *
 * Where the names come from (researched 2026-09, see the pass report):
 *   - RCCG North America, "Order of Church Services" manual — the published
 *     Sunday order: Prayer, Praise, Pastoral Prayer, Welcome of guest,
 *     Congregational Hymn, Special Number, The Word, Altar Call, Tithes &
 *     Offering, Announcements, Prayer for Children, Benediction. Its other
 *     orders add Opening Prayer, Praise & Worship, Bible/Scripture Reading,
 *     Short Exhortation, Love Offering, Processional/Recessional Hymn,
 *     "share the grace", Closing Prayer & Benediction.
 *   - United Methodist Book of Worship basic pattern — Gathering, Greeting,
 *     Opening Prayers and Praise, Prayer for Illumination, Scripture, Sermon,
 *     Response to the Word, Concerns and Prayers, Confession/Pardon/Peace,
 *     Offering, Thanksgiving and Communion, Sending Forth, Dismissal with
 *     Blessing. Anglican usage adds Collect, Lessons, Homily, Creed,
 *     Intercessions, Offertory, Notices, The Grace, Eucharist.
 *   - American evangelical planning guides (Pushpay sample programme,
 *     MinistryPass run-downs of seven churches) — Pre-service, Countdown,
 *     Call to Worship, Worship Set, Welcome and Connection, Giving, Message,
 *     Response, Next Steps, Blessing.
 *   - Nigerian Pentecostal usage generally (Winners, MFM, Christ Embassy
 *     publish no fixed order, so these are from common bulletins): High
 *     Praise, Ministration, Special Number, Choir Rendition, Seed, First
 *     Fruit, Thanksgiving, Testimony Time, Sharing the Grace.
 *
 * The type ids are the ones the app already has — SEGMENT_TYPES in the Live
 * screen (worship, sermon, welcome, announcements, offering, altar-call,
 * closing, communion, custom) plus the two extra ids the engine's SegmentType
 * already carries (prayer, pre-service). Nothing new is invented here. Rows a
 * church plainly has but the app has no type for — testimonies, the scripture
 * reading, a child dedication — match as 'custom' and carry a `wouldBe` hint,
 * so the importer recognises them today and a future type can claim them
 * without touching the matcher.
 *
 * Imports nothing, like everything in shared/: the Electron importer and the
 * renderer's paste-a-schedule box must give the identical answer.
 */

export type SegmentTypeId =
  | 'worship'
  | 'sermon'
  | 'welcome'
  | 'announcements'
  | 'offering'
  | 'altar-call'
  | 'closing'
  | 'communion'
  | 'prayer'
  | 'pre-service'
  | 'custom'

/**
 * Lowercase, apostrophes dropped, '&' spelt 'and' — the same shape
 * `normalise` produces, so what is written here is what is compared.
 * Plurals need not be listed: a trailing 's' on the bulletin is forgiven.
 */
export const SEGMENT_ALIASES: Record<Exclude<SegmentTypeId, 'custom'>, string[]> = {
  /*
   * Everything sung. A hymn, a choir piece and a "special number" are all
   * music-led moments: the engine wants lyrics on screen and scripture
   * detection quiet, which is exactly what 'worship' means to it. So they
   * land here rather than in a type of their own.
   */
  worship: [
    'worship',
    'praise',
    'praises',
    'praise and worship',
    'praise worship',
    'worship and praise',
    'high praise',
    'high praises',
    'praise session',
    'worship session',
    'worship set',
    'worship songs',
    'worship in songs',
    'songs of praise',
    'song service',
    'singing',
    'songs',
    'music',
    'choruses',
    'hymn',
    'opening hymn',
    'closing hymn',
    'closing song',
    'opening song',
    'opening praise',
    'congregational hymn',
    'congregational singing',
    'congregational song',
    'processional hymn',
    'recessional hymn',
    'processional',
    'hymn of praise',
    'hymn of response',
    'sermon hymn',
    'special number',
    'special song',
    'special music',
    'special rendition',
    'choir rendition',
    'choir ministration',
    'choir special',
    'choir number',
    'choir',
    'anthem',
    'song ministration',
    'ministration in songs',
    'music ministration',
    'guest artiste',
    'guest artist',
    'worship ministration',
    'adoration',
    'psalm',
    'gloria',
  ],

  /*
   * The preached word. "Ministration" is the awkward one: in Nigerian usage
   * it is the sermon when it stands alone ("Ministration — Pastor Bola") and
   * a song when qualified ("choir ministration"). The qualified forms are
   * under worship and are longer, so they win; the bare word falls here at
   * reduced confidence (see WEAK_ALIASES).
   */
  sermon: [
    'sermon',
    'message',
    'the message',
    'preaching',
    'preach',
    'word',
    'the word',
    'gods word',
    'word of god',
    'the word of god',
    'ministry of the word',
    'ministering of the word',
    'ministration of the word',
    'word ministration',
    'word session',
    'ministration',
    'exhortation',
    'short exhortation',
    'word of exhortation',
    'charge',
    'pastoral charge',
    'teaching',
    'bible teaching',
    'bible study',
    'homily',
    'sermonette',
    'talk',
    'address',
    'keynote',
    'proclamation',
    'proclamation of the word',
    'rhema',
    'word for the month',
    'prophetic word',
  ],

  /*
   * How the service opens. The opening prayer and the call to worship are
   * here, not under 'prayer': they are the front door of the service, the
   * Sunday template in run.tsx already files them under welcome, and an
   * operator looking for "where does it start" looks at the first segment.
   */
  welcome: [
    'welcome',
    'welcome address',
    'welcome and greeting',
    'welcome and greetings',
    'welcome and opening prayer',
    'welcome of guest',
    'welcome of guests',
    'welcoming of visitors',
    'welcoming first timers',
    'first timers',
    'first timers welcome',
    'recognition of visitors',
    'recognition of first timers',
    'recognition of guests',
    'visitors welcome',
    'greeting',
    'greetings',
    'meet and greet',
    'fellowship greeting',
    'passing of the peace',
    'the peace',
    'opening',
    'opening prayer',
    'opening prayers',
    'opening remarks',
    'introduction',
    'call to worship',
    'call to order',
    'invocation',
    'gathering',
    'connect',
    'welcome and connection',
  ],

  announcements: [
    'announcements',
    'announcement',
    'notices',
    'notice',
    'church notices',
    'notices and banns',
    'banns',
    'banns of marriage',
    'church news',
    'news',
    'news and events',
    'information',
    'information desk',
    'church information',
    'updates',
    'church updates',
    'family news',
    'church life',
    'upcoming events',
    'secretarys report',
    'next steps',
    'bulletin',
    'video announcements',
  ],

  /*
   * Giving, under every name it goes by. "Thanksgiving" is here because in
   * a Nigerian bulletin it is the congregation dancing forward with an
   * offering — but in a Methodist one it is the eucharistic prayer, so it
   * is weak. "Seed" and "first fruit" are giving and nothing else.
   */
  offering: [
    'offering',
    'offerings',
    'offertory',
    'offering time',
    'tithes',
    'tithe',
    'tithes and offering',
    'tithes and offerings',
    'tithe and offering',
    'offering and tithes',
    'offerings and tithes',
    'giving',
    'time of giving',
    'worship in giving',
    'worship through giving',
    'giving and prayer',
    'collection',
    'love offering',
    'special offering',
    'seed',
    'seed sowing',
    'seed offering',
    'seed of faith',
    'first fruit',
    'first fruits',
    '1st fruit',
    'firstfruit offering',
    'thanksgiving',
    'thanksgiving offering',
    'thanksgiving and offering',
    'family thanksgiving',
    'birthday thanksgiving',
    'offering talk',
    'generosity',
    'partnership',
    'pledges',
    'kingdom investment',
  ],

  'altar-call': [
    'altar call',
    'alter call',
    'altar',
    'call to salvation',
    'salvation call',
    'salvation prayer',
    'invitation',
    'the invitation',
    'invitation to discipleship',
    'invitation to christian discipleship',
    'invitation hymn',
    'response',
    'response to the word',
    'response time',
    'time of response',
    'ministry time',
    'prayer ministry',
    'prayer line',
    'decision',
    'decision time',
    'call to commitment',
    'commitment',
    'rededication',
    'new converts',
    'sinners prayer',
    'prophetic ministration',
    'healing ministration',
    'anointing service',
    'anointing',
    'impartation',
    'laying on of hands',
  ],

  closing: [
    'closing',
    'close',
    'closing prayer',
    'closing prayers',
    'closing remarks',
    'closing prayer and benediction',
    'benediction',
    'benedictions',
    'the benediction',
    'blessing',
    'the blessing',
    'final blessing',
    'dismissal',
    'dismissal with blessing',
    'sending forth',
    'sending',
    'going forth',
    'the grace',
    'grace',
    'sharing the grace',
    'sharing of the grace',
    'share the grace',
    'saying the grace',
    'the grace and dismissal',
    'doxology',
    'recessional',
    'vote of thanks',
    'end of service',
    'departure',
    'postlude',
  ],

  communion: [
    'communion',
    'holy communion',
    'communion service',
    'the lords supper',
    'lords supper',
    'lords table',
    'the lords table',
    'lord supper',
    'eucharist',
    'holy eucharist',
    'the eucharist',
    'liturgy of the eucharist',
    'breaking of bread',
    'breaking of the bread',
    'the table',
    'great thanksgiving',
    'the great thanksgiving',
    'sacrament',
    'holy sacrament',
    'mass',
    'holy mass',
    'bread and wine',
    'distribution of elements',
  ],

  /*
   * Prayer that is a segment in its own right — intercession, the pastoral
   * prayer, MFM-style prayer points. The engine already has this id; the
   * Live screen's list does not yet (see the pass report).
   */
  prayer: [
    'prayer',
    'prayers',
    'prayer time',
    'prayer session',
    'time of prayer',
    'season of prayer',
    'intercession',
    'intercessions',
    'intercessory prayer',
    'intercessory prayers',
    'prayers of intercession',
    'prayers of the people',
    'prayer of the faithful',
    'pastoral prayer',
    'prayer points',
    'prayer rain',
    'congregational prayer',
    'corporate prayer',
    'concerns and prayers',
    'prayer for the nation',
    'prayer for the church',
    'prayer for children',
    'prayer of agreement',
    'prayer of illumination',
    'prayer for illumination',
    'collect',
    'the collect',
    'confession',
    'confession and pardon',
    'the lords prayer',
    'lords prayer',
    'supplication',
    'warfare prayers',
    'prophetic prayers',
    'prayer for the week',
    'prayer for the month',
    'rounding off prayer',
  ],

  'pre-service': [
    'pre service',
    'preservice',
    'pre service prayer',
    'pre service prayers',
    'prelude',
    'countdown',
    'countdown video',
    'arrival',
    'arrival of guests',
    'doors open',
    'seating',
    'workers meeting',
    'workers prayer',
    'workers gathering',
    'sunday school',
    'sunday school review',
    'bible class',
    'digging deep',
    'sound check',
    'soundcheck',
    'rehearsal',
    'pre service music',
    'walk in music',
    'walk in',
  ],
}

/**
 * Things a church plainly schedules that the app has no type for. They match
 * as 'custom' — the operator's own label is kept, which is the right outcome
 * today — and `wouldBe` names the type each would become if the owner adds
 * it. Testimony and the scripture reading are on nearly every Nigerian
 * bulletin, which is the case for promoting them; see the pass report.
 */
export const UNTYPED_ALIASES: Record<string, string[]> = {
  testimony: [
    'testimony',
    'testimonies',
    'testimony time',
    'testimony session',
    'time of testimony',
    'sharing of testimonies',
    'testimonies and thanksgiving',
    'praise reports',
    'praise report',
    'faith stories',
    'story',
  ],
  reading: [
    'bible reading',
    'scripture reading',
    'scriptures reading',
    'scripture',
    'scripture lesson',
    'reading',
    'readings',
    'the reading',
    'first reading',
    'second reading',
    'lesson',
    'first lesson',
    'second lesson',
    'old testament reading',
    'new testament reading',
    'old testament lesson',
    'new testament lesson',
    'epistle',
    'the epistle',
    'gospel',
    'the gospel',
    'gospel reading',
    'psalm reading',
    'responsive reading',
    'bible recitation',
    'memory verse',
    'confession of faith',
    'creed',
    'the creed',
    'apostles creed',
    'nicene creed',
    'affirmation of faith',
  ],
  special: [
    'child dedication',
    'baby dedication',
    'dedication',
    'dedication service',
    'naming ceremony',
    'baptism',
    'water baptism',
    'holy baptism',
    'drama',
    'drama ministration',
    'playlet',
    'dance',
    'dance ministration',
    'choreography',
    'spoken word',
    'childrens moment',
    'childrens church',
    'childrens ministry',
    'kids service',
    'children dismissal',
    'ordination',
    'induction',
    'award presentation',
    'presentation',
    'video',
    'sermon bumper',
    'interlude',
    'break',
    'photographs',
    'refreshments',
    'fellowship',
  ],
}

/**
 * Words that name a segment only sometimes. "Word" is the sermon on a
 * bulletin and nothing at all in "a word from our sponsors"; "praise" may be
 * a praise report; "thanksgiving" is giving in Lagos and the eucharistic
 * prayer in a Methodist order. They still match — a row reading just "Word"
 * IS the sermon — but at a confidence the UI can show as "check me".
 */
export const WEAK_ALIASES: ReadonlySet<string> = new Set([
  'word',
  'charge',
  'talk',
  'address',
  'ministration',
  'praise',
  'praises',
  'music',
  'songs',
  'choir',
  'psalm',
  'opening',
  'introduction',
  'connect',
  'gathering',
  'news',
  'information',
  'updates',
  'giving',
  'seed',
  'collection',
  'thanksgiving',
  'partnership',
  'altar',
  'response',
  'invitation',
  'decision',
  'commitment',
  'anointing',
  'close',
  'closing',
  'blessing',
  'grace',
  'sending',
  'departure',
  'mass',
  'sacrament',
  'the table',
  'prayer',
  'prayers',
  'collect',
  'confession',
  'arrival',
  'seating',
  'story',
  'scripture',
  'reading',
  'readings',
  'lesson',
  'gospel',
  'epistle',
  'dedication',
  'presentation',
  'video',
  'break',
  'fellowship',
  'dance',
])

export interface SegmentMatch {
  type: SegmentTypeId
  /** 0..1 — 1 is an exact, unambiguous name covering the whole title. */
  confidence: number
  /** The table entry that matched, as written above. */
  alias: string
  /** For 'custom' matches: the type this would be if the app had one. */
  wouldBe?: string
}

/* ------------------------------------------------------------------ */
/* Normalising                                                         */
/* ------------------------------------------------------------------ */

/**
 * Text -> comparable tokens.
 *
 * Two layers, and the second is the one that matters for a photographed
 * bulletin. First the honest clean-up: lowercase, apostrophes dropped (so
 * "Lord's" and "Lords" agree), '&' and '+' spelt out, everything else that
 * is not a letter or digit turned to a space — which is what disposes of
 * trailing colons, dot leaders and table bars.
 *
 * Then the OCR skeleton. Tesseract's classic confusions on a printed
 * programme are 0 for O, and 1 / l / I / | for each other. Rather than guess
 * which was meant, both sides are folded to one spelling: inside any token
 * that contains a letter, 0 -> o, 5 -> s, and 1, i, l all -> l. "A1tar CaII"
 * and "altar call" both become "altar call" -> "altar call"; the alias table
 * is folded the same way so they meet. Pure numbers are left alone — "10" in
 * "10 mins" is not a word.
 */
export function normalise(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[‘’´`']/g, '')
    .replace(/[&+]/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  if (!cleaned) return []
  return cleaned.split(' ').map(skeleton)
}

function skeleton(token: string): string {
  if (!/[a-z]/.test(token)) return token
  return token.replace(/0/g, 'o').replace(/5/g, 's').replace(/[1i]/g, 'l')
}

interface AliasEntry {
  type: SegmentTypeId
  alias: string
  wouldBe?: string
  weak: boolean
  /** Skeleton tokens joined with no spaces — see `matchSegment`. */
  joined: string
}

/**
 * Built once. Keyed by the space-less skeleton so lookup is a Map hit per
 * window rather than a scan of four hundred aliases per row.
 */
const INDEX: Map<string, AliasEntry> = (() => {
  const index = new Map<string, AliasEntry>()
  const add = (type: SegmentTypeId, alias: string, wouldBe?: string) => {
    const joined = normalise(alias).join('')
    /* First writer wins. The typed table is added first, so a name that is
       both a real type and an untyped hint resolves to the real type. */
    if (!joined || index.has(joined)) return
    index.set(joined, { type, alias, wouldBe, weak: WEAK_ALIASES.has(alias), joined })
  }
  for (const [type, aliases] of Object.entries(SEGMENT_ALIASES)) {
    for (const alias of aliases) add(type as SegmentTypeId, alias)
  }
  for (const [wouldBe, aliases] of Object.entries(UNTYPED_ALIASES)) {
    for (const alias of aliases) add('custom', alias, wouldBe)
  }
  return index
})()

const FUZZY_POOL: AliasEntry[] = [...INDEX.values()].filter((e) => e.joined.length >= 7)

/** Words that pad a title without changing what it names. */
const FILLER = new Set(['the', 'a', 'of', 'and', 'tlme', 'sesslon', 'segment', 'by', 'wlth', 'for', 'our'])

/** A title longer than this is a sentence, not a segment name. */
const MAX_TOKENS = 14
/** The longest alias is six words; one spare for a stray OCR split. */
const MAX_WINDOW = 7

/**
 * Edit distance, capped: returns `limit + 1` as soon as the answer must
 * exceed `limit`. Only ever called on strings of near-equal length.
 */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      row.push(v)
      if (v < best) best = v
    }
    if (best > limit) return limit + 1
    prev = row
  }
  return prev[b.length]
}

/**
 * Which segment does this title name?
 *
 * WHOLE-PHRASE matching over token windows. Every run of consecutive tokens
 * is glued together without spaces and looked up, glued, in the index. That
 * one trick buys three things:
 *   - "word" can never match inside "password" or "sword": a window is made
 *     of whole tokens, so an alias either IS a run of words or is not there.
 *   - missing spaces are free: OCR's "PraiseandWorship" is a one-token
 *     window whose glue equals the alias's glue.
 *   - stray spaces are free too: "Of fering" is a two-token window.
 *
 * The LONGEST alias wins, not the first: "closing hymn" is worship, though
 * "closing" alone is closing; "choir ministration" is worship, though
 * "ministration" alone is the sermon. Length is measured in letters, so the
 * more specific name always beats the vaguer one it contains.
 *
 * A near miss (one wrong letter in seven or more, two in twelve or more) is
 * accepted at lower confidence — "Annoucements", "Benedictlon" after a bad
 * scan. Short aliases get no such grace: one edit from "hymn" is "hymen".
 */
export function matchSegment(text: string): SegmentMatch | null {
  const tokens = normalise(text)
  if (tokens.length === 0 || tokens.length > MAX_TOKENS) return null

  /* Tokens that would be left unexplained if the alias covered [start, end]. */
  const leftoversOf = (start: number, end: number) =>
    tokens.filter((t, i) => (i < start || i > end) && !FILLER.has(t) && /[a-z]/.test(t))

  let best: { entry: AliasEntry; exact: boolean; start: number; end: number } | null = null
  const consider = (entry: AliasEntry, exact: boolean, start: number, end: number) => {
    /*
     * A weak word stands alone or not at all. "Grace" is the closing;
     * "Grace Assembly, Ikeja" is the name of the church, and "Word of Life
     * Bible Church" is not a sermon. With other words around it, a weak
     * alias is more likely part of a name than the name of a segment.
     */
    if (entry.weak && leftoversOf(start, end).length > 0) return
    if (
      !best ||
      entry.joined.length > best.entry.joined.length ||
      (entry.joined.length === best.entry.joined.length && exact && !best.exact)
    ) {
      best = { entry, exact, start, end }
    }
  }

  for (let start = 0; start < tokens.length; start += 1) {
    let glue = ''
    for (let end = start; end < tokens.length && end - start < MAX_WINDOW; end += 1) {
      glue += tokens[end]
      const hit = INDEX.get(glue) ?? (glue.endsWith('s') ? INDEX.get(glue.slice(0, -1)) : undefined)
      if (hit) {
        consider(hit, true, start, end)
        continue
      }
      if (glue.length < 7) continue
      for (const entry of FUZZY_POOL) {
        const allowed = entry.joined.length >= 12 ? 2 : 1
        if (editDistance(glue, entry.joined, allowed) <= allowed) consider(entry, false, start, end)
      }
    }
  }

  if (!best) return null
  const { entry, exact, start, end } = best as { entry: AliasEntry; exact: boolean; start: number; end: number }

  /*
   * Confidence is three independent doubts multiplied together:
   *   - was it spelt right?            exact 1.0, near miss 0.8
   *   - does the word always mean it?  weak alias 0.6
   *   - is it the whole title?         "Offering" 1.0; "Offering for the
   *     building project" 0.85 — still giving, but the row says more than
   *     the alias accounts for.
   */
  const leftovers = leftoversOf(start, end)
  let confidence = exact ? 1 : 0.8
  if (entry.weak) confidence *= 0.6
  if (leftovers.length > 0) confidence *= 0.85

  const match: SegmentMatch = {
    type: entry.type,
    confidence: Math.round(confidence * 100) / 100,
    alias: entry.alias,
  }
  if (entry.wouldBe) match.wouldBe = entry.wouldBe
  return match
}

/* ------------------------------------------------------------------ */
/* The default run                                                     */
/* ------------------------------------------------------------------ */

export interface DefaultSegment {
  type: SegmentTypeId
  label: string
  durationMin: number
}

/**
 * The run a church gets before it has told us anything: 95 minutes, seven
 * segments, every id one the Live screen already offers.
 *
 * The ORDER is the one the two best sources agree on. RCCG's published
 * Sunday order runs Prayer -> Praise -> Welcome of guest -> Hymn/Special
 * Number -> The Word -> Altar Call -> Tithes & Offering -> Announcements ->
 * Benediction. Pushpay's evangelical sample runs Call to Worship -> Worship
 * -> Welcome -> Scripture -> Sermon -> Response -> Giving -> Announcements
 * -> Blessing. Different continents, same spine: open, sing, preach, respond,
 * give, notices, bless. Two things follow that the old template had wrong:
 *   - the altar call sits DIRECTLY after the sermon. Every tradition agrees;
 *     nothing is allowed between the word and the response to it.
 *   - offering and announcements come AFTER the sermon, not before. Plenty
 *     of churches do it the other way, but a default should follow the
 *     sources rather than a guess, and dragging two rows is cheap.
 *
 * The DURATIONS: MinistryPass timed seven American churches at 14-24 min of
 * worship and 26-37 min of message inside 55-63 minutes; planning guides put
 * a normal Sunday at 60-90. Nigerian Pentecostal services run longer at both
 * ends — two hours is ordinary — so worship and sermon sit at the top of the
 * American range rather than the middle. Offering gets 10 because in the
 * churches this app serves it is a procession with a song, not a plate.
 *
 * Communion and prayer are left out on purpose: communion is monthly, and a
 * default that is wrong three Sundays in four teaches the operator to ignore
 * the default.
 */
export const DEFAULT_RUN: DefaultSegment[] = [
  { type: 'welcome', label: 'opening prayer & welcome', durationMin: 5 },
  { type: 'worship', label: 'praise & worship', durationMin: 25 },
  { type: 'sermon', label: 'sermon', durationMin: 40 },
  { type: 'altar-call', label: 'altar call', durationMin: 5 },
  { type: 'offering', label: 'tithes & offering', durationMin: 10 },
  { type: 'announcements', label: 'announcements', durationMin: 5 },
  { type: 'closing', label: 'closing prayer & benediction', durationMin: 5 },
]
