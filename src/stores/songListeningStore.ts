import { create } from 'zustand';
import { retainSongMatches, type SongMatch } from '../lib/songMatch';

/** A song heard without "search song" being pressed, and when it was last heard. */
export interface HeardSong {
  match: SongMatch;
  at: number;
}

/** How long a song heard by itself stays offered — renewed while its words keep coming. */
export const HEARD_LIFE_MS = 60_000;
const HEARD_CAP = 3;

// Shared by the catches rail and library. Changing tabs must not silently
// stop the operator's search; a fresh launch starts with it off.
//
// `heard` is the other way a song turns up (owner, 2026-10-17): offered by
// itself once enough of a line has been heard (lib/songMatch HEARD_BAR),
// without anyone pressing "search song" — see songs/useHeardSongs.
export const useSongListeningStore = create<{
  active: boolean;
  matches: SongMatch[];
  ignoredHeard: string | null;
  heard: HeardSong[];
  /** Songs the operator turned away or put up, kept from being offered again until then. */
  muted: Record<string, number>;
  setActive: (active: boolean) => void;
  remember: (matches: SongMatch[], heard: string) => void;
  clear: (heard: string) => void;
  hear: (match: SongMatch, at: number) => void;
  dropHeard: (songId: string, at: number) => void;
  pruneHeard: (now: number) => void;
}>((set) => ({
  active: false,
  matches: [],
  ignoredHeard: null,
  heard: [],
  muted: {},
  setActive: (active) => set(state => state.active === active ? state : { active, matches: [], ignoredHeard: null }),
  remember: (matches, heard) => set(state => !state.active || state.ignoredHeard === heard || !matches.length ? state : { matches: retainSongMatches(state.matches, matches) }),
  clear: (heard) => set({ matches: [], ignoredHeard: heard }),
  hear: (match, at) => set(state => {
    if ((state.muted[match.song.id] ?? 0) > at) return state;
    const others = state.heard.filter(h => h.match.song.id !== match.song.id);
    return { heard: [{ match, at }, ...others].slice(0, HEARD_CAP) };
  }),
  dropHeard: (songId, at) => set(state => ({
    heard: state.heard.filter(h => h.match.song.id !== songId),
    muted: { ...state.muted, [songId]: at + HEARD_LIFE_MS },
  })),
  pruneHeard: (now) => set(state => {
    const heard = state.heard.filter(h => now - h.at < HEARD_LIFE_MS);
    const muted = Object.fromEntries(Object.entries(state.muted).filter(([, until]) => until > now));
    return heard.length === state.heard.length && Object.keys(muted).length === Object.keys(state.muted).length ? state : { heard, muted };
  }),
}));
