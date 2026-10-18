import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { defaultSegments, type PlannedSegment } from '../../../shared/runPlan';
import { applyRunDrop, moveRunSegments, type RunCarry } from '../../../shared/runCards';

/*
 * The run of service — segments, and what is queued inside each.
 *
 * Lifted out of the rail for the same reason the projector was lifted out of
 * the browsers: two places need it and neither owns it. The rail draws the
 * run; the browser downstairs is what finds the things that go into it. With
 * the state inside the rail, "add this song to worship" had no way to
 * travel — the browser could only ever talk to the projector, which made it
 * a tool for operating a service and not for building one.
 *
 * Sources propose, the run holds. Same shape as ./projector, deliberately.
 */

export type { QueueSource, QueueItem, RunSegment } from '../../../shared/operatorRun';
import type { QueueItem, RunSegment } from '../../../shared/operatorRun';
import { operatorRunStore } from '../../stores/operatorRunStore';
interface RunValue {
  segments: RunSegment[];
  addSegments: (picked: PlannedSegment[]) => void;
  /** Take a whole segment out of the run, queued contents and all. */
  removeSegment: (key: string) => void;
  removeSegments: (keys: string[]) => void;
  /** Swap a segment with its neighbour. Ends of the list are no-ops, so a
      caller can offer the action unconditionally and let it decline. */
  moveSegment: (key: string, delta: -1 | 1) => void;
  moveSegments: (keys: string[], delta: -1 | 1) => void;
  /** A new segment beside an existing one rather than at the end. */
  insertSegment: (key: string, where: 'above' | 'below', picked: PlannedSegment) => void;
  /** The same segment again, contents and all, directly below it. */
  duplicateSegment: (key: string) => void;
  /** Empty a segment without removing it. */
  clearSegment: (key: string) => void;
  /** How long the segment is planned to run. undefined clears it. */
  setSegmentDuration: (key: string, minutes: number | undefined) => void;
  renameSegment: (key: string, label: string) => void;
  /** Change what kind of segment it is. The label follows only if it was
      still the old type's stock label — a name someone typed is theirs. */
  setSegmentType: (key: string, type: { id: string; label: string }, previousStockLabel?: string) => void;

  /** Expanded segments. Collapsed is the resting state — see the rail. */
  isOpen: (key: string) => boolean;
  toggleOpen: (key: string) => void;

  queue: (segmentKey: string, item: Omit<QueueItem, 'key'>) => void;
  /** A whole carried stack at once — see the drag layer. */
  queueMany: (segmentKey: string, items: Omit<QueueItem, 'key'>[]) => void;
  /** A drop from the drag layer. A null segment means "nowhere in
      particular" — see dropInto: it makes the segment the carry belongs in. */
  dropInto: (segmentKey: string | null, items: RunCarry[]) => void;
  remove: (segmentKey: string, itemKey: string) => void;
  /** Rewrite one item's label — how a note is edited in place. */
  updateItem: (segmentKey: string, itemKey: string, label: string) => void;
  /** Merge fields into one item — a song row after its song was edited. */
  patchItem: (segmentKey: string, itemKey: string, patch: Partial<Omit<QueueItem, 'key'>>) => void;
  /** Replace the run with the default order of service (shared DEFAULT_RUN). */
  loadSundayTemplate: () => void;
}

const RunContext = createContext<RunValue | null>(null);

