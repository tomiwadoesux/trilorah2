/**
 * The 66-book Protestant canon in canonical order.
 * Book id (as used by window.api.getChapter) is the array index — the
 * engine's bookIdMap and the bible.db `Book` column are both 0-based.
 */
export const BOOKS: readonly string[] = [
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
  'Jude', 'Revelation',
];

/** Common abbreviations that plain prefix matching can't resolve. */
const BOOK_ABBREVIATIONS: Record<string, string> = {
  gen: 'Genesis', ex: 'Exodus', exo: 'Exodus', lev: 'Leviticus', num: 'Numbers',
  deut: 'Deuteronomy', dt: 'Deuteronomy', josh: 'Joshua', judg: 'Judges',
  '1 sam': '1 Samuel', '2 sam': '2 Samuel', '1 kgs': '1 Kings', '2 kgs': '2 Kings',
  '1 chr': '1 Chronicles', '2 chr': '2 Chronicles', neh: 'Nehemiah', est: 'Esther',
  ps: 'Psalms', psalm: 'Psalms', prov: 'Proverbs', pr: 'Proverbs', eccl: 'Ecclesiastes',
  song: 'Song of Solomon', sos: 'Song of Solomon', isa: 'Isaiah', jer: 'Jeremiah',
  lam: 'Lamentations', ezek: 'Ezekiel', dan: 'Daniel', hos: 'Hosea', ob: 'Obadiah',
  jon: 'Jonah', mic: 'Micah', nah: 'Nahum', hab: 'Habakkuk', zeph: 'Zephaniah',
  hag: 'Haggai', zech: 'Zechariah', mal: 'Malachi',
  matt: 'Matthew', mt: 'Matthew', mk: 'Mark', lk: 'Luke', jn: 'John',
  rom: 'Romans', '1 cor': '1 Corinthians', '2 cor': '2 Corinthians', gal: 'Galatians',
  eph: 'Ephesians', phil: 'Philippians', col: 'Colossians',
  '1 thess': '1 Thessalonians', '2 thess': '2 Thessalonians', '1 th': '1 Thessalonians',
  '2 th': '2 Thessalonians', '1 tim': '1 Timothy', '2 tim': '2 Timothy',
  tit: 'Titus', phlm: 'Philemon', heb: 'Hebrews', jas: 'James',
  '1 pet': '1 Peter', '2 pet': '2 Peter', '1 jn': '1 John', '2 jn': '2 John',
  '3 jn': '3 John', rev: 'Revelation',
};

/** Resolve a typed book name to its 0-based id. Case-insensitive; accepts a
 *  unique prefix or a common abbreviation ("1 cor", "ps", "rom"). */
export function bookIdFromName(name: string): { id: number; name: string } | null {
  const q = name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '');
  if (!q) return null;
  const exact = BOOKS.findIndex((b) => b.toLowerCase() === q);
  if (exact >= 0) return { id: exact, name: BOOKS[exact] };
  const abbrev = BOOK_ABBREVIATIONS[q];
  if (abbrev) {
    const i = BOOKS.indexOf(abbrev);
    return { id: i, name: abbrev };
  }
  const matches = BOOKS.map((b, i) => ({ b, i })).filter(({ b }) => b.toLowerCase().startsWith(q));
  if (matches.length >= 1) return { id: matches[0].i, name: matches[0].b };
  return null;
}

/** First canonical book completing the typed prefix — for tab-completion. */
export function completeBookName(prefix: string): string | null {
  const q = prefix.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return null;
  const hit = BOOKS.find((b) => b.toLowerCase().startsWith(q) && b.toLowerCase() !== q);
  if (hit) return hit;
  const abbrev = BOOK_ABBREVIATIONS[q];
  return abbrev ?? null;
}
