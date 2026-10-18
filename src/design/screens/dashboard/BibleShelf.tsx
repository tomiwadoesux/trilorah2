import {
  memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent,
} from 'react';
import { BIBLE_SHELF, TRAINING_ROUND, type BookStanding, type ShelfBook } from '../../../../shared/preacherLearning';
import { Button, ChevronLeftIcon, CloseIcon, MicIcon, cx } from '../../../ui';
import { useBoxSize } from './useBoxSize';
import './bibleShelf.css';

/*
 * The shelf — all 66 books, drawn as spines, lit by how well Trilorah hears
 * this preacher say each one.
 *
 * It is the profile's one picture, and it is a chart rather than an
 * ornament: every spine is a fact. Mint is a book the app has understood
 * from this preacher (in training or a service), gold is one it needed a
 * book-name fix for, rose is one that still trips it up, and an unlit spine
 * is a book it has never heard them say. A spine's height is the book's
 * length, so the shelf reads as a Bible at a glance — Psalms towers,
 * Obadiah is a sliver — and the three books they quote most carry a
 * bookmark.
 *
 * Layout. The books have the two rows to themselves; what a book means lives
 * in one place that never moves — a column beside the rows on a wide card, a
 * fixed strip under them on a narrow one. Idle it is the key; pointing at a
 * book shows that book; clicking keeps it there with the one action that
 * matters (practise it).
 *
 * In each row the books that still trip it up stand first, behind a hairline,
 * so the work left is the first thing the eye lands on. When a row cannot
 * hold every book at a width where the names stay readable, it shows what
 * fits and ends in a "+N more" book; pressing it narrows the whole row until
 * every book is on it.
 *
 * Why the hover never drops: every column is a full-height button that never
 * moves, with the 3px gap drawn inside it, and only the book inside lifts.
 * Hover is read once, on the books area, and only leaving that area lets go —
 * so the gaps, the air above a short book and the space between the rows all
 * keep the last book shown.
 */

type State = BookStanding['state'];
type Testament = 'old' | 'new';

const WORD: Record<State, string> = {
  caught: 'understood',
  learned: 'understood with a fix',
  trouble: 'still trips it up',
  unheard: 'not heard yet',
};

const SAYS: Record<State, string> = {
  caught: 'Trilorah understands this book when they say it.',
  learned: 'Trilorah misheard it once and saved a fix, so it understands it now.',
  trouble: 'Trilorah still mishears this book. Practising it again usually fixes it.',
  unheard: "Trilorah hasn't heard them say this book yet.",
};

const NO_FIX: Record<State, string> = {
  caught: 'no mix-ups',
  learned: 'no fix saved',
  trouble: 'no fix saved yet',
  unheard: 'not tried yet',
};

const BLANK: BookStanding = { state: 'unheard', quoted: 0, fixes: [] };
const STATES: readonly State[] = ['caught', 'learned', 'trouble', 'unheard'];
const NAME: Record<Testament, string> = { old: 'Old Testament', new: 'New Testament' };
const TESTAMENTS: readonly Testament[] = ['old', 'new'];

/* Row geometry, in CSS pixels. A pitch is one column: the book plus its gap. */
const PITCH_MIN = 20; // the width a row is drawn at before it has been measured
const PITCH_MAX = 26; // the widest; spare room stays as empty shelf
const PITCH_FLOOR = 6; // a row shrunk to hold every book never goes thinner
const PITCH_LABEL = 16; // below this the names fade out, so a row this narrow offers "+N more"
const SEP_W = 13; // the hairline between the trouble books and the rest
const SLOT_W = 46; // the "+N more" book and the air before it
const ROW_PAD = 8; // 4px each side of a row
const HEADROOM = 16; // above the tallest book: the lift and the bookmark

const LIFT = [6, 2, 1]; // the book pointed at, then its neighbours
const PIN_LIFT = 4;
const LEAVE_MS = 120;
const MORPH_MS = 420;
const RISE_MS = 1300;
const RISE_AGAIN_MS = 20_000;

