import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { cx } from '../lib/cx';
import { useNudge } from '../hooks/useNudge';
import { SearchOutlineIcon } from '../icons';
import { parts } from '../../../shared/referenceParts';

/*
 * The scripture reference input.
 *
 * This is not a search box. A search box lets you type anything and then
 * tells you afterwards that it found nothing. This is a guided input over a
 * closed vocabulary — the 66 books, their real chapter counts, and the verse
 * counts of whatever chapter you land in — and it will not accept a keystroke
 * that cannot lead to a real verse.
 *
 * Type "revel" and the only book still standing is Revelation, so the "b" of
 * "revelb" never appears: there is nothing that key could be the start of.
 * Same for numbers. Genesis takes "5" (both 5 and 50 exist) and then refuses
 * the "1", because Genesis 51 does not exist. The rule is one line —
 *
 *   a keystroke is accepted if, and only if, the text it produces is a prefix
 *   of at least one complete, real reference
 *
 * — and everything else here is in service of it. The consequence is that the
 * operator cannot type their way into a dead end, which matters at the front
 * of a service where a wrong lookup is a wrong slide in front of everyone.
 *
 * A refused key is not silent. Silence reads as a broken keyboard and gets
 * pressed again; the field nudges instead, which says "heard, refused".
 */

export interface ScriptureBook {
  name: string;
  /** Real chapter count — what makes "Genesis 51" refusable. */
  chapters: number;
  /** "gen", "1 cor", "ps" — typed shorthands that resolve to this book. */
  aliases?: string[];
}

export interface ResolvedReference {
  bookIndex: number;
  book: string;
  chapter: number;
  /** null when the operator stopped at the chapter — "Psalm 23" is a reference. */
  verse: number | null;
  /** The last verse of a typed range ("5-9" → 9), null for a single verse.
   *  Never less than `verse`; a half-typed "5-" reports null until a digit
   *  lands, so a caller never sees a range that runs backwards. */
  rangeEnd?: number | null;
}

export interface ScriptureReferenceInputHandle {
  focus: () => boolean;
  /** Start a fresh lookup from a neutral area of the Operator page. */
  beginTyping: (text: string) => boolean;
}