export function RunProvider({ children }: { children: ReactNode }) {
  const segments = useSyncExternalStore(operatorRunStore.subscribe, operatorRunStore.getSnapshot);
  const setSegments = operatorRunStore.update;
  const [open, setOpen] = useState<string[]>([]);
  const seq = useRef(Date.now());
  useEffect(() => { void operatorRunStore.hydrate(); }, []);

  const make = (p: PlannedSegment): RunSegment => ({
    key: `${p.id}-${(seq.current += 1)}`,
    type: p.id,
    label: p.label,
    items: [],
    ...(p.startMin !== undefined ? { startMin: p.startMin } : {}),
    ...(p.durationMin !== undefined ? { durationMin: p.durationMin } : {}),
  });

  const addSegments = useCallback((picked: PlannedSegment[]) => {
    setSegments((prev) => [...prev, ...picked.map(make)]);
  }, []);

  const renameSegment = useCallback((key: string, label: string) => {
    setSegments((prev) => prev.map((s) => (s.key === key ? { ...s, label } : s)));
  }, []);

  const setSegmentType = useCallback(
    (key: string, type: { id: string; label: string }, previousStockLabel?: string) => {
      setSegments((prev) =>
        prev.map((s) =>
          s.key === key
            ? { ...s, type: type.id, label: previousStockLabel !== undefined && s.label === previousStockLabel ? type.label : s.label }
            : s,
        ),
      );
    },
    [],
  );

  const removeSegment = useCallback((key: string) => {
    setSegments((prev) => prev.filter((s) => s.key !== key));
    setOpen((prev) => prev.filter((k) => k !== key));
  }, []);

  const removeSegments = useCallback((keys: string[]) => {
    const selected = new Set(keys);
    setSegments(previous => previous.filter(segment => !selected.has(segment.key)));
    setOpen(previous => previous.filter(key => !selected.has(key)));
  }, []);

  const moveSegments = useCallback((keys: string[], delta: -1 | 1) => {
    setSegments(previous => moveRunSegments(previous, keys, delta));
  }, []);

  /* Reordering is a swap, not a splice-and-insert: the two calls a menu can
     make are "up" and "down", and a swap is exactly that. Out of range is a
     no-op rather than an error — the first card's "move up" simply declines. */
  const moveSegment = useCallback((key: string, delta: -1 | 1) => {
    setSegments((prev) => {
      const at = prev.findIndex((s) => s.key === key);
      const to = at + delta;
      if (at < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[at], next[to]] = [next[to], next[at]];
      return next;
    });
  }, []);

  const insertSegment = useCallback((key: string, where: 'above' | 'below', picked: PlannedSegment) => {
    setSegments((prev) => {
      const at = prev.findIndex((s) => s.key === key);
      if (at < 0) return prev;
      const next = [...prev];
      next.splice(where === 'above' ? at : at + 1, 0, make(picked));
      return next;
    });
  }, []);

  /* A copy carries its queue, with fresh keys — two rows sharing a key is
     how a remove takes both. The name gains nothing: the operator is about
     to rename it or leave two worship blocks, and either is legible. */
  const duplicateSegment = useCallback((key: string) => {
    setSegments((prev) => {
      const at = prev.findIndex((s) => s.key === key);
      if (at < 0) return prev;
      const src = prev[at];
      const copy: RunSegment = {
        ...src,
        key: `${src.type}-${(seq.current += 1)}`,
        items: src.items.map((i) => ({ ...i, key: `${i.source}-${(seq.current += 1)}` })),
      };
      const next = [...prev];
      next.splice(at + 1, 0, copy);
      return next;
    });
  }, []);

  const clearSegment = useCallback((key: string) => {
    setSegments((prev) => prev.map((s) => (s.key === key ? { ...s, items: [] } : s)));
  }, []);

  const setSegmentDuration = useCallback((key: string, minutes: number | undefined) => {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.key !== key) return s;
        const next = { ...s };
        if (minutes === undefined) delete next.durationMin;
        else next.durationMin = minutes;
        return next;
      }),
    );
  }, []);

  const queue = useCallback((segmentKey: string, item: Omit<QueueItem, 'key'>) => {
    setSegments((prev) =>
      prev.map((s) =>
        s.key === segmentKey
          ? { ...s, items: [...s.items, { ...item, key: `${item.source}-${(seq.current += 1)}` }] }
          : s,
      ),
    );
    /* Queueing into a collapsed segment with no way to see it happen reads
       as nothing happening at all. */
    setOpen((prev) => (prev.includes(segmentKey) ? prev : [...prev, segmentKey]));
  }, []);

  /* One write for a whole stack. Queueing them one at a time would work,
     but each call is a state update and dropping four chips would leave the
     rail expanding four times in four frames. */
  const queueMany = useCallback((segmentKey: string, items: Omit<QueueItem, 'key'>[]) => {
    if (items.length === 0) return;
    setSegments((prev) =>
      prev.map((s) =>
        s.key === segmentKey
          ? {
              ...s,
              items: [
                ...s.items,
                ...items.map((i) => ({ ...i, key: `${i.source}-${(seq.current += 1)}` })),
              ],
            }
          : s,
      ),
    );
    setOpen((prev) => (prev.includes(segmentKey) ? prev : [...prev, segmentKey]));
  }, []);

  const dropInto = useCallback((target: string | null, items: RunCarry[]) => {
    setSegments(previous => applyRunDrop(previous, target, items, () => `run-${++seq.current}`));
  }, []);

  const remove = useCallback((segmentKey: string, itemKey: string) => {
    setSegments((prev) =>
      prev.map((s) =>
        s.key === segmentKey ? { ...s, items: s.items.filter((i) => i.key !== itemKey) } : s,
      ),
    );
  }, []);

  const toggleOpen = useCallback((key: string) => {
    setOpen((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  const isOpen = useCallback((key: string) => open.includes(key), [open]);

  const updateItem = useCallback((segmentKey: string, itemKey: string, label: string) => {
    setSegments((prev) =>
      prev.map((s) =>
        s.key === segmentKey
          ? { ...s, items: s.items.map((it) => (it.key === itemKey ? { ...it, label } : it)) }
          : s,
      ),
    );
  }, []);

  const patchItem = useCallback(
    (segmentKey: string, itemKey: string, patch: Partial<Omit<QueueItem, 'key'>>) => {
      setSegments((prev) =>
        prev.map((s) =>
          s.key === segmentKey
            ? { ...s, items: s.items.map((it) => (it.key === itemKey ? { ...it, ...patch } : it)) }
            : s,
        ),
      );
    },
    [],
  );

  /*
   * The default order of service — shared/serviceAliases.ts DEFAULT_RUN, by
   * way of shared/runPlan.ts, so the rail, the engine and the research
   * behind the order are one list.
   *
   * It used to be a list typed out here, with a 'reading' type that exists
   * nowhere else and offering before the sermon. It also arrived stuffed
   * with placeholder notes and every card open, which pushed the second
   * half of the service off a 1280 rail. Now it is seven closed cards with
   * their planned minutes and nothing inside: a skeleton to hang things on.
   */
  const loadSundayTemplate = useCallback(() => {
    setSegments(defaultSegments().map(make));
    setOpen([]);
  }, []);

  const value = useMemo(
    () => ({
      segments,
      addSegments,
      removeSegment,
      removeSegments,
      moveSegment,
      moveSegments,
      insertSegment,
      duplicateSegment,
      clearSegment,
      setSegmentDuration,
      renameSegment,
      setSegmentType,
      patchItem,
      isOpen,
      toggleOpen,
      queue,
      queueMany,
      dropInto,
      remove,
      updateItem,
      loadSundayTemplate,
    }),
    [
      segments,
      addSegments,
      removeSegment,
      removeSegments,
      moveSegment,
      moveSegments,
      insertSegment,
      duplicateSegment,
      clearSegment,
      setSegmentDuration,
      renameSegment,
      setSegmentType,
      patchItem,
      isOpen,
      toggleOpen,
      queue,
      queueMany,
      dropInto,
      remove,
      updateItem,
      loadSundayTemplate,
    ],
  );

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

export function useRun(): RunValue {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error('useRun must be used inside a RunProvider');
  return ctx;
}
