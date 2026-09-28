import { describe, expect, it } from 'vitest';
import { transcriptReferences } from './transcriptReferences';

describe('transcript reference hints', () => {
  it('warms a book while speech is unfinished and releases ordinary names', () => {
    expect(transcriptReferences('Let us turn to John', true)[0]?.state).toBe('possible');
    expect(transcriptReferences('John was a boy', true)).toEqual([]);
    expect(transcriptReferences('John was a boy')).toEqual([]);
    expect(transcriptReferences('John')).toEqual([]);
    expect(transcriptReferences('John was a boy; let us read Romans', true).map((r) => r.book)).toEqual(['Romans']);
  });

  it('keeps valid references and the exact spoken character range', () => {
    for (const reference of ['John 3:16', 'Romans chapter eight verse twenty eight', 'First John chapter three', 'Psalm 23', 'Second Timothy 2:15', 'Romans 8:28-30']) {
      const text = `Read ${reference} with me.`;
      const [range] = transcriptReferences(text);
      expect(range?.state).toBe('confirmed');
      expect(text.slice(range.start, range.end)).toBe(reference);
    }
  });

  it('rejects invalid chapters and words containing a book name', () => {
    for (const text of ['John 99', 'John 0', 'Johnathan', 'the benchmark', 'Job was tired', 'Numbers are useful']) {
      expect(transcriptReferences(text, true)).toEqual([]);
    }
    expect(transcriptReferences('Psalm one hundred and fifty')[0]?.state).toBe('confirmed');
    expect(transcriptReferences('Psalm one hundred and fifty one')).toEqual([]);
  });

  it('separates consecutive spoken numbers into chapter and verse', () => {
    expect(transcriptReferences('So John three sixteen is')[0]).toMatchObject({ chapter: 3, verse: 16, complete: true });
    expect(transcriptReferences('Romans eight twenty eight')[0]).toMatchObject({ chapter: 8, verse: 28, complete: true });
    expect(transcriptReferences('John twenty one three')[0]).toMatchObject({ chapter: 21, verse: 3 });
  });

  it('forms a pill only for a complete verse, not an open number or range', () => {
    for (const text of ['John', 'John chapter three', 'John three sixteen', 'Romans four twenty', 'Romans 4:21 to', 'Romans 4:21 to 22']) {
      expect(transcriptReferences(text, true)[0]?.complete).not.toBe(true);
    }
    expect(transcriptReferences('John three sixteen is', true)[0]?.complete).toBe(true);
    expect(transcriptReferences('John three sixteen', false)[0]?.complete).toBe(true);
    expect(transcriptReferences('Romans 4:21 to', false)[0]?.complete).toBe(false);
    expect(transcriptReferences('Romans 4:21 to 22 says', true)[0]).toMatchObject({ endVerse: 22, complete: true });
    expect(transcriptReferences('Acts two three. And there appeared unto them', true)[0]).toMatchObject({ book: 'Acts', chapter: 2, verse: 3, complete: true });
    expect(transcriptReferences('John three sixteen and', true)[0]?.complete).toBe(false);
    expect(transcriptReferences('John three sixteen and seventeen', true)[0]?.complete).toBe(false);
  });
});
