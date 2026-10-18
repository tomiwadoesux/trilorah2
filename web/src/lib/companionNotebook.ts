import { books, type Passage } from './companionBible';
export interface PersonalNote { serviceId: string; title: string; date: string; text: string; updatedAt: string }
export interface SavedPassage { key: string; ref: string; text: string; passage: Passage; serviceId: string; savedAt: string }
export interface Notebook { version: 1; notes: PersonalNote[]; verses: SavedPassage[] }
export const emptyNotebook = (): Notebook => ({ version: 1, notes: [], verses: [] });
export function decodeNotebook(value: string | null): Notebook {
  if (!value) return emptyNotebook();
  const data = JSON.parse(value);
  if (data.version !== 1 || !Array.isArray(data.notes) || !Array.isArray(data.verses)) throw new Error('Unrecognized notebook');
  if (data.notes.some((n: PersonalNote) => !n || ['text', 'serviceId', 'title', 'date', 'updatedAt'].some(k => typeof n[k as keyof PersonalNote] !== 'string')) ||
    data.verses.some((v: SavedPassage) => !v || ['text', 'key', 'ref', 'serviceId', 'savedAt'].some(k => typeof v[k as keyof SavedPassage] !== 'string') ||
      !v.passage || !Number.isInteger(v.passage.book) || !books[v.passage.book] ||
      !Number.isInteger(v.passage.chapter) || v.passage.chapter < 1 || v.passage.chapter > books[v.passage.book].chapters ||
      !Number.isInteger(v.passage.from) || !Number.isInteger(v.passage.to) || v.passage.from < 1 || v.passage.to < v.passage.from || v.passage.to > 999)) throw new Error('Unreadable notebook');
  return data;
}
export function putNote(book: Notebook, note: PersonalNote): Notebook {
  return { ...book, notes: [note, ...book.notes.filter(n => n.serviceId !== note.serviceId)] };
}
export function togglePassage(book: Notebook, verse: SavedPassage): Notebook {
  return { ...book, verses: book.verses.some(v => v.key === verse.key) ? book.verses.filter(v => v.key !== verse.key) : [verse, ...book.verses] };
}
export function notebookText(book: Notebook) {
  return ['My Trilorah notebook', ...book.notes.filter(n => n.text.trim()).map(n => `\n${n.title}\n${n.date}\n\n${n.text}`), '\nSaved scriptures · World English Bible (public domain)', ...book.verses.map(v => `\n${v.ref} · WEB\n${v.text}`)].join('\n');
}
