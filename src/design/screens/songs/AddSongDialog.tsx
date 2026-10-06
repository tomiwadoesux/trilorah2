import { useEffect, useRef, useState } from 'react';
import { Button, SearchField, SearchIcon, GlobeIcon, ResetIcon, MusicIcon, SparkleIcon, cx } from '../../../ui';
import { splitLyrics } from '../../../../shared/lyricSplit';
import type { SongBase } from '../../../../shared/songDraft';
import { FlightPopup } from './FlightPopup';
import { shuffleChristianSongs, matchesChristianSong, type ChristianSong } from '../../../../shared/christianSongs';
import './songDiscovery.css';

/*
 * Add a song — three ways in, one way out.
 *
 *   search   LRCLIB, by title or artist
 *   youtube  a video's own subtitles, or its auto-captions
 *   paste    whatever is on the clipboard
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

export type SongSource = 'search' | 'youtube' | 'paste';
type Route = SongSource;

const TITLES: Record<Route, string> = { search: 'search online', youtube: 'youtube lyrics', paste: 'paste lyrics' };

export interface NewSong {
  base: SongBase;
  /** Where the words came from, for the line under the editor's title. */
  note: string;
}

export interface AddSongDialogProps {
  open: boolean;
  initialRoute?: SongSource;
  onRequestClose: () => void;
  onClosed?: () => void;
  /** Words found and split — hand over to the editor. */
  onReady: (song: NewSong) => void;
}

const NO_ENGINE = 'this needs the desktop app — paste the words instead';

const INPUT =
  'tri-rounded-control w-full border-0 bg-[rgb(0_0_0_/_0.20)] px-3.5 text-[length:var(--tri-control-size)] text-[var(--tri-ink)] placeholder:text-[rgb(229_243_242_/_0.34)] focus:outline-none focus:shadow-[inset_0_0_0_var(--tri-border)_rgb(var(--tri-go-2)_/_0.45)]';

