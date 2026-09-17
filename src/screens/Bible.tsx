import { useEffect, useState } from 'react';
import { Button, EngineNote, Panel, PanelHeader, Pill, TextButton, hasEngine } from '../components/ui';
import { BOOKS, bookIdFromName } from '../lib/books';
import { useLiveStore } from '../stores/liveStore';

interface LoadedChapter {
  book: string;
  chapter: number;
  version: string;
  verses: ChapterVerse[];
}

export function Bible() {
  const [book, setBook] = useState('John');
  const [chapter, setChapter] = useState('3');
  const [verse, setVerse] = useState('16');
  const [versions, setVersions] = useState<string[]>([]);
  const [version, setVersion] = useState('KJV');
  const [loaded, setLoaded] = useState<LoadedChapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const setDisplayVersion = useLiveStore((s) => s.setDisplayVersion);
  // Keyword search (BUILD-MAP 2.12): "rejoice always" → Philippians 4:4.
  const [keywords, setKeywords] = useState('');
  const [hits, setHits] = useState<BibleSearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void window.api?.getAvailableVersions()
      .then((v) => {
        if (!cancelled && v.length > 0) {
          setVersions(v);
          if (!v.includes('KJV')) setVersion(v[0]);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const targetVerse = Number.parseInt(verse, 10);

  // Debounced keyword search while the operator types.
  useEffect(() => {
    const q = keywords.trim();
    if (q.length < 3 || !window.api?.searchBibleText) {
      setHits([]);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      void window.api
        ?.searchBibleText?.(q, { version, limit: 20 })
        .then((r) => setHits(r ?? []))
        .catch(() => setHits([]))
        .finally(() => setSearching(false));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [keywords, version]);

  const openChapter = async (bookName: string, ch: number, focusVerse?: number) => {
    setError(null);
    setNote(null);
    const resolved = bookIdFromName(bookName);
    if (!resolved) {
      setError(`unknown book — “${bookName}”`);
      return false;
    }
    if (Number.isNaN(ch) || ch < 1) {
      setError('enter a chapter number');
      return false;
    }
    try {
      const res = await window.api?.getChapter(resolved.id, ch, version);
      if (res?.success && res.data && res.data.length > 0) {
        setLoaded({ book: resolved.name, chapter: ch, version, verses: res.data });
        setBook(resolved.name);
        setChapter(String(ch));
        if (focusVerse != null) setVerse(String(focusVerse));
        return true;
      }
      setError(res?.error ?? 'chapter not found');
      return false;
    } catch {
      setError('lookup failed');
      return false;
    }
  };

  const lookup = () => openChapter(book, Number.parseInt(chapter, 10));

  // Continuous reading: step through chapters without re-typing. Past the
  // last chapter of a book, roll into the next book (Genesis 50 → Exodus 1).
  const stepChapter = async (delta: 1 | -1) => {
    if (!loaded) return;
    const next = loaded.chapter + delta;
    if (next >= 1 && (await openChapter(loaded.book, next))) return;
    const idx = BOOKS.findIndex((b) => b === loaded.book);
    const neighbour = BOOKS[idx + delta];
    if (!neighbour) return;
    if (delta === 1) {
      await openChapter(neighbour, 1);
    } else {
      // Walk back to the last chapter of the previous book.
      const resolved = bookIdFromName(neighbour);
      if (!resolved) return;
      for (let ch = 150; ch >= 1; ch--) {
        const res = await window.api?.getChapter(resolved.id, ch, version).catch(() => null);
        if (res?.success && res.data && res.data.length > 0) {
          await openChapter(neighbour, ch);
          return;
        }
      }
    }
  };

  const sendHit = (h: BibleSearchHit) => {
    const ref = `${h.book} ${h.chapter}:${h.verse}`;
    window.api?.sendText(ref);
    setNote(`sent to preview — ${ref}`);
  };

  const reference = () => {
    const resolved = bookIdFromName(book);
    const name = resolved?.name ?? book.trim();
    return Number.isNaN(targetVerse) ? `${name} ${chapter}` : `${name} ${chapter}:${targetVerse}`;
  };

  const sendToPreview = () => {
    window.api?.sendText(reference());
    setNote(`sent to preview — ${reference()}`);
  };

  const setAsDisplayVersion = async () => {
    if (window.api?.setDisplayVersion) {
      try {
        await window.api.setDisplayVersion(version);
        setDisplayVersion(version);
        setNote(`display version set — ${version}`);
      } catch {
        setNote('could not set display version');
      }
    } else {
      setNote('display-version switching is not available in this engine yet');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Bible</h2>
        <p className="text-sm text-neutral-500">
          Look up any passage, read it here, and send it to preview when it's needed.
        </p>
        {!hasEngine() && <EngineNote what="engine not connected — no Bible database" />}
      </div>

      <Panel>
        <PanelHeader right={<Pill>{version}</Pill>}>look up</PanelHeader>
        <form
          className="flex flex-wrap items-end gap-x-6 gap-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void lookup();
          }}
        >
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">book</span>
            <input
              list="bible-books"
              value={book}
              onChange={(e) => setBook(e.target.value)}
              placeholder="book"
              className="block w-44 text-sm"
            />
          </label>
          <datalist id="bible-books">
            {BOOKS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">chapter</span>
            <input
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="chapter"
              inputMode="numeric"
              className="block w-16 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">verse</span>
            <input
              value={verse}
              onChange={(e) => setVerse(e.target.value)}
              placeholder="verse"
              inputMode="numeric"
              className="block w-16 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">version</span>
            <select value={version} onChange={(e) => setVersion(e.target.value)} className="block text-sm">
              {(versions.length > 0 ? versions : [version]).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <Button label="Look up" variant="solid" onClick={() => void lookup()} disabled={!hasEngine()} />
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 border-t border-hairline pt-3">
          <Button label="Send to preview" onClick={sendToPreview} disabled={!hasEngine()} />
          <TextButton label="SET AS DISPLAY VERSION" onClick={() => void setAsDisplayVersion()} disabled={!hasEngine()} />
        </div>
        {error && <p className="mt-3 text-sm text-neutral-500">{error}</p>}
        {note && <p className="mt-3 text-sm text-neutral-500">{note}</p>}
      </Panel>

      <Panel>
        <PanelHeader right={searching ? <span className="text-[10px] uppercase tracking-widest text-neutral-400">searching…</span> : null}>
          search by words
        </PanelHeader>
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="rejoice always · good shepherd · faith hope love — finds the verse when you only remember the wording"
          className="w-full text-sm"
          disabled={!hasEngine()}
        />
        {hits.length > 0 && (
          <ul className="mt-4 divide-y divide-hairline">
            {hits.map((h) => (
              <li key={`${h.bookId}-${h.chapter}-${h.verse}`} className="flex items-baseline gap-x-4 py-2">
                <button
                  type="button"
                  onClick={() => void openChapter(h.book, h.chapter, h.verse)}
                  className="w-36 shrink-0 text-left text-xs font-semibold uppercase tracking-widest text-neutral-400 hover:text-ink"
                  title="open the chapter here"
                >
                  {h.book} {h.chapter}:{h.verse}
                </button>
                <button
                  type="button"
                  onClick={() => sendHit(h)}
                  className="grow text-left font-scripture text-base leading-relaxed hover:text-ink [&_b]:font-semibold [&_b]:text-accent"
                  title="send to preview"
                  // Snippet markup comes from our own FTS query (<b> only) — never user HTML.
                  dangerouslySetInnerHTML={{ __html: h.snippet }}
                />
              </li>
            ))}
          </ul>
        )}
        {keywords.trim().length >= 3 && !searching && hits.length === 0 && (
          <p className="mt-3 text-sm text-neutral-500">nothing in {version} matches all of those words</p>
        )}
      </Panel>

      {loaded && (
        <Panel pad={false}>
          <div className="flex items-baseline justify-between gap-x-4 border-b border-hairline px-6 py-4">
            <h3 className="font-scripture text-3xl">
              {loaded.book} {loaded.chapter}
            </h3>
            <div className="flex items-center gap-x-4">
              <TextButton label="← PREV" onClick={() => void stepChapter(-1)} title="previous chapter" />
              <TextButton label="NEXT →" onClick={() => void stepChapter(1)} title="next chapter" />
              <Pill>{loaded.version}</Pill>
            </div>
          </div>
          <article className="px-6 py-6">
            <div className="max-w-2xl font-scripture text-lg leading-loose">
              {loaded.verses.map((v) => (
                <span
                  key={v.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const ref = `${loaded.book} ${loaded.chapter}:${v.id}`;
                    window.api?.sendText(ref);
                    setVerse(String(v.id));
                    setNote(`sent to preview — ${ref}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.currentTarget as HTMLElement).click();
                  }}
                  className={`cursor-pointer rounded hover:bg-paper ${v.id === targetVerse ? 'font-semibold' : ''}`}
                  title="click to send to preview"
                >
                  <sup className="pr-1 text-xs text-neutral-400">{v.id}</sup>
                  {v.text}{' '}
                </span>
              ))}
            </div>
          </article>
        </Panel>
      )}
    </div>
  );
}
