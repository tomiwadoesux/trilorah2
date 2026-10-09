import { resliceSection, type SongSection } from './lyricSplit';

/** Rejoin imported slide fragments, then use the normal balanced lyric splitter.
 * Named verses/choruses and repeat markers remain hard musical boundaries. */
export function rearrangeLyrics(sections: SongSection[]): SongSection[] {
  const groups: SongSection[] = [];
  const generic = (label: string) => /^(?:(?:slide|page|part|section|lyrics?)\s*\d*|\d+)?$/i.test(label.trim());
  for (const section of sections) {
    const previous = groups.at(-1);
    const continuation = section.label.match(/^(.*?)\s*(?:\((\d+)\)|[·–—]\s*(\d+))$/);
    const joins = previous && !previous.repeat && (
      (generic(previous.label) && generic(section.label)) ||
      (continuation && Number(continuation[2] ?? continuation[3]) > 1 && continuation[1].trim() === previous.label)
    );
    if (joins) {
      previous.lines.push(...section.lines);
      if (section.repeat) previous.repeat = section.repeat;
    } else groups.push({ ...section, lines: [...section.lines] });
  }
  return groups.flatMap(section => resliceSection(section));
}
