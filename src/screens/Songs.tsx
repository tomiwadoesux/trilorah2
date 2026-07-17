import { useEffect, useState } from 'react';
import { TextButton, SectionLabel } from '../components/ui';

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
    <div className="space-y-10">
      <section className="space-y-4">
        <SectionLabel>{editingId ? 'edit song' : 'add song'}</SectionLabel>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="song title"
          className="w-full max-w-md text-sm"
        />
        <textarea
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder={'lyrics — one line per sung line\nblank line between stanzas'}
          rows={8}
          className="w-full max-w-xl text-sm leading-relaxed"
        />
        <div className="flex items-baseline gap-x-6">
          <TextButton label={editingId ? 'SAVE CHANGES' : 'ADD TO LIBRARY'} primary onClick={saveSong} />
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
      </section>

      <section className="space-y-4 border-t border-hairline pt-8">
        <SectionLabel>library</SectionLabel>
        {songs.length === 0 && <p className="text-sm italic text-neutral-400">no songs yet</p>}
        <ul className="space-y-2">
          {songs.map((song) => (
            <li key={song.id} className="flex flex-wrap items-baseline gap-x-6">
              <span className={`text-sm ${currentId === song.id ? 'font-semibold text-accent' : ''}`}>
                {song.title}
                {currentId === song.id && ' · current'}
              </span>
              <TextButton label="SET AS CURRENT" primary onClick={() => setCurrent(song)} />
              <TextButton
                label="EDIT"
                onClick={() => {
                  setEditingId(song.id);
                  setTitle(song.title);
                  setLyrics(song.lyrics);
                }}
              />
              <TextButton label="REMOVE" onClick={() => persist(songs.filter((s) => s.id !== song.id))} />
            </li>
          ))}
        </ul>
        <p className="text-xs text-neutral-400">
          "set as current" tells the worship agent which song is live — the engine keeps the output
          clean between verses during worship
        </p>
      </section>
    </div>
  );
}
