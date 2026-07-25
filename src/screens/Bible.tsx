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

  const lookup = async () => {
    setError(null);
    setNote(null);
    const resolved = bookIdFromName(book);
    const ch = Number.parseInt(chapter, 10);
    if (!resolved) {
      setError(`unknown book — “${book}”`);
      return;
    }
    if (Number.isNaN(ch) || ch < 1) {
      setError('enter a chapter number');
      return;
    }
    try {
      const res = await window.api?.getChapter(resolved.id, ch, version);
      if (res?.success && res.data && res.data.length > 0) {
        setLoaded({ book: resolved.name, chapter: ch, version, verses: res.data });
      } else {
        setLoaded(null);
        setError(res?.error ?? 'chapter not found');
      }
    } catch {
      setError('lookup failed');
    }
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

      {loaded && (
        <Panel pad={false}>
          <div className="flex items-baseline justify-between gap-x-4 border-b border-hairline px-6 py-4">
            <h3 className="font-scripture text-3xl">
              {loaded.book} {loaded.chapter}
            </h3>
            <Pill>{loaded.version}</Pill>
          </div>
          <article className="px-6 py-6">
            <div className="max-w-2xl font-scripture text-lg leading-loose">
              {loaded.verses.map((v) => (
                <span key={v.id} className={v.id === targetVerse ? 'font-semibold' : undefined}>
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
