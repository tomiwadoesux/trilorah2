/**
 * Named passages — "bring up the Lord's Prayer".
 *
 * A printed Bible heads its sections: THE LORD'S PRAYER, DAVID AND GOLIATH,
 * THE BEATITUDES. Preachers call passages by those names far more often than
 * by their numbers, and a resolver that only understands book-chapter-verse
 * hears nothing at all when they do.
 *
 * This is a lookup, not a guess: the preacher says the name, the table says
 * where it is. There is no scoring and nothing to get confidently wrong,
 * which is why it can be this simple. A passage that spans chapters is given
 * as its opening section — the screen shows where the reading starts.
 *
 * Names are matched on normalised text (lowercase, no punctuation, no
 * apostrophes), so "the Lord's Prayer", "the lords prayer" and "The Lord’s
 * prayer." are all one entry.
 */

export interface NamedPassage {
  book: string
  chapter: number
  verse: number
  end: number
}

type Row = [names: string[], book: string, chapter: number, verse: number, end: number]

const ROWS: Row[] = [
  // --- Gospels: teaching
  [['the lords prayer', 'lords prayer', 'our father prayer', 'the our father'], 'Matthew', 6, 9, 13],
  [['the beatitudes', 'beatitudes'], 'Matthew', 5, 3, 12],
  [['the sermon on the mount', 'sermon on the mount'], 'Matthew', 5, 1, 12],
  [['the great commission', 'great commission'], 'Matthew', 28, 18, 20],
  [['the great commandment', 'the greatest commandment', 'greatest commandment'], 'Matthew', 22, 36, 40],
  [['the golden rule', 'golden rule'], 'Matthew', 7, 12, 12],
  [['salt and light'], 'Matthew', 5, 13, 16],
  [['the narrow gate', 'narrow gate', 'the narrow way'], 'Matthew', 7, 13, 14],
  [['the wise and foolish builders', 'wise and foolish builders', 'house on the rock'], 'Matthew', 7, 24, 27],
  [['the vine and the branches', 'vine and the branches', 'i am the vine'], 'John', 15, 1, 8],
  [['i am the good shepherd'], 'John', 10, 11, 18],
  [['i am the bread of life'], 'John', 6, 35, 40],
  [['the way the truth and the life'], 'John', 14, 6, 6],
  [['the new birth'], 'John', 3, 1, 8],
  [['the woman at the well', 'woman at the well', 'samaritan woman'], 'John', 4, 7, 15],
  [['the high priestly prayer', 'high priestly prayer'], 'John', 17, 1, 5],
  // --- Gospels: parables
  [['the prodigal son', 'prodigal son', 'the lost son'], 'Luke', 15, 11, 24],
  [['the good samaritan', 'good samaritan'], 'Luke', 10, 30, 37],
  [['the lost sheep', 'parable of the lost sheep'], 'Luke', 15, 4, 7],
  [['the lost coin'], 'Luke', 15, 8, 10],
  [['the parable of the sower', 'parable of the sower'], 'Matthew', 13, 3, 9],
  [['the parable of the talents', 'parable of the talents'], 'Matthew', 25, 14, 30],
  [['the ten virgins', 'wise and foolish virgins', 'parable of the ten virgins'], 'Matthew', 25, 1, 13],
  [['the sheep and the goats', 'sheep and the goats'], 'Matthew', 25, 31, 40],
  [['the mustard seed', 'parable of the mustard seed'], 'Matthew', 13, 31, 32],
  [['the rich man and lazarus', 'rich man and lazarus'], 'Luke', 16, 19, 31],
  [['the pharisee and the tax collector', 'pharisee and the publican'], 'Luke', 18, 9, 14],
  [['the persistent widow', 'the unjust judge'], 'Luke', 18, 1, 8],
  [['the rich fool'], 'Luke', 12, 16, 21],
  [['the unforgiving servant', 'unmerciful servant'], 'Matthew', 18, 23, 35],
  // --- Gospels: events
  [['the christmas story', 'the birth of jesus', 'birth of christ', 'the nativity'], 'Luke', 2, 1, 14],
  [['the magnificat', 'marys song'], 'Luke', 1, 46, 55],
  [['visit of the magi'], 'Matthew', 2, 1, 12],
  [['the baptism of jesus', 'baptism of jesus'], 'Matthew', 3, 13, 17],
  [['the temptation of jesus', 'temptation in the wilderness', 'temptation of christ'], 'Matthew', 4, 1, 11],
  [['the wedding at cana', 'water into wine', 'wedding at cana'], 'John', 2, 1, 11],
  [['feeding of the five thousand', 'feeding the five thousand', 'five loaves and two fish'], 'John', 6, 5, 14],
  [['jesus walks on water', 'walking on the water'], 'Matthew', 14, 22, 33],
  [['calming the storm', 'jesus calms the storm'], 'Mark', 4, 35, 41],
  [['the transfiguration', 'mount of transfiguration'], 'Matthew', 17, 1, 9],
  [['the raising of lazarus', 'raising of lazarus', 'lazarus come forth'], 'John', 11, 38, 44],
  [['zacchaeus'], 'Luke', 19, 1, 10],
  [['mary and martha'], 'Luke', 10, 38, 42],
  [['the woman caught in adultery', 'woman caught in adultery'], 'John', 8, 3, 11],
  [['the woman with the issue of blood', 'issue of blood'], 'Mark', 5, 25, 34],
  [['blind bartimaeus'], 'Mark', 10, 46, 52],
  [['the triumphal entry', 'triumphal entry', 'palm sunday'], 'Matthew', 21, 1, 11],
  [['the last supper', 'last supper', 'the lords supper'], 'Luke', 22, 14, 20],
  [['washing the disciples feet', 'jesus washes the disciples feet'], 'John', 13, 3, 15],
  [['garden of gethsemane'], 'Matthew', 26, 36, 46],
  [['crucifixion of jesus'], 'Luke', 23, 33, 46],
  [['empty tomb'], 'Matthew', 28, 1, 10],
  [['the road to emmaus', 'road to emmaus'], 'Luke', 24, 13, 32],
  [['doubting thomas'], 'John', 20, 24, 29],
  [['the ascension'], 'Acts', 1, 6, 11],
  // --- Acts and the letters
  [['the day of pentecost', 'day of pentecost'], 'Acts', 2, 1, 4],
  [['the conversion of saul', 'road to damascus', 'damascus road', 'conversion of paul'], 'Acts', 9, 1, 9],
  [['paul and silas in prison'], 'Acts', 16, 25, 34],
  [['the stoning of stephen', 'stoning of stephen'], 'Acts', 7, 54, 60],
  [['the love chapter', 'love chapter'], '1 Corinthians', 13, 4, 8],
  [['the fruit of the spirit', 'fruit of the spirit', 'fruits of the spirit'], 'Galatians', 5, 22, 23],
  [['the armor of god', 'armour of god', 'armor of god', 'whole armor of god', 'whole armour of god'], 'Ephesians', 6, 10, 18],
  [['the hall of faith', 'hall of faith', 'heroes of faith', 'the faith chapter'], 'Hebrews', 11, 1, 6],
  [['the romans road', 'romans road'], 'Romans', 3, 23, 23],
  [['more than conquerors'], 'Romans', 8, 31, 39],
  [['the mind of christ', 'the humility of christ'], 'Philippians', 2, 5, 11],
  [['the resurrection chapter'], '1 Corinthians', 15, 50, 58],
  [['the new heaven and new earth', 'new heaven and a new earth'], 'Revelation', 21, 1, 7],
  // --- Old Testament
  [['the creation story', 'creation story'], 'Genesis', 1, 1, 5],
  [['the fall of man'], 'Genesis', 3, 1, 7],
  [['cain and abel'], 'Genesis', 4, 1, 10],
  [['noahs ark', 'noah and the flood'], 'Genesis', 6, 13, 22],
  [['the tower of babel', 'tower of babel'], 'Genesis', 11, 1, 9],
  [['the call of abraham', 'call of abram'], 'Genesis', 12, 1, 4],
  [['abraham and isaac', 'the sacrifice of isaac', 'binding of isaac'], 'Genesis', 22, 1, 14],
  [['jacobs ladder', 'jacobs dream'], 'Genesis', 28, 10, 17],
  [['jacob wrestles with god', 'jacob wrestling'], 'Genesis', 32, 24, 30],
  [['josephs coat', 'coat of many colors', 'coat of many colours'], 'Genesis', 37, 3, 11],
  [['the burning bush', 'burning bush'], 'Exodus', 3, 1, 10],
  [['first passover'], 'Exodus', 12, 1, 13],
  [['crossing the red sea', 'parting of the red sea'], 'Exodus', 14, 13, 22],
  [['the ten commandments', 'ten commandments'], 'Exodus', 20, 1, 17],
  [['the golden calf', 'golden calf'], 'Exodus', 32, 1, 8],
  [['the priestly blessing', 'aaronic blessing', 'the lord bless you and keep you'], 'Numbers', 6, 24, 26],
  [['the shema', 'hear o israel'], 'Deuteronomy', 6, 4, 9],
  [['the walls of jericho', 'walls of jericho', 'battle of jericho'], 'Joshua', 6, 12, 20],
  [['as for me and my house'], 'Joshua', 24, 14, 15],
  [['gideons fleece', 'gideon and the fleece'], 'Judges', 6, 36, 40],
  [['samson and delilah'], 'Judges', 16, 15, 21],
  [['ruth and naomi', 'where you go i will go'], 'Ruth', 1, 16, 17],
  [['hannahs prayer'], '1 Samuel', 1, 9, 18],
  [['the call of samuel', 'speak lord for your servant hears'], '1 Samuel', 3, 1, 10],
  [['david and goliath'], '1 Samuel', 17, 41, 50],
  [['david meets saul'], '1 Samuel', 16, 14, 23],
  [['david and jonathan'], '1 Samuel', 18, 1, 4],
  [['david and bathsheba'], '2 Samuel', 11, 1, 5],
  [['solomon asks for wisdom', 'solomons prayer for wisdom', 'wisdom of solomon'], '1 Kings', 3, 5, 14],
  [['elijah on mount carmel', 'elijah and the prophets of baal'], '1 Kings', 18, 30, 39],
  [['the still small voice', 'still small voice'], '1 Kings', 19, 9, 13],
  [['naaman the leper'], '2 Kings', 5, 9, 14],
  [['if my people who are called by my name'], '2 Chronicles', 7, 14, 14],
  [['the prayer of jabez', 'prayer of jabez'], '1 Chronicles', 4, 9, 10],
  [['for such a time as this'], 'Esther', 4, 13, 16],
  [['the shepherds psalm', 'shepherd psalm', 'the lord is my shepherd', 'psalm of david the shepherd'], 'Psalms', 23, 1, 6],
  [['the psalm of protection', 'he who dwells in the secret place'], 'Psalms', 91, 1, 8],
  [['davids prayer of repentance', 'create in me a clean heart'], 'Psalms', 51, 1, 12],
  [['i lift up my eyes to the hills', 'i will lift up mine eyes'], 'Psalms', 121, 1, 8],
  [['the virtuous woman', 'virtuous woman', 'proverbs thirty one woman', 'wife of noble character'], 'Proverbs', 31, 10, 20],
  [['a time for everything', 'to everything there is a season', 'a time to be born'], 'Ecclesiastes', 3, 1, 8],
  [['the suffering servant', 'suffering servant'], 'Isaiah', 53, 3, 7],
  [['isaiahs vision', 'the call of isaiah', 'here am i send me'], 'Isaiah', 6, 1, 8],
  [['the valley of dry bones', 'valley of dry bones'], 'Ezekiel', 37, 1, 10],
  [['the potters house', 'potters house', 'the potter and the clay'], 'Jeremiah', 18, 1, 6],
  [['the fiery furnace', 'fiery furnace', 'shadrach meshach and abednego'], 'Daniel', 3, 16, 25],
  [['daniel in the lions den', 'the lions den', 'daniel and the lions den'], 'Daniel', 6, 16, 23],
  [['the writing on the wall', 'handwriting on the wall'], 'Daniel', 5, 24, 28],
  [['jonah and the whale', 'jonah and the great fish', 'jonah and the fish'], 'Jonah', 1, 15, 17],
  [['will a man rob god'], 'Malachi', 3, 8, 10],
]

/** Longest names first, so "the parable of the sower" wins over "the sower". */
const INDEX: { name: string; passage: NamedPassage }[] = ROWS.flatMap(([names, book, chapter, verse, end]) =>
  names.map((name) => ({ name, passage: { book, chapter, verse, end } })),
).sort((a, b) => b.name.length - a.name.length)

export function normalizePassageText(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The named passage spoken in this text, if any. */
export function findNamedPassage(text: string): (NamedPassage & { name: string }) | null {
  const t = ` ${normalizePassageText(text)} `
  for (const { name, passage } of INDEX) {
    if (t.includes(` ${name} `)) return { ...passage, name }
  }
  return null
}

export const NAMED_PASSAGE_COUNT = ROWS.length
