import books from './companionBibleBooks.json';
export { books };
export interface BibleVerse { number: number; text: string }
export interface Passage { book: number; chapter: number; from: number; to: number }
export function parsePassage(input: string): Passage | null {
  const match = input.trim().replace(/[–—]/g, '-').match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?(?:\s*\(?WEB\)?)?$/i);
  if (!match) return null;
  const name = match[1].toLowerCase().replace(/\.$/, '').replace(/^psalm$/, 'psalms').replace(/\s+/g, ' ');
  const exact = books.find(b => b.name.toLowerCase() === name);
  const matches = books.filter(b => b.name.toLowerCase().startsWith(name));
  const book = exact ?? (name.length >= 2 && matches.length === 1 ? matches[0] : null);
  const chapter = Number(match[2]), from = Number(match[3] || 1), to = Number(match[4] || match[3] || 999);
  return book && chapter >= 1 && chapter <= book.chapters && from >= 1 && from <= to && to <= 999 ? { book: book.id, chapter, from, to } : null;
}
export function passageLabel(p: Passage) {
  const base = `${books[p.book].name} ${p.chapter}`;
  return p.to === 999 ? base : `${base}:${p.from}${p.to === p.from ? '' : `–${p.to}`}`;
}
export function passageText(verses: BibleVerse[], p: Passage) {
  return verses.filter(v => v.number >= p.from && v.number <= p.to).map(v => `${v.number} ${v.text}`).join('\n');
}
