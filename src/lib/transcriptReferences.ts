import { BOOKS, CHAPTER_COUNTS } from './books';
import { parseSpokenNumber } from '../../shared/spokenNumbers';

export interface TranscriptReference {
  start: number;
  end: number;
  book: string;
  state: 'possible' | 'confirmed';
  chapter?: number;
  verse?: number;
  endVerse?: number;
  complete?: boolean;
}
const names = new Map(BOOKS.map((book) => [book.toLowerCase(), book]));
for (const book of BOOKS) {
  if (/^[123] /.test(book)) {
    names.set(book.replace(/^1/, 'First').replace(/^2/, 'Second').replace(/^3/, 'Third').toLowerCase(), book);
  }
}
names.set('psalm', 'Psalms');
names.set('song of songs', 'Song of Solomon');
names.set('revelations', 'Revelation');
const bookPattern = new RegExp(`\\b(?:${[...names.keys()].sort((a, b) => b.length - a.length).map((name) => name.replace(/ /g, '\\s+')).join('|')})\\b`, 'gi');

export function transcriptBookMentions(text: string): { start: number; end: number; book: string }[] {
  return [...text.matchAll(bookPattern)].map((match) => ({
    start: match.index!, end: match.index! + match[0].length,
    book: names.get(match[0].toLowerCase().replace(/\s+/g, ' '))!,
  }));
}

/** A display hint, not a verse resolver. An unfinished book name can warm up;
 * only a valid chapter makes the colour persist after the utterance finishes. */
export function transcriptReferences(text: string, partial = false): TranscriptReference[] {
  const out: TranscriptReference[] = [];
  for (const { start, end: bookEnd, book } of transcriptBookMentions(text)) {
    const rest = text.slice(bookEnd);
    const tokens = [...rest.matchAll(/\d+|[a-z]+/gi)].map((match) => ({ word: match[0].toLowerCase(), start: match.index!, end: match.index! + match[0].length }));
    const words = tokens.map((token) => token.word);
    let i = 0;
    if (/^chapters?$/.test(words[i])) { i++; if (words[i] === 'number') i++; }
    const chapter = /^[\s,:]*$/.test(rest.slice(0, tokens[0]?.start ?? rest.length)) ? parseSpokenNumber(words, i) : null;
    if (chapter) {
      const value = chapter.value;
      if (value < 1 || value > CHAPTER_COUNTS[BOOKS.indexOf(book)]) continue;
      i += chapter.consumed;
      let end = tokens[i - 1].end;
      let next = i;
      if (words[next] === 'and' && /^verses?$/.test(words[next + 1])) next++;
      if (/^verses?$/.test(words[next])) next++;
      const verse = parseSpokenNumber(words, next);
      let endVerse: number | undefined;
      if (verse && verse.value > 0) {
        i = next + verse.consumed;
        end = tokens[i - 1].end;
        const gap = tokens[i] ? rest.slice(end, tokens[i].start) : '';
        const rangeWord = /^(to|through|thru)$/.test(words[i]);
        const range = parseSpokenNumber(words, i + (rangeWord ? 1 : 0));
        if (range && (rangeWord || /[-–]/.test(gap)) && range.value >= verse.value) {
          endVerse = range.value;
          i += range.consumed + (rangeWord ? 1 : 0);
          end = tokens[i - 1].end;
        }
      }
      const boundary = words[i];
      // "and there appeared…" starts the reading; "and seventeen" can
      // still extend the reference. A completed verse must survive both ASR
      // punctuation and the conjunction at the start of a scripture quote.
      const openAnd = boundary === 'and' && (!words[i + 1] || !!parseSpokenNumber(words, i + 1) || /^(verse|verses|chapter)$/.test(words[i + 1]));
      const continuation = openAnd || /^(to|through|thru|verse|verses|chapter)$/.test(boundary);
      const closed = !!boundary && !continuation && !parseSpokenNumber(words, i);
      const unfinished = continuation || /[-–:]\s*$/.test(rest.slice(end));
      out.push({ start, end: bookEnd + end, book, chapter: value, verse: verse?.value, endVerse,
        complete: !!verse && verse.value > 0 && ((!partial && !unfinished) || closed), state: 'confirmed' });
    } else if (partial && /^\s*[,.:]?\s*(?:(?:chapters?|verses?)(?:\s+number)?\s*)?$/i.test(rest)) {
      out.push({ start, end: bookEnd, book, state: 'possible' });
    }
  }
  return out;
}
