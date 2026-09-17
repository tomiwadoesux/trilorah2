import { useEffect, useRef, useState } from 'react';
import { Button, Pill, SectionLabel, TextButton, hasEngine } from './ui';
import { bookIdFromName, completeBookName } from '../lib/books';
import { parseReference, formatParsed } from '../../shared/parseReference';
import { useLiveStore } from '../stores/liveStore';

/**
 * The Live tab's scripture omnibox. Type a reference free-form —
 * "john 3 16", "1 cor 13:4", "ps 23" — and the chapter opens right above
 * the input; click any verse to send it through the engine to preview.
 * Anything that isn't a reference still goes to the engine as heard text,
 * so the old typed fallback behavior survives.
 */

interface ParsedRef {
  bookId: number;
  book: string;
  chapter: number;
  verse: number | null;
  /** End of a range, e.g. the 18 in 'John 3:16-18'. */
  endVerse: number | null;
}

/**
 * Resolve a typed reference against the book list. The parsing itself lives
 * in shared/parseReference.ts so the engine and this box agree on what
 * 'matt 1 2 3' or 'john 3:16-18' means; here we only turn the book fragment
 * into a real book id.
 */
function parseRef(input: string): ParsedRef | null {
  const parsed = parseReference(input);
  if (!parsed || parsed.chapter == null) return null;
  const resolved = bookIdFromName(parsed.bookQuery);
  if (!resolved) return null;
  return {
    bookId: resolved.id,
    book: resolved.name,
    chapter: parsed.chapter,
    verse: parsed.verse,
    endVerse: parsed.endVerse,
  };
}

/** Split "rom 8 28" into the book fragment and the numeric tail. */
function splitBookAndNumbers(input: string): { bookPart: string; rest: string } | null {
  const m = input.match(/^(\s*\d?\s*[a-z][a-z\s]*?)([\s.:]+\d[\d\s.:-]*)?$/i);
  if (!m) return null;
  return { bookPart: m[1], rest: m[2] ?? '' };
}

/** The full book name Tab would complete to, or null when nothing to do. */
function bookCompletion(input: string): string | null {
  const parts = splitBookAndNumbers(input);
  if (!parts || !parts.bookPart.trim()) return null;
  const completed = completeBookName(parts.bookPart);
  if (!completed) return null;
  return completed.toLowerCase() === parts.bookPart.trim().toLowerCase() ? null : completed;
}

interface LoadedChapter {
  book: string;
  chapter: number;
  version: string;
  verses: ChapterVerse[];
}

