import type { LiveItem } from '../design/screens/projector';
import type { VerseSlide } from '../../shared/verseDisplay';
/** All text sources must render in the operator panels, including song lyrics. */
export function stageSlide(item: LiveItem | null, slideIndex = 0): VerseSlide | null {
  if (!item) return null;
  if (item.slides?.length) return item.slides[Math.min(slideIndex, item.slides.length - 1)];
  const text = item.lines?.join('\n') || item.text;
  if (!text) return null;
  return {
    reference: item.source === 'song' ? item.title ?? item.label : item.reference ?? item.label,
    lines: [{version:item.source === 'song' ? '' : item.version ?? 'KJV',text}],
    verseStart:1,verseEnd:1,index:1,total:1,
  };
}
