import { create } from 'zustand';

// Shared by the catches rail and library. Changing tabs must not silently
// stop the operator's search; a fresh launch starts with it off.
export const useSongListeningStore = create<{ active: boolean; setActive: (active: boolean) => void }>((set) => ({
  active: false,
  setActive: (active) => set({ active }),
}));
