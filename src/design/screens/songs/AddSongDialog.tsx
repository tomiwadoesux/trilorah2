import { useEffect, useId, useRef, useState } from 'react';
import { Button, SearchField, SearchIcon, GlobeIcon, ResetIcon, MusicIcon, SparkleIcon, CheckIcon, SegmentedControl, cx } from '../../../ui';
import { splitLyrics } from '../../../../shared/lyricSplit';
import type { SongBase } from '../../../../shared/songDraft';
import { FlightPopup } from './FlightPopup';
import { shuffleChristianSongs, matchesChristianSong, type ChristianSong } from '../../../../shared/christianSongs';
import { createLyricPreviewLoader, previewKey, type PreviewState } from '../../../lib/lyricPreview';
import './songDiscovery.css';

/*
 * Add a song from online — two ways in, one way out.
 *
 *   search   LRCLIB, by title or artist
 *   youtube  a video's own subtitles, or its auto-captions
 *
 * Pasting words is not here: that is "add song", whose editor takes a paste
 * directly. The two online routes share one box and a switch at the top.
 *
 * Every one of them ends the same way: words → splitLyrics → the SONG
 * EDITOR opens on the result, unsaved. From search the editor opens OVER
 * this dialog, which waits underneath: a church adds songs in runs, and
 * saving one should land back on the results for the next, not on the
 * library. Youtube and paste close as they hand over. The dialog never
 * writes to the library. Splitting is a guess about somebody else's text,
 * and the editor is where a guess gets checked — so there is no "add" button
 * in here at all, only "open in the editor".
 *
 * The failure copy is plain and always points at the next thing to try.
 * "Not found" on a lyrics search is the ordinary case for a song a church
 * wrote itself, not an error.
 */

export type SongSource = 'search' | 'youtube';
type Route = SongSource;

const TITLES: Record<Route, string> = { search: 'search online', youtube: 'youtube transcripts' };
const ROUTES: { id: Route; label: string }[] = [{ id: 'search', label: 'search' }, { id: 'youtube', label: 'youtube transcripts' }];

export interface NewSong {
  base: SongBase;
  /** Where the words came from, for the line under the editor's title. */
  note: string;
  /** Which way in. A song found by search opens over the search, which
      stays up for the next one. */
  route: SongSource;
  /** The search result it came from, so the search can mark it added. */
  discoveryId?: string;
  /** The result's card, for the editor to lift off and land back on. */
  origin?: HTMLElement | null;
}

export interface AddSongDialogProps {
  open: boolean;
  initialRoute?: SongSource;
  onRequestClose: () => void;
  onClosed?: () => void;
  /** Words found and split — hand over to the editor. */
  onReady: (song: NewSong) => void;
  /** Search results already saved to the library while this was open. */
  added?: ReadonlySet<string>;
}

const NO_ENGINE = 'this needs the desktop app';
const LYRICS_BUSY = 'the lyrics service is busy — try again in a moment';

/*
 * Every card's opening line goes through one loader for the whole app
 * session, so a card swept over twice — or a dialog closed and opened again —
 * asks LRCLIB once. Without the bridge (a browser page, or an app still
 * running a main process from before `lyricsPreview`) nothing would answer,
 * so cards do not arm at all.
 */
const lyricPreviews = createLyricPreviewLoader({
  load: (title, artist, opts) => window.api?.songs?.lyricsPreview?.(title, artist, opts),
  available: () => typeof window !== 'undefined' && typeof window.api?.songs?.lyricsPreview === 'function',
});

/** How long the pointer or the keyboard rests on a card before it asks. A
    sweep across the grid on the way to somewhere else asks nothing. */
const HOVER_INTENT_MS = 250;

const INPUT =
  'tri-rounded-control w-full border-0 bg-[rgb(0_0_0_/_0.20)] px-3.5 text-[length:var(--tri-control-size)] text-[var(--tri-ink)] placeholder:text-[rgb(229_243_242_/_0.34)] focus:outline-none focus:shadow-[inset_0_0_0_var(--tri-border)_rgb(var(--tri-go-2)_/_0.45)]';

