import { useEffect, useMemo, useState } from 'react';
import { matchSongs, recentSongWords, type MatchableSong } from '../../../lib/songMatch';
import { useSongListeningStore } from '../../../stores/songListeningStore';
import { useEngine } from '../engine';

/** Shared retained suggestions keep their place when the operator changes tabs. */
export function useSongMatches(library?: readonly MatchableSong[]) {
  const engine = useEngine();
  const active = useSongListeningStore(state => state.active);
  const retained = useSongListeningStore(state => state.matches);
  const remember = useSongListeningStore(state => state.remember);
  const [stored, setStored] = useState<MatchableSong[]>([]);
  useEffect(() => {
    if (!active || library) return;
    let alive = true;
    const reload = () => {
      void window.api?.songs?.list().then(list => {
        if (alive) setStored(list.map(song => ({ id: song.id, title: song.title, sections: song.sections })));
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
  }, [active, library]);
  const heard = recentSongWords(engine.spoken);
  const songs = library ?? stored;
  const incoming = useMemo(() => active ? matchSongs(heard, songs) : [], [active, heard, songs]);
  useEffect(() => { if (active) remember(incoming, heard); }, [active, incoming, heard, remember]);
  return retained;
}
