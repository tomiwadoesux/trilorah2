import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '../lib/cx';
import { useNudge } from '../hooks/useNudge';
import { SearchIcon } from '../icons';

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
}

export interface ScriptureReferenceInputProps {
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

interface Parts {
  /** "1 john", "genesis" — trailing space kept, it means "done typing letters". */
  book: string;
  /** Digits typed for the chapter, "" when none yet, null when not started. */
  chapter: string | null;
  verse: string | null;
}

/*
 * Split what has been typed into book / chapter / verse.
 *
 * Hand-scanned rather than one regex because a leading digit is part of the
 * book ("1 John") while every later digit is a number — a distinction that
 * makes the single-regex version unreadable.
 */
function parts(raw: string): Parts {
  const s = raw.replace(/\s+/g, ' ').replace(/^ /, '');
  let i = 0;
  let book = '';

  // Leading digit belongs to the name: 1 Samuel, 2 Kings, 3 John.
  if (/\d/.test(s[0] ?? '')) {
    while (i < s.length && /\d/.test(s[i])) book += s[i++];
    while (i < s.length && s[i] === ' ') {
      book += ' ';
      i++;
    }
  }
  while (i < s.length && /[a-z ]/i.test(s[i])) book += s[i++];

  const rest = s.slice(i);
  if (!rest) return { book, chapter: null, verse: null };

  const m = rest.match(/^(\d*)(?:\s*[:.]\s*|\s+)?(\d*)$/);
  if (!m) return { book, chapter: null, verse: null };

  const sep = /[:.]|\s/.test(rest.slice(m[1].length));
  return { book, chapter: m[1], verse: sep ? m[2] : null };
}

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

