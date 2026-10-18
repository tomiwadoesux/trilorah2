import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { books, parsePassage, passageLabel, passageText } from './companionBible';
describe('companion Bible reader', () => {
  it('parses canonical, shortened, numbered and range references', () => {
    expect(parsePassage('Romans 12:1–2')).toEqual({ book: 44, chapter: 12, from: 1, to: 2 });
    expect(parsePassage('1 Cor. 13:4-7')?.book).toBe(45);
    expect(parsePassage('Psalm 46:10')?.book).toBe(18);
    expect(passageLabel(parsePassage('John 15')!)).toBe('John 15');
    expect(parsePassage('John 99:1')).toBeNull(); expect(parsePassage('John 1:5-2')).toBeNull();
    expect(parsePassage('../../ 1:1')).toBeNull();
  });
  it('ships all 66 books with the audited WEB verse count and real passage text', () => {
    let count = 0;
    for (const book of books) {
      const data = JSON.parse(readFileSync(new URL(`../../public/bible/web/${book.id}.json`, import.meta.url), 'utf8'));
      expect(Object.keys(data)).toHaveLength(book.chapters);
      for (const chapter of Object.values(data) as Array<Array<{ number: number; text: string }>>) {
        count += chapter.length;
        expect(chapter.every(v => v.text.length > 0 && v.number > 0)).toBe(true);
      }
      if (book.id === 44) expect(passageText(data['12'], parsePassage('Romans 12:1–2')!)).toContain('renewing of your mind');
    }
    expect(books).toHaveLength(66); expect(count).toBe(31098);
  });
});
