import { useCallback, useEffect, useRef, useState } from 'react';
import { dropDraft, parseDrafts, putDraft, type DraftMap, type SongDraft } from '../../../../shared/songDraft';

/*
 * Where unsaved editor work is kept.
 *
 * With an engine it is the `songDrafts` setting — the same electron-store
 * file as everything else the church has configured, so it survives a
 * restart and travels with a backup of the app's data. Without one (the
 * gallery in a plain browser) it is localStorage. Both are read through
 * parseDrafts, which trusts nothing.
 *
 * The map is written WHOLE on every change. Drafts are small (a song is a
 * few hundred bytes) and few, and a whole-value write cannot leave the file
 * holding half of two different edits.
 */

const KEY = 'songDrafts';
const LOCAL_KEY = 'trilorah_song_drafts';

function readLocal(): DraftMap {
  try {
    return parseDrafts(localStorage.getItem(LOCAL_KEY));
  } catch {
    return {};
  }
}

export interface SongDrafts {
  drafts: DraftMap;
  save: (id: string, draft: SongDraft) => void;
  clear: (id: string) => void;
}

export function useSongDrafts(): SongDrafts {
  const [drafts, setDrafts] = useState<DraftMap>(() => (window.api?.getSetting ? {} : readLocal()));
  /* Writes made before the first read lands must not be overwritten by it. */
  const touched = useRef(false);

  useEffect(() => {
    const get = window.api?.getSetting;
    if (!get) return;
    let live = true;
    void get(KEY)
      .then((raw) => {
        if (live && !touched.current) setDrafts(parseDrafts(raw));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const persist = useCallback((next: DraftMap) => {
    touched.current = true;
    if (window.api?.setSetting) {
      void window.api.setSetting(KEY, next).catch(() => undefined);
      return;
    }
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    } catch {
      /* private mode, quota — the draft still lives for this session */
    }
  }, []);

  const save = useCallback(
    (id: string, draft: SongDraft) =>
      setDrafts((map) => {
        const next = putDraft(map, id, draft);
        persist(next);
        return next;
      }),
    [persist],
  );

  const clear = useCallback(
    (id: string) =>
      setDrafts((map) => {
        const next = dropDraft(map, id);
        if (next !== map) persist(next);
        return next;
      }),
    [persist],
  );

  return { drafts, save, clear };
}
