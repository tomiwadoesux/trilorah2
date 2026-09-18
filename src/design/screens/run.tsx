import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

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

export type QueueSource = 'scripture' | 'song' | 'media' | 'presentation' | 'note';

/** One thing queued inside a segment — a verse, a section, a note. */
export interface QueueItem {
  key: string;
  source: QueueSource;
  label: string;
  /** Media: what was dragged in, so the row can show the image itself. */
  preview?: string;
  /** Scripture: the verse text, carried from the drag. */
  quote?: string;
  /** Song: enough to go live from the row. Media: the file. */
  lines?: string[];
  title?: string;
  section?: string;
  path?: string;
}

/*
 * Which segment each kind of thing lands in when the drop names none.
 *
 * Deliberately coarse. This is a guess made so the operator does not have to
 * build the run before using it, and a guess that is wrong is cheap — the
 * segment is right there in the rail to rename or drag out of. Being wrong
 * quietly and often would be worse than being coarse: hence songs to worship
 * and everything with words on a screen to sermon, which is where a reading,
 * a slide deck and a photo actually go in the services this is built for.
 *
 * The ids match SEGMENT_TYPES in Live.tsx — a segment made here is the same
 * kind of object as one picked from the "+" menu, not a special case.
 */
const SEGMENT_FOR: Record<QueueSource, { id: string; label: string }> = {
  song: { id: 'worship', label: 'worship' },
  scripture: { id: 'sermon', label: 'sermon' },
  presentation: { id: 'sermon', label: 'sermon' },
  media: { id: 'sermon', label: 'sermon' },
  note: { id: 'sermon', label: 'sermon' },
};

export interface RunSegment {
  key: string;
  type: string;
  label: string;
  /*
   * Anything, regardless of the segment's type.
   *
   * The obvious model is worship-holds-songs and sermon-holds-verses, and
   * it is wrong about real services: worship has a scripture reading in the
   * middle of it and a sermon ends on an altar-call song. Type biases what
   * is offered first and constrains nothing.
   */
  items: QueueItem[];
}

/* ------------------------------------------------------------------ */

interface RunValue {
  segments: RunSegment[];
  addSegments: (picked: { id: string; label: string }[]) => void;
  /** Take a whole segment out of the run, queued contents and all. */
  removeSegment: (key: string) => void;

  /** Expanded segments. Collapsed is the resting state — see the rail. */
  isOpen: (key: string) => boolean;
  toggleOpen: (key: string) => void;

  queue: (segmentKey: string, item: Omit<QueueItem, 'key'>) => void;
  /** A whole carried stack at once — see the drag layer. */
  queueMany: (segmentKey: string, items: Omit<QueueItem, 'key'>[]) => void;
  /** A drop from the drag layer. A null segment means "nowhere in
      particular" — see dropInto: it makes the segment the carry belongs in. */
  dropInto: (segmentKey: string | null, items: Omit<QueueItem, 'key'>[]) => void;
  remove: (segmentKey: string, itemKey: string) => void;
  /** Rewrite one item's label — how a note is edited in place. */
  updateItem: (segmentKey: string, itemKey: string, label: string) => void;
}

const RunContext = createContext<RunValue | null>(null);

export function RunProvider({ children }: { children: ReactNode }) {
  const [segments, setSegments] = useState<RunSegment[]>([]);
  const [open, setOpen] = useState<string[]>([]);

  /* A counter, not a timestamp: two things queued in the same millisecond
     are two things, and a key has only to be unique within this session. */
  const seq = useRef(0);

  /*
   * Open a segment from inside a setSegments updater.
   *
   * The updater runs during render in StrictMode, and calling setOpen from
   * in there is a state update inside another component's render — React
   * warns, and under StrictMode's double-invoke it would queue twice. So the
   * key is stashed and the effect below does the opening, after commit.
   */
  const openSoon = useRef<string | null>(null);
  const setOpenSoon = (key: string) => {
    openSoon.current = key;
  };
  useEffect(() => {
    const key = openSoon.current;
    if (!key) return;
    openSoon.current = null;
    setOpen((prev) => (prev.includes(key) ? prev : [...prev, key]));
  });

  const addSegments = useCallback((picked: { id: string; label: string }[]) => {
    setSegments((prev) => [
      ...prev,
      ...picked.map((p) => ({
        key: `${p.id}-${(seq.current += 1)}`,
        type: p.id,
        label: p.label,
        items: [],
      })),
    ]);
  }, []);

  const removeSegment = useCallback((key: string) => {
    setSegments((prev) => prev.filter((s) => s.key !== key));
    setOpen((prev) => prev.filter((k) => k !== key));
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

  /*
   * A drop that did not land on a segment.
   *
   * The rail starts empty, and the first thing anyone does is drag a song
   * into it — at which point the old behaviour was nothing at all, because
   * there was no segment under the pointer to receive it and the drop was
   * discarded silently. Requiring the operator to go and build the run's
   * skeleton before it can hold anything is backwards: what they are
   * carrying already says which segment it belongs in.
   *
   * So a drop with no target fills one in. If a segment of the fitting type
   * is already there it queues into that one rather than making a second —
   * dropping three songs makes one worship segment holding three, not three
   * worship segments.
   */
  const dropInto = useCallback(
    (segmentKey: string | null, items: Omit<QueueItem, 'key'>[]) => {
      if (items.length === 0) return;
      if (segmentKey) {
        queueMany(segmentKey, items);
        return;
      }
      /*
       * Each thing goes where IT belongs, not where the first one did.
       *
       * A carry is one gesture but not necessarily one kind of thing — two
       * songs and a reading picked up together is an ordinary way to build
       * the top of a service. Sending the whole stack to the first item's
       * segment would put that reading under worship, which is not what the
       * operator dragged. So the stack is grouped by what each item is, and
       * each group lands in its own segment.
       *
       * Insertion order follows the carry, not SEGMENT_FOR: the segments
       * appear in the order their first item was picked up, so the run comes
       * out in the order the operator was thinking in.
       */
      setSegments((prev) => {
        const next = [...prev];
        let firstTouched: string | null = null;

        for (const item of items) {
          const fit = SEGMENT_FOR[item.source];
          const at = next.findIndex((sg) => sg.type === fit.id);
          const queued = { ...item, key: `${item.source}-${(seq.current += 1)}` };
          if (at >= 0) {
            next[at] = { ...next[at], items: [...next[at].items, queued] };
            firstTouched ??= next[at].key;
          } else {
            const made = {
              key: `${fit.id}-${(seq.current += 1)}`,
              type: fit.id,
              label: fit.label,
              items: [queued],
            };
            next.push(made);
            firstTouched ??= made.key;
          }
        }

        /* Open the first one the drop touched. Opening all of them would
           push the rest of the run off the rail on a mixed carry. */
        if (firstTouched) setOpenSoon(firstTouched);
        return next;
      });
    },
    [queueMany],
  );

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

  const value = useMemo(
    () => ({ segments, addSegments, removeSegment, isOpen, toggleOpen, queue, queueMany, dropInto, remove, updateItem }),
    [segments, addSegments, removeSegment, isOpen, toggleOpen, queue, queueMany, dropInto, remove, updateItem],
  );

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

export function useRun(): RunValue {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error('useRun must be used inside a RunProvider');
  return ctx;
}
