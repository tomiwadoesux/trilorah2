/**
 * The 66-book Protestant canon in canonical order.
 * Book id (as used by window.api.getChapter) is index + 1 — the surviving
 * engine bundle maps `bookNames[bookId]` the same way.
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

/** Resolve a typed book name to its 1-based id. Case-insensitive, allows a unique prefix. */
export function bookIdFromName(name: string): { id: number; name: string } | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  const exact = BOOKS.findIndex((b) => b.toLowerCase() === q);
  if (exact >= 0) return { id: exact + 1, name: BOOKS[exact] };
  const matches = BOOKS.map((b, i) => ({ b, i })).filter(({ b }) => b.toLowerCase().startsWith(q));
  if (matches.length === 1) return { id: matches[0].i + 1, name: matches[0].b };
  return null;
}
