/*
 * Splitting a typed scripture reference into book / chapter / verse / range.
 *
 * Lifted out of the input component so it can be tested on its own: this is
 * the piece that decides whether what an operator typed is a reference at
 * all, and it failed silently on ranges — "Psalm 91:5-9" matched nothing,
 * came back as a null chapter, and the verse went off the screen.
 */

export interface Parts {
  /** "1 john", "genesis" — trailing space kept, it means "done typing letters". */
  book: string;
  /** Digits typed for the chapter, "" when none yet, null when not started. */
  chapter: string | null;
  verse: string | null;
  /** Digits after a "-", for "5-9". "" the moment the dash is typed, null
   *  while no dash has been. */
  rangeEnd: string | null;
}

/*
 * Split what has been typed into book / chapter / verse.
 *
 * Hand-scanned rather than one regex because a leading digit is part of the
 * book ("1 John") while every later digit is a number — a distinction that
 * makes the single-regex version unreadable.
 */
export function parts(raw: string): Parts {
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
  if (!rest) return { book, chapter: null, verse: null, rangeEnd: null };

  /* The trailing group is the second half of a range — "5-9", and "5-" the
     moment the dash lands, which is what lets the dash be typed at all. The
     dash was missing from this pattern entirely, so ANY range failed the
     match and fell to the null below: the field reported "no reference", the
     caller had nothing to look up, and the words went off the screen. */
  const m = rest.match(/^(\d*)(?:\s*[:.]\s*|\s+)?(\d*)(?:\s*[-–—]\s*(\d*))?$/);
  if (!m) return { book, chapter: null, verse: null, rangeEnd: null };

  const sep = /[:.]|\s/.test(rest.slice(m[1].length));
  return {
    book,
    chapter: m[1],
    verse: sep ? m[2] : null,
    /* A dash with no verse in front of it ("Psalm -4") is not a range, it is
       a stray key, and m[3] being undefined is how the caller is told so. */
    rangeEnd: sep && m[3] !== undefined ? m[3] : null,
  };
}