export function AddSongDialog({ initialRoute = 'search', open, onRequestClose, onClosed, onReady, added }: AddSongDialogProps) {
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
  const finish = (text: string, title: string, author: string, from: string, flat = false,
    found?: { discoveryId: string; origin: HTMLElement | null }): boolean => {
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
      route,
      ...found,
    });
    return true;
  };

  /* ---- search -------------------------------------------------------- */
  /* The click and the card's hover line are one lookup: the same LRCLIB
     search and the same pick, so the words that open are the ones the line
     promised. A click joins a hover lookup already out rather than sending a
     second, skips the hover queue, and may wait out one short "busy". A card
     already hovered opens without asking LRCLIB again — main kept the words. */
  const choose = async (song: ChristianSong, card: HTMLElement | null) => {
    if (busy) return;
    if (!api?.getLyrics) return setNote({ text: NO_ENGINE, nudge: true });
    const mine = (ticket.current += 1);
    setBusy(`finding ${song.title}…`);
    setNote(null);
    let found: PreviewState = lyricPreviews.available()
      ? await lyricPreviews.request(previewKey(song.title, song.artist), song.title, song.artist, { priority: true, retry: true })
      : { kind: 'unavailable' };
    if (found.kind === 'unavailable') found = await findTheOldWay(api, song);
    if (mine !== ticket.current) return;
    if (found.kind !== 'line') {
      setBusy(null);
      setNote({ text: found.kind === 'offline' ? 'no internet connection right now — try again when connected'
        : found.kind === 'busy' ? LYRICS_BUSY
        : found.kind === 'unavailable' ? NO_ENGINE
        : `lyrics for ${song.title} are not available right now — try youtube or paste the words`, nudge: true });
      return;
    }
    setBusy(`fetching ${song.title}…`);
    const res = await api.getLyrics(found.id).catch(() => null);
    if (mine !== ticket.current) return;
    setBusy(null);
    if (res?.ok) {
      finish(res.lyrics, song.title, song.artist, 'from online lyrics', false, { discoveryId: song.id, origin: card });
      return;
    }
    setNote({ text: res?.reason === 'offline'
      ? 'the connection dropped before the words arrived'
      : res?.reason === 'busy' ? LYRICS_BUSY
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
        ? { text: 'that video has no captions to read — search for the song instead', nudge: true }
        : res?.reason === 'unavailable'
          ? { text: 'that video cannot be opened — private, removed, or not a youtube link', nudge: true }
          : res?.reason === 'offline'
            ? { text: 'no internet connection right now', nudge: true }
            : { text: 'youtube did not answer the way it usually does — try again, or search for the song', nudge: true },
    );
  };

  return (
    <FlightPopup
      open={open}
      size={{ w: 820, h: 700 }}
      label={TITLES[route]}
      onRequestClose={onRequestClose}
      onClosed={onClosed}
      header={
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight text-[var(--tri-ink)]"><GlobeIcon size={20} />{TITLES[route]}</h2>
            <p className="mt-1 text-[length:var(--tri-size-xs)] leading-relaxed text-[rgb(229_243_242_/_0.5)]">
              {route === 'search' ? 'discover Christian songs. choose a song to find its lyrics and prepare your slides.' : 'paste a lyric video\u2019s link and its captions open in the editor, already cut into slides. nothing is added until you save.'}
            </p>
          </div>
          {/* The two online routes are one choice, so they are one control. */}
          <SegmentedControl options={ROUTES} value={route} onChange={go} size="sm" label="where the words come from" />
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
                  <DiscoveryCard key={song.id} song={song} inLibrary={added?.has(song.id) ?? false} busy={!!busy}
                    onChoose={(chosen, card) => void choose(chosen, card)} />
                ))}
              </div>
              {visibleSongs.length === 0 && <Hint>try another title or artist, or a youtube lyric video for a song you already know.</Hint>}
            </div>
            <span className="text-[11px] text-[var(--tri-ink-muted)]">worship, gospel &amp; hymns</span>
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
                ? <Button label={route === 'youtube' ? 'search instead' : 'try youtube'} tone="ash" onClick={() => go(route === 'youtube' ? 'search' : 'youtube')} />
                : null}
            </>
          ) : null}
        </div>
      </div>
    </FlightPopup>
  );
}

/** The lookup this dialog used before `lyricsPreview`: a search, then the
    first hit that is this song. Only for a main process that predates the
    one-request path — a click there still finds the song. */
async function findTheOldWay(api: SongsApi, song: ChristianSong): Promise<PreviewState> {
  if (!api.searchLyrics) return { kind: 'unavailable' };
  const found = await api.searchLyrics(`${song.title} ${song.artist}`).catch(() => null);
  if (found?.ok) {
    const hit = found.hits.find(candidate => matchesChristianSong(candidate, song));
    return hit ? { kind: 'line', id: hit.id, text: '' } : { kind: 'none' };
  }
  return { kind: found?.reason === 'offline' ? 'offline' : found?.reason === 'busy' ? 'busy' : 'none' };
}

/** What a card's line says, by state. Quiet states are plain and short. */
function previewCopy(preview: PreviewState | null): string {
  switch (preview?.kind) {
    case 'line': return `“${preview.text}”`;
    case 'loading': return 'finding the first line…';
    case 'none': return 'no lyrics online for this one';
    case 'busy': return 'lyrics service busy — try again in a moment';
    case 'offline': return 'offline';
    default: return '';
  }
}

