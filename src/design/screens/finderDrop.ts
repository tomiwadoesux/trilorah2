import { useSyncExternalStore, type DragEvent } from 'react';
import { dragKinds, type DragKinds } from '../../lib/laptopImport';

/*
 * Files dragged in from Finder (or Explorer).
 *
 * The LIVE screen's own drag layer (./drag) runs on pointer events, and an
 * OS drag never produces any: the page sees dragenter/dragover/drop and
 * nothing else. So this is a second, separate thing — and kept apart from
 * the first on purpose. It answers only drags that carry files AND did not
 * start inside this page: a card's picture is not natively draggable
 * (MediaCard), but a stray text or link drag would otherwise read as
 * "files from Finder" here.
 *
 * One set of window listeners for the whole screen says whether files are
 * over the window and which target is under them, so every target can
 * light up together the way the in-app drag lights its own. "Over" is read
 * off dragover's own target, not counted from enter/leave: enter and leave
 * fire on every child crossed and a count drifts, while dragover fires
 * every ~50 ms wherever the pointer is — and stops when the drag leaves the
 * window or is dropped, which is what the timeout below hears.
 */

export interface FinderDrag {
  active: boolean;
  /** The data-finder-drop key under the pointer, if any. */
  over: string | null;
  kinds: DragKinds;
}

const IDLE: FinderDrag = { active: false, over: null, kinds: 'unknown' };
let state: FinderDrag = IDLE;
let inside = false;
let idleTimer: number | undefined;
let installed = false;
const listeners = new Set<() => void>();

function set(next: FinderDrag): void {
  if (next.active === state.active && next.over === state.over && next.kinds === state.kinds) return;
  state = next;
  for (const l of listeners) l();
}

function carriesFiles(dt: DataTransfer | null): dt is DataTransfer {
  return !!dt && Array.from(dt.types).includes('Files');
}

function install(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  document.addEventListener('dragstart', () => { inside = true; }, true);
  document.addEventListener('dragend', () => { inside = false; }, true);
  window.addEventListener('dragover', (e) => {
    if (inside || !carriesFiles(e.dataTransfer)) return;
    const target = e.target instanceof Element ? e.target.closest('[data-finder-drop]') : null;
    set({ active: true, over: target?.getAttribute('data-finder-drop') ?? null, kinds: dragKinds(Array.from(e.dataTransfer.items)) });
    window.clearTimeout(idleTimer);
    /* Longer than the slowest repeat the spec allows a held-still drag
       (350 ms ± 200), so a hand resting over a box does not flicker it. */
    idleTimer = window.setTimeout(() => set(IDLE), 600);
  }, true);
  /* Out of the window: said at once rather than when the timer runs out.
     Leaving for another element in the page has somewhere to go
     (relatedTarget) or a point inside the window. */
  window.addEventListener('dragleave', (e) => {
    if (!state.active || e.relatedTarget) return;
    const { clientX: x, clientY: y } = e;
    if (x <= 0 || y <= 0 || x >= window.innerWidth || y >= window.innerHeight) {
      window.clearTimeout(idleTimer);
      set(IDLE);
    }
  }, true);
  /* Capture runs before the target's own onDrop, so `inside` is left for
     dragend to clear — cleared here, a picture dragged within the page
     (which carries 'Files' in Chromium) would read as one from Finder. */
  window.addEventListener('drop', () => {
    window.clearTimeout(idleTimer);
    set(IDLE);
  }, true);
}

export function useFinderDrag(): FinderDrag {
  return useSyncExternalStore(
    (l) => {
      install();
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => IDLE,
  );
}

export interface FinderDropProps {
  'data-finder-drop': string;
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
}

/**
 * Makes an element take files from Finder. `accept` can turn a drag away by
 * what it carries (the LIVE box and a clip) — the cursor then says no and
 * the drop never fires. `onFiles` gets the paths on disk, and how many files
 * there were, so a drop whose files have no path (an image dragged out of a
 * web page) can say so instead of doing nothing.
 */
export function finderDropProps(
  key: string,
  onFiles: (paths: string[], count: number) => void,
  accept?: (kinds: DragKinds) => boolean,
): FinderDropProps {
  return {
    'data-finder-drop': key,
    onDragOver: (e) => {
      if (inside || !carriesFiles(e.dataTransfer)) return;
      if (accept && !accept(dragKinds(Array.from(e.dataTransfer.items)))) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    onDrop: (e) => {
      if (inside || !carriesFiles(e.dataTransfer)) return;
      /* First, before any reason to bail: a drop that reaches Chromium's own
         handling navigates the window to the file (main's guardNavigation is
         the second belt). */
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files);
      const paths = files.map((f) => window.api?.pathForFile?.(f) ?? '').filter(Boolean);
      window.clearTimeout(idleTimer);
      set(IDLE);
      onFiles(paths, files.length);
    },
  };
}
