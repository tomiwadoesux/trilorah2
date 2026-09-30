import type { SongSection } from './types';

/** Desktop and phone use the same four-line pages and live identifiers. */
export function songCards(song: {id: string; sections: SongSection[]}) {
  return song.sections.flatMap((section, sectionIndex) => {
    const count = Math.max(1, Math.ceil(section.lines.length / 4));
    return Array.from({length: count}, (_, page) => ({
      id: `${song.id}/${song.id}:${sectionIndex}/page-${page}`,
      sectionIndex, offset: page * 4,
      label: count > 1 ? `${section.label} · ${page + 1}` : section.label,
      lines: section.lines.slice(page * 4, page * 4 + 4),
    }));
  });
}

export function editSongCard(sections: SongSection[], sectionIndex: number, offset: number, count: number, lines: string[]) {
  const section=sections[sectionIndex];
  if (!Number.isSafeInteger(sectionIndex) || sectionIndex<0 || !section || !Number.isSafeInteger(offset) || offset<0 || offset%4!==0 || (section.lines.length>0 && offset>=section.lines.length) || count!==section.lines.slice(offset,offset+4).length) {
    throw new Error('This lyric card changed. Reopen the song and try again.');
  }
  return sections.map((section,i)=>i===sectionIndex ? {...section,lines:[...section.lines.slice(0,offset),...lines,...section.lines.slice(offset+count)]} : section);
}
