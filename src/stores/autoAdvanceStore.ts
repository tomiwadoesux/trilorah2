import { create } from 'zustand';

/** Session-only: auto advance always starts off on a fresh launch. */
export const useAutoAdvanceStore = create<{
  enabled: boolean;
  note: string;
  setEnabled: (enabled: boolean) => void;
  setNote: (note: string) => void;
}>((set) => ({
  enabled: false, note: '',
  setEnabled: enabled => set({ enabled, note: '' }),
  setNote: note => set({ note }),
}));
