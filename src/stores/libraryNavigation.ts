import { create } from 'zustand';
import type { QueueItem } from '../design/screens/run';

/** Library selection survives tab changes; search text deliberately does not. */
export const useLibraryNavigation = create<{
  songId: string | null;
  request: { item: QueueItem; serial: number } | null;
  consume: () => void;
  selectSong: (id: string | null) => void;
  open: (item: QueueItem) => void;
}>((set) => ({
  songId: null, request: null,
  consume: () => set({request:null}),
  selectSong: songId => set({ songId }),
  open: item => set(state => ({ request: { item, serial: (state.request?.serial ?? 0) + 1 }, ...(item.songId ? { songId: item.songId } : {}) })),
}));