  /** The greyed remainder — only ever the rest of a book name. */
  const ghost = useMemo(() => {
    if (p.chapter !== null || !p.book.trim()) return '';
    const pick = bookIndex >= 0 ? bookIndex : matches[highlight] ?? matches[0];
    if (pick === undefined) return '';
    const name = books[pick].name;
    const typed = p.book.trimStart();
    return name.toLowerCase().startsWith(typed.toLowerCase()) ? name.slice(typed.length) : '';
  }, [books, p, bookIndex, matches, highlight]);

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
    return viableNumber(n.verse, versesInChapter?.(bi, ch));
  };

  const commit = (next: string, keepUndo = false) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
    setHighlight(0);
    // Typing anything new makes the redo stack stale.
    if (!keepUndo) setUndone([]);
  };

  const attempt = (raw: string) => {
    if (disabled) return;
    // Typing "1j" produces "1 j": one spelling reaches the rest of the field.
    const next = canonical(raw);
    if (viable(next)) commit(next);
    else nudge();
  };

  /** Complete the book name and leave a space, ready for the chapter. */
  const acceptGhost = () => {
    if (!ghost) return;
    commit(p.book.trimStart() + ghost + ' ');
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
    return { bookIndex, book: books[bookIndex].name, chapter: ch, verse: v };
  }, [books, bookIndex, p.chapter, p.verse]);
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
  }, [current?.bookIndex, current?.chapter, current?.verse]);

  /*
   * One step forward through the reference, whatever stage it is at. Enter and
   * Tab both run this; it returns false only when there is nothing left to do.
   */
  const advance = (): boolean => {
    // More than one book still in play — take the highlighted one.
    if (matches.length > 1) {
      commit(books[matches[highlight] ?? matches[0]].name + ' ');
      return true;
    }
    // A completion is showing — finish the word.
    if (ghost) {
      acceptGhost();
      return true;
    }
    // A row is selected in the list below — it owns the keystroke.
    if (onActivate?.()) return true;
    /*
     * Chapter typed, no verse yet: fix the chapter and open the verse slot, so
     * the next digit is a verse rather than a third digit of the chapter. It
     * is what makes "genesis 12" then 3 reach 12:3 instead of chapter 123.
     */
    if (p.chapter && p.verse === null) {
      commit(text.replace(/[\s.:]+$/, '') + ':');
      return true;
    }
    if (current) {
      onSubmit?.(current);
      return true;
    }
    return false;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    /* A modifier means the user wants the normal thing — select, jump a word,
       go to the start — so the arrows keep their usual meaning there. */
    const plainArrow = !e.shiftKey && !e.metaKey && !e.altKey && !e.ctrlKey;

    /* ← takes the last character off and remembers it. */
    if (e.key === 'ArrowLeft' && plainArrow) {
      e.preventDefault();
      if (!text) {
        nudge();
        return;
      }
      setUndone((u) => [...u, text.slice(-1)]);
      commit(text.slice(0, -1), true);
      return;
    }

    /*
     * → puts back whatever ← took, one character at a time. Only once there is
     * nothing left to restore does it fall through to accepting the ghost —
     * otherwise finishing a word would wipe the thing being undone.
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
      else nudge();
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
      if (!advance()) nudge();
      return;
    }

    /*
     * Tab is Enter.
     *
     * Both keys mean the same thing here — "take what is on screen and move me
     * on" — and a field where they disagree makes the operator remember which
     * one they are supposed to be pressing. The only difference is what
     * happens when there is nothing to take: Enter refuses, while Tab falls
     * through to moving focus, because a field that swallows Tab traps anyone
     * working without a mouse. Shift-Tab is always focus.
     */
    if (e.key === 'Tab' && !e.shiftKey) {
      if (text && advance()) e.preventDefault();
    }
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
        onClick={() => inputRef.current?.focus()}
      >
        <SearchIcon size={13} className="shrink-0 text-[rgb(229_243_242_/_0.45)]" />

        {/* The typed text and its ghost are one line of type in two colours,
            so they have to share metrics exactly — same size, same tracking,
            same box. The measured copy is invisible and only holds position. */}
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            value={text}
            disabled={disabled}
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => attempt(e.target.value)}
            onKeyDown={onKeyDown}
            className={cx(
              /* Control size — the primary typing surface of the whole
                 scriptures tab. Shares --tri-field-h with the Select beside
                 it (see the note above) and now shares its type size too. */
              'relative z-10 w-full bg-transparent text-[length:var(--tri-control-size)] leading-none tracking-normal',
              'text-[var(--tri-ink,#e5f3f2)] placeholder:text-[rgb(229_243_242_/_0.34)]',
              'focus:outline-none disabled:cursor-not-allowed',
            )}
          />
          {ghost && (
            <div
              aria-hidden
              /* Moves in lockstep with the input above — one line of type in
                 two colours only works while the metrics are identical. */
              className="pointer-events-none absolute inset-0 flex items-center text-[length:var(--tri-control-size)] leading-none tracking-normal"
            >
              <span className="invisible whitespace-pre">{text}</span>
              <span className="whitespace-pre text-[rgb(229_243_242_/_0.30)]">{ghost}</span>
            </div>
          )}
        </div>

        {/* Live-parsed reference, so the operator can see what they have
            built without reading their own typing back. */}
        {reference() && (
          <span className="shrink-0 text-[length:var(--tri-size-xs)] text-[rgb(229_243_242_/_0.5)]">
            {reference()!.book} {reference()!.chapter}
            {reference()!.verse ? `:${reference()!.verse}` : ''}
          </span>
        )}
      </div>

      {/* Ambiguity is shown, not resolved silently: "jo" is six real books and
          the operator picks. Hidden once one book is standing. */}
      {matches.length > 1 && p.book.trim() !== '' && (
        <ul className="flex flex-wrap gap-1.5" role="listbox">
          {matches.slice(0, 8).map((bi, i) => (
            <li key={books[bi].name}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                onClick={() => commit(books[bi].name + ' ')}
                className={cx(
                  /* The chips are option buttons the operator picks a book
                     from, not hints about one — control text. */
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