export function AddSongDialog({ initialRoute = 'search', open, onRequestClose, onClosed, onReady }: AddSongDialogProps) {
  const api = typeof window === 'undefined' ? undefined : window.api?.songs;
  const [route, setRoute] = useState<Route>(initialRoute);
  const [busy, setBusy] = useState<string | null>(null);
  /* One message slot per dialog, not per tab: whatever was tried last is
     what the message is about. `nudge` names the tabs worth trying next. */
  const [note, setNote] = useState<{ text: string; nudge?: boolean } | null>(null);

  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState(shuffleChristianSongs);
  const [onlineSongs, setOnlineSongs] = useState<ChristianSong[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState('');
  const searchTicket = useRef(0);
  const visibleSongs = onlineSongs ?? songs;
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
    setRoute(initialRoute);
    setBusy(null);
    setNote(null);
    setQuery('');
    setOnlineSongs(null);
    setSearching(false);
    setSearchNote('');
    searchTicket.current += 1;
    setSongs(shuffleChristianSongs());
    setUrl('');
    setPasteTitle('');
    setPasteAuthor('');
    setPasteText('');
  }, [open, initialRoute]);

  useEffect(() => {
    return () => { searchTicket.current += 1; };
  }, [open, route]);

  const searchOnline = async (term = query.trim()) => {
    const mine = ++searchTicket.current;
    if (!term) { setOnlineSongs(null); setSearchNote(''); setSearching(false); return; }
    if (!api?.discoverChristianSongs) { setSearchNote(NO_ENGINE); return; }
    setSearching(true);
    setSearchNote('');
    const result = await api.discoverChristianSongs(term).catch(() => null);
    if (mine !== searchTicket.current) return;
    setSearching(false);
    if (result?.ok) {
      setOnlineSongs(result.songs);
      if (!result.songs.length) setSearchNote('no Christian music matches found — try another title or artist');
    } else {
      setSearchNote('online search is unavailable right now — please try again');
    }
  };

  /* The caret goes where the typing goes, once the box has landed. */
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => body.current?.querySelector<HTMLElement>('input, textarea')?.focus(), 380);
    return () => clearTimeout(t);
  }, [open, route]);

  const go = (r: Route) => {
    ticket.current += 1;
    setBusy(null);
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
  const choose = async (song: ChristianSong) => {
    if (busy) return;
    if (!api?.searchLyrics || !api?.getLyrics) return setNote({ text: NO_ENGINE, nudge: true });
    const mine = (ticket.current += 1);
    setBusy(`finding ${song.title}…`);
    setNote(null);
    const found = await api.searchLyrics(`${song.title} ${song.artist}`).catch(() => null);
    if (mine !== ticket.current) return;
    const hit = found?.ok ? found.hits.find(candidate => matchesChristianSong(candidate, song)) : undefined;
    if (!hit) {
      setBusy(null);
      setNote({ text: found && !found.ok && found.reason === 'offline'
        ? 'no internet connection right now — try again when connected'
        : `lyrics for ${song.title} are not available right now — try youtube or paste the words`, nudge: true });
      return;
    }
    setBusy(`fetching ${song.title}…`);
    const res = await api.getLyrics(hit.id).catch(() => null);
    if (mine !== ticket.current) return;
    setBusy(null);
    if (res?.ok) {
      finish(res.lyrics, song.title, song.artist, 'from online lyrics');
      return;
    }
    setNote({ text: res?.reason === 'offline'
      ? 'the connection dropped before the words arrived'
      : `${song.title} is listed but its words did not come through — try youtube or paste`, nudge: true });
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

  return (
    <FlightPopup
      open={open}
      size={route === 'search' ? { w: 820, h: 700 } : { w: 640, h: 560 }}
      label={TITLES[route]}
      onRequestClose={onRequestClose}
      onClosed={onClosed}
      header={
        <div>
          <h2 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight text-[var(--tri-ink)]">{route === 'search' && <GlobeIcon size={20} />}{TITLES[route]}</h2>
          <p className="mt-1 text-[length:var(--tri-size-xs)] leading-relaxed text-[rgb(229_243_242_/_0.5)]">
            {route === 'search' ? 'discover Christian songs. choose a song to find its lyrics and prepare your slides.' : 'find the words, and they open in the editor already cut into slides. nothing is added until you save.'}
          </p>
        </div>
      }
    >
      <div ref={body} className="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-6 pt-4">
        {route === 'search' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
              <SearchField value={query} onChange={value => {
                setQuery(value); searchTicket.current += 1; setSearching(false); setSearchNote('');
                if (!value.trim()) setOnlineSongs(null);
              }} onSubmit={() => void searchOnline()} placeholder="search all Christian songs or artists…" />
              <Button label="search" tone="go" icon={<SearchIcon size={13} />} disabled={!query.trim() || searching} onClick={() => void searchOnline()} />
              <Button label="shuffle" tone="ash" icon={<ResetIcon size={13} />} disabled={!!busy || searching} onClick={() => {
                setSongs(shuffleChristianSongs()); setQuery('');
                const terms = ['Christian worship', 'gospel praise', 'Christian hymns', 'African gospel', 'worship live', 'praise and worship'];
                void searchOnline(terms[Math.floor(Math.random() * terms.length)]);
              }} />
            </div>
            <div className="song-discovery-label">
              <span>{onlineSongs ? 'online results' : 'discover Christian music'}</span>
              <span>{visibleSongs.length} songs · search the online catalogue for more</span>
            </div>
            <div className="song-discovery-scroll" aria-busy={!!busy || searching}>
              <p role="status" className="song-discovery-status">{searching ? 'searching Christian music…' : searchNote}</p>
              <div className="song-discovery-grid">
                {visibleSongs.map(song => (
                  <article key={song.id} className="song-discovery-card">
                  <button type="button" className="song-discovery-select" disabled={!!busy}
                    onClick={() => void choose(song)} aria-label={`Find lyrics for ${song.title} by ${song.artist}`}>
                    <div className="song-discovery-art">
                      <SongArtwork song={song} />
                      <span className="song-discovery-category">{song.category}</span>
                      <span className="song-discovery-action"><SearchIcon size={13} /> find lyrics</span>
                    </div>
                    <span className="song-discovery-title">{song.title}</span>
                    <span className="song-discovery-artist">{song.artist}</span>
                  </button>
                  {song.storeUrl && <a className="song-discovery-store" href={song.storeUrl} target="_blank" rel="noopener noreferrer">Download on iTunes ↗</a>}
                  </article>
                ))}
              </div>
              {visibleSongs.length === 0 && <Hint>try another title or artist, or use youtube or paste for a song you already know.</Hint>}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[var(--tri-ink-muted)]">worship, gospel &amp; hymns</span>
              <div className="flex gap-2">
                <Button label="youtube lyrics" tone="ash" onClick={() => go('youtube')} />
                <Button label="paste lyrics" tone="ash" onClick={() => go('paste')} />
              </div>
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

function SongArtwork({ song }: { song: ChristianSong }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  useEffect(() => setStatus('loading'), [song.artwork]);
  return <>
    {song.artwork && status !== 'failed' && <img src={song.artwork} alt={`${song.title} — ${song.artist} cover artwork`} loading="lazy"
      style={{ opacity: status === 'loaded' ? 1 : 0 }} onLoad={() => setStatus('loaded')} onError={() => setStatus('failed')} />}
    {status !== 'loaded' && <div className={`song-discovery-image-placeholder ${song.artwork && status === 'loading' ? 'is-loading' : ''}`}>
      <MusicIcon size={30} /><span>{song.artwork && status === 'loading' ? 'loading cover' : 'cover unavailable'}</span>
    </div>}
  </>;
}
