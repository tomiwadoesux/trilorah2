import { MusicIcon, SplitIcon } from '../../../ui';
import type { EditorCard } from '../../../../shared/songDraft';
import './songEntry.css';

interface SongLyricsEntryProps {
  title: string;
  author: string;
  lyrics: string;
  cards: EditorCard[];
  onTitle: (title: string) => void;
  onAuthor: (author: string) => void;
  onLyrics: (lyrics: string) => void;
}

export function SongLyricsEntry({ title, author, lyrics, cards, onTitle, onAuthor, onLyrics }: SongLyricsEntryProps) {
  const lineCount = lyrics.split('\n').filter((line) => line.trim()).length;
  const firstSlide = cards[0];

  return (
    <div className="song-entry" data-guide="song-entry">
      <section className="song-entry-compose" aria-label="song details and lyrics">
        <div className="song-entry-details">
          <label className="song-entry-field">
            <span>song title</span>
            <input data-guide="song-title" value={title} onChange={(e) => onTitle(e.target.value)} placeholder="give your song a title" spellCheck={false} />
          </label>
          <label className="song-entry-field">
            <span>artist <span className="song-entry-optional">optional</span></span>
            <input aria-label="artist or author" value={author} onChange={(e) => onAuthor(e.target.value)} placeholder="artist or author" spellCheck={false} />
          </label>
        </div>

        <div className="song-entry-writing">
          <div className="song-entry-writing-heading">
            <label htmlFor="new-song-lyrics">lyrics</label>
            <span className="song-entry-auto"><SplitIcon size={12} /> auto-split</span>
          </div>
          <textarea
            data-guide="song-lyrics"
            id="new-song-lyrics"
            value={lyrics}
            onChange={(e) => onLyrics(e.target.value)}
            placeholder={'Type or paste the whole song here.\n\nLeave a blank line between verses and choruses.'}
            spellCheck={false}
            aria-describedby="song-entry-hint"
          />
          <div className="song-entry-writing-foot">
            <span id="song-entry-hint">slides split as you write</span>
            <span>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
          </div>
        </div>
      </section>

      <section className="song-entry-preview" aria-label="automatically split slides">
        <div className="song-entry-stack-space">
          <div className="song-entry-stack">
            {cards.length > 2 ? <span className="song-entry-stack-back song-entry-stack-back--far" aria-hidden="true" /> : null}
            {cards.length > 1 ? <span className="song-entry-stack-back song-entry-stack-back--near" aria-hidden="true" /> : null}
            <figure className="song-entry-stack-front">
              <figcaption>
                <span className="song-entry-stack-label">
                  {firstSlide ? <span className="song-entry-stack-number">01</span> : null}
                  <span>{firstSlide?.label || 'your first slide'}</span>
                </span>
                <span className="song-entry-count" aria-live="polite">{cards.length} {cards.length === 1 ? 'slide' : 'slides'}</span>
              </figcaption>
              <div className="song-entry-slide-canvas">
                {firstSlide ? <p>{firstSlide.text}</p> : (
                  <div className="song-entry-stack-empty">
                    <div className="song-entry-stack-placeholder" aria-hidden="true">
                      <MusicIcon size={25} /><span /><span /><span />
                    </div>
                    <p>add lyrics to get started</p>
                  </div>
                )}
              </div>
            </figure>
          </div>
        </div>
        <p className="song-entry-preview-hint">{firstSlide ? 'Your first slide. Arrange to edit the whole song.' : 'Your slides take shape as you write.'}</p>
      </section>
    </div>
  );
}
