import { describe, it, expect } from 'vitest';
import { decodeNotebook, emptyNotebook, putNote, togglePassage, notebookText } from './companionNotebook';
describe('device notebook', () => {
  it('keeps independent service notes and updates without duplicates across reloads', () => {
    let book = emptyNotebook();
    const note = { serviceId: 'a', title: 'Faith', date: 'Oct 11', text: 'A thought', updatedAt: 'now' };
    book = putNote(book, note); book = putNote(book, { ...note, serviceId: 'b', text: 'Another service' });
    book = putNote(decodeNotebook(JSON.stringify(book)), { ...note, text: 'Revised thought' });
    expect(book.notes).toHaveLength(2);
    expect(notebookText(book)).toContain('Revised thought'); expect(notebookText(book)).toContain('Another service');
  });
  it('retains the full scripture text in a portable saved record and toggles without duplicates', () => {
    const verse = { key: 'WEB:John 15:5', ref: 'John 15:5', text: '5 I am the vine.', passage: { book: 42, chapter: 15, from: 5, to: 5 }, serviceId: 'a', savedAt: 'now' };
    const saved = decodeNotebook(JSON.stringify(togglePassage(emptyNotebook(), verse)));
    expect(notebookText(saved)).toContain('5 I am the vine.');
    expect(togglePassage(saved, verse).verses).toHaveLength(0);
  });
  it('does not silently replace unreadable storage with an empty notebook', () => {
    expect(() => decodeNotebook('{broken')).toThrow();
    expect(() => decodeNotebook('{"version":2,"notes":[],"verses":[]}')).toThrow();
  });
});
