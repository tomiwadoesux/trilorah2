import type { LiveItem } from '../design/screens/projector';
import type { VerseSlide } from '../../shared/verseDisplay';
/** All text sources must render in the operator panels, including song lyrics. */
export function stageSlide(item: LiveItem | null, slideIndex = 0): VerseSlide | null {
  if (!item) return null;
  if (item.slides?.length) return item.slides[Math.min(slideIndex, item.slides.length - 1)];
  const text = item.lines?.join('\n') || item.text;
  if (!text) return null;
  /* A lyric screen has no citation: the song's name is a small credit at the
     foot, as the wall draws it. */
  if (item.source === 'song') return { reference: null, credit: item.title ?? item.label, lyric: true, lines: [{version:'',text}], verseStart:1,verseEnd:1,index:1,total:1 };
  return {
    reference: item.reference ?? item.label,
    lines: [{version:item.version ?? 'KJV',text}],
    verseStart:1,verseEnd:1,index:1,total:1,
  };
}
