import { useEffect, useMemo, useRef, useState } from 'react';
import { HEARD_BAR, matchSongs, readsAsVerse, recentSongWords, sharedWords, type MatchableSong, type SongMatch } from '../../../lib/songMatch';
import { useSongListeningStore } from '../../../stores/songListeningStore';
import { useEngine } from '../engine';
import { useProjector } from '../projector';

/** Matching the whole library is the costly part; the words are checked this often at most. */
const CHECK_MS = 800;

/*
 * Songs offered without "search song" being pressed (owner, 2026-10-17:
 * "when the system hears maybe 6-7 words … it can suggest songs without you
 * having to click it").
 *
 * While the engine listens, the last words heard are checked against the
 * library at the stricter HEARD_BAR. A song that clears it is put in the
 * store's `heard` — drawn at the front of the songs tab and at the top of the
 * caught pane, quietly: a song raises no signal. Nothing goes up: the
 * operator still presses live. A song already on the wall is not offered,
 * and one put up leaves the list. Mounted once, by CatchSignals.
 *
 * Words that are scripture being read offer no song, even where a hymn
 * borrows them (lib/songMatch readsAsVerse) — "search song" still finds it.
 */
export function useHeardSongs(): void {
  const engine = useEngine();
  const projector = useProjector();
  const asked = useSongListeningStore((s) => s.active);
  const hear = useSongListeningStore((s) => s.hear);
  const dropHeard = useSongListeningStore((s) => s.dropHeard);
  const pruneHeard = useSongListeningStore((s) => s.pruneHeard);
  const anyHeard = useSongListeningStore((s) => s.heard.length > 0 || Object.keys(s.muted).length > 0);
  const listening = engine.asr === 'listening';
  const [library, setLibrary] = useState<MatchableSong[]>([]);

  useEffect(() => {
    if (!listening) return;
    let alive = true;
    const reload = () => {
      void window.api?.songs?.list().then((list) => {
        if (alive) setLibrary(list.map((song) => ({ id: song.id, title: song.title, sections: song.sections })));
      }).catch(() => undefined);
    };
    reload();
    window.addEventListener('trilorah-package-imported', reload);
    window.addEventListener('trilorah-library-changed', reload);
    return () => {
      alive = false;
      window.removeEventListener('trilorah-package-imported', reload);
      window.removeEventListener('trilorah-library-changed', reload);
    };
  }, [listening]);

  const words = recentSongWords(engine.spoken);
  const latest = useRef(words);
  latest.current = words;
  const live = projector.live;
  const onWall = live?.source === 'song' ? live.id.split('/')[0] : null;
  const onWallRef = useRef(onWall);
  onWallRef.current = onWall;
  /* The verses in front of the operator — just caught, in the preview, on
     the wall — are checked first, without asking main: the practice sermon
     reading John 3:16 is how "To God Be the Glory" first offered itself. */
  const verses = useMemo(() => [
    ...engine.proposals.map((p) => p.text),
    ...[projector.preview, live].flatMap((item) => (item?.source === 'scripture' && item.text ? [item.text] : [])),
  ], [engine.proposals, projector.preview, live]);
  const versesRef = useRef(verses);
  versesRef.current = verses;
  const offered = useSongListeningStore((s) => s.heard.map((h) => h.match.song.id).join('\n'));
  const offeredRef = useRef(offered);
  offeredRef.current = offered;

  /* Checked on a beat rather than on every word: the words of a song being
     sung change several times a second. */
  useEffect(() => {
    if (!listening || asked || !library.length) return;
    let checked = '';
    let looking = false;
    const timer = window.setInterval(() => {
      const text = latest.current;
      if (looking || !text || text === checked) return;
      checked = text;
      if (readsAsVerse(text, versesRef.current)) return;
      const best = matchSongs(text, library, HEARD_BAR).find((m) => m.song.id !== onWallRef.current);
      if (!best) return;
      // Already offered: it passed the Bible's check when it first came.
      if (offeredRef.current.split('\n').includes(best.song.id)) {
        hear(best, Date.now());
        return;
      }
      looking = true;
      void inTheBible(text, best)
        .then((verse) => { if (!verse) hear(best, Date.now()); })
        .finally(() => { looking = false; });
    }, CHECK_MS);
    return () => window.clearInterval(timer);
  }, [listening, asked, library, hear]);

  /* Put up — by this list or any other way — it has been answered. */
  useEffect(() => {
    if (onWall) dropHeard(onWall, Date.now());
  }, [onWall, dropHeard]);

  useEffect(() => {
    if (!anyHeard) return;
    const timer = window.setInterval(() => pruneHeard(Date.now()), 2000);
    return () => window.clearInterval(timer);
  }, [anyHeard, pruneHeard]);
}

/**
 * Whether the words heard are a verse being read — any verse, caught or not.
 * Main's keyword search looks up the words the phrase shares with the song
 * (every one must be in a verse to find it), and each verse it finds is
 * held to the same bar as the song.
 */
async function inTheBible(heard: string, song: SongMatch): Promise<boolean> {
  const search = window.api?.searchBibleText;
  if (!search) return false;
  const query = sharedWords(heard, song.lines.join(' ')).slice(0, 6);
  if (query.length < 3) return false;
  const hits = await search(query.join(' '), { limit: 8 }).catch(() => []);
  return readsAsVerse(heard, hits.map((hit) => hit.text));
}