interface DiscoveryCardProps {
  song: ChristianSong;
  inLibrary: boolean;
  busy: boolean;
  onChoose: (song: ChristianSong, card: HTMLElement | null) => void;
}

/*
 * One result, and its opening line. The line's state lives here rather than
 * in the dialog, so a pointer crossing a grid of two hundred cards re-renders
 * one card at a time.
 *
 * The pointer and focus handlers sit on the article, not the button: the
 * button is disabled while any song is being fetched, and the article also
 * holds the iTunes link the keyboard passes through. Keyboard focus shows the
 * line just as a resting pointer does. The focus a mouse click leaves behind
 * does not (it is not :focus-visible), so a clicked card that the pointer
 * has left does not keep its line up.
 */
function DiscoveryCard({ song, inLibrary, busy, onChoose }: DiscoveryCardProps) {
  const key = previewKey(song.title, song.artist);
  const lineId = useId();
  const [preview, setPreview] = useState<PreviewState | null>(() => lyricPreviews.peek(key));
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [shown, setShown] = useState(false);
  const wanted = hover || focus;
  const card = useRef<HTMLElement>(null);

  /* Disabling the focused button (any choice sets `busy`) drops focus to the
     page. The browser does fire a blur for that, but inside React's commit,
     where React delivers no events — so onBlur never runs, and the line would
     stay up through the editor and back. Whenever the cards are disabled or
     enabled again, ask where focus really is; a disabled button that still
     reads as focused (the browser has not moved focus off it yet) does not
     count as holding it. */
  useEffect(() => {
    const active = document.activeElement;
    const held = !!active && !!card.current?.contains(active) && !active.matches(':disabled');
    if (!held) setFocus(false);
  }, [busy]);

  /* Ask once the pointer or keyboard has rested; stop the moment it leaves —
     or the card does: a card replaced under a resting pointer (a new search,
     shuffle, the dialog closing) never hears a pointerleave. A lookup still
     queued is dropped. One already sent finishes and is kept for next time;
     its answer is just not shown here. */
  useEffect(() => {
    if (!wanted || !lyricPreviews.available()) return;
    let live = true;
    let asked: Promise<PreviewState> | null = null;
    const timer = setTimeout(() => {
      setShown(true);
      const known = lyricPreviews.peek(key);
      if (known) { setPreview(known); return; }
      setPreview({ kind: 'loading' });
      asked = lyricPreviews.request(key, song.title, song.artist);
      void asked.then(state => { if (live) setPreview(state); });
    }, HOVER_INTENT_MS);
    return () => {
      live = false;
      clearTimeout(timer);
      if (asked) lyricPreviews.cancel(key, asked);
      setShown(false);
    };
  }, [wanted, key, song.title, song.artist]);

  const kind = preview?.kind;
  const visible = shown && !!kind && kind !== 'unavailable';
  return (
    <article ref={card} className="song-discovery-card"
      onPointerEnter={e => { if (e.pointerType !== 'touch') setHover(true); }}
      onPointerLeave={() => setHover(false)}
      onFocus={e => { if ((e.target as HTMLElement).matches?.(':focus-visible')) setFocus(true); }}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false); }}>
      <button type="button" className="song-discovery-select" disabled={busy}
        onClick={e => onChoose(song, e.currentTarget.closest('article'))}
        aria-label={`${inLibrary ? 'Added to the library. Find lyrics again' : 'Find lyrics'} for ${song.title} by ${song.artist}`}
        aria-describedby={kind === 'line' ? lineId : undefined}>
        <div className="song-discovery-art">
          <SongArtwork song={song} />
          <span className="song-discovery-category">{song.category}</span>
          {/* Before the action pill, so the pill paints over the line's foot. */}
          <span id={lineId} className="song-discovery-preview" data-state={kind ?? 'empty'} aria-hidden={!visible}>
            <span className="song-discovery-preview-text">{previewCopy(preview)}</span>
          </span>
          {/* Adding a run of songs means coming back here after
              each one; the mark says which are done already. */}
          {inLibrary
            ? <span className="song-discovery-action song-discovery-action--added"><CheckIcon size={12} /> added</span>
            : <span className="song-discovery-action"><SearchIcon size={13} /> find lyrics</span>}
        </div>
        <span className="song-discovery-title">{song.title}</span>
        <span className="song-discovery-artist">{song.artist}</span>
      </button>
      {song.storeUrl && <a className="song-discovery-store" href={song.storeUrl} target="_blank" rel="noopener noreferrer">Download on iTunes ↗</a>}
    </article>
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