const heightOf = (b: ShelfBook) => Math.round(38 + Math.sqrt(b.chapters) * 7);
const ROWS: Record<Testament, readonly ShelfBook[]> = {
  old: BIBLE_SHELF.filter((b) => b.testament === 'old'),
  new: BIBLE_SHELF.filter((b) => b.testament === 'new'),
};
const ROW_H: Record<Testament, number> = {
  old: Math.max(...ROWS.old.map(heightOf)) + HEADROOM,
  new: Math.max(...ROWS.new.map(heightOf)) + HEADROOM,
};
const BY_BOOK = new Map(BIBLE_SHELF.map((b) => [b.book, b]));

/* "+N more" is a choice, so it lasts as long as the app is open. */
const remembered: Record<Testament, boolean> = { old: false, new: false };
/* Switching tabs remounts the shelf; the rise is for a shelf that is new to
   the eye, not one seen a moment ago. */
let lastRise = { at: 0, key: '' };

interface RowOrder { books: ShelfBook[]; trouble: number; sep: boolean }
interface RowFit { pitch: number; gap: number; shown: number; slot: 'more' | 'fewer' | null; thin: boolean }

function rowOrder(t: Testament, standings: Record<string, BookStanding>): RowOrder {
  const bad = ROWS[t].filter((b) => (standings[b.book] ?? BLANK).state === 'trouble');
  const rest = ROWS[t].filter((b) => (standings[b.book] ?? BLANK).state !== 'trouble');
  return { books: [...bad, ...rest], trouble: bad.length, sep: bad.length > 0 && rest.length > 0 };
}

/* Whole pixels only, so every hairline stays crisp. Both rows share one
   pitch while they fit, so a book is the same width on either shelf. A row
   folds into "+N more" only when its books would have to go narrower than
   PITCH_LABEL, where the names fade out; until then it narrows to fit. */
