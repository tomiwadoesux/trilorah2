import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowIcon,
  CheckIcon,
  CopyIcon,
  GripIcon,
  MergeIcon,
  MusicIcon,
  PlusIcon,
  ResetIcon,
  SparkleIcon,
  SplitIcon,
  TrashIcon,
  cx,
} from '../../../ui';
import { sectionsToText, slideFit, splitLyrics, type Fit, type SongSection } from '../../../../shared/lyricSplit';
import {
  cardKey,
  cardsToSections,
  deleteCard,
  duplicateCard,
  editCount,
  isDirty,
  hasSongDraftContent,
  linesOf,
  mergeWithNext,
  moveCard,
  sectionsToCards,
  splitCard,
  type EditorCard,
  type SongBase,
  type SongDraft,
} from '../../../../shared/songDraft';
import { FLIGHT_MS } from '../dashboard/expand';
import { FlightPopup } from './FlightPopup';
import { SongLyricsEntry } from './SongLyricsEntry';
import './songEditor.css';

/*
 * The song editor — a song card, opened.
 *
 * What is on screen is the song AS THE PROJECTOR WILL PAGE IT: one card per
 * slide, in order, each with the words it will show. Editing a song is
 * almost never rewriting it; it is moving a line from the foot of one slide
 * to the head of the next, renaming "Verse 3" to "Bridge", and cutting the
 * slide that ran to six lines. So those are the verbs on every card, and the
 * fit hint under each is the splitter's own opinion of that slide, live.
 *
 * Three promises:
 *
 *   Nothing reaches the library until Save. A new song (from search, a
 *   video, a paste) opens here already split, and is only `songs.add`ed when
 *   the operator says so.
 *
 *   Closing never loses work and never commits it. Unsaved changes become a
 *   DRAFT — words, scroll position, the card that held the caret — and the
 *   next open of that song resumes it.
 *
 *   Reset goes back to what the library holds (or, for a new song, to what
 *   the splitter first produced), and clears the draft.
 */

export interface EditorSession {
  /** A library id, or `new:…` for a song that exists only here. */
  id: string;
  isNew: boolean;
  base: SongBase;
  draft?: SongDraft;
  /** One line about where a new song's words came from, shown under the title. */
  note?: string;
}

export interface SongEditorProps {
  session: EditorSession;
  open: boolean;
  origin?: HTMLElement | null;
  /** Resolve false (or throw) and the editor stays open and says it failed. */
  onSave: (song: SongBase) => Promise<boolean>;
  /** A draft to keep, or null to forget this song's draft. */
  onDraft: (draft: SongDraft | null) => void;
  onRequestClose: () => void;
  onClosed: () => void;
}

const FIT_COPY: Record<Fit, string> = { fits: 'fits on slide', tight: 'text is dense', over: 'too much text' };
/* The selected app accent marks a comfortable fit; warnings stay semantic. */
const FIT_INK: Record<Fit, string> = {
  fits: 'rgb(var(--tri-go-2) / 0.85)',
  tight: 'var(--tri-accent-yellow)',
  over: 'var(--tri-ink-danger-hover)',
};

/** Edits past which Reset and re-split ask first. */
const MANY = 3;

type Ask = { kind: 'reset' | 'resplit'; text: string } | null;

