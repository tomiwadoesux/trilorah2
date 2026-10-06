import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { VerseSlide } from '../../../shared/verseDisplay';
import { publishLiveItem } from '../../lib/publishLiveItem';
import { withdrawRecognizedPreview } from '../../lib/recognitionWithdrawal';

/*
 * What is on the projector, and what is about to be.
 *
 * This used to live inside each browser — scriptures held a `live` index,
 * songs held a `live` id — and that is the wrong shape for it twice over.
 *
 * There is one projector. Two sources each owning a "live" can disagree, and
 * nothing in either of them is able to notice. Worse in practice: the tabs
 * unmount when you switch, so a verse pushed from scriptures was forgotten
 * the moment the operator went to queue the next song. Mid-service, being
 * unable to see what the congregation is currently reading is the wrong
 * direction to fail in.
 *
 * So it is lifted to one owner above the tabs. Sources propose; the projector
 * holds. Only one thing can be live because only one value exists.
 *
 * TWO SLOTS, not one. The original held only `live`, and "preview" meant a
 * highlighted row inside whichever browser you happened to be in — which is
 * not a preview of anything, because it vanished when you switched tabs and
 * nothing ever drew it. A preview that the operator cannot LOOK at is not
 * doing the job the word promises. Staging and pushing are now two values
 * and two acts, which is also the only arrangement in which a stray click
 * cannot reach a congregation.
 */

export type LiveSource = 'scripture' | 'song' | 'media' | 'presentation';

/** Who put it there. The operator has to be able to tell. */
export type Origin = 'operator' | 'engine' | 'auto';

/** Borrowed from the app's own ScreenState — same four words, same meaning. */
export type ScreenState = 'live' | 'clear' | 'black' | 'logo';

export interface LiveItem {
  source: LiveSource;
  /** Unique within its source — a verse index, a section id. */
  id: string;
  /** Human-readable, for anything that has to say what is showing. */
  label: string;

  /*
   * The content, added so the thing can be DRAWN rather than merely named.
   *
   * All of it optional and every field additive: the original three are what
   * the four existing callers pass, and a caller that passes no content gets
   * a routing token that behaves exactly as it did before. Something that
   * only wants to know "is this row live" never has to learn about slides.
   */
  reference?: string;
  version?: string;
  /** The whole reading, unsliced — for the run of service and the log. */
  text?: string;
  /**
   * Pre-sliced by buildVerseSlides, the projector's own splitter.
   *
   * Sliced here rather than in the renderer because the split depends on
   * settings the renderer does not have, and because preview and live must
   * be sliced identically or the operator's "2 of 3" is not the
   * congregation's. One slicer, one result, passed to both.
   */
  slides?: VerseSlide[];
  /** The reading verse by verse — what lets a range be re-sliced together
      or apart without going back to the database. */
  verses?: { verse: number; text: string }[];
  origin?: Origin;
  /** Identifies an automatically staged provisional speech suggestion. */
  recognitionSuggestionId?: string;

  /** A song section's words, one slide's worth. What the projector draws. */
  lines?: string[];
  /** The song's title and the section's own name, kept apart from `label`
      (which joins them for the operator) because the wall shows them apart. */
  title?: string;
  section?: string;
  /** A picture's or a video's file (file://, local-media:// or a bare path). */
  path?: string;
  deckPaths?: string[];
  deckIndex?: number;
  deckId?: string;
  /** Whether `path` is a still or a clip — the wall plays one and paints the other. */
  mediaKind?: 'photo' | 'video';
}

/* Sends use the engine's confirmed output path. Engine events use reflect,
   so receiving a verse never publishes it a second time. */
function clearWall(): void {
  const api = typeof window === 'undefined' ? undefined : window.api;
  void api?.clearMedia?.();
}

interface ProjectorValue {
  /** Apply the staged theme before any desktop or mobile Go live action. */
  beforeSend: (prepare: () => Promise<void>) => () => void;
  reflect: (item: LiveItem | null) => void;
  /** On the projector right now. */
  live: LiveItem | null;
  /** Staged, seen only by the operator. */
  preview: LiveItem | null;
  /** Which slide of the staged/live reading is showing. */
  slide: number;
  delivery: number;
  /** Blacked, cleared, logo, or showing what is live. */
  screen: ScreenState;

