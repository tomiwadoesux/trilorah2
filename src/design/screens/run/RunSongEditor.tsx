import { useEffect, useState } from 'react';
import { findSongForItem } from '../../../../shared/runPlan';
import { NEW_PREFIX, type SongBase } from '../../../../shared/songDraft';
import { SongEditor, type EditorSession } from '../songs/SongEditor';
import type { QueueItem } from '../run';

/*
 * "Edit song", from a row in the run.
 *
 * The songs tab owns its editor, and that tab is not mounted while the
 * operator is looking at scriptures or slides — which is exactly when a typo
 * in the second verse gets noticed, from the rail. So the rail opens the
 * same SongEditor itself, on the same flight, lifted off the row that asked.
 *
 * Finding the song is the only new part. A row dragged in since `songId`
 * was added carries the library id; older rows and the ones made from a
 * segment's own "+" carry a title at best, so the lookup falls back through
 * title and label (shared/runPlan.ts, tested there). If the library has no
 * such song, the row's own words open as a NEW song — the operator asked to
 * edit what is on the row, and "song not found" would be an answer to a
 * different question.
 *
 * Drafts are deliberately not kept from here. The drafts store is one map
 * written whole by whoever holds it (songs/useSongDrafts), and a second
 * holder in the rail could write back a copy that predates the songs tab's
 * latest — silently losing someone's unsaved work to protect a feature that
 * is a quick fix by nature. Closing with changes still asks, as it does
 * everywhere; it just does not survive a restart.
 */

export interface LibrarySong {
  id: string;
  title: string;
  author: string;
  verses: { label: string; lines: string[] }[];
}

export function RunSongEditor({
  item,
  origin,
  fallbackSongs,
  onSaved,
  onClosed,
}: {
  item: QueueItem;
  origin: HTMLElement | null;
  fallbackSongs?: readonly LibrarySong[];
  /** The row's own copy of the section, refreshed from what was saved. */
  onSaved: (patch: Partial<Omit<QueueItem, 'key'>>) => void;
  onClosed: () => void;
}) {
  const store = typeof window === 'undefined' ? undefined : window.api?.songs;
  const [session, setSession] = useState<EditorSession | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let live = true;
    const begin = (library: readonly LibrarySong[]) => {
      if (!live) return;
      const ref = { songId: item.songId, title: item.title, label: item.label };
      const found = findSongForItem(library, ref);
      if (found) {
        setSession({
          id: found.id,
          isNew: false,
          base: { title: found.title, author: found.author, sections: found.verses.map((v) => ({ label: v.label, lines: v.lines })) },
        });
        return;
      }
      setSession({
        id: `${NEW_PREFIX}${Date.now().toString(36)}`,
        isNew: true,
        base: {
          title: item.title ?? item.label,
          author: '',
          sections: [{ label: item.section ?? 'Verse 1', lines: item.lines ?? [''] }],
        },
        note: 'this song is not in the library yet — saving adds it',
      });
    };

    if (!store) {
      begin(fallbackSongs ?? []);
      return;
    }
    void store
      .list()
      .then((list) =>
        begin(
          list.map((s) => ({
            id: s.id,
            title: s.title,
            author: (s.authors ?? []).join(', '),
            verses: s.sections.map((sec) => ({ label: sec.label, lines: sec.lines })),
          })),
        ),
      )
      .catch(() => begin(fallbackSongs ?? []));
    return () => {
      live = false;
    };
    // The row is fixed for the life of this editor (keyed by item in the rail).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session) return null;

  const save = async (song: SongBase): Promise<boolean> => {
    let songId = session.isNew ? undefined : session.id;
    if (store) {
      const authors = song.author ? [song.author] : [];
      const saved = session.isNew
        ? await store.add({ title: song.title, authors, sections: song.sections })
        : await store.update(session.id, { title: song.title, authors, sections: song.sections });
      if (!saved) return false;
      songId = saved.id;
    }
    /* The row carries its own copy of one section's words — that copy is
       what goes to the projector — so an edit that did not reach it would
       fix the library and still put the typo on the wall. Matched by
       section name; a row with no section takes the first. */
    const section = song.sections.find((s) => s.label === item.section) ?? (item.section ? undefined : song.sections[0]);
    onSaved({
      title: song.title,
      ...(songId ? { songId } : {}),
      ...(section
        ? { section: section.label, lines: section.lines, label: `${song.title} — ${section.label}` }
        : item.section
          ? { label: `${song.title} — ${item.section}` }
          : { label: song.title }),
    });
    return true;
  };

  return (
    <SongEditor
      session={session}
      open={open}
      origin={origin}
      onSave={save}
      onDraft={() => undefined}
      onRequestClose={() => setOpen(false)}
      onClosed={onClosed}
    />
  );
}
