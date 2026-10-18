import { buildVerseSlides } from '../../shared/verseDisplay';
import { fitRules } from '../lib/slideRules';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LiveItem } from '../design/screens/projector';

export interface RememberedScripture {
  key: string;
  reference: string;
  version: string;
  text: string;
  verses: { verse: number; text: string }[];
  at: number;
}

export function rememberScripture(item: LiveItem, at = Date.now()): RememberedScripture | null {
  if (item.source !== 'scripture' || !item.reference || !item.version || !item.text?.trim()) return null;
  return { key: `${item.reference}|${item.version}`, reference: item.reference, version: item.version,
    text: item.text, verses: item.verses ?? [], at };
}

export function recallScripture(entry: RememberedScripture): LiveItem {
  const ref = entry.reference.match(/^(.+?) (\d+):/);
  const slides = ref && entry.verses.length ? buildVerseSlides({ book: ref[1], chapter: Number(ref[2]), version: entry.version }, entry.verses, fitRules(entry.verses)) : undefined;
  return { source: 'scripture', id: entry.reference, label: entry.reference, reference: entry.reference,
    version: entry.version, text: entry.text, verses: entry.verses, slides, origin: 'operator' };
}

interface ScriptureMemory {
  history: RememberedScripture[];
  saved: RememberedScripture[];
  storageError: string | null;
  record: (item: LiveItem) => void;
  dismiss: (key: string) => void;
  dismissMany: (keys: readonly string[]) => void;
  toggleSaved: (entry: RememberedScripture) => void;
}

// History survives a reload; bookmarks are never evicted by the history cap.
// Store only scripture data, never transient slides, guards, or engine IDs.
export const useScriptureMemoryStore = create<ScriptureMemory>()(persist((set) => ({
  history: [], saved: [], storageError: null,
  dismiss: key => set(state => ({ history: state.history.filter(entry => entry.key !== key) })),
  dismissMany: keys => { const gone = new Set(keys); set(state => ({ history: state.history.filter(entry => !gone.has(entry.key)) })); },
  record: item => {
    const entry = rememberScripture(item);
    if (!entry) return;
    set(state => state.history[0]?.key === entry.key ? state : {
      history: [entry, ...state.history.filter(old => old.key !== entry.key)].slice(0, 500),
    });
  },
  toggleSaved: entry => set(state => ({ saved: state.saved.some(old => old.key === entry.key)
    ? state.saved.filter(old => old.key !== entry.key) : [entry, ...state.saved] })),
}), {
  name: 'trilorah-scripture-memory-v1',
  storage: createJSONStorage(() => ({
    getItem: key => localStorage.getItem(key),
    setItem: (key, value) => {
      try { localStorage.setItem(key, value); }
      catch { queueMicrotask(() => { if (!useScriptureMemoryStore.getState().storageError) useScriptureMemoryStore.setState({ storageError: 'Could not keep scriptures on this computer. Your changes are available until you close the app.' }); }); }
    },
    removeItem: key => localStorage.removeItem(key),
  })),
  partialize: state => ({ history: state.history, saved: state.saved }),
}));