  /** Put something in the preview box. Never reaches the congregation. */
  stage: (item: LiveItem | null) => void;
  /** Retract only an automatic preview from this provisional suggestion. */
  withdrawRecognition: (suggestionId: string) => void;
  /** Put something on the projector, staged or not. */
  send: (item: LiveItem) => Promise<void>;
  /** The local half of a push: what was staged becomes what is live. */
  promote: () => Promise<void>;
  clear: () => void;
  setSlide: (n: number) => void;
  /** Step within the live reading, clamped. Returns whether it moved. */
  stepSlide: (delta: -1 | 1) => boolean;
  setScreen: (s: ScreenState) => void;

  /** Is this exact thing on the projector right now? */
  isLive: (source: LiveSource, id: string) => boolean;
  /** Is this exact thing staged? */
  isStaged: (source: LiveSource, id: string) => boolean;
}

const ProjectorContext = createContext<ProjectorValue | null>(null);

export function ProjectorProvider({ children }: { children: ReactNode }) {
  const prepareOutput = useRef<(() => Promise<void>) | null>(null);
  const beforeSend = useCallback((prepare: () => Promise<void>) => {
    prepareOutput.current = prepare;
    return () => { if (prepareOutput.current === prepare) prepareOutput.current = null; };
  }, []);
  const [delivery, setDelivery] = useState(0);
  const [live, setLive] = useState<LiveItem | null>(null);
  const [preview, setPreview] = useState<LiveItem | null>(null);
  const [slide, setSlideIndex] = useState(0);
  const [screen, setScreen] = useState<ScreenState>('live');

  const stage = useCallback((item: LiveItem | null) => setPreview(item), []);
  const withdrawRecognition = useCallback((suggestionId: string) => {
    setPreview(current => withdrawRecognizedPreview(current, suggestionId));
  }, []);
  const reflect = useCallback((item: LiveItem | null) => { setLive(item); setDelivery(n => n + 1); setSlideIndex(0); }, []);

  const send = useCallback(async (item: LiveItem) => {
    await prepareOutput.current?.();
    const delivered = await publishLiveItem(item);
    setLive(delivered);
    setDelivery(n => n + 1);
    /* A new reading starts at its first slide. Carrying the old index over
       lands the congregation on slide 3 of a reading that has two. */
    setSlideIndex(0);
    /* Pushing lifts a clear, the way the app's own screen state machine
       does when content arrives — but deliberately NOT a black or a logo.
       Those are held on purpose and only a person lifts them. */
    setScreen((s) => (s === 'clear' ? 'live' : s));
  }, []);

  const promote = useCallback(async () => {
    if (preview) await send(preview);
  }, [preview, send]);

  const clear = useCallback(() => {
    clearWall();
    setLive(null);
    setSlideIndex(0);
  }, []);

  const setSlide = useCallback((n: number) => setSlideIndex(Math.max(0, n)), []);

  /*
   * Returns whether it actually moved, so a caller can tell the difference
   * between "advanced" and "already at the end" — which is what lets one
   * key both step through a reading and fall through to the next thing in
   * the run when the reading is done.
   */
  const stepSlide = useCallback(
    (delta: -1 | 1) => {
      const total = live?.slides?.length ?? 0;
      if (total <= 1) return false;
      let moved = false;
      setSlideIndex((i) => {
        const next = Math.min(total - 1, Math.max(0, i + delta));
        moved = next !== i;
        return next;
      });
      return moved;
    },
    [live],
  );

  const isLive = useCallback(
    (source: LiveSource, id: string) => live?.source === source && live.id === id,
    [live],
  );
  const isStaged = useCallback(
    (source: LiveSource, id: string) => preview?.source === source && preview.id === id,
    [preview],
  );

  const value = useMemo(
    () => ({
      delivery,
      beforeSend,
      reflect,
      live,
      preview,
      slide,
      screen,
      stage,
      withdrawRecognition,
      send,
      promote,
      clear,
      setSlide,
      stepSlide,
      setScreen,
      isLive,
      isStaged,
    }),
    [delivery, beforeSend, live, preview, slide, screen, stage, withdrawRecognition, send, promote, clear, setSlide, stepSlide, isLive, isStaged],
  );
  return <ProjectorContext.Provider value={value}>{children}</ProjectorContext.Provider>;
}

export function useProjector(): ProjectorValue {
  const ctx = useContext(ProjectorContext);
  if (!ctx) throw new Error('useProjector must be used inside a ProjectorProvider');
  return ctx;
}
