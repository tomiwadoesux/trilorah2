import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { CheckIcon, MediaIcon, PaletteIcon, PlayIcon, TrashIcon, cx } from '../../ui';
import './mediaLibraryCards.css';

export function MediaLibraryGrid({ children }: { children: ReactNode }) {
  return <div className="media-library-grid" role="region" aria-label="Pictures and videos">{children}</div>;
}

type DragProps = Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'>;

/** Standalone media gets a complete caption and actions outside the image.
 * Keep the drag binding on the preview button so pointer capture and keyboard
 * activation both select the same item. Footer actions never begin a drag. */
export function MediaLibraryCard({ src, label, detail, kind, selected, live, hasPoster = true, dragProps, onSelect, onBackground, onRemove }: {
  src: string;
  label: string;
  detail: string;
  kind: 'photo' | 'video';
  selected: boolean;
  live: boolean;
  hasPoster?: boolean;
  dragProps?: DragProps;
  onSelect: () => void;
  onBackground?: () => void;
  onRemove?: () => void;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const video = kind === 'video';
  const available = failedSrc !== src && (!video || hasPoster);
  return <article className={cx('media-library-card tri-rounded-control', selected && 'is-selected', live && 'is-live')}>
    <button type="button" data-guide="media-card" className="media-library-card__select"
      aria-label={`Preview ${label}${detail ? ` — ${detail}` : ''}`} aria-pressed={selected}
      {...dragProps} onClick={onSelect}>
      <span className="media-library-card__image">
        {available ? <img src={src} alt="" draggable={false} loading="lazy" onError={() => setFailedSrc(src)} />
          : <span className="media-library-card__fallback"><MediaIcon size={24} /><span>{video && !hasPoster ? 'No video thumbnail' : 'Preview unavailable'}</span></span>}
        {video && <span className="media-library-card__video" aria-hidden><PlayIcon size={18} /></span>}
        {(live || selected) && <span className="media-library-card__state">
          {live ? <span aria-hidden className="media-library-card__live-dot" /> : <CheckIcon size={12} />}
          {live ? 'live' : 'preview'}
        </span>}
      </span>
      <span className="media-library-card__caption">
        <span className="media-library-card__name" title={label}>{label}</span>
        <span className="media-library-card__detail" title={detail}>{detail || (video ? 'Video file' : 'Picture file')}</span>
      </span>
    </button>
    <div className="media-library-card__footer">
      <span className="media-library-card__kind">{video ? <PlayIcon size={12} /> : <MediaIcon size={12} />}{video ? 'video' : 'picture'}</span>
      <div className="media-library-card__actions">
        {onBackground && <button type="button" data-guide="media-to-themes" title="Use as a background" aria-label={`use ${label} as a background`} onClick={onBackground}><PaletteIcon size={14} /></button>}
        {onRemove && <button type="button" data-guide="media-delete" title="Remove from library" aria-label={`delete ${label}`} onClick={onRemove}><TrashIcon size={14} /></button>}
      </div>
    </div>
  </article>;
}
