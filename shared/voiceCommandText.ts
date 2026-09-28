/** Command words with their original positions, including punctuated ASR text. */
export function commandWords(text: string): { word: string; start: number; end: number }[] {
  return [...text.matchAll(/[\p{L}\p{M}\p{N}]+/gu)].map((match) => ({
    word: match[0].toLowerCase().replace(/[À-ÖØ-öø-ž]/g, (ch) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '')),
    start: match.index!, end: match.index! + match[0].length,
  }));
}

/** Find the phrase the engine accepted; never infer whether it is a command. */
export function findCommandPhrase(text: string, phrase: string, substringMode = false): { start: number; end: number } | null {
  const words = commandWords(text);
  const wanted = commandWords(phrase);
  if (!wanted.length) return null;
  for (let i = 0; i + wanted.length <= words.length; i++) {
    if (wanted.every((token, j) => token.word === words[i + j].word)) {
      return { start: words[i].start, end: words[i + wanted.length - 1].end };
    }
  }
  if (substringMode) {
    const start = text.toLowerCase().indexOf(phrase.toLowerCase());
    if (start >= 0) return { start, end: start + phrase.length };
  }
  return null;
}

/** Prefer the full instruction when shorter configured phrases also match. */
export function longestCommandPhrase(text: string, phrases: string[], substringMode = false): string | undefined {
  const match = phrases.map((phrase) => findCommandPhrase(text, phrase, substringMode))
    .filter((range): range is { start: number; end: number } => range !== null)
    .sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
  return match ? text.slice(match.start, match.end) : undefined;
}