export function SongEditor({ session, open, origin, onSave, onDraft, onRequestClose, onClosed }: SongEditorProps) {
  const { base, draft, isNew } = session;
  const [title, setTitle] = useState(draft?.title ?? base.title);
  const [author, setAuthor] = useState(draft?.author ?? base.author);
  const [cards, setCards] = useState<EditorCard[]>(() =>
    draft?.cards?.length ? draft.cards : sectionsToCards(base.sections),
  );
  const startsWithLyrics = isNew && base.sections.every((section) => section.lines.every((line) => !line.trim()));
  const [collectingLyrics, setCollectingLyrics] = useState(() =>
    draft?.sourceLyrics !== undefined || (startsWithLyrics && cardsToSections(cards).length === 0),
  );
  const [sourceLyrics, setSourceLyrics] = useState(draft?.sourceLyrics ?? '');
  const [closePrompt, setClosePrompt] = useState(false);
  const [attention, setAttention] = useState(0);
  const [ask, setAsk] = useState<Ask>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const areas = useRef(new Map<string, HTMLTextAreaElement>());
  /* The last textarea to hold the caret. Read at close — by then focus has
     already moved to the ✕, so document.activeElement is no use. */
  const lastFocus = useRef<{ key: string | null; caret: number }>({
    key: draft?.focusKey ?? null,
    caret: draft?.caret ?? 0,
  });
  /* Focus to take once React has drawn the cards an action produced. */
  const wantFocus = useRef<{ key: string; caret: number } | null>(null);

  const dirty = useMemo(() => isDirty(base, { title, author, cards }), [base, title, author, cards]);
  const hasWords = useMemo(() => cardsToSections(cards).length > 0, [cards]);
  /* A new song is unsaved by definition, so Save is live from the start;
     Reset still waits for a real difference from what the splitter made. */
  const canSave = (dirty || isNew) && hasWords && title.trim() !== '' && !saving;

  /* ---- resume: scroll and caret, once the box has landed ------------ */
  useEffect(() => {
    if (!draft) return;
    const restore = () => {
      if (scroller.current) scroller.current.scrollTop = draft.scrollTop;
      const el = draft.focusKey ? areas.current.get(draft.focusKey) : null;
      if (el) {
        el.focus({ preventScroll: true });
        const at = Math.min(draft.caret, el.value.length);
        el.setSelectionRange(at, at);
      }
    };
    restore();
    /* Again after the flight: the scroller has no height to scroll while the
       box is still the size of a song card. */
    const t = setTimeout(restore, FLIGHT_MS + 40);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const want = wantFocus.current;
    if (!want) return;
    wantFocus.current = null;
    const el = areas.current.get(want.key);
    if (!el) return;
    el.focus();
    const at = Math.min(want.caret, el.value.length);
    el.setSelectionRange(at, at);
  }, [cards, collectingLyrics]);

  /* A slide's box is as tall as its words, wrapped lines included — a long
     line that scrolls out of its own card is a line nobody checks. Measured,
     because `rows` counts newlines and knows nothing about wrapping; and
     re-measured when the box changes width, which it does all through the
     opening flight. */
  useLayoutEffect(() => {
    const fit = () =>
      areas.current.forEach((el) => {
        el.style.height = '0px';
        el.style.height = `${el.scrollHeight}px`;
      });
    fit();
    const host = scroller.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
  }, [cards, collectingLyrics]);

  /* ---- what can be done to a card ----------------------------------- */
  const change = (next: EditorCard[]) => {
    setProblem(null);
    setCards(next);
  };
  const patch = (key: string, part: Partial<EditorCard>) =>
    change(cards.map((c) => (c.key === key ? { ...c, ...part } : c)));

  const enterLyrics = (text: string) => {
    setSourceLyrics(text);
    const sections = splitLyrics(text);
    change(sectionsToCards(sections.length ? sections : [{ label: 'Verse 1', lines: [] }]));
  };

  const arrangeSlides = () => {
    if (!hasWords) return;
    wantFocus.current = { key: cards[0].key, caret: 0 };
    setCollectingLyrics(false);
  };

  const splitAt = (index: number) => {
    const card = cards[index];
    const el = areas.current.get(card.key);
    const caret = lastFocus.current.key === card.key ? lastFocus.current.caret : (el?.selectionStart ?? 0);
    const next = splitCard(cards, index, caret);
    if (next === cards) return;
    wantFocus.current = { key: next[index + 1].key, caret: 0 };
    change(next);
  };

  const move = (index: number, to: number) => {
    const next = moveCard(cards, index, to);
    if (next === cards) return;
    wantFocus.current = { key: cards[index].key, caret: lastFocus.current.caret };
    change(next);
  };

  const addCard = () => {
    const key = cardKey();
    wantFocus.current = { key, caret: 0 };
    change([...cards, { key, label: `Verse ${cards.length + 1}`, text: '' }]);
    requestAnimationFrame(() => {
      if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
    });
  };

  /* ---- reset, re-split ---------------------------------------------- */
  const doReset = () => {
    setAsk(null);
    setProblem(null);
    setTitle(base.title);
    setAuthor(base.author);
    setCards(sectionsToCards(base.sections));
    setSourceLyrics('');
    setCollectingLyrics(startsWithLyrics);
    /* A new song's draft IS the song — forgetting it would delete it. */
    if (!isNew) onDraft(null);
  };
  const reset = () => {
    const n = editCount(base, cards);
    if (n >= MANY) setAsk({ kind: 'reset', text: `undo the changes to ${n} slides?` });
    else doReset();
  };

  const doResplit = () => {
    setAsk(null);
    const next: SongSection[] = splitLyrics(sectionsToText(cardsToSections(cards)));
    if (next.length) change(sectionsToCards(next));
  };

  /* ---- close, save --------------------------------------------------- */
  const snapshot = (): SongDraft => ({
    title,
    author,
    cards,
    ...(collectingLyrics ? { sourceLyrics } : {}),
    scrollTop: scroller.current?.scrollTop ?? 0,
    focusKey: lastFocus.current.key && cards.some((c) => c.key === lastFocus.current.key) ? lastFocus.current.key : null,
    caret: lastFocus.current.caret,
    updatedAt: Date.now(),
    ...(isNew ? { base } : {}),
  });

  const finishClose = () => {
    if (saving) return;
    const draft = snapshot();
    onDraft((isNew ? hasSongDraftContent(draft) : dirty) ? draft : null);
    onRequestClose();
  };

  const close = () => {
    if (saving) return;
    if (isNew ? hasSongDraftContent(snapshot()) : dirty) {
      setClosePrompt(true);
      setAttention(n => n + 1);
    } else { onDraft(null); onRequestClose(); }
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setProblem(null);
    let ok = false;
    try {
      ok = await onSave({ title: title.trim(), author: author.trim(), sections: cardsToSections(cards) });
    } catch {
      ok = false;
    }
    setSaving(false);
    if (!ok) {
      setProblem('that did not save — nothing was lost, try again');
      return;
    }
    onDraft(null);
    onRequestClose();
  };

  /* As tall as the song needs, within reason: a two-verse hymn in a box
     sized for twenty slides is mostly empty floor. Fixed at open — a box
     that resized as cards were split would move Save under the pointer. */
  const [size] = useState(() => {
    if (collectingLyrics) return { w: 1080, h: 640 };
    const rows = Math.ceil(cards.length / 3);
    return { w: 1180, h: Math.min(760, Math.max(590, 250 + rows * 320)) };
  });

  const field =
    'min-w-0 bg-transparent border-0 p-0 text-[var(--tri-ink)] placeholder:text-[rgb(229_243_242_/_0.3)] focus:outline-none';

  return (
    <FlightPopup
      open={open}
      origin={origin}
      size={size}
      label={collectingLyrics ? 'add a song' : `edit ${base.title || 'song'}`}
      onRequestClose={close}
      onClosed={onClosed}
      attention={attention}
      overlay={closePrompt && open ? <SongClosePrompt
        onKeepEditing={() => setClosePrompt(false)}
        onKeep={finishClose}
        onDiscard={() => { onDraft(null); onRequestClose(); }}
      /> : null}
      header={
        collectingLyrics ? (
          <div className="song-entry-heading">
            <span className="song-entry-heading-icon"><MusicIcon size={20} /></span>
            <div><h2>add a song</h2><p>Start with the words. Make them your own.</p></div>
          </div>
        ) : <div className="song-editor-heading">
          <span className="song-entry-heading-icon"><MusicIcon size={20} /></span>
          <div className="song-editor-details">
            <input
              value={title}
              onChange={(e) => {
                setProblem(null);
                setTitle(e.target.value);
              }}
              placeholder="song title"
              aria-label="song title"
              spellCheck={false}
              className={cx(field, 'song-editor-title')}
            />
            <div className="flex min-w-0 items-center gap-2">
              <input
                value={author}
                onChange={(e) => {
                  setProblem(null);
                  setAuthor(e.target.value);
                }}
                placeholder="artist or author"
                aria-label="artist or author"
                spellCheck={false}
                className={cx(field, 'song-editor-author')}
              />
              {session.note ? (
                <span className="truncate text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.42)]">
                  {session.note}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      }
      footer={
        collectingLyrics ? (
          <footer className="song-entry-footer">
            <div className="song-entry-footer-status">
              {ask ? <>
                <span>{ask.text}</span>
                <button type="button" className="song-entry-secondary" onClick={doReset}>reset</button>
                <button type="button" className="song-entry-secondary" onClick={() => setAsk(null)}>keep editing</button>
              </> : <><CheckIcon size={12} /><span>Review and arrange before saving.</span></>}
            </div>
            <div className="song-entry-footer-actions">
              {Boolean(title.trim() || author.trim() || sourceLyrics.trim()) && !ask ? <button type="button" className="song-entry-secondary" onClick={reset}>reset</button> : null}
              <button type="button" className="song-entry-primary" disabled={!hasWords || !!ask} onClick={arrangeSlides}>
                arrange slides <ArrowIcon size={14} />
              </button>
            </div>
          </footer>
        ) : <footer className="song-entry-footer song-editor-footer">
          <div className="song-entry-footer-status" aria-live="polite">
            {ask ? <>
              <span>{ask.text}</span>
              <button type="button" className="song-entry-secondary" onClick={ask.kind === 'reset' ? doReset : doResplit}>
                {ask.kind === 'reset' ? 'reset' : 're-split'}
              </button>
              <button type="button" className="song-entry-secondary" onClick={() => setAsk(null)}>keep editing</button>
            </> : <span className={problem ? 'song-editor-error' : undefined}>
              {problem ?? (!title.trim() ? 'Add a song title to save.' : !hasWords ? 'Add lyrics to at least one slide.' :
                isNew ? 'Not in your library yet' : dirty ? 'Unsaved changes' : 'All changes saved')}
            </span>}
          </div>
          <div className="song-entry-footer-actions">
            {dirty && !ask ? <button type="button" className="song-entry-secondary" disabled={saving} onClick={reset}>
              <ResetIcon size={14} /> reset
            </button> : null}
            <button type="button" className="song-entry-primary" disabled={!canSave || !!ask} onClick={() => void save()}>
              <CheckIcon size={14} />{saving ? 'saving…' : isNew ? 'save to library' : 'save changes'}
            </button>
          </div>
        </footer>
      }
    >
      <div
        ref={scroller}
        className={collectingLyrics ? 'song-entry-body' : 'song-editor-body'}
      >
        {collectingLyrics ? (
          <SongLyricsEntry
            title={title}
            author={author}
            lyrics={sourceLyrics}
            cards={hasWords ? cards : []}
            onTitle={(value) => { setProblem(null); setTitle(value); }}
            onAuthor={(value) => { setProblem(null); setAuthor(value); }}
            onLyrics={enterLyrics}
          />
        ) : <>
          <div className="song-editor-toolbar">
            <div>
              <div className="song-editor-toolbar-title">
                <h2>arrange slides</h2>
                <span className="song-entry-count" aria-live="polite">{cards.length} {cards.length === 1 ? 'slide' : 'slides'}</span>
              </div>
              <p>Edit the words. Drag a handle or use the arrows to reorder.</p>
            </div>
            <div className="song-editor-tools">
              <button
                type="button"
                className="song-editor-tool"
                disabled={!!ask || !hasWords}
                title="Automatically split the lyrics into slides again"
                onClick={() => setAsk({ kind: 'resplit', text: 'Re-split all lyrics? Your slide breaks and labels will change.' })}
              >
                <SparkleIcon size={14} /> re-split
              </button>
              <button type="button" className="song-editor-tool song-editor-tool--accent" onClick={addCard}>
                <PlusIcon size={14} /> add slide
              </button>
            </div>
          </div>
          <ol className="song-editor-grid" aria-label="song slides">
            {cards.map((card, i) => {
              const lines = linesOf(card.text);
              const fit = slideFit(lines);
              return (
                <li
                  key={card.key}
                  className="song-editor-card"
                  aria-label={`slide ${i + 1}: ${card.label || 'untitled'}`}
                  data-dragging={dragFrom === i}
                  data-over={dragOver === i && dragFrom !== null && dragFrom !== i}
                  onDragOver={(e) => {
                    if (dragFrom === null) return;
                    e.preventDefault();
                    if (dragOver !== i) setDragOver(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragFrom !== null) move(dragFrom, i);
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                >
                  <div className="song-editor-card-heading">
                    <span className="song-editor-number">{String(i + 1).padStart(2, '0')}</span>
                    <input
                      value={card.label}
                      onChange={(e) => patch(card.key, { label: e.target.value })}
                      placeholder="section name"
                      aria-label={`label of slide ${i + 1}`}
                      spellCheck={false}
                      className="song-editor-label"
                    />
                    <span
                      draggable
                      title="Drag to reorder, or use the move buttons below"
                      className="song-editor-grip"
                      onDragStart={(e) => {
                        setDragFrom(i);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', card.label);
                        const host = e.currentTarget.closest('.song-editor-card');
                        if (host) e.dataTransfer.setDragImage(host, 16, 16);
                      }}
                      onDragEnd={() => {
                        setDragFrom(null);
                        setDragOver(null);
                      }}
                    >
                      <GripIcon size={16} />
                    </span>
                  </div>

                  <div className="song-editor-canvas">
                    <textarea
                      ref={(el) => {
                        if (el) areas.current.set(card.key, el);
                        else areas.current.delete(card.key);
                      }}
                      value={card.text}
                      rows={3}
                      spellCheck={false}
                      aria-label={`words of slide ${i + 1}`}
                      placeholder="Type the words for this slide…"
                      onChange={(e) => {
                        lastFocus.current = { key: card.key, caret: e.target.selectionStart ?? 0 };
                        patch(card.key, { text: e.target.value });
                      }}
                      onSelect={(e) => {
                        lastFocus.current = { key: card.key, caret: e.currentTarget.selectionStart ?? 0 };
                      }}
                      onFocus={(e) => {
                        lastFocus.current = { key: card.key, caret: e.currentTarget.selectionStart ?? 0 };
                      }}
                    />
                  </div>

                  <div className="song-editor-card-tools">
                    <CardAction label="split here — the cursor’s line starts a new slide" text="split here" disabled={lines.length < 2} onClick={() => splitAt(i)}>
                      <SplitIcon size={14} />
                    </CardAction>
                    <CardAction label="merge with the next slide" text="merge" disabled={i === cards.length - 1} onClick={() => change(mergeWithNext(cards, i))}>
                      <MergeIcon size={14} />
                    </CardAction>
                    <CardAction label="duplicate this slide" text="duplicate" onClick={() => change(duplicateCard(cards, i))}>
                      <CopyIcon size={14} />
                    </CardAction>
                  </div>
                  <div className="song-editor-card-foot">
                    <span
                      className="song-editor-fit"
                      style={{ color: lines.length ? FIT_INK[fit.fit] : undefined }}
                      title={`${fit.lines} lines · about ${fit.syllables} syllables · ${fit.chars} characters`}
                    >
                      {lines.length > 0 && fit.fit === 'fits' ? <CheckIcon size={11} /> : null}
                      {lines.length ? `${lines.length} ${lines.length === 1 ? 'line' : 'lines'} · ${FIT_COPY[fit.fit]}` : 'empty slide'}
                    </span>
                    <div className="song-editor-order">
                      <CardAction label="move earlier" disabled={i === 0} onClick={() => move(i, i - 1)}>
                        <ArrowIcon size={14} className="rotate-180" />
                      </CardAction>
                      <CardAction label="move later" disabled={i === cards.length - 1} onClick={() => move(i, i + 1)}>
                        <ArrowIcon size={14} />
                      </CardAction>
                      <span className="song-editor-action-divider" />
                      <CardAction label="delete this slide" danger disabled={cards.length <= 1} onClick={() => change(deleteCard(cards, i))}>
                        <TrashIcon size={13} />
                      </CardAction>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>}
      </div>
    </FlightPopup>
  );
}

function CardAction({
  label,
  text,
  onClick,
  disabled = false,
  danger = false,
  children,
}: {
  label: string;
  text?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cx('song-editor-action', text && 'song-editor-action--labelled', danger && 'song-editor-action--danger')}
    >
      {children}{text ? <span>{text}</span> : null}
    </button>
  );
}


function SongClosePrompt({ onKeepEditing, onKeep, onDiscard }: {
  onKeepEditing: () => void; onKeep: () => void; onDiscard: () => void;
}) {
  const prompt = useRef<HTMLDivElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    stay.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="song-close-scrim">
    <div ref={prompt} role="alertdialog" aria-modal="true" aria-labelledby="song-close-title" aria-describedby="song-close-description" className="song-close-card"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onKeepEditing(); }
        if (event.key === 'Tab') {
          const buttons = prompt.current?.querySelectorAll<HTMLButtonElement>('button');
          if (!buttons?.length) return;
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}>
      <span className="song-entry-heading-icon"><MusicIcon size={22} /></span>
      <h2 id="song-close-title">Leave this song?</h2>
      <p id="song-close-description">This draft will be deleted after 30 minutes unless you return to edit and save it. You can also discard these changes now.</p>
      <div className="song-close-actions">
        <button type="button" className="song-entry-primary" onClick={onKeep}>leave and keep draft temporarily</button>
        <button type="button" className="song-entry-secondary song-close-discard" onClick={onDiscard}>discard changes</button>
      </div>
      <button ref={stay} type="button" className="song-entry-secondary" onClick={onKeepEditing}>keep editing</button>
    </div>
  </div>;
}
