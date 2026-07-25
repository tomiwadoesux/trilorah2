import { useEffect, useRef, useState } from 'react';
import { Button, Pill, SectionLabel, TextButton, hasEngine } from './ui';
import { bookIdFromName } from '../lib/books';
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
}

function parseRef(input: string): ParsedRef | null {
  const m = input.trim().match(/^(\d?\s*[a-z][a-z\s]*?)[\s.]+(\d+)(?:[\s.:]+(\d+))?$/i);
  if (!m) return null;
  const resolved = bookIdFromName(m[1]);
  if (!resolved) return null;
  const chapter = Number.parseInt(m[2], 10);
  if (Number.isNaN(chapter) || chapter < 1) return null;
  const verse = m[3] != null ? Number.parseInt(m[3], 10) : null;
  return { bookId: resolved.id, book: resolved.name, chapter, verse };
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
    // A parsed chapter-only ref goes as "Book 3"; anything else goes raw.
    api.sendText(parsed ? `${parsed.book} ${parsed.chapter}${parsed.verse != null ? `:${parsed.verse}` : ''}` : t);
    setNote(`sent — ${t}`);
    setQ('');
    setOpen(false);
  };

  return (
    <div className="relative shrink-0">
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
          }}
          onFocus={() => {
            if (loaded && parsed) setOpen(true);
          }}
          placeholder="search scripture — john 3 16, 1 cor 13… or type anything for the engine"
          className="w-full text-sm"
        />
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
