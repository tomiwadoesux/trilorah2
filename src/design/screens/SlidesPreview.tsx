import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PresentationIcon } from '../../ui';
import './slidesPreview.css';

export interface SlidesPreviewDeck {
  id: string;
  title: string;
  pages: number;
  rendered: number;
}

export function SlidesPreview({ deck, src, page, onPage }: {
  deck: SlidesPreviewDeck | null;
  src?: string;
  page: number;
  onPage: (page: number) => void;
}) {
  const [failedSrc, setFailedSrc] = useState<string>();
  return <aside className="slides-preview tri-rounded-control" data-guide="slides-preview" aria-label="Slide preview">
    <div className="slides-preview__heading"><span>preview</span><PresentationIcon size={15} /></div>
    {deck ? <>
      <div className="slides-preview__image">
        {src && failedSrc !== src ? <img src={src} alt={`${deck.title} — slide ${page + 1}`} draggable={false} onError={() => setFailedSrc(src)} />
          : <div className="slides-preview__placeholder"><PresentationIcon size={28} /><span>{deck.rendered ? 'Preview unavailable' : 'Slides are being prepared'}</span></div>}
      </div>
      <h3 className="slides-preview__title">{deck.title}</h3>
      <p className="slides-preview__count">{deck.rendered < deck.pages ? `${deck.rendered} of ${deck.pages} slides ready` : `${deck.pages} ${deck.pages === 1 ? 'slide' : 'slides'}`}</p>
      <div className="slides-preview__navigation">
        <button type="button" data-guide="slides-preview-previous" aria-label="Preview previous slide" disabled={page <= 0} onClick={() => onPage(page - 1)}><ChevronLeftIcon size={16} /></button>
        <span role="status">{deck.rendered ? `Slide ${page + 1} of ${deck.pages}` : 'Preparing slides'}</span>
        <button type="button" data-guide="slides-preview-next" aria-label="Preview next slide" disabled={page >= deck.rendered - 1} onClick={() => onPage(page + 1)}><ChevronRightIcon size={16} /></button>
      </div>
      {deck.rendered > 1 && <div className="slides-preview__pages" aria-label="Choose a slide to preview">
        {Array.from({ length: deck.rendered }, (_, index) => <button key={index} type="button" data-guide="slides-preview-page" aria-label={`Preview slide ${index + 1}`} aria-pressed={page === index} onClick={() => onPage(index)}>{index + 1}</button>)}
      </div>}
    </> : <div className="slides-preview__placeholder slides-preview__empty"><PresentationIcon size={28} /><p>Select a deck to preview its slides.</p></div>}
  </aside>;
}
