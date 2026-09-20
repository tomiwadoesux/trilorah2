import { useEffect, useRef, useState } from 'react';
import { Button, ImportIcon, SearchField, SearchIcon, SegmentedControl, SparkleIcon, cx, type SegmentOption } from '../../../ui';
import { sectionsToText, splitLyrics } from '../../../../shared/lyricSplit';
import type { SongBase } from '../../../../shared/songDraft';
import { FlightPopup } from './FlightPopup';

/*
 * Add a song — four ways in, one way out.
 *
 *   search   LRCLIB, by title or artist
 *   youtube  a video's own subtitles, or its auto-captions
 *   paste    whatever is on the clipboard
 *   file     ChordPro, OpenLyrics, plain text
 *
 * Every one of them ends the same way: words → splitLyrics → this dialog
 * closes and the SONG EDITOR opens on the result, unsaved. The dialog never
 * writes to the library. Splitting is a guess about somebody else's text,
 * and the editor is where a guess gets checked — so there is no "add" button
 * in here at all, only "open in the editor".
 *
 * The failure copy is plain and always points at the next thing to try.
 * "Not found" on a lyrics search is the ordinary case for a song a church
 * wrote itself, not an error.
 */

type Route = 'search' | 'youtube' | 'paste' | 'file';

const ROUTES: SegmentOption<Route>[] = [
  { id: 'search', label: 'search' },
  { id: 'youtube', label: 'youtube' },
  { id: 'paste', label: 'paste' },
  { id: 'file', label: 'import file' },
];

export interface NewSong {
  base: SongBase;
  /** Where the words came from, for the line under the editor's title. */
  note: string;
}

export interface AddSongDialogProps {
  open: boolean;
  onRequestClose: () => void;
  onClosed?: () => void;
  /** Words found and split — hand over to the editor. */
  onReady: (song: NewSong) => void;
  /** A multi-file import went straight to the library; refresh the grid. */
  onImported?: (count: number) => void;
}

type Hit = { id: number; title: string; artist: string; album: string; duration: number };

