import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowIcon,
  Button,
  CheckIcon,
  CopyIcon,
  GripIcon,
  MergeIcon,
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
import './songs.css';

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

const FIT_COPY: Record<Fit, string> = { fits: 'fits', tight: 'tight', over: 'too long' };
/* Mint, gold, and red only for the one that will not fit — see the brief:
   a warning colour on a slide that is merely full teaches people to ignore it. */
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
  }, [cards]);

  /* A slide's box is as tall as its words, wrapped lines included — a long
     line that scrolls out of its own card is a line nobody checks. Measured,
     because `rows` counts newlines and knows nothing about wrapping; and
     re-measured when the box changes width, which it does all through the
     opening flight. */
  useLayoutEffect(() => {
    const fit = () =>
      areas.current.forEach((el) => {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      });
    fit();
    const host = scroller.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
  }, [cards]);

  /* ---- what can be done to a card ----------------------------------- */
  const change = (next: EditorCard[]) => {
    setProblem(null);
    setCards(next);
  };
  const patch = (key: string, part: Partial<EditorCard>) =>
    change(cards.map((c) => (c.key === key ? { ...c, ...part } : c)));

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
    scrollTop: scroller.current?.scrollTop ?? 0,
    focusKey: lastFocus.current.key && cards.some((c) => c.key === lastFocus.current.key) ? lastFocus.current.key : null,
    caret: lastFocus.current.caret,
    updatedAt: Date.now(),
    ...(isNew ? { base } : {}),
  });

  const close = () => {
    if (saving) return;
    onDraft(dirty || isNew ? snapshot() : null);
    onRequestClose();
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
    const rows = Math.ceil(cards.length / 4);
    return { w: 1180, h: Math.min(760, Math.max(440, 210 + rows * 200)) };
  });

  const field =
    'min-w-0 bg-transparent border-0 p-0 text-[var(--tri-ink)] placeholder:text-[rgb(229_243_242_/_0.3)] focus:outline-none';

  return (
    <FlightPopup
      open={open}
      origin={origin}
      size={size}
      label={`edit ${base.title || 'song'}`}
      onRequestClose={close}
      onClosed={onClosed}
      header={
        <div className="flex min-w-0 flex-col gap-1">
          <input
            value={title}
            onChange={(e) => {
              setProblem(null);
              setTitle(e.target.value);
            }}
            placeholder="song title"
            aria-label="song title"
            spellCheck={false}
            className={cx(field, 'w-full truncate text-[20px] font-semibold tracking-tight')}
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
              className={cx(field, 'w-[min(320px,50%)] text-[length:var(--tri-size-sm)] !text-[var(--tri-ink-muted)]')}
            />
            {session.note ? (
              <span className="truncate text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.42)]">
                {session.note}
              </span>
            ) : null}
          </div>
        </div>
      }
      footer={
        <footer
          className="flex shrink-0 items-center justify-between gap-4 px-6 py-4"
          style={{ boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.07)' }}
        >
          <div className="flex min-w-0 items-center gap-3">
            {ask ? (
              /* The question takes the place of the status it is about, and
                 the two answers are the system's own buttons. No dialog on
                 top of a dialog. */
              <>
                <span className="truncate text-[length:var(--tri-size-sm)] lowercase text-[var(--tri-ink)]">{ask.text}</span>
                <Button label="yes" tone="caution" onClick={ask.kind === 'reset' ? doReset : doResplit} />
                <Button label="keep editing" tone="ash" onClick={() => setAsk(null)} />
              </>
            ) : (
              <>
                <Button
                  label="re-split all"
                  tone="ash"
                  icon={<SparkleIcon size={12} />}
                  title="run every slide back through the splitter — four lines a slide, by the syllable"
                  onClick={() =>
                    setAsk({ kind: 'resplit', text: `re-cut all ${cards.length} slides? labels and breaks you set by hand will change` })
                  }
                />
                <Button label="add slide" tone="ash" icon={<PlusIcon size={12} />} onClick={addCard} />
                <span
                  className="truncate text-[length:var(--tri-size-xs)] lowercase"
                  style={{ color: problem ? 'var(--tri-ink-danger-hover)' : 'rgb(229 243 242 / 0.42)' }}
                >
                  {problem ??
                    `${cards.length} slide${cards.length === 1 ? '' : 's'} · ${
                      isNew ? 'not in the library yet' : dirty ? (draft ? 'draft — unsaved changes' : 'unsaved changes') : 'no changes'
                    }`}
                </span>
              </>
            )}
          </div>

          {/* Save never moves; Reset comes out from behind it. See songs.css. */}
          <div className="flex shrink-0 items-center" style={{ gap: 'var(--song-foot-gap, 8px)' }}>
            <div className="song-reset" data-out={dirty && !saving} inert={!dirty || saving}>
              <Button
                label="reset"
                tone="caution"
                icon={<ResetIcon size={13} />}
                title={isNew ? 'back to how it was first split' : 'back to the saved version'}
                onClick={dirty ? reset : undefined}
                className="min-w-[104px]"
              />
            </div>
            <div className="song-save">
              <Button
                label={saving ? 'saving…' : isNew ? 'save to library' : 'save'}
                tone="go"
                icon={<CheckIcon size={13} />}
                disabled={!canSave}
                title={canSave ? undefined : dirty || isNew ? 'a song needs a title and some words' : 'nothing to save yet'}
                onClick={() => void save()}
                className="min-w-[104px]"
              />
            </div>
          </div>
        </footer>
      }
    >
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4"
      >
        <div className="grid items-start gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
          {cards.map((card, i) => {
            const lines = linesOf(card.text);
            const fit = slideFit(lines);
            return (
              <div
                key={card.key}
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
                className={cx(
                  'song-slide tri-rounded-control flex flex-col gap-2 bg-[rgb(255_255_255_/_0.03)] p-3 transition-[opacity,box-shadow] duration-150',
                  dragFrom === i && 'opacity-40',
                )}
                style={{ boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.08)' }}
              >
                <div className="flex items-center gap-2">
                  {/* The grip is the only draggable part: a drag that began on
                      the words would fight text selection. */}
                  <span
                    draggable
                    title="drag to reorder"
                    onDragStart={(e) => {
                      setDragFrom(i);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', card.label);
                      const host = e.currentTarget.closest('.song-slide');
                      if (host) e.dataTransfer.setDragImage(host, 16, 16);
                    }}
                    onDragEnd={() => {
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    className="-ml-1 grid h-6 w-5 shrink-0 cursor-grab place-items-center text-[rgb(229_243_242_/_0.3)] hover:text-[var(--tri-ink)] active:cursor-grabbing"
                  >
                    <GripIcon size={13} />
                  </span>
                  <span className="shrink-0 text-[length:var(--tri-size-xs)] tabular-nums text-[rgb(229_243_242_/_0.35)]">
                    {i + 1}
                  </span>
                  <input
                    value={card.label}
                    onChange={(e) => patch(card.key, { label: e.target.value })}
                    placeholder="verse 1"
                    aria-label={`label of slide ${i + 1}`}
                    spellCheck={false}
                    className={cx(field, 'flex-1 text-[length:var(--tri-size-sm)] font-semibold')}
                  />
                  <span
                    className="shrink-0 text-[length:var(--tri-size-xs)] lowercase"
                    style={{ color: lines.length ? FIT_INK[fit.fit] : 'rgb(229 243 242 / 0.3)' }}
                    title={`${fit.lines} lines · about ${fit.syllables} syllables · ${fit.chars} characters`}
                  >
                    {lines.length ? FIT_COPY[fit.fit] : 'empty'}
                  </span>
                </div>

                <textarea
                  ref={(el) => {
                    if (el) areas.current.set(card.key, el);
                    else areas.current.delete(card.key);
                  }}
                  value={card.text}
                  rows={4}
                  spellCheck={false}
                  aria-label={`words of slide ${i + 1}`}
                  placeholder="the words on this slide, a line at a time"
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
                  /* Set like a slide — centred, the projector's own leading —
                     so a line that is too long LOOKS too long before the
                     hint says so. */
                  className="tri-rounded-control w-full resize-none overflow-hidden border-0 bg-[rgb(0_0_0_/_0.22)] px-3 py-3 text-center text-[length:var(--tri-size-sm)] leading-[1.55] text-[var(--tri-ink)] placeholder:text-[rgb(229_243_242_/_0.25)] focus:outline-none focus:shadow-[inset_0_0_0_var(--tri-border)_rgb(var(--tri-go-2)_/_0.45)]"
                />

                <div className="flex items-center gap-1">
                  <CardAction label="split here — the line the cursor is on starts a new slide" disabled={lines.length < 2} onClick={() => splitAt(i)}>
                    <SplitIcon size={13} />
                  </CardAction>
                  <CardAction label="merge with the next slide" disabled={i === cards.length - 1} onClick={() => change(mergeWithNext(cards, i))}>
                    <MergeIcon size={13} />
                  </CardAction>
                  <CardAction label="duplicate" onClick={() => change(duplicateCard(cards, i))}>
                    <CopyIcon size={13} />
                  </CardAction>
                  <span className="flex-1" />
                  <CardAction label="move earlier" disabled={i === 0} onClick={() => move(i, i - 1)}>
                    <ArrowIcon size={13} className="rotate-180" />
                  </CardAction>
                  <CardAction label="move later" disabled={i === cards.length - 1} onClick={() => move(i, i + 1)}>
                    <ArrowIcon size={13} />
                  </CardAction>
                  <CardAction label="delete this slide" danger disabled={cards.length <= 1} onClick={() => change(deleteCard(cards, i))}>
                    <TrashIcon size={12} />
                  </CardAction>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </FlightPopup>
  );
}

function CardAction({
  label,
  onClick,
  disabled = false,
  danger = false,
  children,
}: {
  label: string;
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
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={cx(
        'tri-rounded-control grid size-7 place-items-center transition-colors duration-150',
        disabled
          ? 'cursor-not-allowed text-[rgb(229_243_242_/_0.18)]'
          : danger
            ? 'text-[var(--tri-ink-danger)] hover:bg-[rgb(var(--tri-red-2)_/_0.45)] hover:text-[var(--tri-ink-danger-hover)]'
            : 'text-[rgb(229_243_242_/_0.55)] hover:bg-[rgb(255_255_255_/_0.07)] hover:text-[var(--tri-ink)]',
      )}
    >
      {children}
    </button>
  );
}