export function ScriptureSearch() {
  const displayVersion = useLiveStore((s) => s.displayVersion);
  const version = displayVersion ?? 'KJV';

  const [q, setQ] = useState('');
  const [loaded, setLoaded] = useState<LoadedChapter | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const parsed = parseRef(q);
  const completion = bookCompletion(q);
  // Not a reference but two or more words → keyword hits (BUILD-MAP 2.12).
  const [hits, setHits] = useState<BibleSearchHit[]>([]);
  const keywordQuery = !parsed && !completion && /\S+\s+\S+/.test(q.trim()) ? q.trim() : '';
  useEffect(() => {
    if (!keywordQuery || !window.api?.searchBibleText) {
      setHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void window.api
        ?.searchBibleText?.(keywordQuery, { version, limit: 6 })
        .then((r) => setHits(r ?? []))
        .catch(() => setHits([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [keywordQuery, version]);

  const acceptCompletion = () => {
    if (!completion) return;
    const parts = splitBookAndNumbers(q);
    const rest = parts?.rest ?? '';
    setQ(`${completion}${rest || ' '}`);
  };

  // Debounced chapter load while the operator types a reference.
  useEffect(() => {
    if (!parsed || !hasEngine()) return;
    const { bookId, book, chapter, verse } = parsed;
    setTarget(verse);
    // Same chapter already loaded (only the verse digit changed) — no refetch.
    if (loaded && loaded.book === book && loaded.chapter === chapter && loaded.version === version) {
      setOpen(true);
      return;
    }
    const timer = window.setTimeout(() => {
      void window.api
        ?.getChapter(bookId, chapter, version)
        .then((res) => {
          if (res?.success && res.data && res.data.length > 0) {
            setLoaded({ book, chapter, version, verses: res.data });
            setOpen(true);
          }
        })
        .catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, version]);

  // Keep the target verse centered in the dropdown.
  useEffect(() => {
    if (!open || target == null) return;
    const container = listRef.current;
    const el = container?.querySelector<HTMLElement>(`[data-verse="${target}"]`);
    if (container && el) {
      container.scrollTop = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
    }
  }, [open, target, loaded]);

  const send = (verse: number | null) => {
    const api = window.api;
    if (!api) return;
    if (loaded && verse != null) {
      const ref = `${loaded.book} ${loaded.chapter}:${verse}`;
      api.sendText(ref);
      setNote(`sent to preview — ${ref}`);
      setTarget(verse);
      return;
    }
    const t = q.trim();
    if (!t) return;
    // A parsed chapter-only ref goes as "Book 3"; a range keeps both ends so
    // the engine displays the whole passage, not just its first verse.
    api.sendText(
      parsed
        ? formatParsed(
            { bookQuery: parsed.book, chapter: parsed.chapter, verse: parsed.verse, endVerse: parsed.endVerse, partial: false },
            parsed.book,
          )
        : t,
    );
    setNote(`sent — ${t}`);
    setQ('');
    setOpen(false);
  };

  return (
    <div className="relative shrink-0">
      {!open && hits.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 z-10 mb-2 rounded-md border border-hairline bg-surface shadow-lg">
          <div className="flex items-center justify-between gap-x-4 border-b border-hairline px-4 py-2.5">
            <SectionLabel>verses that say this</SectionLabel>
            <span className="text-[10px] uppercase tracking-widest text-neutral-400">
              click to send to preview · enter still sends the text to the engine
            </span>
          </div>
          <div className="max-h-56 overflow-y-auto px-2 py-2">
            {hits.map((h) => (
              <button
                key={`${h.bookId}-${h.chapter}-${h.verse}`}
                type="button"
                onClick={() => {
                  const ref = `${h.book} ${h.chapter}:${h.verse}`;
                  window.api?.sendText(ref);
                  setNote(`sent to preview — ${ref}`);
                  setQ('');
                  setHits([]);
                }}
                className="flex w-full items-baseline gap-x-3 rounded px-2 py-1 text-left hover:bg-paper"
              >
                <span className="w-32 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                  {h.book} {h.chapter}:{h.verse}
                </span>
                <span
                  className="truncate font-scripture text-sm [&_b]:font-semibold [&_b]:text-accent"
                  // Snippet markup is our own FTS output (<b> only).
                  dangerouslySetInnerHTML={{ __html: h.snippet }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
      {open && loaded && (
        <div className="absolute bottom-full left-0 right-0 z-10 mb-2 rounded-md border border-hairline bg-surface shadow-lg">
          <div className="flex items-center justify-between gap-x-4 border-b border-hairline px-4 py-2.5">
            <div className="flex items-center gap-x-3">
              <SectionLabel>
                {loaded.book} {loaded.chapter}
              </SectionLabel>
              <Pill>{loaded.version}</Pill>
            </div>
            <div className="flex items-center gap-x-3">
              <span className="text-[10px] uppercase tracking-widest text-neutral-400">
                click a verse to send it to preview
              </span>
              <TextButton label="CLOSE" onClick={() => setOpen(false)} />
            </div>
          </div>
          <div ref={listRef} className="max-h-64 overflow-y-auto px-4 py-3">
            {loaded.verses.map((v) => (
              <button
                key={v.id}
                type="button"
                data-verse={v.id}
                onClick={() => send(v.id)}
                className={`block w-full rounded px-2 py-1 text-left font-scripture text-base leading-relaxed hover:bg-paper ${
                  v.id === target ? 'bg-paper font-semibold' : ''
                }`}
              >
                <sup className="pr-1.5 text-xs text-neutral-400">{v.id}</sup>
                {v.text}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        className="flex items-center gap-x-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(parsed?.verse ?? null);
        }}
      >
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setNote(null);
            if (!e.target.value.trim()) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Tab' && completion) {
              e.preventDefault();
              acceptCompletion();
            }
          }}
          onFocus={() => {
            if (loaded && parsed) setOpen(true);
          }}
          placeholder="search scripture — joh 3 16 (tab completes the book)… or type anything for the engine"
          className="w-full text-sm"
        />
        {completion && (
          <button
            type="button"
            onClick={acceptCompletion}
            className="shrink-0 rounded border border-hairline px-2 py-1 text-[10px] uppercase tracking-widest text-neutral-400 hover:border-ink hover:text-ink"
            title="press Tab to complete"
          >
            ⇥ {completion}
          </button>
        )}
        <Button
          label={parsed ? 'Open' : 'Send'}
          onClick={() => send(parsed?.verse ?? null)}
          disabled={!hasEngine() || !q.trim()}
        />
        {note && <span className="shrink-0 text-[10px] uppercase tracking-widest text-neutral-400">{note}</span>}
      </form>
    </div>
  );
}