export interface ScriptureReferenceInputProps {
  ref?: Ref<ScriptureReferenceInputHandle>;
  books: ScriptureBook[];
  /**
   * Verses in a given chapter, or undefined when not known yet. Chapter counts
   * are static canon data, but verse counts come from the loaded translation,
   * so this is a callback rather than a table. Where it returns undefined the
   * verse is left unconstrained rather than guessed at — refusing a key on a
   * number we are not sure about would be worse than accepting it.
   */
  versesInChapter?: (bookIndex: number, chapter: number) => number | undefined;
  value?: string;
  onChange?: (text: string) => void;
  /** Enter on a complete reference. */
  onSubmit?: (ref: ResolvedReference) => void;
  /**
   * Fires as soon as book and chapter resolve, before any verse is typed.
   *
   * This is what lets the verse constraint work at all: the caller loads that
   * chapter the moment it is named, and the verse count it comes back with
   * becomes the bound this field refuses against. The alternative — shipping a
   * table of all 1,189 verse counts — would duplicate the database.
   */
  onReferenceChange?: (ref: ResolvedReference | null) => void;
  /**
   * ↑/↓ once the book is settled — the caller moves its own selection.
   *
   * While the book is still ambiguous the arrows belong to the book chips;
   * after that there is nothing left to choose in the field and the list
   * below is the only thing worth moving through.
   */
  onNavigate?: (delta: -1 | 1) => void;
  /**
   * Enter while the caller has a row selected. Return true to say it was
   * consumed, and the field leaves its own Enter handling alone.
   */
  onActivate?: () => boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

/*
 * The space after a leading number is not information.
 *
 * No book in the canon runs a digit straight into letters, so "1john" can
 * only ever mean "1 John" — the space carries nothing the reader does not
 * already know. Rather than accept both spellings and thread the difference
 * through everything downstream, the field puts the space in as you type and
 * there is only ever one spelling to reason about.
 */
const canonical = (raw: string) => raw.replace(/^(\s*\d)(?=[a-z])/i, '$1 ');

const norm = (s: string) => canonical(s).trim().toLowerCase().replace(/\s+/g, ' ');

/** Every book the typed fragment could still become. */
function candidates(books: ScriptureBook[], fragment: string): number[] {
  const q = norm(fragment);
  if (!q) return books.map((_, i) => i);
  const out: number[] = [];
  books.forEach((b, i) => {
    const name = b.name.toLowerCase();
    if (name.startsWith(q) || b.aliases?.some((a) => a.startsWith(q) || q.startsWith(a))) {
      out.push(i);
    }
  });
  return out;
}

/** The one book a fragment names, or -1 while it is still ambiguous. */
function resolved(books: ScriptureBook[], fragment: string): number {
  const q = norm(fragment);
  if (!q) return -1;
  const exact = books.findIndex((b) => b.name.toLowerCase() === q);
  if (exact >= 0) return exact;
  const alias = books.findIndex((b) => b.aliases?.includes(q));
  if (alias >= 0) return alias;
  const c = candidates(books, q);
  return c.length === 1 ? c[0] : -1;
}

/**
 * Could these digits still grow into a number in 1..max?
 *
 * "5" against 50 chapters is yes — 5 and 50 both exist. "51" is no. This is
 * what refuses the second keystroke rather than the first.
 */
function viableNumber(digits: string, max: number | undefined): boolean {
  if (digits === '') return true;
  if (/^0/.test(digits)) return false; // no chapter 0, and no "01"
  if (max === undefined) return true; // unknown verse count: do not guess
  const n = Number(digits);
  if (n >= 1 && n <= max) return true;
  // Still viable if some longer number starting with these digits fits.
  return Number(digits + '0') <= max;
}

/* ------------------------------------------------------------------ */

export function ScriptureReferenceInput({
  ref: handleRef,
  books,
  versesInChapter,
  value,
  onChange,
  onSubmit,
  onReferenceChange,
  onNavigate,
  onActivate,
  placeholder = 'type a book name...',
  disabled = false,
  className = '',
}: ScriptureReferenceInputProps) {
  const [internal, setInternal] = useState('');
  const text = value ?? internal;
  const [highlight, setHighlight] = useState(0);
  const [lockedBook, setLockedBook] = useState(false);
  const [lockedChapter, setLockedChapter] = useState(false);
  const [lockedVerse, setLockedVerse] = useState(false);
  /*
   * Characters taken off by ← , newest last, so → can put them back.
   *
   * Nothing is ever typed into the middle of a reference — it is built left to
   * right and torn down the same way — so a caret has no work to do here. The
   * arrows are spent on something useful instead: ← removes the last
   * character, → restores it. Undo and redo, on the two keys already under
   * the hand.
   */
  const [undone, setUndone] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { ref: shakeRef, nudge } = useNudge<HTMLDivElement>();

  const p = useMemo(() => parts(text), [text]);
  const bookIndex = useMemo(() => resolved(books, p.book), [books, p.book]);
  const matches = useMemo(
    () => (bookIndex >= 0 ? [] : candidates(books, p.book)),
    [books, p.book, bookIndex],
  );

  /** Automatically lock segments if an external full reference is provided */
  useEffect(() => {
    if (!value) {
      setLockedBook(false);
      setLockedChapter(false);
      setLockedVerse(false);
      return;
    }
    // If the input is currently focused by the operator, do not auto-lock;
    // locking is controlled step-by-step by Tab / Enter / Backspace.
    if (typeof document !== 'undefined' && document.activeElement === inputRef.current) {
      return;
    }
    const n = parts(value);
    const bi = resolved(books, n.book);
    if (bi >= 0 && n.book.trim().toLowerCase() === books[bi].name.toLowerCase()) {
      setLockedBook(true);
      if (n.chapter && n.chapter.trim() !== '') {
        setLockedChapter(true);
        if (n.verse && n.verse.trim() !== '') {
          setLockedVerse(true);
        }
      }
    }
  }, [value, books]);

  /*
   * What ← took off, in the order it would be typed again.
   *
   * `undone` is a stack — newest last — because that is how ← pushes and →
   * pops. Read left to right it is the tail of the reference that used to be
   * there, which is what gets drawn behind the caret.
   */
  const deleted = useMemo(() => [...undone].reverse().join(''), [undone]);

  /** The greyed remainder — only ever the rest of a book name. */
  const ghost = useMemo(() => {
    /* Deleted text owns the space behind the caret while it is showing.
       Completing "psal" to "Psalms" here would claim the operator is about
       to get a word they did not delete, and → would then do the other
       thing than the one on screen. */
    if (undone.length) return '';
    if (p.chapter !== null || !p.book.trim() || lockedBook) return '';
    const pick = bookIndex >= 0 ? bookIndex : matches[highlight] ?? matches[0];
    if (pick === undefined) return '';
    const name = books[pick].name;
    const typed = p.book.trimStart();
    return name.toLowerCase().startsWith(typed.toLowerCase()) ? name.slice(typed.length) : '';
  }, [books, p, bookIndex, matches, highlight, lockedBook, undone.length]);

  /** The rule, applied to a whole candidate string. */
  const viable = (next: string): boolean => {
    if (next === '') return true;
    const n = parts(next);

    if (n.chapter === null) return candidates(books, n.book).length > 0;

    const bi = resolved(books, n.book);
    if (bi < 0) return false; // numbers before the book is pinned down
    if (!viableNumber(n.chapter, books[bi].chapters)) return false;

    if (n.verse === null) return true;
    const ch = Number(n.chapter);
    if (!n.chapter || ch < 1 || ch > books[bi].chapters) return false;
    const last = versesInChapter?.(bi, ch);
    if (!viableNumber(n.verse, last)) return false;

    /* The range's end. Held to the same rule as every other number — it has
       to be able to grow into a real verse of THIS chapter — with one more
       on top: it may not end before it started, so "9-5" is refused at the
       "5" rather than accepted and then quietly reordered. A dash with no
       digits yet is fine; it is a reference being typed, not a broken one. */
    if (n.rangeEnd === null) return true;
    if (!n.verse) return false; // a dash needs a verse in front of it
    if (n.rangeEnd === '') return true;
    if (!viableNumber(n.rangeEnd, last)) return false;
    return Number(n.rangeEnd + '9'.repeat(Math.max(0, String(last ?? 999).length - n.rangeEnd.length))) >= Number(n.verse);
  };

  const commit = (next: string, keepUndo = false) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
    setHighlight(0);
    // Typing anything new makes the redo stack stale.
    if (!keepUndo) setUndone([]);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(next.length, next.length);
      }
    });
  };

  const attempt = (raw: string) => {
    if (disabled) return;
    // Typing "1j" produces "1 j": one spelling reaches the rest of the field.
    const next = canonical(raw);
    if (viable(next)) {
      commit(next);
      const n = parts(next);
      // If user typed colon, lock book and chapter
      if (n.chapter && next.endsWith(':')) {
        setLockedBook(true);
        setLockedChapter(true);
      }
      // If user typed full book name followed by space, lock book
      if (!n.chapter && next.endsWith(' ')) {
        const bi = resolved(books, n.book);
        if (bi >= 0 && n.book.trim().toLowerCase() === books[bi].name.toLowerCase()) {
          setLockedBook(true);
        }
      }
    } else {
      nudge();
    }
  };

  useImperativeHandle(handleRef, () => {
    const focus = () => {
      const input = inputRef.current;
      if (!input || input.matches(':disabled') || input.closest('[inert]') || !input.getClientRects().length) return false;
      input.focus({ preventScroll: true });
      return input.ownerDocument.activeElement === input;
    };
    return {
      focus,
      beginTyping: (firstText) => {
        if (!focus()) return false;
        // A verse selected earlier should not trap a new book name at its end.
        setLockedBook(false);
        setLockedChapter(false);
        setLockedVerse(false);
        attempt(firstText);
        return true;
      },
    };
  });

  /** Complete the book name and leave a space, ready for the chapter. */
  const acceptGhost = () => {
    if (!ghost) return;
    commit(p.book.trimStart() + ghost + ' ');
    setLockedBook(true);
    setLockedChapter(false);
    setLockedVerse(false);
  };

  /*
   * What the caller should be showing right now.
   *
   * A book on its own is enough — naming Genesis means chapter 1 until told
   * otherwise, so the list fills the moment the book is known and follows
   * every keystroke after it. Waiting for a chapter to be typed would leave
   * the table empty through the part of the interaction where seeing the text
   * is most useful.
   */
  const current = useMemo<ResolvedReference | null>(() => {
    if (bookIndex < 0) return null;
    const ch = p.chapter ? Number(p.chapter) : 1;
    if (ch < 1 || ch > books[bookIndex].chapters) return null;
    const v = p.verse ? Number(p.verse) : null;
    /* Only a complete, forward range is reported. A half-typed "5-" is a
       single verse until its second number arrives, so the caller shows
       verse 5 the whole way through rather than blanking on the dash. */
    const end = p.rangeEnd && v !== null && Number(p.rangeEnd) >= v ? Number(p.rangeEnd) : null;
    return { bookIndex, book: books[bookIndex].name, chapter: ch, verse: v, rangeEnd: end };
  }, [books, bookIndex, p.chapter, p.verse, p.rangeEnd]);
  const reference = () => current;

  /*
   * Every part of the reference is reported, verse included — the caller needs
   * it to move its selection when one is typed. Deciding what is worth
   * re-fetching is the caller's business, not this field's; it only says what
   * the reference now is.
   */
  useEffect(() => {
    onReferenceChange?.(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.bookIndex, current?.chapter, current?.verse, current?.rangeEnd]);

  /*
   * Step forward through the reference:
   * 1. Book name locks in on Enter / Tab (shows with reduced opacity).
   * 2. Chapter locks in on Enter / Tab (shows with reduced opacity).
   * 3. Verse locks in on Enter / Tab (shows with reduced opacity).
   */
  const advance = (): boolean => {
    // A paste or externally selected reference can be complete before its
    // visual locks are. Never throw away its numbers to complete the book.
    if (current && p.chapter) {
      setLockedBook(true);
      setLockedChapter(true);
      if (p.verse !== null) setLockedVerse(true);
      else commit(text.trimEnd() + ':');
      return true;
    }
    // Stage 1: Book not locked yet
    if (!lockedBook) {
      const pick = bookIndex >= 0 ? bookIndex : (matches[highlight] ?? matches[0]);
      if (pick !== undefined && books[pick]) {
        commit(books[pick].name + ' ');
        setLockedBook(true);
        setLockedChapter(false);
        setLockedVerse(false);
        return true;
      }
      return false;
    }

    // Stage 2: Book is locked, but Chapter is not locked yet
    if (!lockedChapter) {
      if (p.chapter && p.chapter.trim() !== '') {
        commit(text.replace(/[\s.:]+$/, '') + ':');
        setLockedChapter(true);
        setLockedVerse(false);
        return true;
      }
      return false;
    }

    // Tab/right settle the token only. Enter owns the live action.
    if (current) {
      setLockedVerse(true);
      return true;
    }
    return false;
  };

  const erase = () => {
    setLockedVerse(false);
    if (p.rangeEnd !== null || p.verse) commit(text.trimEnd().slice(0, -1));
    else if (p.chapter !== null) {
      setLockedChapter(false);
      commit(p.book.trimEnd() + ' ');
    } else {
      setLockedBook(false);
      commit('');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter/arrows belong to the composition candidate window until it closes.
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    const plainArrow = !e.shiftKey && !e.metaKey && !e.altKey && !e.ctrlKey;

    if (e.key === 'Backspace' && plainArrow) {
      e.preventDefault();
      erase();
      return;
    }
    if (e.key === ' ' && p.verse) {
      e.preventDefault();
      return;
    }

    /*
     * ← takes the last character off and remembers it, so → can put it back.
     *
     * It also gives back the segment it just reached into. A locked segment is
     * dimmed and finished; if ← removed a digit from the chapter but left the
     * chapter locked, the operator would be staring at a half-erased number
     * they are not allowed to retype. Editing backwards through the reference
     * is the whole point of the key, so the locks follow the caret out.
     */
    if (e.key === 'ArrowLeft' && plainArrow) {
      e.preventDefault();
      if (!text) {
        nudge();
        return;
      }
      const next = text.slice(0, -1);
      const n = parts(next);
      /* Reopen whatever the shortened text no longer finishes. Each test is
         "is this segment still complete?", not "which key was pressed", so a
         single ← that erases a separator reopens exactly one stage. */
      if (lockedVerse && !(n.verse && n.verse.trim() !== '')) setLockedVerse(false);
      if (lockedChapter && !/[:.]|\d\s/.test(next.slice(n.book.length))) setLockedChapter(false);
      if (lockedBook && (n.chapter === null || n.chapter === '')) setLockedBook(false);
      setUndone((u) => [...u, text.slice(-1)]);
      commit(next, true);
      return;
    }

    /*
     * → walks forward, and "forward" means whatever is actually in front of
     * the caret:
     *
     *   1. Text ← took off, shown greyed behind the caret. It goes back one
     *      character at a time, so what is on screen is what → will do next.
     *   2. The rest of a book name, once there is nothing left to restore.
     *   3. The next segment of the reference — book → chapter → verse, the
     *      same staged walk Tab and Enter take.
     *
     * Priority matters and is not arbitrary: restoring beats advancing so
     * that ← and → stay each other's inverse, which is the property that
     * makes backing up to fix a chapter safe. Once the deleted tail is spent
     * the key is free, and the operator gets the segment walk they would
     * otherwise have to reach for Tab to get.
     */
    if (e.key === 'ArrowRight' && plainArrow) {
      e.preventDefault();
      if (undone.length) {
        const restored = undone[undone.length - 1];
        setUndone((u) => u.slice(0, -1));
        commit(text + restored, true);
        return;
      }
      if (ghost) acceptGhost();
      else if (!advance()) nudge();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      // Still more than one book in play: the arrows pick between them.
      if (matches.length > 1) {
        setHighlight((h) => {
          const next = e.key === 'ArrowDown' ? h + 1 : h - 1;
          return (next + matches.length) % matches.length;
        });
        return;
      }
      onNavigate?.(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (current && p.chapter) onSubmit?.(current);
      else if (!onActivate?.() && !advance()) nudge();
      return;
    }

    /* Tab is Enter — locks in current segment */
    if (e.key === 'Tab' && !e.shiftKey) {
      if (text && advance()) e.preventDefault();
    }
  };

  /**
   * Renders the locked and active segments:
   * - Locked segments render with reduced opacity (50%).
   * - Currently active segment renders with full opacity (100% white).
   */
  const renderSegments = () => {
    if (!text && !ghost && !deleted) return null;

    const n = parts(text);
    const bookStr = n.book;
    const chapterStr = n.chapter === null ? '' : n.chapter + (n.verse !== null ? ':' : '');
    const verseStr = (n.verse ?? '') + (n.rangeEnd !== null ? '-' + n.rangeEnd : '');

    return (
      <div className="pointer-events-none absolute inset-0 flex items-center text-[length:var(--tri-control-size)] leading-none tracking-normal whitespace-pre">
        {bookStr && (
          <span
            className={cx(
              'rounded bg-white/7 transition-opacity duration-150',
              lockedBook
                ? 'opacity-50 text-[var(--tri-ink,#e5f3f2)]'
                : 'opacity-100 text-white font-medium',
            )}
          >
            {bookStr}
          </span>
        )}
        {!lockedBook && ghost && (
          <span className="text-[rgb(229_243_242_/_0.30)] transition-opacity duration-150">
            {ghost}
          </span>
        )}
        {chapterStr && (
          <span
            className={cx(
              'rounded bg-white/7 transition-opacity duration-150',
              lockedChapter
                ? 'opacity-50 text-[var(--tri-ink,#e5f3f2)]'
                : 'opacity-100 text-white font-medium',
            )}
          >
            {chapterStr}
          </span>
        )}
        {verseStr && (
          <span
            className={cx(
              'transition-opacity duration-150',
              lockedVerse
                ? 'opacity-50 text-[var(--tri-ink,#e5f3f2)]'
                : 'opacity-100 text-white font-medium',
            )}
          >
            {verseStr}
          </span>
        )}
        {/*
          What ← took off, still legible behind the caret.
          Dimmer than the book-completion ghost: that one is a suggestion the
          field is making, this one is the operator's own text being held for
          them, and they should not read as the same thing. It is also what
          tells them → will put a character back rather than advance.
        */}
        {deleted && (
          <span className="text-[rgb(229_243_242_/_0.18)] transition-opacity duration-150">
            {deleted}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={cx('flex flex-col gap-2 lowercase', className)}>
      <div
        ref={shakeRef}
        className={cx(
          /* Same tokens the Select trigger reads, so the two controls stay the
             same height at every density rather than agreeing at one of them. */
          'tri-rounded-control relative flex h-[var(--tri-field-h)] w-full items-center gap-2.5 px-3.5',
          disabled ? 'opacity-40' : 'bg-[rgb(0_0_0_/_0.20)]',
        )}
        onClick={() => {
          inputRef.current?.focus();
          if (inputRef.current) {
            const len = inputRef.current.value.length;
            inputRef.current.setSelectionRange(len, len);
          }
        }}
      >
        <SearchOutlineIcon size={13} className="shrink-0 text-[rgb(229_243_242_/_0.45)]" />

        {/* The typed text and its ghost overlay. Native input is transparent with bright caret */}
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            value={text}
            disabled={disabled}
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
            onBeforeInput={(e) => {
              if ((e.nativeEvent as InputEvent).inputType === 'deleteContentBackward') {
                e.preventDefault();
                erase();
              }
            }}
            onChange={(e) => {
              if ((e.nativeEvent as InputEvent).inputType === 'deleteContentBackward') erase();
              else attempt(e.target.value);
            }}
            onKeyDown={onKeyDown}
            className={cx(
              /* Control size — the primary typing surface of the whole
                 scriptures tab. Shares --tri-field-h with the Select beside
                 it and now shares its type size too. */
              'relative z-10 w-full m-0 p-0 bg-transparent text-[length:var(--tri-control-size)] leading-none tracking-normal',
              'text-transparent caret-white [--tri-caret-color:white] placeholder:text-[rgb(229_243_242_/_0.34)]',
              'focus:outline-none disabled:cursor-not-allowed',
              /* Same as SearchField: index.css underlines every bare input,
                 and that hairline has no business inside a filled box. */
              'border-0',
            )}
          />
          {renderSegments()}
        </div>

        {/* Live-parsed reference indicator */}
        {reference() && (
          <span className="shrink-0 text-[length:var(--tri-size-xs)] text-[rgb(229_243_242_/_0.5)]">
            {reference()!.book} {reference()!.chapter}
            {reference()!.verse ? `:${reference()!.verse}` : ''}
          </span>
        )}
      </div>

      {/* Ambiguity is shown, not resolved silently */}
      {matches.length > 1 && p.book.trim() !== '' && !lockedBook && (
        <ul className="flex flex-wrap gap-1.5" role="listbox">
          {matches.slice(0, 8).map((bi, i) => (
            <li key={books[bi].name}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                onClick={() => {
                  commit(books[bi].name + ' ');
                  setLockedBook(true);
                  setLockedChapter(false);
                  setLockedVerse(false);
                }}
                className={cx(
                  'tri-rounded-control h-[30px] px-3 text-[length:var(--tri-control-size)] transition-colors',
                  i === highlight
                    ? 'bg-[rgb(255_255_255_/_0.08)] text-[var(--tri-ink)]'
                    : 'bg-[rgb(255_255_255_/_0.03)] text-[rgb(229_243_242_/_0.62)] hover:bg-[rgb(255_255_255_/_0.06)]',
                )}
              >
                {books[bi].name.toLowerCase()}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/*
 * The rule, exposed for tests. Not part of the component's public API — the
 * behaviour it guards (a key that cannot lead to a verse is refused) is worth
 * pinning down in a test rather than only in a comment.
 */
export const __test = {
  viable: (
    books: ScriptureBook[],
    versesInChapter: ((bookIndex: number, chapter: number) => number | undefined) | undefined,
    next: string,
  ): boolean => {
    if (next === '') return true;
    const n = parts(next);
    if (n.chapter === null) return candidates(books, n.book).length > 0;
    const bi = resolved(books, n.book);
    if (bi < 0) return false;
    if (!viableNumber(n.chapter, books[bi].chapters)) return false;
    if (n.verse === null) return true;
    const ch = Number(n.chapter);
    if (!n.chapter || ch < 1 || ch > books[bi].chapters) return false;
    return viableNumber(n.verse, versesInChapter?.(bi, ch));
  },
  parts,
};
