import { create } from 'zustand';

/*
 * Whether "start listening" plays the practice sermon instead of the
 * microphone (shared/practiceSermon.ts). Session-only on purpose — never
 * saved with the audio input — so a restart always comes back on the real
 * microphone, and a forgotten practice can never be what a live service
 * starts with.
 */
export const usePracticeStore = create<{ on: boolean; setOn: (on: boolean) => void }>((set) => ({
  on: false,
  setOn: (on) => set({ on }),
}));
