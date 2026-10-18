import { verseToText } from './scriptureText';
const STOP = new Set('about after again before being could every first have into just more said says shall should some than that their them then there these they this those unto very were what when where which while will with words would your'.split(' '));
const normalized = (value: string) => value.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]/g, '');
/** Highlight concrete wording shared with the query; never imply a semantic match is an exact quote. */
export function scriptureMatchParts(raw: string, heard: string, evidence: string[] = []): { text: string; match: boolean }[] {
  const text = verseToText(raw);
  const terms = new Set(`${heard} ${evidence.join(' ')}`.split(/\s+/).map(normalized).filter(word => word.length >= 4 && !STOP.has(word)));
  return text.split(/(\b[\w’']+\b)/).filter(Boolean).map(part => ({ text: part, match: terms.has(normalized(part)) }));
}

/** Put shared wording in view even when a search result starts a verse earlier. */
export function scriptureMatchExcerpt(raw: string, heard: string, evidence: string[] = []): string {
  const text = verseToText(raw);
  const parts = scriptureMatchParts(text, heard, evidence);
  const first = parts.findIndex(part => part.match);
  if (first < 0) return text;
  const prefix = parts.slice(0, first).map(part => part.text).join('');
  const wordsBefore = [...prefix.matchAll(/\S+/g)];
  const start = wordsBefore.length > 6 ? wordsBefore[wordsBefore.length - 6].index! : 0;
  return (start > 0 ? '… ' : '') + text.slice(start);
}
