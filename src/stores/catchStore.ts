import { create } from 'zustand';
import type { SentStep } from '../lib/catchSets';

/*
 * What the operator has done with a set of verses said together: which ones
 * have gone up to the wall (so the numbered strip can tick them off after
 * the engine has let them go) and which one they jumped to. Kept outside the
 * catches pane because the screen reads it too — to stage the verse that is
 * up into the preview box, and to keep the queued verses' clocks held while
 * the verses tab is not showing. See lib/catchSets.
 */
export const useCatchStore = create<{
  sent: Record<string, SentStep[]>;
  picked: Record<string, string>;
  markSent: (group: string, step: SentStep) => void;
  pick: (group: string, id: string) => void;
  /** Forget every set that has nothing left waiting. */
  prune: (open: readonly string[]) => void;
}>((set) => ({
  sent: {},
  picked: {},
  markSent: (group, step) =>
    set((s) => ({ sent: { ...s.sent, [group]: [...(s.sent[group] ?? []), step] } })),
  pick: (group, id) => set((s) => ({ picked: { ...s.picked, [group]: id } })),
  prune: (open) =>
    set((s) => {
      const keep = new Set(open);
      const sent = Object.fromEntries(Object.entries(s.sent).filter(([g]) => keep.has(g)));
      const picked = Object.fromEntries(Object.entries(s.picked).filter(([g]) => keep.has(g)));
      const same = Object.keys(sent).length === Object.keys(s.sent).length &&
        Object.keys(picked).length === Object.keys(s.picked).length;
      return same ? s : { sent, picked };
    }),
}));
