import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { VerseSlide } from '../../../shared/verseDisplay';

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

  /** A song section's words, one slide's worth. What the projector draws. */
  lines?: string[];
  /** The song's title and the section's own name, kept apart from `label`
      (which joins them for the operator) because the wall shows them apart. */
  title?: string;
  section?: string;
  /** A picture's or a video's file (file://, local-media:// or a bare path). */
  path?: string;
  /** Whether `path` is a still or a clip — the wall plays one and paints the other. */
  mediaKind?: 'photo' | 'video';
}

/*
 * The other half of "one projector": the real one, in its own window.
 *
 * Holding a single `live` value in this context stopped the tabs disagreeing
 * with each other. It did nothing for the congregation — a song promoted here
 * moved from one box to another inside the app and the output window was
 * never told, because the only wire out of the app was the verse one. So
 * every act that changes `live` also goes out on the wire, from here and
 * nowhere else, which is the same reason the value lives here and nowhere
 * else.
 *
 * Verses are the exception, on purpose: a verse goes live through the engine
 * (`pushReference` / `pushEnginePreview`), which resolves the text and
 * records the review item, and the engine's echo comes back in as a
 * `send(...)` — bridging that again would push every verse twice.
 */
function toWall(item: LiveItem): void {
  const api = typeof window === 'undefined' ? undefined : window.api;
  if (!api) return;
  if (item.source === 'song' && item.lines) {
    void api.pushLiveContent?.({
      kind: 'song',
      title: item.title ?? item.label,
      label: item.section ?? '',
      lines: item.lines,
    });
  } else if (item.source === 'presentation' && item.lines) {
    void api.pushLiveContent?.({
      kind: 'slide',
      title: item.title ?? item.label,
      label: item.section ?? '',
      lines: item.lines,
      path: item.path,
    });
  } else if ((item.source === 'media' || item.source === 'presentation') && item.path) {
    void api.showMedia?.(item.path, item.mediaKind);
  }
}

function clearWall(): void {
  const api = typeof window === 'undefined' ? undefined : window.api;
  void api?.clearMedia?.();
}

interface ProjectorValue {
  /** On the projector right now. */
  live: LiveItem | null;
  /** Staged, seen only by the operator. */
  preview: LiveItem | null;
  /** Which slide of the staged/live reading is showing. */
  slide: number;
  /** Blacked, cleared, logo, or showing what is live. */
  screen: ScreenState;

  /** Put something in the preview box. Never reaches the congregation. */
  stage: (item: LiveItem | null) => void;
  /** Put something on the projector, staged or not. */
  send: (item: LiveItem) => void;
  /** The local half of a push: what was staged becomes what is live. */
  promote: () => void;
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
  const [live, setLive] = useState<LiveItem | null>(null);
  const [preview, setPreview] = useState<LiveItem | null>(null);
  const [slide, setSlideIndex] = useState(0);
  const [screen, setScreen] = useState<ScreenState>('live');

  const stage = useCallback((item: LiveItem | null) => setPreview(item), []);

  const send = useCallback((item: LiveItem) => {
    toWall(item);
    setLive(item);
    /* A new reading starts at its first slide. Carrying the old index over
       lands the congregation on slide 3 of a reading that has two. */
    setSlideIndex(0);
    /* Pushing lifts a clear, the way the app's own screen state machine
       does when content arrives — but deliberately NOT a black or a logo.
       Those are held on purpose and only a person lifts them. */
    setScreen((s) => (s === 'clear' ? 'live' : s));
  }, []);

  const promote = useCallback(() => {
    setPreview((staged) => {
      if (staged) {
        toWall(staged);
        setLive(staged);
        setSlideIndex(0);
        setScreen((s) => (s === 'clear' ? 'live' : s));
      }
      /* Both screens retain the verse that was pushed to live. */
      return staged;
    });
  }, []);

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
      live,
      preview,
      slide,
      screen,
      stage,
      send,
      promote,
      clear,
      setSlide,
      stepSlide,
      setScreen,
      isLive,
      isStaged,
    }),
    [live, preview, slide, screen, stage, send, promote, clear, setSlide, stepSlide, isLive, isStaged],
  );
  return <ProjectorContext.Provider value={value}>{children}</ProjectorContext.Provider>;
}

export function useProjector(): ProjectorValue {
  const ctx = useContext(ProjectorContext);
  if (!ctx) throw new Error('useProjector must be used inside a ProjectorProvider');
  return ctx;
}
