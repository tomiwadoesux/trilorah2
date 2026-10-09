import { create } from 'zustand';

export interface ScriptureMatch {
  reference: string;
  title: string;
  text: string;
  version: string;
  evidence: string[];
  kind: 'named' | 'story' | 'meaning';
}

// The button lives in the catches rail and its answer is drawn over the
// preview screen, two panels apart. Null means the overlay is not there at
// all, and the preview behaves exactly as it does without this feature.
/** Where the words came from: the room ("find scripture") or the operator's typing (the story field in the verses card). */
export type FindSource = 'heard' | 'typed';

export const useScriptureFindStore = create<{
  found: { heard: string; matches: ScriptureMatch[]; how: FindSource; original?: string } | null;
  page: number;
  open: (heard: string, matches: ScriptureMatch[], how?: FindSource, original?: string) => void;
  setPage: (page: number) => void;
  close: () => void;
}>((set) => ({
  found: null,
  page: 0,
  open: (heard, matches, how = 'heard', original) => set({ found: { heard, matches, how, original }, page: 0 }),
  setPage: (page) => set({ page }),
  close: () => set({ found: null, page: 0 }),
}));