function fitRows(track: number, order: Record<Testament, RowOrder>, expanded: Record<Testament, boolean>): Record<Testament, RowFit> {
  const make = (pitch: number, shown: number, slot: RowFit['slot']): RowFit =>
    ({ pitch, shown, slot, gap: pitch >= 12 ? 3 : 2, thin: pitch < PITCH_LABEL });
  if (track <= 0) return { old: make(PITCH_MIN, order.old.books.length, null), new: make(PITCH_MIN, order.new.books.length, null) };

  const room = (t: Testament) => track - (order[t].sep ? SEP_W : 0);
  const natural = (t: Testament) => Math.floor(room(t) / order[t].books.length);
  const base = Math.min(PITCH_MAX, Math.max(PITCH_LABEL, Math.min(natural('old'), natural('new'))));
  const one = (t: Testament): RowFit => {
    const n = order[t].books.length;
    if (n * base <= room(t)) return make(base, n, null);
    if (!expanded[t]) return make(base, Math.min(n, Math.max(1, Math.floor((room(t) - SLOT_W) / base))), 'more');
    return make(Math.max(PITCH_FLOOR, Math.floor((room(t) - SLOT_W) / n)), n, 'fewer');
  };
  return { old: one('old'), new: one('new') };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function BibleShelf({
  standings,
  fresh,
  onPick,
}: {
  standings: Record<string, BookStanding>;
  /** Books whose spine changed in the round just finished — they pulse once. */
  fresh?: ReadonlySet<string>;
  /** Practising a book — the profile opens voice training on it. */
  onPick?: (book: string) => void;
}) {
  const stateOf = useCallback((book: string) => (standings[book] ?? BLANK).state, [standings]);
  const [peek, setPeek] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [stop, setStop] = useState<string | null>(null);
  const [spot, setSpot] = useState<State | null>(null);
  const [expanded, setExpanded] = useState<Record<Testament, boolean>>(() => ({ ...remembered }));
  const [morph, setMorph] = useState<Testament | null>(null);
  const [said, setSaid] = useState('');

  const rootRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLElement>(null);
  const peekFrom = useRef<'pointer' | 'keys' | null>(null);
  const leaveTimer = useRef(0);
  const morphTimer = useRef(0);
  const rowIds = { old: useId(), new: useId() };

  /* Measured off the books column, never a row: a row holds the "+N more"
     book, so measuring it would feed back into itself. Zero while the tab
     is display:none — keep the last real width rather than reflow blind. */
  const { ref: booksRef, width } = useBoxSize<HTMLDivElement>();
  const lastWidth = useRef(0);
  useLayoutEffect(() => { if (width > 0) lastWidth.current = width; }, [width]);
  const track = (width > 0 ? width : lastWidth.current) - ROW_PAD;

  const order = useMemo(() => ({ old: rowOrder('old', standings), new: rowOrder('new', standings) }), [standings]);
  const fit = useMemo(() => fitRows(track, order, expanded), [track, order, expanded]);
  const fitFolded = useMemo(() => fitRows(track, order, { old: false, new: false }), [track, order]);
  const marked = useMemo(
    () => new Set(Object.entries(standings).filter(([, s]) => s.quoted > 0).sort((a, b) => b[1].quoted - a[1].quoted).slice(0, 3).map(([b]) => b)),
    [standings],
  );
  const counts = useMemo(() => {
    const c: Record<State, number> = { caught: 0, learned: 0, trouble: 0, unheard: 0 };
    for (const b of BIBLE_SHELF) c[stateOf(b.book)] += 1;
    return c;
  }, [stateOf]);

  const fingerprint = useMemo(() => BIBLE_SHELF.map((b) => stateOf(b.book)[0]).join(''), [stateOf]);
  const [rise, setRise] = useState(() => Date.now() - lastRise.at > RISE_AGAIN_MS || lastRise.key !== fingerprint);
  useEffect(() => {
    if (!rise) return;
    lastRise = { at: Date.now(), key: fingerprint };
    const t = window.setTimeout(() => setRise(false), RISE_MS);
    return () => window.clearTimeout(t);
  }, [rise, fingerprint]);

  useEffect(() => () => { window.clearTimeout(leaveTimer.current); window.clearTimeout(morphTimer.current); }, []);

  const isHidden = (book: string) => {
    const b = BY_BOOK.get(book);
    if (!b) return false;
    return order[b.testament].books.findIndex((x) => x.book === book) >= fit[b.testament].shown;
  };

  /* ---- pointer: read once on the books area, let go only on leaving it ---- */
  const letGo = () => { if (peekFrom.current === 'pointer') { peekFrom.current = null; setPeek(null); } };
  const onOver = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    /* Focus is on the kept book's close or practise button: a passing pointer
       must not swap the details, or the button vanishes from under it. */
    if (infoRef.current?.contains(document.activeElement)) return;
    window.clearTimeout(leaveTimer.current);
    const hit = (e.target as Element).closest<HTMLElement>('[data-book]');
    if (!hit || hit.closest('[data-hidden]')) return;
    peekFrom.current = 'pointer';
    setPeek(hit.dataset.book ?? null);
  };
  const onLeave = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    window.clearTimeout(leaveTimer.current);
    const to = e.relatedTarget;
    /* Heading for the details: show the kept book (and its button) now. */
    if (to instanceof Node && infoRef.current?.contains(to)) { letGo(); return; }
    leaveTimer.current = window.setTimeout(letGo, LEAVE_MS);
  };
  const onInfoEnter = () => {
    window.clearTimeout(leaveTimer.current);
    peekFrom.current = null;
    setPeek(null);
  };

  /* ---- keeping a book in the details ---- */
  const togglePin = (book: string) => {
    const next = pin === book ? null : book;
    setPin(next);
    setStop(book);
    setSaid(next ? `${next} kept open: ${WORD[stateOf(next)]}.` : `${book} closed.`);
  };
  const focusBook = (book: string) => {
    const root = rootRef.current;
    if (!root) return;
    const b = BY_BOOK.get(book);
    const el = isHidden(book) && b
      ? root.querySelector<HTMLElement>(`[data-stop="more:${b.testament}"]`)
      : root.querySelector<HTMLElement>(`[data-book="${CSS.escape(book)}"]`);
    el?.focus();
  };
  const unpin = (moveFocus: boolean) => {
    if (!pin) return;
    const book = pin;
    setPin(null);
    setSaid(`${book} closed.`);
    /* The button that had focus is about to disappear: hand it to the book. */
    if (moveFocus) focusBook(book);
  };

  const onBooksClick = (e: MouseEvent<HTMLDivElement>) => {
    const hit = (e.target as Element).closest<HTMLElement>('[data-book]');
    if (hit?.dataset.book) togglePin(hit.dataset.book);
  };

  const onBooksFocus = (e: FocusEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (el.dataset.stop) setStop(el.dataset.stop);
    /* A mouse click focuses the button too — only a keyboard focus shows a
       book, or a click would leave one lit after the pointer has gone. */
    if (!el.matches(':focus-visible')) return;
    if (el.dataset.book) {
      window.clearTimeout(leaveTimer.current);
      peekFrom.current = 'keys';
      setPeek(el.dataset.book);
    } else if (peekFrom.current === 'keys') {
      peekFrom.current = null;
      setPeek(null);
    }
  };
  const onBooksBlur = (e: FocusEvent<HTMLDivElement>) => {
    const to = e.relatedTarget;
    if (to instanceof Node && e.currentTarget.contains(to)) return;
    if (peekFrom.current === 'keys') { peekFrom.current = null; setPeek(null); }
  };

  const onKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      if (!pin) return; // nothing to close: let the page have it
      e.preventDefault();
      e.stopPropagation();
      unpin(!!infoRef.current?.contains(document.activeElement));
      return;
    }
    const el = e.target as HTMLElement;
    const row = el.closest<HTMLElement>('[data-row]');
    if (!row || !el.dataset.stop) return;
    const stops = (r: Element) => Array.from(r.querySelectorAll<HTMLElement>('[data-stop]')).filter((s) => !s.closest('[data-hidden]'));
    const list = stops(row);
    const i = list.indexOf(el);
    let next: HTMLElement | undefined;
    switch (e.key) {
      case 'ArrowRight': next = list[i + 1]; break;
      case 'ArrowLeft': next = list[i - 1]; break;
      case 'Home': next = list[0]; break;
      case 'End': next = list[list.length - 1]; break;
      case 'ArrowUp':
      case 'ArrowDown': {
        const other: Testament = row.dataset.row === 'old' ? 'new' : 'old';
        if ((e.key === 'ArrowDown') !== (other === 'new')) break;
        const target = rootRef.current?.querySelector(`[data-row="${other}"]`);
        if (!target) break;
        const box = el.getBoundingClientRect();
        const x = box.left + box.width / 2;
        let best = Infinity;
        for (const s of stops(target)) {
          const r = s.getBoundingClientRect();
          const d = Math.abs(r.left + r.width / 2 - x);
          if (d < best) { best = d; next = s; }
        }
        break;
      }
      default: return;
    }
    e.preventDefault();
    next?.focus();
  };

  /* ---- more / fewer ---- */
  const toggleRow = (t: Testament) => {
    const next = !expanded[t];
    remembered[t] = next;
    setExpanded((x) => ({ ...x, [t]: next }));
    setMorph(t);
    window.clearTimeout(morphTimer.current);
    morphTimer.current = window.setTimeout(() => setMorph(null), MORPH_MS);
    const n = order[t].books.length;
    const shownAfter = fitRows(track, order, { ...expanded, [t]: next })[t].shown;
    setSaid(shownAfter >= n ? `Showing all ${n} ${NAME[t]} books.` : `Showing ${shownAfter} of ${n} ${NAME[t]} books.`);
  };

  /* One Tab stop for all 66: the last book touched, else the kept one, else
     the first that still trips it up, else Genesis. */
  const firstTrouble = BIBLE_SHELF.find((b) => stateOf(b.book) === 'trouble')?.book;
  let tabStop = stop ?? pin ?? firstTrouble ?? 'Genesis';
  if (tabStop.startsWith('more:')) {
    const t = tabStop.slice(5) as Testament;
    if (!fit[t]?.slot) tabStop = order[t]?.books[0]?.book ?? 'Genesis';
  } else if (isHidden(tabStop)) {
    tabStop = `more:${BY_BOOK.get(tabStop)?.testament ?? 'old'}`;
  }

  /* What the details show. */
  const shown = peek ?? pin;
  const kept = !!shown && shown === pin;
  const lit = peek;
  const litAt = (t: Testament) => (lit && BY_BOOK.get(lit)?.testament === t ? order[t].books.findIndex((b) => b.book === lit) : -1);
  const allDark = counts.unheard === BIBLE_SHELF.length;

  const rowFor = (t: Testament) => {
    const o = order[t];
    const f = fit[t];
    const at = litAt(t);
    const groupOf = (i: number) => (i < o.trouble ? 0 : 1);
    const hiddenBooks = o.books.slice(f.shown);
    const n = o.books.length;
    const label = o.trouble > 0
      ? `${NAME[t]} books; ${o.trouble === 1 ? '1 still trips it up and comes first' : `${o.trouble} still trip it up and come first`}`
      : `${NAME[t]} books`;
    const showSep = o.sep && f.shown > o.trouble;
    /* The books a "more" press brings in arrive one after another. */
    const folded = fitFolded[t].shown;

    return (
      <section className="shelf-shelf" key={t}>
        <p className="shelf-eyebrow" aria-hidden>
          {NAME[t].toLowerCase()}
          {o.trouble > 0 && <span className="shelf-eyebrow-trouble">· {o.trouble} to practise</span>}
        </p>
        <div className="shelf-plank">
          <ul
            id={rowIds[t]}
            role="list"
            className="shelf-track"
            data-row={t}
            data-thin={f.thin || undefined}
            data-morph={morph === t || undefined}
            aria-label={label}
            style={{ '--pitch': `${f.pitch}px`, '--gap': `${f.gap}px`, '--row-h': `${ROW_H[t]}px`, '--row-delay': t === 'new' ? '70ms' : '0ms' } as CSSProperties}
          >
            {o.books.map((b, i) => {
              const hidden = i >= f.shown;
              const d = at >= 0 && !hidden && groupOf(i) === groupOf(at) ? Math.abs(i - at) : Infinity;
              let lift = LIFT[d] ?? 0;
              if (pin === b.book && !hidden) lift = Math.max(lift, PIN_LIFT);
              const s = standings[b.book] ?? BLANK;
              return [
                showSep && i === o.trouble && <li key="sep" className="shelf-sep" aria-hidden />,
                <Spine
                  key={b.book}
                  book={b}
                  state={s.state}
                  lift={lift}
                  active={lit === b.book && !hidden}
                  pinned={pin === b.book}
                  fresh={!!fresh?.has(b.book)}
                  marked={marked.has(b.book)}
                  hidden={hidden}
                  index={i}
                  reveal={i >= folded ? Math.min(8, i - folded + 1) : 0}
                  tabStop={tabStop === b.book}
                />,
              ];
            })}
            {f.slot && (
              <li className="shelf-more-slot">
                <button
                  type="button"
                  className="shelf-more"
                  data-guide={`shelf-more-${t}`}
                  data-stop={`more:${t}`}
                  data-holds-pin={(!!pin && hiddenBooks.some((b) => b.book === pin)) || undefined}
                  data-fresh={(!!fresh && hiddenBooks.some((b) => fresh.has(b.book))) || undefined}
                  tabIndex={tabStop === `more:${t}` ? 0 : -1}
                  aria-expanded={f.slot === 'fewer'}
                  aria-controls={rowIds[t]}
                  aria-label={f.slot === 'more' ? `Show ${n - f.shown} more ${NAME[t]} books` : `Show fewer ${NAME[t]} books, larger`}
                  title={f.slot === 'more' ? `Show ${n - f.shown} more` : 'Show fewer, larger'}
                  onClick={() => toggleRow(t)}
                >
                  {f.slot === 'more' ? <>
                    <span className="shelf-more-tops" aria-hidden>
                      {hiddenBooks.map((b) => <i key={b.book} data-s={stateOf(b.book)} />)}
                    </span>
                    <span className="shelf-more-n">+{n - f.shown}</span>
                    <span className="shelf-more-word">more</span>
                  </> : <>
                    <ChevronLeftIcon size={10} />
                    <span className="shelf-more-word">fewer</span>
                  </>}
                </button>
              </li>
            )}
          </ul>
        </div>
      </section>
    );
  };

  return (
    <div
      ref={rootRef}
      className="shelf"
      data-rise={rise || undefined}
      data-spot={spot ?? undefined}
      onKeyDown={onKeys}
    >
      <div className="shelf-frame">
        <div
          ref={booksRef}
          className="shelf-books"
          onPointerOver={onOver}
          onPointerLeave={onLeave}
          onClick={onBooksClick}
          onFocus={onBooksFocus}
          onBlur={onBooksBlur}
        >
          {TESTAMENTS.map(rowFor)}
        </div>

        <aside ref={infoRef} className="shelf-info" aria-label="Book details" data-guide-area="shelf-info" onPointerEnter={onInfoEnter}>
          {shown ? (
            <BookDetails
              key="book"
              book={shown}
              standing={standings[shown] ?? BLANK}
              marked={marked.has(shown)}
              kept={kept}
              otherKept={!!pin && !kept}
              onPick={onPick}
              onClose={() => unpin(true)}
            />
          ) : (
            <div className="shelf-info-body" data-mode="idle" key="idle">
              <div className="shelf-info-who">
                <div className="shelf-info-head"><p className="shelf-info-eyebrow">what the colours mean</p></div>
              </div>
              <ul className="shelf-legend" onPointerLeave={() => setSpot(null)}>
                {STATES.map((state) => (
                  <li
                    key={state}
                    data-on={spot === state || undefined}
                    data-zero={counts[state] === 0 || undefined}
                    onPointerEnter={(e) => { if (e.pointerType !== 'touch') setSpot(counts[state] > 0 ? state : null); }}
                  >
                    <span className={`shelf-swatch shelf-swatch--${state}`} aria-hidden />
                    <span className="shelf-legend-word">{WORD[state]}</span>
                    <b>{counts[state]}</b>
                  </li>
                ))}
                {marked.size > 0 && (
                  <li data-ribbon onPointerEnter={() => setSpot(null)}>
                    <span className="shelf-swatch shelf-swatch--ribbon" aria-hidden />
                    <span className="shelf-legend-word">their most-quoted books</span>
                  </li>
                )}
              </ul>
              <p className="shelf-hint">
                {allDark
                  ? `No books heard yet. One round of voice training lights up the first ${TRAINING_ROUND}.`
                  : `Point at a book to see how Trilorah hears it. Click it to keep it here${onPick ? ' and practise it' : ''}.`}
              </p>
            </div>
          )}
        </aside>
      </div>
      <p className="sr-only" role="status">{said}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const Spine = memo(function Spine({
  book, state, lift, active, pinned, fresh, marked, hidden, index, reveal, tabStop,
}: {
  book: ShelfBook;
  state: State;
  lift: number;
  active: boolean;
  pinned: boolean;
  fresh: boolean;
  marked: boolean;
  hidden: boolean;
  index: number;
  reveal: number;
  tabStop: boolean;
}) {
  return (
    <li
      className="shelf-slot"
      data-state={state}
      data-hidden={hidden || undefined}
      data-active={active || undefined}
      data-pinned={(pinned && !hidden) || undefined}
      data-up={lift > 0 || undefined}
      data-fresh={(fresh && !hidden) || undefined}
      inert={hidden}
      style={{ '--h': `${heightOf(book)}px`, '--lift': `${-lift}px`, '--i': index, '--k': reveal } as CSSProperties}
    >
      <button
        type="button"
        className="shelf-hit"
        data-guide={`shelf-${book.book}`}
        data-book={book.book}
        data-stop={book.book}
        tabIndex={tabStop ? 0 : -1}
        aria-pressed={pinned}
        aria-label={`${book.book}, ${WORD[state]}${marked ? ', one of their most-quoted' : ''}`}
      >
        <span className="shelf-book">
          <span className={`shelf-spine shelf-spine--${state}`}>
            <span className="shelf-label" aria-hidden>{book.short}</span>
          </span>
          {marked && <span className="shelf-ribbon" aria-hidden />}
        </span>
      </button>
    </li>
  );
});

function BookDetails({
  book, standing, marked, kept, otherKept, onPick, onClose,
}: {
  book: string;
  standing: BookStanding;
  marked: boolean;
  kept: boolean;
  otherKept: boolean;
  onPick?: (book: string) => void;
  onClose: () => void;
}) {
  const b = BY_BOOK.get(book);
  const { state, fixes, quoted } = standing;
  const heard = fixes.length
    ? `${fixes.slice(0, 2).map((f) => `“${f}”`).join(', ')}${fixes.length > 2 ? ` +${fixes.length - 2}` : ''}`
    : NO_FIX[state];
  const used = quoted === 0 ? 'not yet' : quoted === 1 ? 'once' : `${quoted} times`;
  const hint = kept
    ? 'Click it again or press Esc to close.'
    : otherKept
      ? 'Click to keep this one here instead.'
      : `Click the book to keep it here${onPick ? ' and practise it' : ''}.`;

  return (
    <div className="shelf-info-body" data-mode="book">
      <div className="shelf-info-who">
        <div className="shelf-info-head">
          <p className="shelf-info-eyebrow">
            {b ? NAME[b.testament].toLowerCase() : 'book'}
          </p>
          {kept && (
            <button type="button" className="shelf-unpin" data-guide="shelf-unpin" aria-label={`Close ${book}`} title="Close (Esc)" onClick={onClose}>
              <CloseIcon size={12} />
            </button>
          )}
        </div>
        <p className="shelf-info-name" title={book}>{book}</p>
        <p className={`shelf-info-state shelf-ink--${state}`}>
          <span className={`shelf-swatch shelf-swatch--${state}`} aria-hidden />
          {WORD[state]}
        </p>
        <p className="shelf-info-says">{SAYS[state]}</p>
      </div>
      <dl className="shelf-facts">
        <div><dt>heard as</dt><dd title={fixes.length ? fixes.map((f) => `“${f}”`).join(', ') : undefined}>{heard}</dd></div>
        <div>
          <dt>used in services</dt>
          <dd>
            {marked && <span className="shelf-swatch shelf-swatch--ribbon" role="img" aria-label="one of their most-quoted books" title="One of their most-quoted books" />}
            {used}
          </dd>
        </div>
        {b && <div><dt>length</dt><dd>{plural(b.chapters, 'chapter', 'chapters')}</dd></div>}
      </dl>
      <div className={cx('shelf-info-foot', kept && onPick && 'shelf-info-foot--action')} key={kept ? 'kept' : 'peek'}>
        {kept && onPick
          ? <Button
              guideId="shelf-practise"
              tone={state === 'trouble' || state === 'unheard' ? 'go' : 'default'}
              icon={<MicIcon size={12} />}
              label={`practise ${book}`}
              onClick={() => onPick(book)}
              className="shelf-practise"
            />
          : <p className="shelf-hint">{hint}</p>}
      </div>
    </div>
  );
}

/** "38 of 66" — understood in any way. */
export function understoodCount(standings: Record<string, BookStanding>): number {
  return BIBLE_SHELF.filter((b) => ['caught', 'learned'].includes((standings[b.book] ?? BLANK).state)).length;
}
