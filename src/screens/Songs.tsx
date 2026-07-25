import { useEffect, useState } from 'react';
import {
  Button,
  EmptyState,
  Field,
  Panel,
  PanelHeader,
  Pill,
  SectionLabel,
  TextButton,
} from '../components/ui';

/**
 * Songs: a simple lyrics library (stored locally) + "set as current song",
 * which feeds the engine's worship logic (clean-background timing during
 * worship uses the current-song signal). Full lyric display on outputs
 * comes with the design pass.
 */

interface Song {
  id: string;
  title: string;
  lyrics: string;
}

const STORAGE_KEY = 'trilorah-songs';

function loadSongs(): Song[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function Songs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [title, setTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setSongs(loadSongs());
  }, []);

  const persist = (next: Song[]) => {
    setSongs(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full — songs stay in memory for the session */
    }
  };

  const saveSong = () => {
    const t = title.trim();
    if (!t || !lyrics.trim()) return;
    if (editingId) {
      persist(songs.map((s) => (s.id === editingId ? { ...s, title: t, lyrics } : s)));
      setEditingId(null);
    } else {
      persist([...songs, { id: `song-${Date.now()}`, title: t, lyrics }]);
    }
    setTitle('');
    setLyrics('');
  };

  const setCurrent = (song: Song) => {
    window.api?.setCurrentSongLyrics(song.lyrics);
    setCurrentId(song.id);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Songs</h2>
        <p className="text-sm text-neutral-500">
          Keep the worship set's lyrics here — the current song tells the engine when to hold a
          clean background.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel pad={false} className="self-start">
          <div className="border-b border-hairline px-4 py-3">
            <SectionLabel>library</SectionLabel>
          </div>
          {songs.length === 0 ? (
            <div className="px-4 py-4">
              <EmptyState>no songs yet — add the first one on the right</EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {songs.map((song) => (
                <li
                  key={song.id}
                  className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-l-2 px-4 py-3 ${
                    currentId === song.id ? 'border-accent bg-paper' : 'border-transparent'
                  }`}
                >
                  <span className="flex min-w-0 items-baseline gap-x-3">
                    <span className={`truncate text-sm ${currentId === song.id ? 'font-semibold' : ''}`}>
                      {song.title}
                    </span>
                    {currentId === song.id && <Pill active>current</Pill>}
                  </span>
                  <span className="flex items-center gap-x-4">
                    <Button label="Set as current" onClick={() => setCurrent(song)} />
                    <TextButton
                      label="EDIT"
                      onClick={() => {
                        setEditingId(song.id);
                        setTitle(song.title);
                        setLyrics(song.lyrics);
                      }}
                    />
                    <TextButton label="REMOVE" onClick={() => persist(songs.filter((s) => s.id !== song.id))} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-hairline px-4 py-3 text-xs text-neutral-400">
            "set as current" tells the worship agent which song is live — the engine keeps the
            output clean between verses during worship
          </p>
        </Panel>

        <Panel className="self-start">
          <PanelHeader>{editingId ? 'edit song' : 'add song'}</PanelHeader>
          <div className="space-y-4">
            <Field label="title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="song title"
                className="w-full text-sm"
              />
            </Field>
            <Field label="lyrics" hint="one line per sung line · blank line between stanzas">
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder={'lyrics — one line per sung line\nblank line between stanzas'}
                rows={8}
                className="w-full text-sm leading-relaxed"
              />
            </Field>
            <div className="flex items-center gap-x-4">
              <Button label={editingId ? 'Save changes' : 'Add to library'} variant="solid" onClick={saveSong} />
              {editingId && (
                <TextButton
                  label="CANCEL"
                  onClick={() => {
                    setEditingId(null);
                    setTitle('');
                    setLyrics('');
                  }}
                />
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
