import { describe, expect, it } from 'vitest';
import { findCommandPhrase, longestCommandPhrase } from './voiceCommandText';

describe('accepted command phrase positions', () => {
  it('preserves surrounding words and punctuation', () => {
    const text = 'Now, go to the next verse, please.';
    const phrase = longestCommandPhrase(text, ['next verse', 'the next verse', 'go to the next verse']);
    expect(phrase).toBe('go to the next verse');
    const range = findCommandPhrase(text, phrase!);
    expect(text.slice(range!.start, range!.end)).toBe(phrase);
    expect(text.slice(range!.end)).toBe(', please.');
  });

  it('handles contractions, accents and custom multilingual phrases', () => {
    expect(longestCommandPhrase("Now let's pray together.", ["let's pray"])).toBe("let's pray");
    expect(longestCommandPhrase('Lisez le verset précédent.', ['verset precedent'])).toBe('verset précédent');
    expect(longestCommandPhrase('请读下一节经文', ['下一节'], true)).toBe('下一节');
  });

  it('does not match words inside other words', () => {
    expect(findCommandPhrase('This is household faith.', 'hold')).toBeNull();
    expect(findCommandPhrase('Read next verse.', '')).toBeNull();
  });
});