const clock = (sec: number): string =>
  sec > 0 ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}` : '';

const NO_ENGINE = 'this needs the desktop app — paste the words instead';

const INPUT =
  'tri-rounded-control w-full border-0 bg-[rgb(0_0_0_/_0.20)] px-3.5 text-[length:var(--tri-control-size)] text-[var(--tri-ink)] placeholder:text-[rgb(229_243_242_/_0.34)] focus:outline-none focus:shadow-[inset_0_0_0_var(--tri-border)_rgb(var(--tri-go-2)_/_0.45)]';

export function AddSongDialog({ open, onRequestClose, onClosed, onReady, onImported }: AddSongDialogProps) {
  const api = typeof window === 'undefined' ? undefined : window.api?.songs;
  const [route, setRoute] = useState<Route>('search');
  const [busy, setBusy] = useState<string | null>(null);
  /* One message slot per dialog, not per tab: whatever was tried last is
     what the message is about. `nudge` names the tabs worth trying next. */
  const [note, setNote] = useState<{ text: string; nudge?: boolean } | null>(null);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [url, setUrl] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteAuthor, setPasteAuthor] = useState('');
  const [pasteText, setPasteText] = useState('');

  const body = useRef<HTMLDivElement>(null);
  /* A reply that arrives after the dialog was closed, or after a newer
     request, is dropped — a slow search must not reopen the editor. */
  const ticket = useRef(0);

  /* Each open starts clean; what was typed last time is not this song. */
  useEffect(() => {
    if (!open) {
      ticket.current += 1;
      return;
    }
    setRoute('search');
    setBusy(null);
    setNote(null);
    setQuery('');
    setHits(null);
    setUrl('');
    setPasteTitle('');
    setPasteAuthor('');
    setPasteText('');
  }, [open]);

  /* The caret goes where the typing goes, once the box has landed. */
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => body.current?.querySelector<HTMLElement>('input, textarea')?.focus(), 380);
    return () => clearTimeout(t);
  }, [open, route]);

  const go = (r: Route) => {
    setRoute(r);
    setNote(null);
  };

  /** The one exit. False when the text had no words in it. */
  const finish = (text: string, title: string, author: string, from: string, flat = false): boolean => {
    let sections = splitLyrics(text);
    /* Captions arrive as one unbroken run, so the splitter — rightly — calls
       it all one verse and numbers the parts: "Verse 1 (17)". Nobody knows
       where the verses are yet, so say "Slide 17" and let the operator name
       the chorus when they find it. */
    if (flat && sections.length > 1 && sections.every((s) => /^Verse 1( \(\d+\))?$/.test(s.label))) {
      sections = sections.map((s, i) => ({ ...s, label: `Slide ${i + 1}` }));
    }
    if (sections.length === 0) {
      setNote({ text: 'there were no words in that — nothing to split', nudge: true });
      return false;
    }
    onReady({
      base: { title: title.trim() || 'Untitled song', author: author.trim(), sections },
      note: `${from} · split into ${sections.length} slide${sections.length === 1 ? '' : 's'} — check each one, then save`,
    });
    return true;
  };

  /* ---- search -------------------------------------------------------- */
  const search = async () => {
    const q = query.trim();
    if (!q) return;
    if (!api?.searchLyrics) return setNote({ text: NO_ENGINE, nudge: true });
    const mine = (ticket.current += 1);
    setBusy('searching…');
    setNote(null);
    setHits(null);
    const res = await api.searchLyrics(q).catch(() => null);
    if (mine !== ticket.current) return;
    setBusy(null);
    if (res?.ok) return setHits(res.hits);
    setNote(
      res?.reason === 'offline'
        ? { text: 'no internet connection right now — search needs one', nudge: true }
        : res?.reason === 'not-found'
          ? { text: `nothing found for “${q}” — try fewer words, or just the title`, nudge: true }
          : { text: 'the lyrics search did not answer', nudge: true },
    );
  };

  const choose = async (hit: Hit) => {
    if (!api?.getLyrics) return;
    const mine = (ticket.current += 1);
    setBusy(`fetching ${hit.title}…`);
    setNote(null);
    const res = await api.getLyrics(hit.id).catch(() => null);
    if (mine !== ticket.current) return;
    setBusy(null);
    if (res?.ok) {
      finish(res.lyrics, res.title || hit.title, res.artist || hit.artist, 'from lyrics search');
      return;
    }
    setNote(
      res?.reason === 'offline'
        ? { text: 'the connection dropped before the words arrived', nudge: true }
        : { text: `${hit.title} is listed but its words did not come through — try another result`, nudge: true },
    );
  };

  /* ---- youtube ------------------------------------------------------- */
  const fetchCaptions = async () => {
    const link = url.trim();
    if (!link) return;
    if (!api?.youtubeCaptions) return setNote({ text: NO_ENGINE, nudge: true });
    const mine = (ticket.current += 1);
    setBusy('reading the captions…');
    setNote(null);
    const res = await api.youtubeCaptions(link).catch(() => null);
    if (mine !== ticket.current) return;
    setBusy(null);
    if (res?.ok) {
      finish(
        res.lines.join('\n'),
        res.title,
        res.author,
        res.trackKind === 'manual' ? "from the video's own subtitles" : 'from auto-captions — expect to tidy these',
        true,
      );
      return;
    }
    setNote(
      res?.reason === 'no-captions'
        ? { text: 'that video has no captions to read — search for the song, or paste the words', nudge: true }
        : res?.reason === 'unavailable'
          ? { text: 'that video cannot be opened — private, removed, or not a youtube link', nudge: true }
          : res?.reason === 'offline'
            ? { text: 'no internet connection right now', nudge: true }
            : { text: 'youtube did not answer the way it usually does — paste the words instead', nudge: true },
    );
  };

  /* ---- file ---------------------------------------------------------- */
  const pickFiles = async () => {
    if (!api?.importFiles) return setNote({ text: NO_ENGINE, nudge: true });
    setNote(null);
    setBusy('waiting for the file picker…');
    const picked = await api.importFiles().catch(() => null);
    setBusy(null);
    if (!picked || picked.canceled) return;
    const songs = picked.songs ?? [];
    if (songs.length === 0) {
      setNote({ text: picked.errors?.[0]?.error ?? 'nothing in that file could be read as a song', nudge: true });
      return;
    }
    if (songs.length === 1) {
      const [song] = songs;
      finish(sectionsToText(song.sections), song.title, (song.authors ?? []).join(', '), 'from a file');
      return;
    }
    /* A folder of forty exports is not corrected card by card. Those go in
       as the files have them, and each can be opened from the grid after. */
    setBusy(`importing ${songs.length} songs…`);
    const report = await api.importCommit(songs).catch(() => null);
    setBusy(null);
    if (!report) return setNote({ text: 'the import did not finish — nothing was added' });
    onImported?.(songs.length);
    onRequestClose();
  };

  return (
    <FlightPopup
      open={open}
      size={{ w: 640, h: 560 }}
      label="add a song"
      onRequestClose={onRequestClose}
      onClosed={onClosed}
      header={
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-[var(--tri-ink)]">add a song</h2>
          <p className="mt-1 text-[length:var(--tri-size-xs)] leading-relaxed text-[rgb(229_243_242_/_0.5)]">
            find the words, and they open in the editor already cut into slides. nothing is added until you save.
          </p>
        </div>
      }
    >
      <div ref={body} className="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-6 pt-4">
        <SegmentedControl options={ROUTES} value={route} onChange={go} className="[&>div]:w-full" />

        {route === 'search' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
              <SearchField
                value={query}
                onChange={setQuery}
                onSubmit={() => void search()}
                placeholder="song title, artist, or both..."
              />
              <Button label="search" tone="go" icon={<SearchIcon size={12} />} disabled={!query.trim() || !!busy} onClick={() => void search()} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {hits?.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  onClick={() => void choose(hit)}
                  aria-disabled={!!busy || undefined}
                  className={cx(
                    'tri-rounded-control group/hit flex w-full items-baseline gap-2 px-3 py-2 text-left transition-colors',
                    'hover:bg-[rgb(255_255_255_/_0.05)] focus-visible:bg-[rgb(255_255_255_/_0.05)] focus:outline-none',
                    busy && 'pointer-events-none opacity-50',
                  )}
                  style={{ boxShadow: 'inset 0 -1px 0 rgb(255 255 255 / 0.06)' }}
                >
                  <span className="min-w-0 flex-1 truncate text-[length:var(--tri-size-sm)] text-[var(--tri-ink)]">
                    <span className="font-semibold">{hit.title}</span>
                    <span className="text-[var(--tri-ink-muted)]"> — {hit.artist}</span>
                  </span>
                  <span className="max-w-[40%] shrink-0 truncate text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.42)]">
                    {[hit.album, clock(hit.duration)].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))}
              {hits === null && !note && !busy ? (
                <Hint>searches lrclib, a free community lyrics library. hymns and well-known worship songs are usually there.</Hint>
              ) : null}
            </div>
          </div>
        ) : null}

        {route === 'youtube' ? (
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void fetchCaptions();
                }}
                placeholder="https://www.youtube.com/watch?v=..."
                spellCheck={false}
                aria-label="youtube link"
                className={cx(INPUT, 'h-[var(--tri-field-h)]')}
              />
              <Button label="get the words" tone="go" icon={<SparkleIcon size={12} />} disabled={!url.trim() || !!busy} onClick={() => void fetchCaptions()} />
            </div>
            <Hint>
              reads the captions on a lyric video. the video&rsquo;s own subtitles are used when it has them; otherwise
              youtube&rsquo;s auto-captions, which mishear words and ignore line breaks — you will be told which.
            </Hint>
          </div>
        ) : null}

        {route === 'paste' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex gap-2">
              <input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="song title" aria-label="song title" spellCheck={false} className={cx(INPUT, 'h-[var(--tri-field-h)] flex-[3]')} />
              <input value={pasteAuthor} onChange={(e) => setPasteAuthor(e.target.value)} placeholder="artist (optional)" aria-label="artist" spellCheck={false} className={cx(INPUT, 'h-[var(--tri-field-h)] flex-[2]')} />
            </div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="paste the words here. chords, [tags] and blank lines are fine — they are cleaned up on the way in."
              aria-label="lyrics"
              spellCheck={false}
              className={cx(INPUT, 'min-h-0 flex-1 resize-none py-3 leading-[1.55]')}
            />
            <div className="flex justify-end">
              <Button
                label="split into slides"
                tone="go"
                icon={<SparkleIcon size={12} />}
                disabled={!pasteText.trim()}
                onClick={() => finish(pasteText, pasteTitle, pasteAuthor, 'pasted')}
              />
            </div>
          </div>
        ) : null}

        {route === 'file' ? (
          <div className="flex flex-1 flex-col items-start gap-3">
            <Hint>
              chordpro, openlyrics (.xml) or plain text. one file opens in the editor so you can check the slides; several
              at once go straight into the library as they are.
            </Hint>
            <Button label="choose files…" tone="go" icon={<ImportIcon size={12} />} disabled={!!busy} onClick={() => void pickFiles()} />
          </div>
        ) : null}

        {/* One line at the foot, always in the same place: working, or what
            went wrong and where to go next. Never red for "not found". */}
        <div className="flex min-h-[var(--tri-control-h)] shrink-0 items-center gap-3" aria-live="polite">
          {busy ? (
            <span className="text-[length:var(--tri-size-xs)] lowercase text-[var(--tri-ink-muted)]">{busy}</span>
          ) : note ? (
            <>
              <span className="min-w-0 flex-1 text-[length:var(--tri-size-xs)] lowercase leading-relaxed text-[var(--tri-accent-yellow)]">
                {note.text}
              </span>
              {note.nudge
                ? (['search', 'youtube', 'paste'] as const)
                    .filter((r) => r !== route)
                    .slice(-2)
                    .map((r) => (
                      <Button
                        key={r}
                        label={r === 'paste' ? 'paste instead' : r === 'youtube' ? 'try youtube' : 'search instead'}
                        tone="ash"
                        onClick={() => go(r)}
                      />
                    ))
                : null}
            </>
          ) : null}
        </div>
      </div>
    </FlightPopup>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-[520px] px-1 text-[length:var(--tri-size-xs)] lowercase leading-relaxed text-[rgb(229_243_242_/_0.42)]">
      {children}
    </p>
  );
}
