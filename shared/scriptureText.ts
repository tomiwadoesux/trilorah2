/*
 * The braces in the KJV text.
 *
 * bible.db stores the KJV with its apparatus inline, in curly braces, and
 * 17,366 verses have some. There are two kinds and they need opposite
 * treatment:
 *
 *   {was}, {it was}, {land}     words the translators supplied, which the
 *                               printed KJV sets in italic. They belong to
 *                               the verse — read them out and the sentence
 *                               works.
 *
 *   {firmament: Heb. expansion} a marginal note about the Hebrew. It is
 *   {the day...: Heb. between}  apparatus, not scripture. Putting it on a
 *                               projector would show the congregation a
 *                               footnote mid-verse.
 *
 * The colon is what separates them: a note is always `lemma: gloss`, and a
 * supplied word never contains one — in "{it was} good:" the colon falls
 * outside the braces.
 */

export interface VerseSegment {
  text: string;
  /** A word the translators supplied — italic in print. */
  supplied?: boolean;
}

const BRACES = /\{([^}]*)\}/g;

/** True for a translator's marginal note rather than a supplied word. */
function isNote(inner: string): boolean {
  return inner.includes(':');
}

/**
 * Split a stored verse into renderable pieces, dropping the marginal notes.
 *
 * Returns segments rather than a string so a caller can set the supplied
 * words in italic, as the printed text does, instead of flattening the
 * distinction away.
 */
export function parseVerse(raw: string): VerseSegment[] {
  const out: VerseSegment[] = [];
  let last = 0;

  for (const m of raw.matchAll(BRACES)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: raw.slice(last, at) });
    if (!isNote(m[1])) out.push({ text: m[1], supplied: true });
    last = at + m[0].length;
  }
  if (last < raw.length) out.push({ text: raw.slice(last) });

  /* Dropping a note usually leaves the space that preceded it stranded at the
     end of the verse, and a trailing space shifts centred output. */
  return out
    .map((s, i) => (i === out.length - 1 ? { ...s, text: s.text.replace(/\s+$/, '') } : s))
    .filter((s) => s.text !== '');
}

/** The verse as one plain string — for the projector, search, and logging. */
export function verseToText(raw: string): string {
  return parseVerse(raw)
    .map((s) => s.text)
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
