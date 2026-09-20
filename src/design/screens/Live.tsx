import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import ThinkingOrbsPill from '../orb/ThinkingOrbsPill';
import {
  ActionMenu,
  Button,
  cx,
  ChevronDownIcon,
  type ActionMenuGroup,
  DisplayFontPicker,
  ScriptureReferenceInput,
  MediaIcon,
  MicIcon,
  NoteIcon,
  SearchField,
  SearchIcon,
  Select,
  surface,
  toneClass,
  PencilIcon,
  MusicIcon,
  TrashIcon,
  GlobeIcon,
  LaptopIcon,
  SlideThumb,
  PlusIcon,
  PlayIcon,
  PauseIcon,
  slideBackdrop,
  type BackdropStyle,
  BACKDROP_BY_CONTENT,
  Slider,
  TextPositionPicker,
  ResetIcon,
  type FontOption,
  type ResolvedReference,
  type ScriptureBook,
  type SelectOption,
  type TextPositionOption,
  SegmentedControl,
  type SegmentOption,
  ImportIcon,
  PresentationIcon,
  QrIcon,
} from '../../ui';
import { BOOKS, CHAPTER_COUNTS } from '../../lib/books';
import { parseVerse } from '../../lib/scriptureText';
import { AppShell } from './AppShell';
import { DashboardBento } from './dashboard';
import { ViewEnter } from './viewEnter';
import { RunHeaderActions } from './run/RunHeaderActions';
import { RunOfService } from './run/RunRail';
import { LibraryBrowser, LibraryPane, useLibrarySelection } from './library';
import { AddSongDialog } from './songs/AddSongDialog';
import { SongEditor, type EditorSession } from './songs/SongEditor';
import { DOCK_CLEARANCE, TabDock, type DockAction } from './songs/TabDock';
import { useSongDrafts } from './songs/useSongDrafts';
import { NEW_PREFIX, cardsToSections, isNewId, type SongBase, type SongDraft } from '../../../shared/songDraft';
import './songs/songs.css';
import { SlideCanvas } from './slide';
import { buildVerseSlides, type VerseSlide } from '../../../shared/verseDisplay';
import { formatTimerDisplay } from '../../../shared/timerDisplay';
import { getTimerColor } from '../../../shared/timerColor';
import {
  TEXT_TRANSITIONS,
  TRANSITION_MS,
  clampTransitionMs,
  isTextTransition,
  type TextTransition,
} from '../../../shared/textTransitions';
import { SlidesBrowser } from './presentations';
import { StockSearch } from './stockSearch';
import { addMedia, mediaSrc, useMediaLibrary, videoLength, videoPoster, type MediaSource, type ThemeMedia } from './mediaLibrary';
import { ProjectorProvider, useProjector, type LiveItem } from './projector';
import { EngineProvider, useEngine, SLIDE_RULES, fitRules, fitOf, wordCount, FIT_WORDS } from './engine';
import { RunProvider, useRun, type RunSegment } from './run';
import { DragKeyframes, DragProvider, useDrag } from './drag';
import { LogHistory } from './LogHistory';
import { Panel } from './parts';
import { useForesight } from './foresight';

/*
 * S-02 — LIVE, the control surface.
 *
 * The owner's wireframe, and nothing else: regions, proportions, and the
 * six tab labels, which are the only words the drawing contains. Every
 * panel is empty on purpose — the composition is being judged on its own
 * before any content is put back.
 *
 * What the panels used to hold — the service order, preview and live
 * verses, the browser, and all fourteen state models — is parked intact in
 * ./liveContent, not deleted.
 *
 * Proportions come off the wireframe and are part of the spec: rail 18% of
 * width, context bar 5% of height, the stage 48%, tab strip 4%, browser
 * 38%. The tab strip sits mid-screen by design.
 */

/*
 * The bottom strip — five tabs.
 *
 * The drawing carried "themes" twice and the duplicate was kept for a while
 * as a visible question: an unassigned tab that opens an empty panel asks
 * itself, where a quietly-dropped one cannot. It has been answered — there is
 * one themes editor — so the second is gone rather than left as dead weight
 * on the strip an operator scans mid-service.
 *
 * Id and label stay separate anyway: labels are for reading, ids are what the
 * panel below switches on, and tying the two together is how the strip
 * acquired a duplicate key the first time.
 */
const TABS = [
  { id: 'scriptures', label: 'verses' },
  { id: 'themes', label: 'themes' },
  { id: 'songs', label: 'songs' },
  { id: 'slides', label: 'presentation slides' },
  { id: 'media', label: 'media' },
];


interface ThemeSettings {
  backgroundId: string;
  dimness: number;
  blur: number;
  shadow: number;
  font: FontOption;
  size: number;
  verseSize: number;
  refGap: number;
  layout: TextPositionOption;
  safeMargin: number;
}

const DEFAULT_THEME: ThemeSettings = {
  backgroundId: 'quiet-sea',
  dimness: 48,
  blur: 0,
  shadow: 65,
  font: 'default',
  size: 0,
  verseSize: 0,
  /* 0.45em — what the gap was hard-coded to before it became a control, so
     an existing theme looks the same until someone moves the slider. */
  refGap: 0.45,
  layout: 'top',
  safeMargin: 7,
};

/*
 * The safe margin's bounds — one object, read by both sliders that set it and
 * by the corners you can drag on the canvas, so no control can reach a value
 * another cannot show.
 *
 * Up to 20, from 16: broadcast title-safe is 10% and a careful room wants 15,
 * and on a track that ended at 16 the useful range was crammed into its last
 * third. Half steps because the corners are dragged by hand, and on a 600px
 * canvas a whole percent is a visible 6px jump.
 */
const SAFE_MARGIN = { min: 3, max: 20, step: 0.5 } as const;

/* The reference gap's bounds, in ems of the verse body — shared by its
   slider and by dragging the reference on the canvas, for the same reason
   SAFE_MARGIN is shared. 0 butts the two lines together; 3em is most of a
   line of space, past which the reference has visibly left the verse. */
const REF_GAP = { min: 0, max: 3, step: 0.05 } as const;

/* The picker's options, straight off the shared vocabulary so this screen,
   Settings and the wall cannot disagree about what the choices are. */
const TRANSITION_OPTIONS: SegmentOption<TextTransition>[] = TEXT_TRANSITIONS.map((t) => ({
  id: t.id,
  label: t.label,
}));

/*
 * How words arrive on the wall — the two settings the projector reads.
 *
 * NOT part of ThemeSettings, and the difference is the point: a theme is
 * edited in preview and only reaches the room on "go live", because changing
 * it moves words people are reading. A transition cannot disturb what is
 * already up — it only decides how the NEXT thing arrives — so it is written
 * through the moment it is chosen, like any other setting.
 *
 * `play` counts the reasons to show it again. With no engine (a browser tab)
 * the writes fall away and the picker still works on the canvas.
 */
function useTextTransition() {
  const [id, setId] = useState<TextTransition>('fade');
  const [ms, setMs] = useState<number>(TRANSITION_MS.default);
  const [play, setPlay] = useState(0);

  useEffect(() => {
    let gone = false;
    void window.api
      ?.getSettings?.()
      ?.then((s: Record<string, unknown> | undefined) => {
        if (gone || !s) return;
        if (isTextTransition(s.textTransition)) setId(s.textTransition);
        if (s.textTransitionMs != null) setMs(clampTransitionMs(s.textTransitionMs));
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, []);

  const choose = useCallback((next: TextTransition) => {
    setId(next);
    setPlay((n) => n + 1);
    void window.api?.setSetting?.('textTransition', next);
  }, []);

  /* The speed is heard on release, not during: replaying on every step of a
     drag restarts the entrance thirty times and shows none of them. */
  const replay = useRef<number | undefined>(undefined);
  const pace = useCallback((next: number) => {
    const clamped = clampTransitionMs(next);
    setMs(clamped);
    void window.api?.setSetting?.('textTransitionMs', clamped);
    window.clearTimeout(replay.current);
    replay.current = window.setTimeout(() => setPlay((n) => n + 1), 260);
  }, []);
  useEffect(() => () => window.clearTimeout(replay.current), []);

  return { id, ms, play, choose, pace };
}

/*
 * The two postures of this screen: the operator's own working surface, or
 * the dashboard the rest of the team watches.
 *
 * Not a panel swap — everything under the context bar changes, the rail
 * included, because the dashboard is read rather than worked and has no use
 * for a control column. The bar is what the two share, which is what makes
 * this a switch and not a tab.
 */
const VIEWS = ['operator', 'dashboard'] as const;
type ViewMode = (typeof VIEWS)[number];

/* SEGMENT_TYPES, the "+" menu and the rail's drawing live in ./run/ — see
   run/segmentTypes.tsx, run/RunHeaderActions.tsx and run/RunRail.tsx. */

/** The bare box every region is. */
const EDGE = { boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.055)' } as const;

export const LIVE_STATES = [
  { id: 'S-02a', label: 'idle', note: 'Service open, not listening yet. Everything is armed and nothing is running.' },
  { id: 'S-02b', label: 'connecting', note: 'ASR handshake, or the local Whisper model still downloading. The operator needs a reason to wait.' },
  { id: 'S-02c', label: 'listening', note: 'Hearing speech, no reference detected. The commonest state of the whole service.' },
  { id: 'S-02d', label: 'in preview', note: 'A verse is proposed and waiting on the operator. Nothing has reached the projector.' },
  { id: 'S-02e', label: 'live', note: 'Operator pushed it. The congregation is reading this right now.' },
  { id: 'S-02f', label: 'auto live', note: 'The trust gate passed and the engine pushed it itself — must not look identical to a human push.' },
  { id: 'S-02g', label: 'correction', note: 'The preacher said "I meant verse 34" and the engine caught the correction mid-flight.' },
  { id: 'S-02h', label: 'prayer mode', note: 'Screen deliberately held. Nothing advances until the operator lifts it.' },
  { id: 'S-02i', label: 'practice mode', note: 'Full rehearsal, projector untouched. The safety has to be unmissable.' },
  { id: 'S-02j', label: 'output frozen', note: 'Output held on the last slide while the operator sets up what comes next.' },
  { id: 'S-02k', label: 'media / QR', note: 'Something other than scripture is on the screen — the QR for the web companion.' },
  { id: 'S-02l', label: 'engine error', note: 'The engine stopped mid-sermon. The screen must say so without losing the manual controls.' },
  { id: 'S-02m', label: 'no display', note: 'No projector attached. Everything still works; nothing leaves the laptop.' },
  { id: 'S-02n', label: 'no mic signal', note: 'Permission denied or the interface went silent. The most damaging failure to discover late.' },
];




/**
 * The themes tab — the bottom half, per the owner's design.
 *
 * Every control here is a library component doing its own job: C-07 Select,
 * C-05 DisplayFontPicker, C-06 TextPositionPicker, C-20 Slider. Nothing is
 * re-drawn locally, which is the point of having built them — the screen
 * only decides the arrangement and what each one is called.
 */
function ThemesEditor({
  theme,
  onChange,
  onReset,
}: {
  theme: ThemeSettings;
  onChange: (next: ThemeSettings) => void;
  onReset: () => void;
}) {
  const tx = useTextTransition();
  /* A corner of the guide is in someone's hand — see SlideCanvas. */
  const [cornerHeld, setCornerHeld] = useState(false);
  const [refHeld, setRefHeld] = useState(false);
  const blurb = TEXT_TRANSITIONS.find((t) => t.id === tx.id)?.blurb;

  return (
    /*
     * The design as drawn: two control columns and the projector — on ONE
     * surface, the tab's own panel.
     *
     * For a while these were separate boxes: the controls on a lighter card,
     * the projector in a framed card beside it, the panel behind them bare.
     * That made this the only tab whose contents did not sit on the panel
     * the other four sit on, and the only place on the screen where a
     * picture of the projector had a different material around it than the
     * preview and live boxes directly above. The owner's call: it is one
     * surface, the same one the stage uses. The grouping is carried by the
     * columns and the space between them, and the picture is seated in the
     * panel at --tri-gap exactly as the stage seats its two.
     *
     * The split is set by the picture, not by a ratio: the projector takes
     * the row's full height and the width 16:9 makes of it, so it meets the
     * panel at --tri-gap on three sides, and the controls take what is left.
     * At the default window that lands within a few pixels of half and half,
     * which is where it was drawn. The row is the size container the
     * picture measures itself against — see ThemePreview.
     */
    <div className="flex h-full gap-[var(--tri-gap)]" style={{ containerType: 'size' }}>
      {/* Only this half scrolls; the projector is a fixed object beside it
          and must not move when the controls do. */}
      <ThemeControls>
        {/* The two control stacks stay two COLUMNS inside the one surface —
            the sliders would run to absurd lengths across a full half — but
            they are columns of content now, spaced by type, not two boxes
            with a seam between them. */}
        <div className="flex min-h-0 shrink-0 gap-6 pt-2">
          {/*
            Verse layout leads the column and the dimness slider follows it.
            The picker is the only control here with a shape to recognise —
            four cards you aim at — and putting it first gives the eye
            something to land on at the top of the panel instead of a row of
            sliders that all read alike. Dimness and blur then sit together,
            which is what they are: the two controls that act on the picture
            behind the text rather than on the text.
          */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <TextPositionPicker label="verse layout" value={theme.layout} onChange={(layout) => onChange({ ...theme, layout })} columns={2} />
            <Slider label="background dimness" value={theme.dimness} onChange={(dimness) => onChange({ ...theme, dimness })} />
            <Slider label="background blur" value={theme.blur} onChange={(blur) => onChange({ ...theme, blur })} min={0} max={12} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <Slider label="shadow strength" value={theme.shadow} onChange={(shadow) => onChange({ ...theme, shadow })} />
            {/* Two sizes that no longer pull on each other: the first is the
                scripture, the second is the John 3:16 line. They used to be
                "text" (which scaled BOTH, because it set the container) and
                "verse" (which scaled only the body), so moving either moved
                the verse and neither label was true. */}
            <Slider label="verse text size" value={theme.size} onChange={(size) => onChange({ ...theme, size })} min={-2} max={8} />
            <Slider label="reference size" value={theme.verseSize} onChange={(verseSize) => onChange({ ...theme, verseSize })} min={-2} max={8} />
            {/* Also set by dragging the reference itself on the picture. */}
            <Slider
              label="reference gap"
              value={theme.refGap}
              onChange={(refGap) => onChange({ ...theme, refGap })}
              min={REF_GAP.min}
              max={REF_GAP.max}
              step={REF_GAP.step}
              immediate={refHeld}
            />
            {/* Also set by dragging any corner of the guide on the picture;
                this stays the keyboard's way in, and the precise one. */}
            <Slider
              label="safe margin"
              value={theme.safeMargin}
              onChange={(safeMargin) => onChange({ ...theme, safeMargin })}
              min={SAFE_MARGIN.min}
              max={SAFE_MARGIN.max}
              step={SAFE_MARGIN.step}
              immediate={cornerHeld}
            />
            <DisplayFontPicker value={theme.font} onChange={(font) => onChange({ ...theme, font })} />
          </div>
        </div>

        {/*
          How the words arrive. Its own row under the two columns, full
          width: five words side by side do not fit a half-column, and a
          segmented control is only worth having while every option is
          readable at once. The speed sits beside the choice it paces, and
          goes quiet on "cut", where there is nothing to pace.
        */}
        <div className="flex shrink-0 flex-wrap items-start gap-x-6 gap-y-4">
          <div className="flex min-w-[240px] flex-[3] flex-col gap-1.5">
            <SegmentedControl
              label="transition"
              size="sm"
              options={TRANSITION_OPTIONS}
              value={tx.id}
              onChange={tx.choose}
            />
            <span className="px-1 text-[length:var(--tri-size-xs)] lowercase text-[var(--tri-ink-muted)]">
              {blurb}
            </span>
          </div>
          <div className="flex min-w-[140px] flex-[2] flex-col gap-1.5">
            <Slider
              label="speed · ms"
              value={tx.ms}
              onChange={tx.pace}
              min={TRANSITION_MS.min}
              max={TRANSITION_MS.max}
              step={50}
              disabled={tx.id === 'cut'}
            />
          </div>
        </div>

        <div className="flex shrink-0 justify-end">
          <Button
            label="reset theme"
            tone="danger"
            icon={<ResetIcon size={15} />}
            title="reset theme"
            onClick={onReset}
          />
        </div>
      </ThemeControls>

      <ThemePreview
        theme={theme}
        transition={tx}
        onSafeMargin={(safeMargin) => onChange({ ...theme, safeMargin })}
        onSafeDrag={setCornerHeld}
        onRefGap={(refGap) => onChange({ ...theme, refGap })}
        onRefGapDrag={setRefHeld}
      />
    </div>
  );
}

/*
 * How every scrolling region on this screen begins and ends.
 *
 * Content that runs past its box gets sliced by the box's edge, and a slice
 * is ambiguous: a half-height card at the floor could be a card that ends
 * there. The fade is unambiguous — it says there is more, and it says it in
 * the content rather than in a bar the operator has to notice.
 *
 * BOTH ends, and each only when there is something past it. Fading the foot
 * alone made scrolling down feel like arriving at a hard ceiling: the list
 * dissolved ahead of you and snapped shut behind. Dissolving at both ends
 * while there is more in either direction reads as a window onto something
 * longer, which is what it is. A complete list gets no fade at all — a
 * permanent one dims the last line of a list that already ended, which is
 * the same lie in the other direction.
 *
 * FADE is one number for the whole screen: the themes editor and the
 * proposal stack are both fixed-height boxes with more inside than fits, so
 * they have to dissolve over the same distance, or the bottom of the window
 * reads as two different materials.
 */
const FADE = 72;

/*
 * The scrollbar is ours, and it is an OVERLAY.
 *
 * A styled ::-webkit-scrollbar is a classic scrollbar: Chromium lays it out
 * inside the box, so every scrolling region silently loses that much width.
 * A list would reflow the moment it grew past its box, and the right-hand
 * inset of one panel would not match its neighbour's. The native bar is off
 * screen-wide in index.css and this draws the replacement in the wrapper
 * OUTSIDE the scroller — absolutely positioned, so it costs no width and
 * the content is laid out as though nothing were there.
 *
 * It has to sit outside for a second reason: the mask above is on the
 * scroller, and a thumb inside it would dissolve at exactly the two edges
 * where it says the most.
 *
 * A hairline rather than a grabbable bar, because it is a position readout
 * and not a control — this screen is scrolled with a trackpad, and the only
 * question it answers is how far down you are. MIN keeps it from shrinking
 * to a dot in a very long list.
 */
const BAR_W = 3;
const BAR_MIN = 22;
/* Shown while it is telling you something — during a scroll, or while the
   pointer is over the region — then gone. A bar standing permanently on a
   still list is chrome. */
const BAR_LINGER = 800;

interface Metrics {
  above: boolean;
  below: boolean;
  /** null when the content fits and there is nothing to indicate. */
  thumb: { top: number; height: number } | null;
}

const NOTHING: Metrics = { above: false, below: false, thumb: null };

function FadeScroller({
  className,
  contentClassName,
  children,
}: {
  /** Sizing for the region — the wrapper is the flex or grid item. */
  className?: string;
  /** Layout for the content column inside it. */
  contentClassName?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<Metrics>(NOTHING);
  const [live, setLive] = useState(false);
  const linger = useRef<number | undefined>(undefined);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    /* 2px of slack throughout: fractional layout leaves scrollTop plus
       clientHeight a hair short of scrollHeight at the true bottom, and
       without it the foot fade never switches off. */
    const room = scrollHeight - clientHeight;
    if (room <= 2) {
      setM(NOTHING);
      return;
    }
    const height = Math.max(BAR_MIN, (clientHeight / scrollHeight) * clientHeight);
    setM({
      above: scrollTop > 2,
      below: scrollTop < room - 2,
      /* Travel is over what is LEFT of the track once the thumb has taken
         its share, not over the whole track — otherwise it runs off the
         bottom by its own height at full scroll. */
      thumb: { top: (scrollTop / room) * (clientHeight - height), height },
    });
  }, []);

  const onScroll = useCallback(() => {
    measure();
    setLive(true);
    window.clearTimeout(linger.current);
    linger.current = window.setTimeout(() => setLive(false), BAR_LINGER);
  }, [measure]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    /* Both, deliberately: the box resizes when the window does, and the
       CONTENT resizes when a card arrives or one is dismissed. Watching only
       the scroller misses the second. */
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      observer.disconnect();
      window.clearTimeout(linger.current);
    };
  }, [measure]);

  /* Written as two independent ends rather than one shorthand, because that
     is what they are — this is how a mask stops fading a side with nothing
     past it. */
  const head = m.above ? `transparent 0%, black ${FADE}px` : 'black 0%';
  const foot = m.below ? `black calc(100% - ${FADE}px), transparent 100%` : 'black 100%';
  const mask = m.above || m.below ? `linear-gradient(to bottom, ${head}, ${foot})` : undefined;

  return (
    <div
      className={cx('relative min-h-0', className)}
      onMouseEnter={() => setLive(true)}
      onMouseLeave={() => setLive(false)}
    >
      <div
        ref={ref}
        onScroll={onScroll}
        className={cx('h-full overflow-y-auto', contentClassName)}
        style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      >
        {children}
      </div>
      {m.thumb && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-[1px] rounded-full bg-[rgb(229_243_242_/_0.28)]"
          style={{
            top: m.thumb.top,
            height: m.thumb.height,
            width: BAR_W,
            opacity: live ? 1 : 0,
            transition: 'opacity 220ms var(--tri-ease-out)',
          }}
        />
      )}
    </div>
  );
}

function ThemeControls({ children }: { children: ReactNode }) {
  return (
    /*
     * The left half. No fill and no outline of its own — it sits on the
     * tab's panel, the same surface the projector beside it is seated in.
     *
     * The mask lives on the scroller, not out here: applied to the half it
     * would fade the space the panel's own corner needs to stay crisp in.
     */
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <FadeScroller className="flex-1" contentClassName="flex flex-col gap-4 px-2">
        {children}
      </FadeScroller>
    </div>
  );
}

/*
 * The specimen the themes editor is set on.
 *
 * A real VerseSlide rather than two loose strings, so the editor is judging
 * the same renderer the stage and the projector use — including how the
 * reference sits above the words, which is a decision buildVerseSlides makes
 * and not one this file gets to fake.
 *
 * John 3:16 because it is the verse everyone can check the type against
 * without reading it.
 */
const THEME_SPECIMEN: VerseSlide = {
  lines: [
    {
      version: 'KJV',
      text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
    },
  ],
  reference: 'John 3:16',
  verseStart: 16,
  verseEnd: 16,
  index: 1,
  total: 1,
};

/*
 * The editor's projector — the shared renderer with the guide turned on.
 *
 * This used to be the only place a slide was drawn, and the drawing lived
 * inside it. It is now one caller of SlideCanvas among three (here, the
 * preview box, the live box), which is the point: a theme change the editor
 * shows and the stage does not would be a lie told at the worst possible
 * moment. See ./slide.
 */
function ThemePreview({
  theme,
  transition,
  onSafeMargin,
  onSafeDrag,
  onRefGap,
  onRefGapDrag,
}: {
  theme: ThemeSettings;
  transition: { id: TextTransition; ms: number; play: number };
  onSafeMargin: (next: number) => void;
  onSafeDrag: (dragging: boolean) => void;
  onRefGap: (next: number) => void;
  onRefGapDrag: (dragging: boolean) => void;
}) {
  return (
    /*
     * Seated like the stage boxes, and sized in container units for the
     * reason given at StageBox. All of the row's height, so the picture sits
     * --tri-gap off the panel above, below and to the right and the
     * concentric corner holds — capped at three fifths of the row so that a
     * tall, narrow window cannot let the specimen squeeze out the controls
     * that are the reason the tab exists.
     */
    <div
      className="shrink-0 self-center"
      style={{ width: 'min(60cqw, calc(100cqh * 16 / 9))', aspectRatio: '16 / 9' }}
    >
      <SlideCanvas
        seated
        theme={theme}
        slide={THEME_SPECIMEN}
        guide
        onSafeMargin={onSafeMargin}
        onSafeDrag={onSafeDrag}
        safeRange={SAFE_MARGIN}
        onRefGap={onRefGap}
        onRefGapDrag={onRefGapDrag}
        refGapRange={REF_GAP}
        transition={transition}
      />
    </div>
  );
}

/*
 * The tab holds two different jobs, and the toggle at its top left is the
 * line between them.
 *
 *   themes  what goes BEHIND the words — the background the congregation
 *           reads a verse off for the whole service.
 *   media   what goes ON the screen instead of words — the announcement
 *           slide, the countdown, the baptism clip.
 *
 * They looked like one library because both are pictures in a grid, and
 * that is exactly the confusion worth spending a control on: choosing a
 * background is a decision made once before the service, and choosing a
 * clip is a thing done to the screen during it.
 *
 * It is also why only themes has a stock search. Nobody downloads their
 * own announcement slide from Pixabay.
 */
type MediaView = 'themes' | 'media';

const MEDIA_VIEWS: SegmentOption<MediaView>[] = [
  { id: 'themes', label: 'themes' },
  { id: 'media', label: 'media' },
];

/* A third shelf beside the two: not a source of media the church already
   has, but the way to get more. It is on the same control because the
   operator's question — "where is a background for this" — is the same,
   and the answer is one of three places. */
type MediaShelf = MediaSource | 'search';

const MEDIA_SHELVES: SegmentOption<MediaShelf>[] = [
  { id: 'local', label: 'local' },
  { id: 'stock', label: 'stock' },
  { id: 'search', label: 'search' },
];

/* What each view calls itself, so the header is not a fixed sentence that
   goes half-true the moment the toggle moves. */
const VIEW_COPY: Record<MediaView, { eyebrow: string; line: string; aside: string }> = {
  themes: {
    eyebrow: 'themes',
    line: 'choose the background used on the projector',
    aside: 'selects immediately',
  },
  media: {
    eyebrow: 'media',
    line: "this church's own images and clips",
    aside: 'drag into the service',
  },
};

/** The church's own content — not backgrounds, things shown in their place. */
interface ServiceMedia {
  id: string;
  label: string;
  detail: string;
  seed: number;
  style: BackdropStyle;
  kind: 'image' | 'video';
  /** Videos say how long, because a clip's length changes the run. */
  length?: string;
}

const SERVICE_MEDIA: ServiceMedia[] = [
  { id: 'welcome-loop', label: 'welcome loop', detail: 'plays before the service', seed: 11, style: 'smoke', kind: 'video', length: '2:00' },
  { id: 'countdown-5', label: 'five minute countdown', detail: 'starts on the clock', seed: 6, style: 'facets', kind: 'video', length: '5:00' },
  { id: 'announcements', label: 'announcements', detail: 'this week, three slides', seed: 8, style: 'facets', kind: 'image' },
  { id: 'baptism-sunday', label: 'baptism sunday', detail: 'recorded last week', seed: 12, style: 'smoke', kind: 'video', length: '1:24' },
  { id: 'giving-qr', label: 'giving code', detail: 'scan to give', seed: 10, style: 'facets', kind: 'image' },
];

function MediaBrowser({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [view, setView] = useState<MediaView>('themes');
  const drag = useDrag();
  const projector = useProjector();

  /*
   * Opens on the shelf holding whatever is on the projector, not on a fixed
   * default. The operator's first question here is always "where is the one
   * we are using" — answering it before they ask costs one lookup.
   */
  const library = useMediaLibrary();
  const [shelf, setShelf] = useState<MediaShelf>(
    () => library.find((m) => m.id === selected)?.source ?? 'stock',
  );
  const shown = library.filter((m) => m.source === shelf);
  const copy = VIEW_COPY[view];

  /* The media shelf's own filter. Closed by default — five items do not
     need one — and opened from the dock. */
  const [mediaQuery, setMediaQuery] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const focusSearch = () =>
    requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>('input[type="text"]')?.focus());
  const mediaNeedle = (mediaQuery ?? '').trim().toLowerCase();
  const serviceMedia = SERVICE_MEDIA.filter(
    (m) => mediaNeedle === '' || `${m.label} ${m.detail}`.toLowerCase().includes(mediaNeedle),
  );

  /* The engine copies the file into its own folder — so the background
     survives the USB stick being pulled — and makes it the projector's
     background. It lands on the local shelf and is selected, the same as a
     stock pick. */
  const addLocal = () => {
    /* One picker for stills AND clips. The engine has had a video-capable
       picker for a while; nothing called it, so "add" could only ever bring
       in a picture. A still becomes the projector's background, as before. A
       clip does not — a video is something you play, not a wallpaper — so it
       lands on the shelf with a frame of itself for a face and waits to be
       staged. Either way the engine copies the file into the app's own
       folder, so it is still there next Sunday with the USB stick gone. */
    const api = window.api;
    if (!api?.pickMediaFile) {
      void api?.pickBackgroundImage?.().then((res) => {
        if (!res?.success || !res.url) return;
        const name = decodeURIComponent(res.url.split('/').pop() ?? 'background');
        const media = { id: `local:${res.url}`, label: name.replace(/\.[a-z0-9]+$/i, ''), detail: 'from this laptop', seed: 4, style: 'smoke' as const, source: 'local' as const, url: res.src ?? res.url, kind: 'photo' as const };
        addMedia(media);
        setShelf('local');
        onSelect(media.id);
      });
      return;
    }
    void api.pickMediaFile().then(async (res) => {
      if (!res?.success || !res.url) return;
      const src = res.src ?? res.url;
      const isVideo = res.kind === 'video';
      const [poster, length] = isVideo ? await Promise.all([videoPoster(src), videoLength(src)]) : [undefined, undefined];
      const media: ThemeMedia = {
        id: `local:${res.url}`,
        label: res.name ?? 'media',
        detail: isVideo ? `video${length ? ` · ${length}` : ''} · from this laptop` : 'from this laptop',
        seed: 4,
        style: 'smoke',
        source: 'local',
        url: src,
        poster,
        kind: isVideo ? 'video' : 'photo',
      };
      addMedia(media);
      setShelf('local');
      if (!isVideo) {
        void api.setSetting?.('defaultBackgroundUrl', res.url);
        onSelect(media.id);
      }
    });
  };

  /*
   * The dock: search · add · where from.
   *
   * The third button IS the shelf switch, not a copy of it — it reads and
   * writes the same `shelf` the segmented control above does, so the two can
   * never disagree. It shows where you ARE: a globe while the pictures come
   * from beyond this laptop (stock, or the online search), a laptop while
   * they are the church's own. Pressing it goes to the other.
   */
  const local = shelf === 'local';
  const dock: DockAction[] =
    view === 'themes'
      ? [
          {
            id: 'search',
            label: 'search the free photo and video library',
            icon: <SearchIcon size={14} />,
            active: shelf === 'search',
            onClick: () => {
              setShelf('search');
              focusSearch();
            },
          },
          {
            id: 'add',
            label: window.api?.pickBackgroundImage ? 'add an image from this computer' : 'adding images needs the desktop app',
            icon: <PlusIcon size={14} />,
            disabled: !window.api?.pickBackgroundImage,
            onClick: addLocal,
          },
          {
            id: 'source',
            label: local ? 'showing this laptop — switch to stock' : 'showing stock — switch to this laptop',
            icon: local ? <LaptopIcon size={14} /> : <GlobeIcon size={14} />,
            onClick: () => setShelf(local ? 'stock' : 'local'),
          },
        ]
      : [
          {
            id: 'search',
            label: 'search this church’s media',
            icon: <SearchIcon size={14} />,
            active: mediaQuery !== null,
            onClick: () => {
              if (mediaQuery === null) {
                setMediaQuery('');
                focusSearch();
              } else setMediaQuery(null);
            },
          },
          { id: 'add', label: 'adding your own clips is not built yet', icon: <PlusIcon size={14} />, disabled: true },
          {
            id: 'source',
            label: 'stock is for backgrounds — switch to themes to use it',
            icon: <LaptopIcon size={14} />,
            disabled: true,
          },
        ];

  return (
    <div ref={root} className="relative flex h-full min-h-0 flex-col gap-3">
      <TabDock label={view} actions={dock} />
      {/*
        The header is two rows, not one, and the split is by rank: what this
        tab IS on top, how to narrow it underneath. Cramming the shelf
        control up beside the title made a row of three unrelated things and
        left the reader to work out which governed which.
      */}
      <div className="flex shrink-0 flex-col gap-2 px-1">
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-end gap-3">
            <div>
              <p className="tri-label text-[var(--tri-ink-muted)]">{copy.eyebrow}</p>
              <p className="mt-1 text-[length:var(--tri-size-sm)] text-[var(--tri-ink)]">{copy.line}</p>
            </div>
            <SegmentedControl options={MEDIA_VIEWS} value={view} onChange={setView} size="sm" />
          </div>
          <span className="tri-label shrink-0 text-[var(--tri-ink-muted)]">{copy.aside}</span>
        </div>

        {/*
          Only under themes. The second row appears and disappears with the
          view rather than greying out, because a disabled control still
          asks to be read — and on the media shelf the question it answers
          ("where do backgrounds come from") is not one being asked.
        */}
        {/*
          The row keeps its height on both views. Letting it collapse moved
          the whole grid up by 28px on every toggle, which turns a change of
          shelf into a change of layout — the pictures the eye was reading
          jump out from under it. Empty and present beats absent.
        */}
        <div className="flex h-[var(--tri-control-h)] items-center gap-3">
          {view === 'themes' ? (
            <>
              <SegmentedControl options={MEDIA_SHELVES} value={shelf} onChange={setShelf} size="sm" />
              <span className="tri-label text-[rgb(229_243_242_/_0.38)]">
                {shelf === 'local'
                  ? 'on this laptop'
                  : shelf === 'stock'
                    ? 'ships with trilorah'
                    : 'free photo and video library'}
              </span>
            </>
          ) : mediaQuery !== null ? (
            <SearchField value={mediaQuery} onChange={setMediaQuery} placeholder="type a name..." className="!h-[var(--tri-control-h)]" />
          ) : null}
        </div>
      </div>

      {/*
        The songs and slides grid, exactly: five across, the same gaps, the
        same leading card, and a cell that is a picture with a two-line
        caption under it and a rule along its foot. A background is a slide
        the congregation looks at for the whole service, so the thing that
        chooses one should be the same object as the thing that chooses a
        verse — not a second, squarer kind of card in a neighbouring tab.
      */}
      {view === 'themes' && shelf === 'search' ? (
        /* A pick lands on the local shelf — it is on this laptop now — and
           goes straight to the projector, as a click on either other shelf
           does. */
        <StockSearch
          onPick={(media) => {
            addMedia(media);
            onSelect(media.id);
          }}
        />
      ) : view === 'themes' ? (
        <MediaGrid>
          {shown.map((media) => (
            /* A click makes the picture the theme background; a HOLD drags
               it into the run of service, where its row can put it on the
               wall by itself. Two gestures because they are two different
               jobs — the backdrop behind every verse, and a picture shown
               on its own — and the second one had no way in at all. Only a
               picture with a real file can be dragged: the procedural
               washes have nothing to show. */
            <div
              key={media.id}
              {...(media.url
                ? drag.bind(() => ({
                    source: 'media',
                    label: media.label,
                    preview: mediaSrc(media),
                    path: media.url,
                    mediaKind: media.kind ?? 'photo',
                  }))
                : {})}
            >
              <MediaCard
                src={mediaSrc(media)}
                label={media.label}
                detail={media.detail}
                selected={selected === media.id}
                badge={media.kind === 'video' ? 'video' : selected === media.id ? 'in use' : null}
                /* A still is a background: clicking chooses it. A clip is
                   staged instead — it shows in PREVIEW and only "go live"
                   plays it on the wall, the same two steps as a verse. */
                onClick={() =>
                  media.kind === 'video' && media.url
                    ? projector.stage({
                        source: 'media',
                        id: media.id,
                        label: media.label,
                        path: media.url,
                        mediaKind: 'video',
                        origin: 'operator',
                      })
                    : onSelect(media.id)
                }
              />
            </div>
          ))}
        </MediaGrid>
      ) : (
        <MediaGrid>
          {serviceMedia.map((item) => (
            <MediaCard
              key={item.id}
              src={slideBackdrop(item.seed, item.style)}
              label={item.label}
              detail={item.detail}
              selected={false}
              /* A clip's length is the one thing about it that changes the
                 run, so it is on the picture rather than in the caption. */
              badge={item.kind === 'video' ? (item.length ?? 'clip') : null}
            />
          ))}
        </MediaGrid>
      )}
    </div>
  );
}

/** The grid both views share, so a card cannot drift between them. */
function MediaGrid({ children }: { children: ReactNode }) {
  return (
    <div
      className="grid min-h-0 auto-rows-min grid-cols-5 gap-x-3 gap-y-4 overflow-y-auto px-1"
      /* Room for the dock — see TabDock. */
      style={{ paddingBottom: DOCK_CLEARANCE }}
    >
      {children}
    </div>
  );
}

function MediaCard({
  src,
  label,
  detail,
  selected,
  badge,
  onClick,
}: {
  src: string;
  label: string;
  detail: string;
  selected: boolean;
  badge: string | null;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="group/card block w-full pb-3 text-left transition-transform duration-150 ease-out hover:-translate-y-[2px]"
      style={{ boxShadow: 'inset 0 -1px 0 rgb(255 255 255 / 0.08)' }}
    >
      <span className="tri-rounded-control relative block overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
        <img src={src} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover/card:scale-[1.03]" />
        {/*
          A scrim under the badge, not a box around it. The badge sits on
          whatever the picture happens to be at that corner — a bright sky
          and a black chip both lose — so the picture is darkened where the
          text lands and the chip itself can be nothing but the text.
        */}
        {badge ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
            style={{ background: 'linear-gradient(to top, rgb(0 0 0 / 0.62), transparent)' }}
          />
        ) : null}
        {/*
          The edge, carrying the corner itself rather than leaning on
          the parent to clip it: a square ring cropped by a squircle
          loses its corners and reads as four detached sides. Same
          weights as a slide card's ring, so a selected background
          and a selected song are edged alike.
        */}
        <span
          className="tri-rounded-control pointer-events-none absolute inset-0 transition-shadow duration-150"
          style={{
            boxShadow: selected
              ? 'inset 0 0 0 var(--tri-border) rgb(228 216 122 / 0.6)'
              : 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.22), inset 0 0 0 0 rgb(255 255 255 / 0)',
          }}
        />
        {badge ? (
          <span
            className={cx(
              'absolute bottom-2 right-2 flex items-center gap-[5px] text-[length:var(--tri-size-xs)] leading-none lowercase',
              selected ? 'text-[var(--tri-accent-yellow)]' : 'text-[rgb(255_255_255_/_0.88)]',
            )}
          >
            {/* The dot is the state; the word only says which state. On a
                shelf of five pictures the eye finds a lit dot before it
                finds two letters. */}
            {selected ? (
              <span aria-hidden className="h-[5px] w-[5px] rounded-full bg-[var(--tri-accent-yellow)]" />
            ) : null}
            {badge}
          </span>
        ) : null}
      </span>
      <span className="mt-2 block px-0.5">
        <span className={cx('block truncate text-[length:var(--tri-size-sm)] font-semibold leading-[1.25] transition-colors', selected ? 'text-[var(--tri-accent-yellow)]' : 'text-[rgb(229_243_242_/_0.86)] group-hover/card:text-[var(--tri-ink)]')}>
          {label}
        </span>
        <span className="mt-[2px] block truncate text-[length:var(--tri-size-xs)] leading-[1.3] text-[rgb(229_243_242_/_0.42)]">{detail}</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* S-04 — SCRIPTURES                                                   */
/* ------------------------------------------------------------------ */

/*
 * The real bible, not a mock.
 *
 * DESIGN_MODE opens the database before it opens this window and the sandbox
 * gets the same preload the app does, so window.api.getChapter is live here.
 * Run the gallery in a plain browser instead and there is no api — the table
 * says so rather than quietly showing nothing.
 */

const BOOK_DATA: ScriptureBook[] = BOOKS.map((name, i) => ({
  name,
  chapters: CHAPTER_COUNTS[i],
}));

/*
 * Where the tab opens. An empty table teaches nothing about what this screen
 * does; Genesis 1 shows the shape of the thing before a key is pressed, and
 * it is the same place a physical bible falls open to.
 */
const OPENS_AT: ResolvedReference = { bookIndex: 0, book: 'Genesis', chapter: 1, verse: null };

interface VerseRow {
  ref: string;
  verse: number;
  text: string;
}

/*
 * S-04 — the scripture browser.
 *
 * Two controls and a table. The input is the whole idea: it is a guided
 * reference builder, not a search box, so the operator cannot type their way
 * to a verse that does not exist (see ScriptureReferenceInput).
 *
 * The table keeps a deliberate gap between looking and showing. A single
 * click previews; only a double-click or Enter puts a verse on the
 * projector. One stray click during a service should never reach the
 * congregation, and that is worth an extra deliberate gesture.
 */
function ScripturesBrowser() {
  const drag = useDrag();
  const projector = useProjector();
  const [versions, setVersions] = useState<SelectOption[]>([{ value: 'KJV', label: 'KJV' }]);
  const [version, setVersion] = useState('KJV');
  const [query, setQuery] = useState('');
  const [ref, setRef] = useState<ResolvedReference | null>(null);
  const [rows, setRows] = useState<VerseRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'no-api' | 'empty'>('idle');

  /* Whatever translations the database actually holds — not a guessed list.
     This one ships KJV, BBE and four non-English versions. */
  useEffect(() => {
    window.api?.getAvailableVersions().then((v) => {
      if (v?.length) setVersions(v.map((code) => ({ value: code, label: code })));
    });
  }, []);

  /*
   * What the table is showing: whatever has been named, or Genesis while the
   * field is still empty. A half-typed book that matches several is neither —
   * the chips are the answer at that point, not a list of verses.
   */
  const target = ref ?? (query.trim() === '' ? OPENS_AT : null);

  /*
   * The chapter loads when the chapter is named, not when the operator hits
   * Enter. That is what makes the verse constraint possible — by the time
   * anyone types ":", the real verse count is already here.
   */
  useEffect(() => {
    if (!target) {
      setRows([]);
      setStatus('idle');
      return;
    }
    if (!window.api) {
      setStatus('no-api');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    window.api.getChapter(target.bookIndex, target.chapter, version).then((res) => {
      if (cancelled) return;
      const data = res?.success ? (res.data ?? []) : [];
      setRows(data.map((v) => ({ verse: v.id, ref: v.ref, text: v.text })));
      setStatus(data.length ? 'idle' : 'empty');
    });
    return () => {
      cancelled = true;
    };
  }, [target?.bookIndex, target?.chapter, version]);

  const sel = useLibrarySelection({
    items: rows,
    source: 'scripture',
    idOf: (r) => r.ref,
    labelOf: (r) => r.ref,
    /* The field follows the selection. Arrowing to a verse and typing its
       number are the same act, so they should leave the same thing on
       screen — and it is the reference the operator reads back before
       sending. */
    onPreviewChange: (r) => setQuery(r.ref),
    /*
     * The words, exactly as the projector will set them.
     *
     * RAW text, not the parseVerse-cleaned version the list below uses. The
     * list is for reading at a desk, so it separates the KJV apparatus and
     * sets supplied words in italic; the projector does neither and renders
     * the stored string with its braces intact. Cleaning it here would make
     * the preview prettier than the wall, which is the one direction a
     * preview must never be wrong in — the operator would approve something
     * they had not actually seen.
     *
     * If the braces should go, they should go from the projector, and then
     * from here. Not from here alone.
     *
     * buildVerseSlides is the projector's own splitter, so a long verse
     * breaks here at exactly the clause it breaks at out in the room. That
     * is the difference between a preview and a picture of a preview.
     */
    contentOf: (r) => {
      const text = r.text;
      return {
        reference: r.ref,
        version,
        text,
        slides: buildVerseSlides(
          { book: target?.book ?? '', chapter: target?.chapter ?? 0, version },
          [{ verse: r.verse, text }],
          SLIDE_RULES,
        ),
      };
    },
  });

  /* Specimen text for the sandbox, where no database is attached. The two
     recognisable verses keep the screenshots readable; everything else gets
     one line so a range still demonstrates a range. */
  const FALLBACK_VERSE = (v: number) =>
    v === 2
      ? 'And both Jesus was called, and his disciples, to the marriage.'
      : v === 16
        ? 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'
        : 'In the beginning was the Word, and the Word was with God, and the Word was God.';

  /** The bound the input refuses against — straight off the loaded chapter. */
  const versesInChapter = (bookIndex: number, chapter: number) =>
    target && target.bookIndex === bookIndex && target.chapter === chapter && rows.length
      ? rows[rows.length - 1].verse
      : undefined;

  /* Typing a verse selects its row rather than reloading anything. */
  useEffect(() => {
    if (!ref?.verse) return;
    const i = rows.findIndex((r) => r.verse === ref.verse);
    if (i >= 0) sel.setPreview(i, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref?.verse, rows]);

  /* In sandbox mode or when rows is empty, stage typed reference so preview shows it immediately */
  useEffect(() => {
    if (!ref || !ref.book || !ref.chapter) return;
    if (rows.length === 0) {
      const first = ref.verse ?? 1;
      const last = Math.max(first, ref.rangeEnd ?? first);
      const reference =
        `${ref.book} ${ref.chapter}:${first}` + (last > first ? `-${last}` : '');
      const verses = Array.from({ length: last - first + 1 }, (_, i) => ({
        verse: first + i,
        text: FALLBACK_VERSE(first + i),
      }));
      projector.stage({
        source: 'scripture',
        id: reference,
        label: reference,
        reference,
        version,
        text: verses.map((v) => v.text).join(' '),
        slides: buildVerseSlides({ book: ref.book, chapter: ref.chapter, version }, verses, SLIDE_RULES),
        origin: 'operator',
      });
    }
  }, [ref?.book, ref?.chapter, ref?.verse, ref?.rangeEnd, rows.length, version, projector]);

  const emptyMessage =
    status === 'no-api'
      ? 'no database in a plain browser — run the sandbox through electron'
      : status === 'loading'
        ? 'loading…'
        : status === 'empty'
          ? `nothing in ${version} for this chapter`
          : 'type a reference — the field only accepts keys that lead to a real verse';

  return (
    <LibraryBrowser
      search={
        <>
          {/* Sized to the longest version code plus the chevron. The database
              ships KJV, BBE, RVR, APEE, AA and CUV — four characters at most,
              with a fifth in hand. */}
          <div className="w-[68px] shrink-0">
            <Select options={versions} value={version} onChange={setVersion} />
          </div>
          <ScriptureReferenceInput
            className="min-w-0 flex-1"
            books={BOOK_DATA}
            versesInChapter={versesInChapter}
            value={query}
            onChange={setQuery}
            onReferenceChange={setRef}
            onSubmit={(r) => {
              /*
               * A typed range is a READING, not a verse: "5-9" stages all
               * five and lets buildVerseSlides break them the way the wall
               * would. Before this, the field could not even parse the dash
               * and the whole reference came back null — which is why a
               * range put nothing on the screen at all.
               */
              const first = r.verse ?? 1;
              const last = Math.max(first, r.rangeEnd ?? first);
              const reference =
                `${r.book} ${r.chapter}` +
                (r.verse ? `:${first}${last > first ? `-${last}` : ''}` : '');

              const picked = rows.filter((v) => v.verse >= first && v.verse <= last);
              const verses = picked.length
                ? picked.map((v) => ({ verse: v.verse, text: v.text }))
                : [{ verse: first, text: FALLBACK_VERSE(first) }];

              const slides = buildVerseSlides(
                { book: r.book, chapter: r.chapter, version },
                verses,
                SLIDE_RULES,
              );

              projector.stage({
                source: 'scripture',
                id: reference,
                label: reference,
                reference,
                version,
                text: verses.map((v) => v.text).join(' '),
                slides,
                origin: 'operator',
              });
            }}
            onNavigate={sel.navigate}
            onActivate={sel.activate}
          />
        </>
      }
    >
      <LibraryPane
        title={
          <>
            <span className="w-[150px] shrink-0">reference</span>
            <span className="min-w-0 flex-1">scripture text</span>
          </>
        }
      >
        <div ref={sel.listRef}>
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.38)]">
              {emptyMessage}
            </p>
          ) : (
            rows.map((row, i) => (
              <button
                key={row.ref}
                data-row={i}
                type="button"
                /* Hold to drag. A press that moves early is refused with a
                   nudge and behaves as a click, so selecting the text of a
                   verse is still possible — see drag.tsx. */
                {...drag.bind(() => ({
                  source: 'scripture',
                  label: row.ref,
                  quote: parseVerse(row.text)
                    .map((seg) => seg.text)
                    .join(''),
                }))}
                onClick={() => sel.setPreview(i)}
                onDoubleClick={() => sel.send(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sel.send(i);
                }}
                /* Rule on the row itself rather than a divider element, so a
                   highlighted row keeps its own edge and nothing shifts. */
                style={{ boxShadow: 'inset 0 -1px 0 rgb(255 255 255 / 0.055)' }}
                className={cx(
                  'flex w-full items-baseline gap-4 px-4 py-3.5 text-left transition-colors',
                  sel.isLive(i)
                    ? 'bg-[rgb(228_216_122_/_0.10)]'
                    : sel.preview === i
                      ? 'bg-[rgb(255_255_255_/_0.06)]'
                      : 'hover:bg-[rgb(255_255_255_/_0.03)]',
                )}
              >
                <span
                  className={cx(
                    'w-[150px] shrink-0 text-[length:var(--tri-size)]',
                    sel.isLive(i)
                      ? 'text-[rgb(228_216_122_/_0.9)]'
                      : 'text-[rgb(229_243_242_/_0.72)]',
                  )}
                >
                  {row.ref}
                </span>
                {/* The stored text carries the KJV apparatus in braces; the
                    marginal notes are dropped and the supplied words set in
                    italic, as the printed text does. */}
                {/* The base step — the same size the song cards set their
                    lyrics at, so a verse and a verse read as the same kind
                    of thing across the two tabs. */}
                {/* Capped measure. The column is as wide as the window lets
                    it be, and at 1920 that is ~190 characters on one line —
                    the length the artboard note warns about ("where line
                    length starts to be the problem, not width"). 90ch is the
                    top of the readable band; in ch rather than px so it
                    tracks the tier instead of needing a fourth number. The
                    flex-1 stays, so the cell still owns the space and the
                    text simply stops growing inside it. */}
                <span className="min-w-0 max-w-[90ch] flex-1 text-[length:var(--tri-size)] leading-[1.5] text-[var(--tri-ink)]">
                  {parseVerse(row.text).map((seg, n) =>
                    seg.supplied ? (
                      <em key={n} className="italic opacity-90">
                        {seg.text}
                      </em>
                    ) : (
                      <span key={n}>{seg.text}</span>
                    ),
                  )}
                </span>
                {sel.isLive(i) && (
                  <span className="shrink-0 text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.14em] text-[rgb(228_216_122_/_0.9)]">
                    live
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </LibraryPane>
    </LibraryBrowser>
  );
}

/* ------------------------------------------------------------------ */
/* S-04 — SONGS                                                        */
/* ------------------------------------------------------------------ */

interface SongVerse {
  id: string;
  label: string;
  /** The words on the slide. Three short lines — a slide, not a page. */
  lines: string[];
}

interface Song {
  id: string;
  title: string;
  author: string;
  verses: SongVerse[];
}

/*
 * Placeholder library. There is no songs table yet — bible.db holds exactly
 * one table and it is the bible — so this is the shape the screen expects,
 * not data it found. Public-domain hymns, and enough of them to fill more
 * than one row of seven and start the grid scrolling, which is the thing the
 * layout actually has to survive.
 *
 * Real lyrics rather than "Verse 1" repeated sixteen times: the cards are
 * slide previews now, and a grid of identical placeholder rectangles proves
 * nothing about whether an operator can pick a song out of it at a glance.
 */
const SONG_SEED: [string, string, [string, string[]][]][] = [
  ['Amazing Grace', 'John Newton', [
    ['Verse 1', ['Amazing grace, how sweet the sound', 'that saved a wretch like me']],
    ['Verse 2', ['\u2019Twas grace that taught my heart to fear', 'and grace my fears relieved']],
    ['Verse 3', ['Through many dangers, toils and snares', 'I have already come']],
  ]],
  ['Be Thou My Vision', 'Dallan Forgaill', [
    ['Verse 1', ['Be thou my vision, O Lord of my heart', 'naught be all else to me']],
    ['Verse 2', ['Be thou my wisdom, and thou my true word', 'I ever with thee and thou with me']],
  ]],
  ['Holy, Holy, Holy', 'Reginald Heber', [
    ['Verse 1', ['Holy, holy, holy, Lord God Almighty', 'early in the morning our song shall rise to thee']],
    ['Verse 2', ['All the saints adore thee', 'casting down their golden crowns']],
  ]],
  ['It Is Well With My Soul', 'Horatio Spafford', [
    ['Verse 1', ['When peace like a river attendeth my way', 'when sorrows like sea billows roll']],
    ['Chorus', ['It is well, it is well', 'with my soul']],
  ]],
  ['Great Is Thy Faithfulness', 'Thomas Chisholm', [
    ['Verse 1', ['Great is thy faithfulness, O God my Father', 'there is no shadow of turning with thee']],
    ['Chorus', ['Morning by morning new mercies I see', 'all I have needed thy hand hath provided']],
  ]],
  ['Come Thou Fount', 'Robert Robinson', [
    ['Verse 1', ['Come thou fount of every blessing', 'tune my heart to sing thy grace']],
    ['Verse 2', ['Here I raise mine Ebenezer', 'hither by thy help I\u2019m come']],
  ]],
  ['Blessed Assurance', 'Fanny Crosby', [
    ['Verse 1', ['Blessed assurance, Jesus is mine', 'O what a foretaste of glory divine']],
    ['Chorus', ['This is my story, this is my song', 'praising my Saviour all the day long']],
  ]],
  ['Rock of Ages', 'Augustus Toplady', [
    ['Verse 1', ['Rock of ages, cleft for me', 'let me hide myself in thee']],
    ['Verse 2', ['Nothing in my hand I bring', 'simply to thy cross I cling']],
  ]],
  ['What a Friend We Have in Jesus', 'Joseph Scriven', [
    ['Verse 1', ['What a friend we have in Jesus', 'all our sins and griefs to bear']],
    ['Verse 2', ['Have we trials and temptations?', 'Is there trouble anywhere?']],
  ]],
  ['Crown Him With Many Crowns', 'Matthew Bridges', [
    ['Verse 1', ['Crown him with many crowns', 'the Lamb upon his throne']],
    ['Verse 2', ['Crown him the Lord of love', 'behold his hands and side']],
  ]],
  ['All Creatures of Our God and King', 'Francis of Assisi', [
    ['Verse 1', ['All creatures of our God and King', 'lift up your voice and with us sing']],
    ['Chorus', ['O praise him, O praise him', 'alleluia, alleluia']],
  ]],
  ['Nothing But the Blood', 'Robert Lowry', [
    ['Verse 1', ['What can wash away my sin?', 'Nothing but the blood of Jesus']],
    ['Chorus', ['O precious is the flow', 'that makes me white as snow']],
  ]],
  ['To God Be the Glory', 'Fanny Crosby', [
    ['Verse 1', ['To God be the glory, great things he hath done', 'so loved he the world that he gave us his Son']],
    ['Chorus', ['Praise the Lord, praise the Lord', 'let the earth hear his voice']],
  ]],
  ['Praise to the Lord, the Almighty', 'Joachim Neander', [
    ['Verse 1', ['Praise to the Lord, the Almighty', 'the King of creation']],
    ['Verse 2', ['Praise to the Lord, who o\u2019er all things', 'so wondrously reigneth']],
  ]],
  ['When I Survey the Wondrous Cross', 'Isaac Watts', [
    ['Verse 1', ['When I survey the wondrous cross', 'on which the Prince of glory died']],
    ['Verse 2', ['Forbid it, Lord, that I should boast', 'save in the death of Christ my God']],
  ]],
  ['O Worship the King', 'Robert Grant', [
    ['Verse 1', ['O worship the King, all glorious above', 'and gratefully sing his power and his love']],
    ['Verse 2', ['O tell of his might, O sing of his grace', 'whose robe is the light, whose canopy space']],
  ]],
];

const SONGS: Song[] = SONG_SEED.map(([title, author, verses], s) => ({
  id: `song-${s}`,
  title,
  author,
  verses: verses.map(([label, lines], i) => ({ id: `v-${s}-${i}`, label, lines })),
}));

/*
 * Which verse a card shows.
 *
 * Deliberately not Math.random: a card that reshuffles its own words on every
 * render is not a preview of anything, and the one thing a slide thumbnail
 * has to be is the same slide next time you look at it. Mixed across the
 * grid, stable within a card.
 */
function cardVerseIndex(song: Song, index: number): number {
  return (index * 3 + 1) % song.verses.length;
}

/*
 * The projector id for one section of one song.
 *
 * Written once because two places have to agree on it: the lyric sheet
 * sends it, and the grid asks whether anything belonging to a song is on
 * the projector. A song is never live by itself — a SECTION of it is — so
 * the grid's question is a prefix test, and a prefix test against a format
 * invented at each end is how the gold ring ends up on the wrong card.
 */
function sectionId(song: Song, verse: SongVerse): string {
  return `${song.id}/${verse.id}`;
}

/*
 * S-04 — songs, in two views.
 *
 * The library is a grid of songs and opening one replaces it with that
 * song's words. That is the shape the tab always described — search, pick a
 * container, pick an item inside it — and the grid had been doing the first
 * two and then asking the operator to find a chorus on a 117px thumbnail.
 *
 * The search field belongs to whichever view is up. In the grid it finds
 * songs; on the sheet it finds a line inside the one that is open. Same
 * field, same place, and the thing being searched is always the thing on
 * the screen — which is the only rule that makes one field mean two things
 * without confusing anybody.
 */
/*
 * The songs tab's state: the library, the editor, the add dialog, drafts.
 *
 * The editor and the dialog are the two popups in src/design/screens/songs/.
 * What this component owns is the hand-off between them and the one rule
 * they share — NOTHING reaches the library except through the editor's Save:
 *
 *   edit a card      → editor on that song   → Save = songs.update
 *   add (any route)  → editor on a new song  → Save = songs.add
 *   close, unsaved   → a draft, per song id, that the next open resumes
 *
 * A song that exists only as a draft (added, never saved) is drawn as a card
 * at the head of the grid, marked, so closing the editor on a new song does
 * not look like losing it.
 */
interface EditorState {
  session: EditorSession;
  origin: HTMLElement | null;
  open: boolean;
}

function songFromDraft(id: string, draft: SongDraft): Song {
  const sections = cardsToSections(draft.cards);
  return {
    id,
    title: draft.title.trim() || 'untitled song',
    author: draft.author,
    verses: (sections.length ? sections : [{ label: 'Verse 1', lines: [''] }]).map((sec, i) => ({
      id: `${id}:${i}`,
      label: sec.label,
      lines: sec.lines,
    })),
  };
}

function SongsBrowser({ addRequest = 0 }: { addRequest?: number }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [deleted, setDeleted] = useState<ReadonlySet<string>>(() => new Set());
  const { drafts, save: saveDraft, clear: clearDraft } = useSongDrafts();

  const store = typeof window === 'undefined' ? undefined : window.api?.songs;
  const [stored, setStored] = useState<Song[] | null>(null);
  const refresh = useCallback(() => {
    if (!store) return;
    void store
      .list()
      .then((list) =>
        setStored(
          /* Newest first. The store hands songs back in the order they were
             added, which put a song imported a moment ago at the very bottom
             of the grid, under every seeded hymn — the one place the operator
             who just added it will not look. The seeded hymns all share one
             timestamp, so they keep their own order behind it (sort is stable). */
          [...list]
            .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
            .map((song) => ({
            id: song.id,
            title: song.title,
            author: (song.authors ?? []).join(', '),
            verses: song.sections.map((sec, i) => ({ id: `${song.id}:${i}`, label: sec.label, lines: sec.lines })),
          })),
        ),
      )
      .catch(() => undefined);
  }, [store]);
  useEffect(refresh, [refresh]);

  /* The header's import menu asks for the add dialog by stamping the time —
     this tab may not have been mounted when it was pressed, so the request
     has to survive the mount; and it is a TIME so that coming back to this
     tab an hour later does not replay it. */
  const seenRequest = useRef(0);
  useEffect(() => {
    if (addRequest === seenRequest.current) return;
    seenRequest.current = addRequest;
    if (Date.now() - addRequest < 2000) setAddOpen(true);
  }, [addRequest]);

  const songs = useMemo(() => {
    const library = (stored ?? SONGS).filter((s) => !deleted.has(s.id));
    const pending = Object.entries(drafts)
      .filter(([id]) => isNewId(id))
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .map(([id, draft]) => songFromDraft(id, draft));
    return [...pending, ...library];
  }, [stored, deleted, drafts]);
  const open = songs.find((s) => s.id === openId && !isNewId(s.id));

  const edit = (song: Song, origin: HTMLElement | null) => {
    const draft = drafts[song.id];
    const isNew = isNewId(song.id);
    const base: SongBase =
      isNew && draft?.base
        ? draft.base
        : { title: song.title, author: song.author, sections: song.verses.map((v) => ({ label: v.label, lines: v.lines })) };
    setEditor({ session: { id: song.id, isNew, base, draft }, origin, open: true });
  };

  const saveSong = async (id: string, isNew: boolean, song: SongBase): Promise<boolean> => {
    const authors = song.author ? [song.author] : [];
    if (!store) {
      /* No engine: the grid is the only library there is. */
      const local: Song = {
        id: isNew ? `song-${Date.now()}` : id,
        title: song.title,
        author: song.author,
        verses: song.sections.map((sec, i) => ({ id: `${id}:${i}`, label: sec.label, lines: sec.lines })),
      };
      setStored((prev) => {
        const list = prev ?? SONGS;
        return isNew ? [local, ...list] : list.map((s) => (s.id === id ? local : s));
      });
      return true;
    }
    const saved = isNew
      ? await store.add({ title: song.title, authors, sections: song.sections })
      : await store.update(id, { title: song.title, authors, sections: song.sections });
    if (!saved) return false;
    refresh();
    return true;
  };

  return (
    <>
      <AddSongDialog
        open={addOpen}
        onRequestClose={() => setAddOpen(false)}
        onImported={refresh}
        onReady={({ base, note }) => {
          setAddOpen(false);
          setOpenId(null);
          setEditor({
            session: { id: `${NEW_PREFIX}${Date.now().toString(36)}`, isNew: true, base, note },
            origin: null,
            open: true,
          });
        }}
      />
      {editor ? (
        <SongEditor
          key={editor.session.id}
          session={editor.session}
          open={editor.open}
          origin={editor.origin}
          onSave={(song) => saveSong(editor.session.id, editor.session.isNew, song)}
          onDraft={(draft) => (draft ? saveDraft(editor.session.id, draft) : clearDraft(editor.session.id))}
          onRequestClose={() => setEditor((e) => (e ? { ...e, open: false } : e))}
          onClosed={() => setEditor(null)}
        />
      ) : null}
      {open ? (
        <SongSheet key={open.id} song={open} onBack={() => setOpenId(null)} />
      ) : (
        <SongGrid
          songs={songs}
          query={query}
          onQuery={setQuery}
          onOpen={(id) => {
            /* A song that is only a draft has nothing to put on the wall
               yet; opening it means carrying on editing it. */
            const song = songs.find((s) => s.id === id);
            if (song && isNewId(id)) edit(song, null);
            else setOpenId(id);
          }}
          onEdit={edit}
          onAdd={() => setAddOpen(true)}
          draftIds={drafts}
          onDelete={(id) => {
            clearDraft(id);
            if (isNewId(id)) return;
            setDeleted((d) => new Set(d).add(id));
            if (store) void store.remove(id).then(refresh).catch(() => undefined);
          }}
        />
      )}
    </>
  );
}

/*
 * The library grid.
 *
 * One surface: every song is a card, and the card is a picture of the slide
 * the congregation would see. The two-pane version put a column of titles on
 * the left and made you pick one before anything appeared, which spent a
 * third of the width on words that were already printed on the cards and hid
 * fifteen songs behind a click. Search narrows the grid instead.
 *
 * A card OPENS its song now rather than previewing it. It used to carry the
 * whole gesture — click to select, double-click to put a verse up — on a
 * thumbnail showing two of the song's five sections, so the third verse was
 * reachable only by paging a card with two small arrows. The card is a good
 * picture of a song and a bad list of one, and opening it is how you get the
 * list.
 */
function SongGrid({
  songs,
  query,
  onQuery,
  onOpen,
  onEdit,
  onDelete,
  onAdd,
  draftIds,
}: {
  songs: readonly Song[];
  query: string;
  onQuery: (q: string) => void;
  onOpen: (id: string) => void;
  /** The card's own element comes too — it is what the editor lifts off from. */
  onEdit?: (song: Song, origin: HTMLElement | null) => void;
  onDelete: (id: string) => void;
  onAdd?: () => void;
  /** Songs with unsaved editor work; only membership is read. */
  draftIds?: Readonly<Record<string, unknown>>;
}) {
  const drag = useDrag();
  const projector = useProjector();
  const searchRow = useRef<HTMLDivElement>(null);

  /*
   * Which verse each card is showing, once the operator has paged it off
   * its default. Keyed by song, so filtering the grid and coming back finds
   * the card where it was left. Sparse: a card that was never paged is not
   * in here, and reads its default from cardVerseIndex.
   */
  const [verseAt, setVerseAt] = useState<Record<string, number>>({});
  const verseOf = (song: Song, i: number) =>
    song.verses[verseAt[song.id] ?? cardVerseIndex(song, i)];
  const stepVerse = (song: Song, i: number, delta: -1 | 1) =>
    setVerseAt((m) => {
      const cur = m[song.id] ?? cardVerseIndex(song, i);
      const next = Math.min(song.verses.length - 1, Math.max(0, cur + delta));
      return next === cur ? m : { ...m, [song.id]: next };
    });

  /*
   * Lyrics are searched as well as titles — "type a song name or lyrics" is
   * what the field promises, and half-remembered words are how a song usually
   * gets found.
   */
  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      songs.filter((s) =>
        needle === ''
          ? true
          : s.title.toLowerCase().includes(needle) ||
            s.verses.some((v) => v.lines.join(' ').toLowerCase().includes(needle)),
      ),
    [needle, songs],
  );

  /* A song is live when a section of it is. The gold ring belongs on the
     card whose words the congregation is reading, and that is the only
     thing the grid still needs from the projector. */
  const liveId = projector.live?.source === 'song' ? projector.live.id : null;

  return (
    <LibraryBrowser
      framed
      search={
        <div ref={searchRow} className="w-full">
          <SearchField
            value={query}
            onChange={onQuery}
            placeholder="type a song name or lyrics..."
          />
        </div>
      }
      dock={
        <TabDock
          label="songs"
          actions={[
            { id: 'add', label: 'add a song', icon: <PlusIcon size={14} />, onClick: onAdd },
            {
              id: 'search',
              label: 'search songs',
              icon: <SearchIcon size={14} />,
              onClick: () => searchRow.current?.querySelector('input')?.focus(),
            },
          ]}
        />
      }
    >
      {/* No header band: the cards are titled, and a word above them
          saying "songs" was a row of chrome between the search and the
          thing being searched. */}
      <LibraryPane header={false}>
        {matches.length === 0 ? (
          <div className="flex h-full items-center justify-center px-5">
            <p className="text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.38)]">
              nothing matches
            </p>
          </div>
        ) : (
          /*
            Five across, fixed. Everywhere else in this app a grid counts
            its own columns from the room it has — see the note in tokens
            about a verse not growing — but a song grid is scanned as a
            shape you learn: the fourth song is always fourth on the top
            row, on any screen, and a count that changed with the window
            would move it. Five is what leaves the lyrics readable at a
            glance; seven had them down at the size you have to lean in for.
          */
          <div
            className="grid auto-rows-min grid-cols-5 gap-x-3 gap-y-4 px-5 pt-4"
            /* Room for the dock: the last row scrolls clear of it. */
            style={{ paddingBottom: DOCK_CLEARANCE }}
          >
            {matches.map((song, i) => {
              const verse = verseOf(song, i);
              /* This verse and the next — the card shows where the song
                 is going. The last verse stands alone; nothing follows. */
              const at = song.verses.indexOf(verse);
              const shown = song.verses.slice(at, at + 2);
              const live = liveId?.startsWith(`${song.id}/`) ?? false;
              return (
                /* Wrapped rather than teaching SlideThumb to be a drag
                   source: the gesture belongs to this screen's run of
                   service, not to a library component that knows nothing
                   about it. */
                <div
                  key={song.id}
                  {...drag.bind(() => ({
                    source: 'song',
                    label: `${song.title} — ${verse.label}`,
                    title: song.title,
                    section: verse.label,
                    lines: verse.lines,
                    songId: song.id,
                  }))}
                  /*
                   * The whole cell opens the song, not just the picture.
                   *
                   * SlideThumb puts its onSelect on the <button> around the
                   * image, so a click on the title, the artist or the
                   * padding under the thumbnail hit this wrapper and did
                   * nothing — the card reads as one object and behaved as
                   * two. The pager arrows inside stopPropagation, so paging
                   * a card still does not open it.
                   *
                   * onClick, not onPointerUp: a drag ends in a pointerup
                   * too, and the drag layer already swallows the click that
                   * follows a drop (see swallowNextClick). Listening for the
                   * click is what keeps "dropped a song into the run" from
                   * also meaning "opened that song".
                   */
                  onClick={() => onOpen(song.id)}
                  /*
                    The card is the slide and nothing else: its border is
                    the slide's own edge, and the name lives under it the
                    way a caption lives under a picture. Fencing the two
                    inside a second box put a title on the card, which is
                    exactly what a title is not — and gave every cell two
                    concentric borders saying the same thing.

                    Hover no longer lifts the cell. With twenty cards under
                    a moving pointer the lift made the grid shimmer; what
                    answers the pointer now is the pager arrow on the
                    picture and the edit / delete pair — see songs.css.
                  */
                  /*
                    A rule under each cell, like the foot of a list row.
                    1px and faint — a line between rows, not an outline,
                    so it is not --tri-border (see the token's note). It
                    gives the grid a baseline the captions sit on, which
                    the eye wants once there are two lines of text under
                    every picture.
                  */
                  className="song-card group/card pb-3"
                  style={{ boxShadow: 'inset 0 -1px 0 rgb(255 255 255 / 0.08)' }}
                >
                  <SlideThumb
                    index={i}
                    label={song.title}
                    stanzas={shown.map((v) => v.lines)}
                    backdropStyle={BACKDROP_BY_CONTENT.music}
                    pager={{
                      at,
                      count: song.verses.length,
                      onStep: (delta) => stepVerse(song, i, delta),
                    }}
                    showCaption={false}
                    live={live}
                    /* Both gestures open it. Click and double-click meant
                       two different things back when one previewed and the
                       other committed; with nothing to commit from here,
                       a double-click that did nothing would just read as a
                       click that failed. */
                    onSelect={() => onOpen(song.id)}
                    onSend={() => onOpen(song.id)}
                  />

                  {/*
                    Name over artist, the way every library the operator
                    has ever used sets them. Two lines rather than one
                    joined by a dot: at 208px a "title · artist" run
                    truncates mid-name and the artist is the half that
                    survives, which is backwards — you are looking for the
                    song.

                    The vertical rhythm, tightest first: 2px between the
                    two lines (one unit), 8px from the card down to them
                    (a caption belonging to the picture above), 20px to the
                    next row (a different song). Each step is more than
                    double the last, which is what lets the eye group them
                    without a rule or a box drawn to say so.

                    Both lines carry explicit leading. Left inherited they
                    took the base 1.5, which is a reading line-height meant
                    for paragraphs — on a two-line label it opened a gap
                    between name and artist wider than the gap separating
                    them from the card.
                  */}
                  {/*
                    The caption is a row now: name and artist on the left,
                    the two things you can do to a song on the right. They
                    sit level with the pair of text lines rather than under
                    them, so the row stays two lines tall and the grid's
                    vertical rhythm is the one described above.
                  */}
                  <div
                    className="mt-2 flex items-center gap-2 px-0.5"
                    title={`${song.title} — ${song.author}`}
                  >
                    {/* min-w-0: without it the flex item refuses to shrink
                        below its text's width and `truncate` never fires —
                        a long title would push the buttons off the card. */}
                    <div className="min-w-0 flex-1">
                      {/* Ink, not the accent: gold is the colour of the one
                          act that reaches the congregation, and sixteen gold
                          titles would spend it on nothing. Live is the one
                          that goes gold. */}
                      <p
                        className={cx(
                          /* The caption step carrying weight, not the base
                             step: that one scales with density and reached
                             14px on a wide window, which put a heading under
                             a 117px picture. */
                          'flex min-w-0 items-center gap-1.5 text-[length:var(--tri-size-sm)] font-semibold leading-[1.25] transition-colors',
                          live
                            ? 'text-[var(--tri-accent-yellow)]'
                            : 'text-[rgb(229_243_242_/_0.86)] group-hover/card:text-[var(--tri-ink)]',
                        )}
                      >
                        <span className="truncate">{song.title}</span>
                      </p>
                      {/* Quiet by a wide margin. The artist settles ties
                          between two songs of the same name; it is never
                          what the eye should land on first. */}
                      <p className="mt-[2px] flex min-w-0 items-center gap-1.5 text-[length:var(--tri-size-xs)] leading-[1.3] text-[rgb(229_243_242_/_0.42)]">
                        {/* Unsaved editor work is waiting on this song. Gold
                            dot and a word, the same mark "in use" makes on a
                            background — and never hidden on hover, because
                            it is a fact about the song, not an action. */}
                        {draftIds && song.id in draftIds ? (
                          <span className="flex shrink-0 items-center gap-1 lowercase text-[var(--tri-accent-yellow)]">
                            <span aria-hidden className="h-[5px] w-[5px] rounded-full bg-[var(--tri-accent-yellow)]" />
                            {isNewId(song.id) ? 'unsaved' : 'draft'}
                          </span>
                        ) : null}
                        <span className="truncate">{song.author}</span>
                      </p>
                    </div>

                    {/*
                      Edit and delete, as a pair of equal squares — the
                      system's surface at control shape, sized from the
                      side rather than padded from a label, because an icon
                      has no text to set the width. Teal then red: the two
                      tones already mean "an action" and "a destructive
                      one", so the colour says which is which before the
                      glyph does.

                      stopPropagation on both: the whole cell opens the song
                      (see the wrapper's onClick), and a click on either of
                      these is not that.
                    */}
                    {/* Hidden at rest; the card's hover or keyboard focus
                        brings them in. Rounded squares — the control corner
                        — like every other icon button in the app. */}
                    <div
                      className="song-card-actions flex shrink-0 items-center gap-1.5"
                      /* The cell is a drag source and captures the pointer on
                         pointerdown; a captured pointer's click is delivered
                         to the CELL, so without this a real mouse press on
                         edit or delete opened the song instead. (The pager
                         arrows in SlideThumb do the same, for the same
                         reason.) */
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        title={`edit ${song.title}`}
                        aria-label={`edit ${song.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          /* The picture is what lifts off, not the caption. */
                          const cell = e.currentTarget.closest<HTMLElement>('.song-card');
                          const origin = cell?.querySelector<HTMLElement>('[data-row]') ?? cell ?? null;
                          if (onEdit) onEdit(song, origin);
                          else onOpen(song.id);
                        }}
                        className={cx(
                          surface({ shape: 'control', interactive: true }),
                          toneClass(),
                          'grid size-7 place-items-center',
                        )}
                      >
                        <PencilIcon size={12} />
                      </button>
                      <button
                        type="button"
                        title={`delete ${song.title}`}
                        aria-label={`delete ${song.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(song.id);
                        }}
                        className={cx(
                          surface({ tone: 'danger', shape: 'control', interactive: true }),
                          toneClass('danger'),
                          'grid size-7 place-items-center',
                        )}
                      >
                        <TrashIcon size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </LibraryPane>
    </LibraryBrowser>
  );
}

/*
 * A song, opened — its words, top to bottom.
 *
 * The one thing the operator is doing here is finding a section and putting
 * it up, so a section is a ROW and the row is the button. No thumbnails: the
 * congregation's view of a chorus tells you nothing you need in order to
 * pick it, and at the size a grid of them fits, the words stop being
 * readable anyway. Set the words plainly and large enough to scan, and the
 * shape of the stanza does the recognising.
 *
 * Clicking a section puts it on the projector — one click, no preview step.
 * That is a deliberate exception to the rule the verse list keeps, and it is
 * earned by the drilling-in: you opened this song, and picking a chorus
 * inside a song you opened is not a gesture anyone makes by accident. The
 * verse list has no such door, which is why it still asks twice.
 */
function SongSheet({ song, onBack }: { song: Song; onBack: () => void }) {
  const drag = useDrag();
  const projector = useProjector();
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();
  /* Labels as well as lines — "chorus" is a search, and the commonest one. */
  const shown = useMemo(
    () =>
      song.verses.filter(
        (v) =>
          needle === '' ||
          v.label.toLowerCase().includes(needle) ||
          v.lines.join(' ').toLowerCase().includes(needle),
      ),
    [song, needle],
  );

  const send = (v: SongVerse) =>
    projector.send({
      source: 'song',
      id: sectionId(song, v),
      label: `${song.title} — ${v.label}`,
      title: song.title,
      section: v.label,
      lines: v.lines,
    });

  /*
   * Where the song is, measured against the WHOLE song rather than the
   * filtered view. A search that hides the live section must not make the
   * play button think the song stopped — the projector did not change
   * because the operator typed.
   */
  const at = song.verses.findIndex((v) => projector.isLive('song', sectionId(song, v)));
  const last = at === song.verses.length - 1;
  /* Three states, one button. Nothing up yet, so start at the top; something
     up with more to come, so advance; the end, so offer the top again. A
     button that greys out at the last verse is a dead control on the one
     surface that has to keep working while a room is singing. */
  const play = at < 0 ? 0 : last ? 0 : at + 1;
  const playLabel = at < 0 ? 'play' : last ? 'from the top' : 'next';

  return (
    <LibraryBrowser
      framed
      search={
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={`find a line in ${song.title.toLowerCase()}...`}
        />
      }
    >
      <LibraryPane
        scroll={false}
        /* The way back is the title itself, chevron and all, rather than a
           button parked somewhere else on the screen: the header already
           says which song you are in, and the thing that says where you are
           is the natural thing to press to leave. */
        title={
          <button
            type="button"
            onClick={onBack}
            title="back to the song library"
            className="group/back -ml-1 flex min-w-0 items-center gap-2 rounded px-1 text-left uppercase tracking-[0.18em] transition-colors hover:text-[var(--tri-ink)]"
          >
            <ChevronDownIcon size={11} className="shrink-0 rotate-90" />
            <span className="truncate text-[var(--tri-ink)]">{song.title}</span>
            <span className="truncate font-normal tracking-[0.14em] text-[rgb(229_243_242_/_0.38)]">
              {song.author}
            </span>
          </button>
        }
        footer={
          /*
            The foot says where the song is and offers the next move, in that
            order — read the state, then act on it. The position is words
            rather than a bar: "chorus · 2 of 5" is what a person leading
            singing would say out loud, and a progress bar for a five-item
            list is decoration.
          */
          <div className="flex items-center gap-[var(--tri-gap)] px-2 pb-1">
            <span className="min-w-0 flex-1 truncate text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.42)]">
              {at < 0
                ? `${song.verses.length} sections — nothing up yet`
                : `${song.verses[at].label.toLowerCase()} · ${at + 1} of ${song.verses.length}`}
            </span>
            {/* The same gold act the proposal card wears, for the same
                reason: this is the control that reaches the congregation,
                and there is exactly one of them per surface. */}
            <button
              type="button"
              onClick={() => send(song.verses[play])}
              title={`put ${song.verses[play].label.toLowerCase()} on the projector`}
              className={cx(
                surface({ tone: 'gold', shape: 'control', interactive: true }),
                'tri-label flex min-h-[var(--tri-control-h)] shrink-0 items-center gap-[6px]',
                'whitespace-nowrap lowercase px-[var(--tri-control-pad-x)]',
                'text-[rgb(228_216_122_/_0.95)]',
              )}
              style={{ borderRadius: 8 }}
            >
              <PlayIcon size={11} />
              {playLabel}
            </button>
          </div>
        }
      >
        {shown.length === 0 ? (
          <div className="flex h-full items-center justify-center px-5">
            <p className="text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.38)]">
              no line in this song matches
            </p>
          </div>
        ) : (
          <FadeScroller
            className="h-full"
            /* A gap between rows rather than a rule: the rows are cards you
               press, and a list of pressable things separated by hairlines
               reads as a table where the lines are structure rather than as
               a stack of targets. */
            contentClassName="flex flex-col gap-1 px-4 py-3"
          >
            {shown.map((v) => {
              const live = projector.isLive('song', sectionId(song, v));
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => send(v)}
                  {...drag.bind(() => ({
                    source: 'song',
                    label: `${song.title} — ${v.label}`,
                    title: song.title,
                    section: v.label,
                    lines: v.lines,
                    songId: song.id,
                  }))}
                  title={`put ${v.label.toLowerCase()} on the projector`}
                  className={cx(
                    'group/sec tri-rounded-control flex flex-col items-start gap-1.5 px-3 py-2.5 text-left transition-colors',
                    live
                      ? 'bg-[rgb(228_216_122_/_0.09)]'
                      : 'hover:bg-[rgb(255_255_255_/_0.035)]',
                  )}
                  style={
                    live
                      ? { boxShadow: 'inset 0 0 0 var(--tri-border) rgb(228 216 122 / 0.32)' }
                      : undefined
                  }
                >
                  {/* Label and, when it is up, the word for what up means.
                      "live" rather than a dot: the operator is reading this
                      list to find out what the room is singing, and a
                      coloured dot is a thing you have to have been taught. */}
                  <span className="flex w-full items-baseline gap-2">
                    <span
                      className={cx(
                        'text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em] transition-colors',
                        live
                          ? 'text-[var(--tri-accent-yellow)]'
                          : 'text-[rgb(229_243_242_/_0.42)] group-hover/sec:text-[rgb(229_243_242_/_0.62)]',
                      )}
                    >
                      {v.label}
                    </span>
                    {live && (
                      <span className="ml-auto text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em] text-[var(--tri-accent-yellow)]">
                        live
                      </span>
                    )}
                  </span>
                  {/*
                    The words, in the face the projector would set them in.
                    A song section is read here the way it is read on the
                    wall — that is the whole point of showing the words
                    instead of a thumbnail — so the family follows the
                    slide, and only the size does not.

                    One line per line, never wrapped into a paragraph: the
                    line breaks ARE the song, and a stanza reflowed into
                    prose is not a shape anybody recognises.
                  */}
                  <span
                    className={cx(
                      'flex flex-col gap-[2px]',
                      live ? 'text-[var(--tri-ink)]' : 'text-[rgb(229_243_242_/_0.78)]',
                    )}
                    style={{
                      fontFamily: 'var(--font-scripture)',
                      fontWeight: 'var(--font-scripture-weight)' as never,
                      fontSize: 14,
                      lineHeight: 1.4,
                    }}
                  >
                    {v.lines.map((line, n) => (
                      <span key={n}>{line}</span>
                    ))}
                  </span>
                </button>
              );
            })}
          </FadeScroller>
        )}
      </LibraryPane>
    </LibraryBrowser>
  );
}

/*
 * What a segment's own "+" offers, in the menu flow.
 *
 * Songs are the real library; scriptures are a short stub, because finding
 * a verse means the reference builder and that does not fit in a 200px
 * menu — which is itself one of the things this flow is here to show.
 */
const SAMPLE_REFS = ['John 3:16', 'Psalm 23:1', 'Romans 8:28', 'Isaiah 40:31'];

function segmentAddMenu(): ActionMenuGroup[] {
  return [
    {
      items: [
        { id: 'note', label: 'add note', icon: <NoteIcon size={14} />, accent: true },
        {
          id: 'song',
          label: 'add song',
          icon: <MediaIcon size={13} />,
          items: SONGS.map((s) => ({ id: `song:${s.title}`, label: s.title })),
        },
        {
          id: 'scripture',
          label: 'add scripture',
          icon: <SearchIcon size={13} />,
          items: SAMPLE_REFS.map((r) => ({ id: `scripture:${r}`, label: r })),
        },
      ],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Detected scripture — the engine's proposal card                     */
/* ------------------------------------------------------------------ */

/*
 * The one moment the whole product exists for: the engine heard a reference
 * mid-sermon and is asking permission. Everything on the card is tuned to
 * that half-second of judgement:
 *
 *   - It ARRIVES — rises in on the system ease, because a proposal that
 *     blinks into place reads as having always been there, and this one is
 *     news. The mint dot pulses while the card stands: the engine is still
 *     listening, this is live goods, not a leftover.
 *   - Scripture is set in scripture's face, both lines of it: reference
 *     large, verse small, one serif family carrying both. Sans is for
 *     chrome only. The verse is there so the operator can hear the echo —
 *     two whole-word lines, never a mid-word ellipsis.
 *   - The trust meter is on the card. How sure the engine is IS the
 *     product (the per-preacher trust that one day earns auto mode), so it
 *     rides every proposal as a quiet mint line, not a hidden number.
 *   - One gold act. "live" is the only thing here that touches the
 *     congregation, so it is the full-width floor of the card and the only
 *     word on it; dismissal is a small square that could never be pressed
 *     by mistake for it.
 *   - It sits on a picture. The card is a proposal for what the screen is
 *     about to show, so it is drawn on the same dark photograph the
 *     projector would put behind the verse — dimmed harder than a slide
 *     thumb, because there is a paragraph of small serif on it and a
 *     meter, not three lines of bold. The indigo surface stays underneath
 *     as the card's edge and fallback.
 *
 * Static specimen — the engine feeds the real one, and `trust` with it.
 */
interface Heard {
  id: string;
  ref: string;
  version: string;
  text: string;
  /** The engine's confidence, or null when it did not give one. */
  trust: number | null;
  /** Which backdrop the projector would put behind it. */
  backdrop: number;
  /** Pre-sliced, when this came from the engine rather than the seed. */
  slides?: VerseSlide[];
  verses?: { verse: number; text: string }[];
  /** The database has no such verse — shown so the operator knows what was
      heard, but it can only be dismissed. */
  missing?: boolean;
}

/*
 * Three catches from one stretch of preaching — the realistic case, and the
 * reason this is a list and not an object.
 *
 * A preacher builds to John 3:16 through Romans and Ephesians and says all
 * three inside a minute; the panel that held one proposal had no answer for
 * the second. Trust FALLS down the stack rather than tracking recency: the
 * newest catch is not automatically the surest one, which is the whole
 * reason the operator is still in the loop and the meter is on every card
 * rather than on the top one.
 *
 * Each carries its own backdrop, so the three read as three different slides
 * waiting rather than as one card drawn three times.
 *
 * Static specimen — the engine feeds the real ones, and `trust` with them.
 */
const CATCHES: Heard[] = [
  {
    id: 'jn',
    ref: 'John 3:16',
    version: 'kjv',
    trust: 0.84,
    backdrop: 5,
    text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
  },
  {
    id: 'ro',
    ref: 'Romans 8:28',
    version: 'kjv',
    trust: 0.71,
    backdrop: 2,
    text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.',
  },
  {
    id: 'ep',
    ref: 'Ephesians 2:8',
    version: 'kjv',
    trust: 0.62,
    backdrop: 8,
    text: 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God.',
  },
];

/* The surface already owns its colour and press transitions. Width is added
   locally for the intent-responsive dismiss control. */
const SURFACE_TRANSITION = [
  '--tri-a-mid var(--tri-dur-state) var(--tri-ease-out)',
  '--tri-a-edge var(--tri-dur-state-trail) var(--tri-ease-soft) var(--tri-delay-trail)',
  'color var(--tri-dur-state) var(--tri-ease-out)',
  'transform var(--tri-dur-press) var(--tri-ease-out)',
].join(', ');

/*
 * The arrival, hoisted out of the card.
 *
 * Three cards rendering the same @keyframes block three times is three
 * copies of one rule in the document for no gain — the stack mounts this
 * once and every card animates off it.
 *
 * The pulse that used to live here went with the dot it drove. Nothing on
 * the card pulses now; the engine's heartbeat is the status orb's job, one
 * per screen rather than one per proposal.
 */
function HeardMotion() {
  return (
    <style>{`
      @keyframes tri-heard-in {
        from { opacity: 0; transform: translateY(7px) scale(0.985); }
        to   { opacity: 1; transform: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        @keyframes tri-heard-in { from { opacity: 0; transform: none; } to { opacity: 1; } }
      }
    `}</style>
  );
}

/*
 * `index` is only for the arrival: the cards rise in one after another
 * rather than all at once, so the stack reads as an order — this was heard,
 * then this — instead of as a block that appeared. 60ms is under the
 * threshold where a stagger starts feeling like a queue to wait through.
 */
function DetectedScripture({
  heard,
  index = 0,
  onSelect,
  onLive,
  onDismiss,
}: {
  heard: Heard;
  index?: number;
  onSelect?: () => void;
  /** Put it up. Absent on a specimen, which is what makes the card inert. */
  onLive?: () => void;
  onDismiss?: () => void;
}) {
  const dismiss = useForesight<HTMLButtonElement>('dismiss the proposal', {
    top: 22,
    bottom: 22,
    left: 28,
    right: 4,
  });
  const [dismissHover, setDismissHover] = useState(false);
  const dismissWide = dismiss.predicted || dismissHover;

  return (
    <div
      onClick={onSelect}
      className={cx(
        surface({ tone: 'indigo', shape: 'panel', wide: true }),
        'relative isolate shrink-0 overflow-hidden p-3 cursor-pointer transition-all hover:ring-1 hover:ring-white/20',
      )}
      onMouseLeave={dismiss.relax}
      style={{
        borderRadius: 12,
        animation: 'tri-heard-in 240ms var(--tri-ease-out) both',
        animationDelay: `${index * 60}ms`,
        /* A reference that is not in the Bible is information, not an
           offer: it sits back, and the only thing it can do is go away. */
        opacity: heard.missing ? 0.45 : undefined,
      }}
    >
      {/* The picture and its dim, behind everything (-z-10 inside the
          isolate). Stacked with the darker band at the foot, where the
          gold act sits and the small text ends. The hairline rides the dim
          rather than the surface: a negative-z child paints over its
          parent's inset stroke, so the surface's own edge is under the
          picture, and the card needs one it can see. */}
      <img
        aria-hidden
        src={slideBackdrop(heard.backdrop, BACKDROP_BY_CONTENT.scripture)}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(to top, rgb(0 0 0 / 0.58) 0%, rgb(0 0 0 / 0.34) 55%, rgb(0 0 0 / 0.26) 100%)',
          boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.12)',
          borderRadius: 12,
        }}
      />

      <div className="flex items-baseline gap-1.5">
        {/*
          The eyebrow is a figure and a version, and nothing else.

          The word "heard" went first: every card in this panel is something
          the engine heard, so labelling each one said it three times and
          told the operator nothing they could act on. The pulsing dot went
          with it — it was the last of that label, and once the word beside
          it was gone it read as a bullet for the percentage rather than as
          the engine still listening. That the engine is listening belongs to
          the status orb on the bar, which says it once for the whole screen.

          "confidence", not "sure": this is the per-preacher trust figure
          the product is built on, and it goes in the operator's notes and
          the settings copy under that name. A card that calls it something
          friendlier makes them two different numbers.

          And it is INK, not mint. Mint is the engine's colour on this
          screen — the meter, the live states — so a mint number read as a
          verdict the engine had reached. It is a measurement. The meter
          below is where the engine gets to speak in its own colour; up here
          the figure is just the figure.
        */}
        {/* A confidence the engine did not give is left blank rather than
            drawn as 0%. The trust meter is the product's own promise and an
            invented figure on it is worse than an absent one. */}
        {heard.trust != null && (
          <span
            className="text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.14em] tabular-nums text-[rgb(229_243_242_/_0.72)]"
            title="how sure the engine is about this catch"
          >
            {Math.round(heard.trust * 100)}%
            <span className="ml-1 font-normal text-[rgb(229_243_242_/_0.4)]">confidence</span>
          </span>
        )}
        <span className="ml-auto text-[length:var(--tri-size-eyebrow)] uppercase tracking-[0.14em] text-[rgb(229_243_242_/_0.35)]">
          {heard.version}
        </span>
      </div>

      <p
        className="mt-1.5 text-[var(--tri-ink)]"
        style={{
          fontFamily: 'var(--font-scripture)',
          fontWeight: 'var(--font-scripture-weight)' as never,
          fontSize: 17,
          lineHeight: 1.25,
        }}
      >
        {heard.ref}
      </p>

      <p
        className="mt-1 overflow-hidden text-[rgb(229_243_242_/_0.6)]"
        style={{
          fontFamily: 'var(--font-scripture)',
          fontWeight: 'var(--font-scripture-weight)' as never,
          fontSize: 12,
          lineHeight: 1.55,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {heard.text}
      </p>

      {/* The trust meter, riding the proposal it justifies. Gone entirely
          when there is no figure — a meter drawn empty reads as no
          confidence rather than as no measurement. */}
      {heard.trust != null && (
        <div
          className="mt-2.5 flex items-center gap-1.5"
          title="how sure the engine is about this catch — the per-preacher trust meter"
        >
          <span className="h-[2px] min-w-0 flex-1 overflow-hidden rounded-full bg-[rgb(255_255_255_/_0.08)]">
            <span
              className="block h-full rounded-full bg-[rgb(143_211_192_/_0.55)]"
              style={{ width: `${heard.trust * 100}%` }}
            />
          </span>
        </div>
      )}

      {/*
        Two acts on one line, and neither is dressed in anything the system
        does not already own: both are tri-surface — the same linear
        gradient, stroke, hover ramp and press every control on this screen
        wears — ash for the refusal, gold for the one thing here that
        reaches the congregation. No raised fill, no glow. Gold IS the
        emphasis; adding light on top of it was saying the same thing
        twice, and it made the card's floor look like a different material
        from the rest of the app.

        What separates them is size, not decoration: go-live takes the
        control height and the label size the normal button takes, the ✕ is
        a 28px square beside it.

      */}
      <div className="mt-2 flex items-stretch gap-[var(--tri-gap)]">
        <button
          ref={dismiss.ref}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss?.();
          }}
          title="dismiss — the engine misheard"
          onMouseEnter={() => setDismissHover(true)}
          onMouseLeave={() => setDismissHover(false)}
          className={cx(
            surface({ tone: 'ash', interactive: true }),
            'flex shrink-0 items-center justify-center',
            dismissWide ? 'text-[var(--tri-ink)]' : 'text-[rgb(229_243_242_/_0.5)]',
          )}
          style={{
            borderRadius: 8,
            width: dismissWide ? 46 : 28,
            transition: `width 200ms var(--tri-ease-out), ${SURFACE_TRANSITION}`,
          }}
        >
          <PlusIcon size={12} className="rotate-45" />
        </button>
        {heard.missing ? (
          <span className="flex min-w-0 flex-1 items-center text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.45)]">
            not in the bible — nothing to show
          </span>
        ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLive?.();
          }}
          title="put it on the projector — enter does the same"
          onMouseEnter={dismiss.relax}
          className={cx(
            surface({ tone: 'gold', shape: 'control', interactive: true }),
            'tri-label flex min-h-[var(--tri-control-h)] min-w-0 flex-1',
            'items-center justify-center whitespace-nowrap lowercase',
            'px-[var(--tri-control-pad-x)] text-[rgb(228_216_122_/_0.95)]',
          )}
          style={{ borderRadius: 8 }}
        >
          {/* One word, and no keycap beside it.

              The ↵ was drawn as a hint that enter does the same thing, but
              on a stack of three proposals it is a claim the screen cannot
              keep: enter puts up ONE of them, and a return key printed on
              all three says each is the one it would reach. A hint that is
              wrong two times in three is worse than no hint — the title
              still carries it for the card the keyboard is actually on. */}
          live
        </button>
        )}
      </div>
    </div>
  );
}

/*
 * What the preacher is saying, while there is nothing to answer.
 *
 * The rail is empty most of a sermon, and an empty box beside an open
 * microphone gives the operator no way to tell "nothing caught" from
 * "nothing heard". So the quiet state is the sermon itself, set the way a
 * lyrics view sets a song: the sentence being spoken is at full strength in
 * the middle, the ones before it climb and fade above it.
 *
 * The line being spoken is the recogniser's partial and is replaced as it
 * grows; when the recogniser closes the sentence it arrives punctuated and
 * takes its place in the stack, which is the moment everything moves up one.
 * Keyed by id so React moves the existing lines rather than redrawing them —
 * that is what makes the climb an animation and not a flicker.
 */
/*
 * What the engine has heard and nobody has answered yet.
 *
 * Real catches when there is an engine, the three seeds when there is not.
 * The fallback is not laziness: this screen is also a design sheet, opened
 * in a browser tab with nothing behind it, and a rail that renders empty
 * there stops being reviewable. `caps.bridge` is the honest test — with a
 * bridge and no proposals the rail says so, which is the true state of a
 * quiet room and should look different from a dead window.
 *
 * A proposal is HELD here rather than staged into the preview box. The
 * engine's guess must not overwrite a verse the operator picked by hand
 * mid-sentence; that is the behaviour that makes an operator switch the
 * whole feature off. Answering it is a press.
 */
function ProposalStack() {
  const engine = useEngine();
  const projector = useProjector();
  const live = engine.caps.bridge;

  const cards: Heard[] = live
    ? engine.proposals.map((p, i) => ({
        id: p.id,
        ref: p.reference,
        version: p.version,
        text: p.text,
        trust: p.trust,
        /* The seeds carry a hand-picked backdrop each; a real catch has no
           opinion, so it takes one off its position in the stack — stable
           for as long as the card stands, and different from its
           neighbours, which is all the backdrop is doing here. */
        backdrop: 2 + i * 3,
        slides: p.slides,
        verses: p.verses,
        missing: p.missing,
      }))
    : CATCHES;

  if (live && cards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <p className="text-center text-[length:var(--tri-size-xs)] lowercase leading-[1.6] text-[rgb(229_243_242_/_0.32)]">
          {engine.asr === 'listening'
            ? 'listening — nothing caught yet'
            : 'start listening and catches land here'}
        </p>
      </div>
    );
  }

  return (
    <FadeScroller className="h-full" contentClassName="flex flex-col gap-[var(--tri-gap)]">
      {cards.map((c, i) => {
        const handleActivate = () => {
          if (c.missing) return;
          const slides: VerseSlide[] = c.slides && c.slides.length > 0
            ? c.slides
            : [{
                reference: c.ref,
                lines: [{ version: c.version, text: c.text }],
                verseStart: 1,
                verseEnd: 1,
                index: 1,
                total: 1,
              }];
          const item: LiveItem = {
            source: 'scripture',
            id: c.ref,
            label: c.ref,
            reference: c.ref,
            version: c.version,
            text: c.text,
            slides,
            verses: c.verses ?? [{ verse: 1, text: c.text }],
            origin: 'engine',
          };
          projector.stage(item);
          projector.send(item);
          if (live) {
            engine.pushEnginePreview();
            if (c.ref) engine.pushReference(c.ref);
            engine.dismissProposal(c.id);
          }
          if (window.api?.pushToLive) {
            window.api.pushToLive();
          }
        };

        return (
          <DetectedScripture
            key={c.id}
            heard={c}
            index={i}
            onSelect={!c.missing ? handleActivate : undefined}
            onLive={!c.missing ? handleActivate : undefined}
            onDismiss={live ? () => engine.dismissProposal(c.id) : undefined}
          />
        );
      })}
    </FadeScroller>
  );
}

/** The + on every segment — gold, the accent as a surface: adding to the
    run is the one thing a card invites you to do, so its control carries
    the look-here tone while everything around it rests. */
function SegmentAdd({ seg, size = 22 }: { seg: RunSegment; size?: number }) {
  const run = useRun();
  return (
    <ActionMenu
      groups={segmentAddMenu()}
      onSelect={(item) => {
        if (item.id === 'note') {
          /* Empty on purpose — the row is the editor, so the note starts as
             a blank line waiting for the words, not as the word "note". */
          run.queue(seg.key, { source: 'note', label: '' });
          return;
        }
        const [source, label] = item.id.split(/:(.*)/s);
        run.queue(seg.key, {
          source: source === 'song' ? 'song' : 'scripture',
          label: label ?? item.label,
        });
      }}
      trigger={
        <button
          type="button"
          title={`add to ${seg.label}`}
          className={cx(
            surface({ tone: 'gold', interactive: true }),
            'flex shrink-0 items-center justify-center text-[rgb(228_216_122_/_0.92)]',
          )}
          style={{ width: size, height: size, borderRadius: 8 }}
        >
          <PlusIcon size={11} />
        </button>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* The status orb — the app's state, as motion                         */
/* ------------------------------------------------------------------ */

/*
 * One orb style per state, and the style MEANS the state: a probe going
 * out and back is connecting, a rippling surface is listening, a snap and
 * recoil is a correction.
 *
 * Colour is a traffic light and it lives on the ACCENT dots only — the
 * sphere itself stays ink. Red: not connected (nothing is listening, or
 * something is broken). Orange: connecting, or connected with the output
 * held. Green: connected and working. The body of the orb is not coloured
 * because a whole red sphere is an alarm, and a red thread through an ink
 * sphere is a status — the bar wants the second.
 *
 * Idle is a STILL sphere. An orb that moves when nothing is happening is
 * lying, and the whole point of putting it in the bar is that a glance at
 * it is worth something. Frozen stops the clock wherever it was.
 */
interface OrbLook {
  style: string;
  /** The accent dots' colour — the only colour the state gets. */
  accent: string;
  /** 0 holds the orb exactly where it is. */
  speed: number;
  opacity: number;
}

const INK = '#e5f3f2';
const RED = '#ef5350';    // not connected
const ORANGE = '#ffa726'; // connecting, or held
const GREEN = '#66bb6a';  // connected

const ORB_BY_STATE: Record<string, OrbLook> = {
  'idle':          { style: 'nest',       accent: RED,    speed: 0,    opacity: 0.45 },
  'connecting':    { style: 'ping',       accent: ORANGE, speed: 1,    opacity: 0.8 },
  'listening':     { style: 'noise',      accent: GREEN,  speed: 1,    opacity: 0.9 },
  /* gyro, not spot: a roaming light on a dark sphere is invisible at 28px.
     A gimbal lining up a core is "held up for inspection" and reads. */
  'in preview':    { style: 'gyro',       accent: GREEN,  speed: 1,    opacity: 0.9 },
  'live':          { style: 'nested',     accent: GREEN,  speed: 1,    opacity: 1 },
  'auto live':     { style: 'chase',      accent: GREEN,  speed: 1.3,  opacity: 1 },
  'correction':    { style: 'ratchet',    accent: GREEN,  speed: 1,    opacity: 0.9 },
  'prayer mode':   { style: 'tide',       accent: GREEN,  speed: 0.55, opacity: 0.6 },
  'practice mode': { style: 'nested',     accent: GREEN,  speed: 1,    opacity: 0.85 },
  'output frozen': { style: 'nested',     accent: ORANGE, speed: 0,    opacity: 0.55 },
  'media / QR':    { style: 'grid',       accent: GREEN,  speed: 1,    opacity: 0.9 },
  'engine error':  { style: 'bounce',     accent: RED,    speed: 1,    opacity: 1 },
  'no display':    { style: 'terminator', accent: RED,    speed: 0.8,  opacity: 0.7 },
  'no mic signal': { style: 'sag',        accent: RED,    speed: 0.8,  opacity: 0.7 },
};

const STATE_LABELS = LIVE_STATES.map((s) => s.label);

/**
 * The orb in the context bar, gear-sized. `label` is one of the fourteen
 * state labels; anything else reads as idle, which is the honest default.
 */
function StatusOrb({ label, onClick }: { label: string; onClick?: () => void }) {
  const look = ORB_BY_STATE[label] ?? ORB_BY_STATE.idle;
  const [named, setNamed] = useState(false);
  return (
    <div className="relative flex aspect-square h-full shrink-0">
      <button
        type="button"
        onClick={onClick}
        onPointerEnter={() => setNamed(true)}
        onPointerLeave={() => setNamed(false)}
        onFocus={() => setNamed(true)}
        onBlur={() => setNamed(false)}
        aria-label={`engine: ${label} — change state`}
        className="tri-rounded-control flex h-full w-full items-center justify-center"
        style={EDGE}
      >
        {/* No pill, no label. The ball fills its 46px square with a 4px
            margin. `dots` is a MULTIPLIER on the style's own count (150 ×
            0.6 = 90), not a count — the full 150 is mush at this size and
            64× was a solid disc. The verb is the bar's job, not the orb's. */}
        <ThinkingOrbsPill
          style={look.style}
          dotColor={INK}
          accent={look.accent}
          speed={look.speed}
          dotOpacity={look.opacity}
          showsPill={false}
          showsLabel={false}
          ball={38}
          dots={0.6}
          scheme="dark"
        />
      </button>
      {/*
        The state's NAME, on demand only.

        It used to sit in the bar as a permanent chip — "state · prayer
        mode ›" — and that chip was paying full rent on the widest strip
        of the screen for a word the operator already knows. The orb is
        the thing they look at for status; asking it is a hover, changing
        it is a click, and the bar it vacated now carries the log, which
        is the one thing in this row that actually changes on its own.
      */}
      <span
        role="status"
        className={cx(
          'tri-rounded-control pointer-events-none absolute left-0 top-[calc(100%+4px)] z-30',
          'whitespace-nowrap px-2 py-1 text-[length:var(--tri-size-xs)] lowercase',
          'text-[var(--tri-ink)] transition-opacity duration-150',
          named ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          background: 'rgb(14 18 18 / 0.96)',
          boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.12)',
        }}
      >
        {label}
      </span>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* The service log                                                     */
/* ------------------------------------------------------------------ */

/**
 * The bar's whole job now: what the service is doing, three lines at a
 * time, newest rising in from underneath.
 *
 * Two rules hold the writing together, and both are about the person
 * reading it — a volunteer on a Sunday, not an engineer.
 *
 *   1. Say the thing that happened, in their words. Not "ASR confidence
 *      0.42" but "struggling with this preacher's accent". Not "OCR
 *      failed" but "couldn't read that image". A log nobody can read is
 *      a log nobody reads.
 *
 *   2. If they can do something about it, say what. Every line that
 *      reports the engine losing its footing carries the same way out —
 *      turn the suggestions off and drive it yourself — and that action
 *      rides on the line as its own row, so it cannot be missed and
 *      cannot be mistaken for part of the sentence.
 */
/** How many lines the log remembers. ~3 hours at one line every half minute. */
const LOG_HISTORY = 400;

interface LogSeed {
  text: string;
  /** The way out, when there is one. Rendered as its own row beneath. */
  action?: { label: string };
}

interface LogEntry extends LogSeed {
  id: number;
  /** When it was said — the history column shows it. */
  at: number;
  /** Dealt once, when the line is said, and never re-dealt after. */
}

/* One way out, worded once. Every confidence failure ends here: the
   engine has stopped being worth trusting, so stop trusting it. */
const SWITCH_TO_MANUAL = { label: 'switch to manual' } as const;

/**
 * What each state says the moment the engine enters it. Not every state
 * speaks — 'listening' after 'connecting' is worth a line, but a state
 * the operator caused themselves does not need the log to confirm it.
 */
const LOG_BY_STATE: Record<string, LogSeed> = {
  'idle': { text: 'service open — not listening yet' },
  'connecting': { text: 'connecting to the speech engine' },
  'listening': { text: 'listening' },
  /* No line for 'in preview', 'live', 'auto live' or 'correction'. The
     scripture flow already has the whole screen saying it — the preview
     panel, the stage, the rail. A log that repeats what the operator is
     looking at is noise sitting where a warning should be. */
  'prayer mode': { text: 'screen held for prayer — nothing will advance' },
  'practice mode': { text: 'practice mode — the projector is untouched' },
  'output frozen': { text: 'output frozen on the last slide' },
  'media / QR': { text: 'showing the code for the web companion' },
  'engine error': {
    text: 'the engine stopped hearing. the manual controls still work',
    action: SWITCH_TO_MANUAL,
  },
  'no display': { text: 'no projector attached — nothing is leaving this laptop' },
  'no mic signal': { text: 'no sound from the mic for 20 seconds' },
};

/**
 * The rest of the service — the things that happen without the state
 * changing at all. Reading, importing, the network, the trust meter.
 *
 * SANDBOX ONLY as a source: the real bar is fed by the engine. The list
 * itself is not sandbox-only — it is the vocabulary, and the engine will
 * speak from it.
 */
const LOG_ROUTINE: LogSeed[] = [
  { text: 'reading the text off that image' },
  { text: "couldn't read that image — type the reference in" },
  { text: 'importing sermon-notes.docx' },
  { text: 'imported 14 slides' },
  { text: 'network dropped — running on this laptop only' },
  { text: 'network back' },
  { text: 'speech model still downloading — 40%' },
  { text: 'speech model ready' },
  { text: 'projector connected' },
  { text: "struggling with this preacher's accent", action: SWITCH_TO_MANUAL },
  { text: 'no voice profile for this preacher yet', action: SWITCH_TO_MANUAL },
  { text: "the voice profile for pastor tunde isn't confident yet", action: SWITCH_TO_MANUAL },
  { text: 'the last two suggestions were wrong', action: SWITCH_TO_MANUAL },
];

/** Where the log starts, so the bar is never an empty box. */
const LOG_SEED: LogSeed[] = [
  { text: 'service opened — sunday first service' },
  { text: 'speech model ready' },
  { text: 'listening' },
];

/**
 * The log itself. Entries in, oldest dropped — only the last handful can
 * ever be on screen and nothing here is a record, so keeping more would
 * be keeping it for nobody.
 */
function useServiceLog(stateLabel: string) {
  const nextId = useRef(LOG_SEED.length);
  /* The seed lines are a specimen. With an engine behind the screen the log
     starts empty — "listening" printed above an idle microphone is the log
     lying before the service has begun. */
  const [entries, setEntries] = useState<LogEntry[]>(() =>
    typeof window !== 'undefined' && window.api
      ? []
      : LOG_SEED.map((seed, i) => ({ ...seed, id: i, at: Date.now() - (LOG_SEED.length - i) * 60_000 })),
  );

  const say = useCallback((seed: LogSeed) => {
    /* A whole service's worth. The bar only ever reads the tail, but the
       dashboard's history column shows all of it, and eight lines was a
       minute of a busy service. */
    setEntries((list) => [
      ...list.slice(-(LOG_HISTORY - 1)),
      { ...seed, id: nextId.current++, at: Date.now() },
    ]);
  }, []);

  /* A state change is an event like any other, so it speaks. Skipping the
     first run matters: mounting into 'listening' is not the engine
     starting to listen, it is the screen opening. */
  const spoken = useRef(stateLabel);
  useEffect(() => {
    if (spoken.current === stateLabel) return;
    spoken.current = stateLabel;
    const line = LOG_BY_STATE[stateLabel];
    if (line) say(line);
  }, [stateLabel, say]);

  /*
   * The engine speaking, when there is one.
   *
   * Voice commands and detections are the two things that happen during a
   * service without the operator doing anything, which is exactly what a
   * log is for — the record of what the room caused. With no bridge (a
   * plain browser tab, or the gallery) the routine below stands in so the
   * bar can still be watched moving.
   */
  const api = typeof window === 'undefined' ? undefined : window.api;
  useEffect(() => {
    if (!api) return;
    const off: (undefined | (() => void))[] = [];

    off.push(
      api.onVoiceCommand?.((cmd) => {
        /* The utterance, not the kind: the log is a record of what was
           said in the room, and "go back a verse" is legible where
           'nav-previous' is an implementation detail. */
        const what = cmd?.utterance?.trim() || cmd?.kind || 'a command';
        say({ text: `heard "${what}" from the pulpit` });
      }),
    );

    off.push(
      api.onVersePreview?.((d: { book?: string; chapter?: number; verse?: number | null; endVerse?: number | null }) => {
        if (!d?.book) return;
        const verse = d.verse == null ? '' : `:${d.verse}${d.endVerse && d.endVerse !== d.verse ? `-${d.endVerse}` : ''}`;
        say({ text: `caught ${d.book} ${d.chapter}${verse} — waiting for you` });
      }),
    );

    return () => off.forEach((fn) => fn?.());
  }, [api, say]);

  /* SANDBOX ONLY — with no engine behind it, the service talks to itself
     so the bar can be watched moving. It walks the list in order rather
     than picking at random: every line gets seen. */
  const cursor = useRef(0);
  useEffect(() => {
    if (api) return;
    const tick = setInterval(() => {
      say(LOG_ROUTINE[cursor.current % LOG_ROUTINE.length]);
      cursor.current += 1;
    }, 4200);
    return () => clearInterval(tick);
  }, [api, say]);

  return { entries, say };
}


/**
 * How many sentences of the sermon the context bar holds at once.
 *
 * Two, not three. The strip is a glance, not a reading surface — the owner
 * asked for the current sentence and the one that set it up, and nothing
 * more. The full log is a click away on the dashboard, which is exactly why
 * the pill now opens it.
 */
const TRANSCRIPT_ROWS = 2;

/*
 * The ladder, as numbers, indexed by distance from the newest line.
 *
 * One rung per row, so LADDER.length must track TRANSCRIPT_ROWS. At two
 * rows the older line is the only context there is, so it drops to 0.55
 * rather than the 0.25 a third row used to get — dimmed enough to be
 * plainly behind the current sentence, bright enough to still be read. See
 * .tri-transcript-line in tokens.css for how a row gets from one rung to
 * the next.
 */
const LADDER = [1, 0.55];

/*
 * A sentence Deepgram has not finished hearing is dimmer than one it has.
 *
 * It sits between the newest rung and the one below, which is the point:
 * the operator can tell at a glance that the bottom line may still change
 * its mind. When the line goes final the row is the SAME DOM node (see the
 * key below), so it brightens to 1 over the ladder duration instead of the
 * text jumping.
 */
const PARTIAL_ALPHA = 0.72;

/**
 * The preacher's speech in the top context bar — two sentences deep,
 * newest at the bottom, the older one dimming a rung as the next arrives.
 *
 * Replaces a single line that was thrown away the instant the next one
 * landed. The owner's complaint was exactly that: nobody can read one
 * sentence in the time it takes to say the next, so the strip showed text
 * that could not be used. Depth plus a ladder of opacity makes the bar
 * readable at a glance and gives the current sentence its context.
 *
 * The strip is a glance and nothing more, which is why the whole pill is a
 * button: the scrollable log of everything said lives on the dashboard, and
 * the natural thing to do when two lines are not enough is to reach for the
 * text itself. Clicking it goes there.
 *
 * Why the rows are built as a fixed-length array with the partial folded in
 * as the last entry: every row then knows its distance from the newest, and
 * that distance is the ONLY input to its opacity. When a sentence lands,
 * every row's distance goes up by one and CSS moves them all together —
 * there is no per-row state, no timer, and nothing to fall out of step.
 */
function HeaderKineticFocus({
  spoken,
  asr,
  onOpenDashboard,
}: {
  spoken: { lines: { id: number; text: string }[]; partial: string };
  asr: string;
  onOpenDashboard: () => void;
}) {
  const isLive = asr === 'listening';
  const hasRealSpeech = spoken.lines.length > 0 || Boolean(spoken.partial);

  /*
   * Newest last. The partial is appended as its own row rather than
   * replacing the newest final, because it IS the next sentence — showing
   * it in place of the last one would throw away the very context this
   * change exists to keep.
   *
   * Its key is one past the newest final's id, which is the id the engine
   * will hand the final when it commits it (spokenId is a plain counter —
   * see onTranscriptLine in engine.tsx). React therefore keeps the same
   * element across the settle, and the row transitions from provisional to
   * full strength rather than unmounting and flashing back in.
   */
  const rows = useMemo(() => {
    const settled = spoken.lines.map((l) => ({ ...l, partial: false }));
    if (spoken.partial) {
      const nextId = (spoken.lines[spoken.lines.length - 1]?.id ?? -1) + 1;
      settled.push({ id: nextId, text: spoken.partial, partial: true });
    }
    if (!hasRealSpeech) {
      /* Nothing has been heard yet. One placeholder, at the newest rung, so
         the strip says what it is for instead of reading as broken.
         Never sample scripture: an operator glancing at this strip mid-service
         must not be able to mistake filler for something the preacher said. */
      return [
        {
          id: -1,
          text: isLive ? 'listening for the pulpit…' : 'transcripts appear here',
          partial: true,
        },
      ];
    }
    return settled.slice(-TRANSCRIPT_ROWS);
  }, [spoken.lines, spoken.partial, hasRealSpeech, isLive]);

  const newestId = rows[rows.length - 1]?.id;

  return (
    <button
      type="button"
      onClick={onOpenDashboard}
      className={cx(
        '@container relative flex min-w-[64px] flex-1 cursor-pointer overflow-hidden rounded-[var(--tri-radius-control)]',
        'border border-white/10 bg-white/[0.04] pl-3 pr-2.5 backdrop-blur-md',
        /* The same neutral lift every other control on this strip uses when
           the pointer is over it. No colour: the only coloured thing in this
           pill is the live dot, and that means something. */
        'transition-colors hover:border-white/20 hover:bg-white/[0.08]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tri-accent-yellow)]',
      )}
      /* Two rows tall, and never shorter than the controls beside it —
         see --tri-topbar-live-h. Pinned rather than left to the content so
         a one-line transcript does not sit in a short pill that jumps taller
         on the second sentence. */
      style={{ height: 'var(--tri-topbar-live-h)', paddingBlock: '6px' }}
      title="live preacher transcript — click to open the dashboard, where the full transcript is"
      aria-label="Live preacher transcript. Opens the dashboard, where the full transcript is."
    >
      {/*
        The live dot is taken OUT of the text flow and parked in the corner.
        Inline it cost about 18px of every line, and at 1280 this strip is
        already the narrowest thing on the row — the owner's complaint was as
        much about lines being short as about there being one of them, and
        18px is a word. Top-right rather than top-left because the text is
        read left-to-right from a hard margin: a marker on that margin pushes
        the first character off it.
      */}
      <span
        aria-label={isLive ? 'listening' : 'not listening'}
        className={cx(
          'absolute right-2.5 top-2 size-1.5 rounded-full transition-all',
          isLive ? 'animate-pulse bg-[#6ee7b7] shadow-[0_0_8px_#10b981]' : 'bg-white/30',
        )}
      />

      {/*
        Bottom-anchored. Before the second sentence lands the stack sits at
        the FOOT of the pill, so the newest line is always on the same
        baseline — it does not walk down the pill as the service fills up.
      */}
      <div className="flex min-w-0 flex-1 flex-col justify-end overflow-hidden text-left">
        {rows.map((row, i) => {
          /* Distance from the newest, which is the rung. */
          const depth = rows.length - 1 - i;
          const alpha = row.partial && depth === 0 ? PARTIAL_ALPHA : (LADDER[depth] ?? 0);
          return (
            /* A span, not a paragraph: the pill is a button now, and a <p>
               inside one is invalid nesting. `block` keeps the row a row. */
            <span
              key={row.id}
              className={cx(
                'tri-transcript-line block truncate text-left font-medium tracking-wide select-text',
                /* Only the arriving row animates in; the rest are
                   transitioning down and must not restart their keyframe. */
                row.id === newestId && 'tri-transcript-line--new',
                /* Only the TOP row is level with the corner dot, so only the
                   top row pays for it. The newest line keeps the full width —
                   which is the whole reason the dot left the text flow. */
                depth === TRANSCRIPT_ROWS - 1 && 'pr-3',
              )}
              style={
                {
                  '--tri-line-a': alpha,
                  fontSize: '11.5px',
                  /* The rung height is a token so the rows and the pill that
                     holds them are computed from the same number. */
                  lineHeight: 'var(--tri-transcript-leading)',
                  color: 'var(--tri-ink)',
                } as React.CSSProperties
              }
            >
              {row.text}
              {row.partial && depth === 0 && (
                <span
                  className="ml-1 inline-block h-[0.85em] w-[2px] translate-y-[1px] animate-pulse rounded-sm bg-[var(--tri-accent-yellow)]"
                  aria-hidden="true"
                />
              )}
            </span>
          );
        })}
      </div>
    </button>
  );
}

/**
 * Import button bento pill with an icon-led dropdown menu for Image, Presentation Slides, and Songs.
 */
function ImportBentoMenu({
  onImportImage,
  onImportSlides,
  onImportSongs,
}: {
  onImportImage: () => void;
  onImportSlides: () => void;
  onImportSongs: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cx(
          'tri-rounded-control flex shrink-0 cursor-pointer items-center gap-1.5 px-3 text-[12px] font-medium lowercase transition-all active:scale-[0.98]',
          open
            ? 'bg-[rgb(255_255_255_/_0.12)] text-white shadow-[0_0_12px_rgba(255,255,255,0.06)]'
            : 'text-[rgb(229_243_242_/_0.85)] hover:bg-[rgb(255_255_255_/_0.06)] hover:text-white',
        )}
        style={{
          ...EDGE,
          height: 'var(--tri-topbar-h)',
        }}
        title="import images, presentation slides, or songs"
        aria-expanded={open}
      >
        <ImportIcon size={12} className="text-cyan-400/90" />
        <span className="tracking-wide">import</span>
        <ChevronDownIcon
          size={8}
          className={cx('opacity-60 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-50 flex w-64 flex-col gap-1 rounded-xl p-1.5 text-left shadow-[0_16px_36px_rgba(0,0,0,0.7)]"
          style={{
            ...EDGE,
            background: 'rgba(18, 26, 29, 0.95)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[rgb(229_243_242_/_0.4)]">
            import content
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onImportImage();
            }}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[rgb(255_255_255_/_0.07)]"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-400">
              <MediaIcon size={14} />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-[12px] font-medium lowercase text-[var(--tri-ink)]">
                image
              </span>
              <span className="truncate text-[10px] lowercase text-[rgb(229_243_242_/_0.45)]">
                backgrounds, stills & photos
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onImportSlides();
            }}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[rgb(255_255_255_/_0.07)]"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-400">
              <PresentationIcon size={14} />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-[12px] font-medium lowercase text-[var(--tri-ink)]">
                presentation slides
              </span>
              <span className="truncate text-[10px] lowercase text-[rgb(229_243_242_/_0.45)]">
                pptx, ppt, odp or pdf decks
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onImportSongs();
            }}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[rgb(255_255_255_/_0.07)]"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
              <MusicIcon size={14} />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-[12px] font-medium lowercase text-[var(--tri-ink)]">
                songs
              </span>
              <span className="truncate text-[10px] lowercase text-[rgb(229_243_242_/_0.45)]">
                youtube, paste lyrics or file
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Digital clock bento pill showing live device time with seconds and am/pm.
 */
function DigitalClockBento() {
  const [time, setTime] = useState(() => new Date());
  const [mode, setMode] = useState<'clock' | 'timer'>('clock');
  const [timers, setTimers] = useState<TimerSnapshot[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const takenAt = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const api = typeof window === 'undefined' ? undefined : window.api;
    if (!api?.onTimers) return;
    let alive = true;

    const take = (list: TimerSnapshot[]) => {
      if (!alive) return;
      takenAt.current = Date.now();
      setTimers(list || []);
    };

    void api.listTimers?.().then((list) => take((list ?? []) as TimerSnapshot[])).catch(() => undefined);
    return api.onTimers((list) => {
      take((list ?? []) as TimerSnapshot[]);
      return undefined;
    });
  }, []);

  const hours = time.getHours();
  const minutes = String(time.getMinutes()).padStart(2, '0');
  const seconds = String(time.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 || 12;

  // Find active timer: running first, then paused, then first timer
  const activeTimer = timers.find((t) => t.state === 'running') ?? timers[0] ?? null;

  const toggle = () => {
    if (mode === 'clock') {
      if (activeTimer) {
        setMode('timer');
      } else {
        setNotice('no timer set');
        setTimeout(() => setNotice(null), 1800);
      }
    } else {
      setMode('clock');
    }
  };

  // Compute live countdown when in timer mode
  let timerDisplay = '';
  let timerDotColor = '#22c55e';
  let isOverrun = false;
  if (activeTimer) {
    const drift = activeTimer.state === 'running' ? Date.now() - takenAt.current : 0;
    const ms =
      activeTimer.state !== 'running'
        ? activeTimer.remainingMs
        : activeTimer.kind === 'elapsed'
          ? activeTimer.remainingMs + drift
          : activeTimer.remainingMs - drift;
    isOverrun = activeTimer.overrunning || (activeTimer.kind === 'countdown' && ms < 0);
    const totalMs = (activeTimer.durationSec ?? 0) * 1000;
    timerDotColor = getTimerColor(ms, totalMs);
    timerDisplay = activeTimer.state === 'running' ? formatTimerDisplay(ms) : activeTimer.display;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="tri-rounded-control relative flex shrink-0 cursor-pointer items-center gap-2 overflow-hidden bg-[rgb(255_255_255_/_0.03)] px-3 text-[length:var(--tri-size-xs)] lowercase text-[var(--tri-ink)] transition-all hover:bg-[rgb(255_255_255_/_0.07)] active:scale-[0.98]"
      style={{
        ...EDGE,
        height: 'var(--tri-topbar-h)',
      }}
      title={
        notice
          ? 'No timer currently set'
          : mode === 'clock'
            ? `${time.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} — click to switch to countdown timer`
            : `Timer: ${activeTimer?.name || 'Countdown'} — click to switch to clock`
      }
    >
      {notice ? (
        <span className="text-[11px] font-medium tracking-wide text-amber-300 animate-pulse">
          {notice}
        </span>
      ) : mode === 'clock' ? (
        <>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/80 shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
          <span className="font-mono tracking-wider text-[rgb(229_243_242_/_0.9)] tabular-nums">
            {displayHours}:{minutes}
            <span className="text-[rgb(229_243_242_/_0.4)]">:{seconds}</span>
          </span>
          <span className="text-[10px] font-semibold tracking-wider text-[rgb(229_243_242_/_0.55)]">
            {ampm}
          </span>
        </>
      ) : (
        <>
          <span
            className={cx('h-1.5 w-1.5 shrink-0 rounded-full', isOverrun && 'animate-ping')}
            style={{
              backgroundColor: timerDotColor,
              boxShadow: `0 0 8px ${timerDotColor}`,
            }}
          />
          <span
            className="font-mono font-bold tracking-wider tabular-nums"
            style={{ color: timerDotColor }}
          >
            {timerDisplay}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(229_243_242_/_0.55)]">
            {isOverrun ? 'over' : activeTimer?.state === 'paused' ? 'paused' : 'tmr'}
          </span>
        </>
      )}
    </button>
  );
}

function ServiceLogBar({
  entries,
  onAction,
  className,
  style,
}: {
  entries: LogEntry[];
  onAction: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const latest = entries[entries.length - 1];
  const text = latest?.text ?? 'system ready';
  const hasAction = Boolean(latest?.action);

  return (
    <div
      className={cx(
        'tri-rounded-control relative flex min-w-0 flex-1 items-center justify-between overflow-hidden bg-[rgb(255_255_255_/_0.03)] px-3 text-[length:var(--tri-size-xs)] lowercase text-[var(--tri-ink)]',
        className,
      )}
      style={{
        ...EDGE,
        height: 'var(--tri-topbar-h)',
        ...style,
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/85 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
        <span className="min-w-0 truncate tracking-wide text-[rgb(229_243_242_/_0.85)]">
          {text}
        </span>
      </div>
      {hasAction && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-[var(--tri-accent-yellow)] underline underline-offset-2 transition-colors hover:text-white"
        >
          {latest.action?.label ?? 'switch to manual'}
        </button>
      )}
    </div>
  );
}

/** The rise, and the row that fades in at the bottom of it. */
function ServiceLogKeyframes() {
  return (
    <style>{`
      @keyframes tri-log-rise {
        from { transform: translateY(var(--tri-log-row)); }
        to   { transform: none; }
      }
      .tri-log-stack {
        animation: tri-log-rise 420ms cubic-bezier(0.22, 0.61, 0.36, 1);
      }
      .tri-log-stack > :last-child {
        animation: tri-log-arrive 420ms cubic-bezier(0.22, 0.61, 0.36, 1);
      }
      @keyframes tri-log-arrive {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @media (prefers-reduced-motion: reduce) {
        .tri-log-stack, .tri-log-stack > :last-child { animation: none; }
      }
    `}</style>
  );
}

/*
 * The service's on-switch, back on the screen and wired this time.
 *
 * It sat in the rail as a box the size of a card for a while, above the one
 * region that is ever news, and it was the wrong shape for what it does: a
 * service starts once. On the bar it is a control the width of its own word,
 * beside the orb that reports what starting it did — which is where the
 * operator looks when they want to know whether the engine is hearing
 * anything.
 *
 * It reports what it CAN do as well as what it is doing. Under DESIGN_MODE=1
 * the database answers and the services are skipped, so the button would be
 * a switch attached to nothing; it says so instead of failing quietly.
 */
function ListenControl() {
  const engine = useEngine();
  const { caps, asr, level } = engine;
  const on = asr === 'listening' || asr === 'connecting';

  const label = !caps.bridge
    ? 'no engine'
    : asr === 'connecting'
      ? 'connecting…'
      : asr === 'listening'
        ? 'listening'
        : asr === 'error'
          ? "can't listen — see why"
          : 'start listening';

  return (
    <button
      type="button"
      disabled={!caps.bridge}
      onClick={() => engine.listen(!on)}
      title={
        caps.bridge
          ? on
            ? 'stop listening'
            : 'start listening for the service'
          : 'no engine in this window — run the app with SANDBOX=1'
      }
      className={cx(
        'tri-rounded-control flex shrink-0 cursor-pointer items-center gap-2 px-3 text-[12px] font-medium lowercase transition-colors',
        !caps.bridge
          ? 'cursor-not-allowed text-[rgb(229_243_242_/_0.4)]'
          : on
            ? 'text-white'
            : 'text-[rgb(229_243_242_/_0.85)] hover:text-white',
      )}
      style={EDGE}
    >
      <MicIcon size={12} />
      {label}
      {/*
        The level, as four rising bars rather than a number.
        
        A mic that is open but hearing nothing is the most damaging failure
        on this screen and the hardest to notice, because everything else
        looks correct. A meter answers "is sound arriving" at a glance, which
        a status word cannot.
      */}
      {on && (
        <span aria-hidden className="flex items-end gap-[2px]">
          {[0, 1, 2, 3].map((n) => (
            <span
              key={n}
              className="w-[2px] rounded-full bg-[#8fd3c0] transition-[height,opacity] duration-150"
              style={{
                height: 3 + n * 2,
                opacity: level > n * 12 ? 0.9 : 0.18,
              }}
            />
          ))}
        </span>
      )}
    </button>
  );
}

/*
 * What the orb should say, derived rather than stepped.
 *
 * The label used to be a cursor into the fourteen states, walked by clicking
 * the orb — a demo control, and honest about being one while nothing behind
 * it was real. Now there is something behind it, and the priority order here
 * is the operator's own: the worst true thing first.
 *
 * It maps onto the SAME fourteen labels the sandbox strip uses, so the orb's
 * appearance table needs no edit and every state remains reachable from the
 * strip for design review.
 */
function engineState(
  engine: ReturnType<typeof useEngine>,
  live: LiveItem | null,
  preview: LiveItem | null,
  quiet: boolean,
): string {
  if (!engine.caps.bridge) return 'no display';
  if (engine.asr === 'error') return 'engine error';
  if (engine.asr === 'connecting') return 'connecting';
  if (engine.screen === 'black' || engine.screen === 'logo') return 'output frozen';
  /* Sound is the thing a listening engine is supposed to be getting, so a
     long silence outranks "live" — a verse can sit on the wall correctly
     while the microphone has been dead for a minute. */
  if (engine.asr === 'listening' && quiet) return 'no mic signal';
  if (live) return live.origin === 'auto' ? 'auto live' : 'live';
  if (preview) return 'in preview';
  if (engine.asr === 'listening') return 'listening';
  return 'idle';
}

/* ------------------------------------------------------------------ */
/* The stage — preview and live                                        */
/* ------------------------------------------------------------------ */

/*
 * The two boxes the wireframe gives the most height to, and the reason the
 * screen exists.
 *
 * LEFT is what the operator has staged. RIGHT is what the congregation is
 * reading. They are the same renderer — see ./slide — fed different content,
 * which is the only arrangement in which the preview cannot lie about the
 * live. The shipping app draws its operator preview as a clamped paragraph
 * while the projector slices the reading into slides, and those two disagree
 * the moment a reading runs past one screen.
 *
 * The gap between them is the safety. Nothing crosses from left to right
 * without a person pressing the gold act, which is why staging is a click
 * and pushing is a different click somewhere else.
 */

/** A compact stepper for a multi-slide reading. Hidden when there is one. */
function SlidePager({
  at,
  total,
  onStep,
}: {
  at: number;
  total: number;
  onStep: (delta: -1 | 1) => void;
}) {
  if (total <= 1) return null;
  const step = (delta: -1 | 1) => (
    <button
      type="button"
      onClick={() => onStep(delta)}
      title={delta < 0 ? 'previous slide' : 'next slide'}
      className="tri-rounded-control grid size-[22px] place-items-center text-[rgb(229_243_242_/_0.55)] transition-colors hover:text-[var(--tri-ink)]"
      style={EDGE}
    >
      <ChevronDownIcon size={10} className={delta < 0 ? 'rotate-90' : '-rotate-90'} />
    </button>
  );
  return (
    <div className="flex items-center gap-1.5">
      {step(-1)}
      {/* Tabular so the row does not twitch as the number changes — a pager
          that shifts its neighbours every slide is the kind of small motion
          that pulls an eye away from the words. */}
      <span className="text-[length:var(--tri-size-xs)] tabular-nums text-[rgb(229_243_242_/_0.55)]">
        {at + 1} / {total}
      </span>
      {step(1)}
    </div>
  );
}

/** "Genesis 1:4-5" → its parts. Null for anything that is not a verse. */
function parseStagedRef(reference?: string): { book: string; chapter: number; start: number; end: number } | null {
  const m = reference?.match(/^(.+?)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if (!m) return null;
  const start = Number(m[3]);
  return { book: m[1], chapter: Number(m[2]), start, end: m[4] ? Number(m[4]) : start };
}

/*
 * One half of the stage: the screen, and one row of controls under it.
 *
 * No header. The panel used to open with an eyebrow and its buttons, which
 * put a bar's height between the panel's top edge and the picture while the
 * sides sat a few pixels off it — a screen hung low in its own box. Now the
 * picture is inset by --tri-gap, the same gutter that separates the panels
 * from each other, so the space around the screen and the space between the
 * boxes are one rhythm. Everything that is not the picture — the name of the
 * box and its acts — lives in a single row along the bottom edge, at that
 * same inset.
 *
 * The screen is as large as a 16:9 box can be here, and the arithmetic is
 * done in container units because nothing else can do it: `height:100%` with
 * a max-width keeps the height when the width clamps and the picture quietly
 * stops being 16:9 (it was 1.58:1 at the default window). min() of "all the
 * width" and "the width that all the height minus the control row allows"
 * is the largest box that is still the projector's shape.
 *
 * Normally the two agree to the pixel, because the panel's height is no
 * longer handed down to it: Stage derives it from the panel's width, as
 * exactly "a 16:9 picture, a gutter, this row, and the inset" — so the row
 * sits one --tri-gap under the picture and one --tri-gap off the floor, with
 * no air between. The min() is what is left for the short-window case, where
 * the browser's floor squeezes the stage and the picture has to give.
 */
function StageBox({
  label,
  tone = 'default',
  canvas,
  controls,
  onKeyDown,
  onHover,
}: {
  label: string;
  tone?: 'default' | 'live';
  canvas: ReactNode;
  controls: ReactNode;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onHover?: (over: boolean) => void;
}) {
  return (
    <Panel
      className="basis-1/2"
      /* Panel already ships a gold ring as tone='live'. Using it rather
         than drawing a second highlight is what keeps "this is live" one
         visual idea across the whole app. */
      tone={tone}
      /* Inline because Panel's own px-3 pb-3 cannot be out-classed — see
         bodyStyle in ./parts. */
      bodyStyle={{ padding: 'var(--tri-gap)' }}
    >
      <div
        className="flex h-full min-h-0 flex-col items-center outline-none"
        /* Focusable only when it has keys to answer, so Tab does not stop on
           a box that would do nothing with it. */
        tabIndex={onKeyDown ? 0 : undefined}
        onKeyDown={onKeyDown}
        onPointerEnter={onHover ? () => onHover(true) : undefined}
        onPointerLeave={onHover ? () => onHover(false) : undefined}
        style={
          {
            containerType: 'size',
            /* --tri-control-h and --stage-row come from Stage, which needs
               the same two numbers to work out how tall this panel is. */
            '--tri-control-pad-x': '10px',
          } as React.CSSProperties
        }
      >
        <div
          className="relative shrink-0"
          style={{
            width: 'min(100cqw, calc((100cqh - var(--stage-row)) * 16 / 9))',
            aspectRatio: '16 / 9',
          }}
        >
          {canvas}
        </div>
        {/* Bottom-anchored: the controls sit --tri-gap off the panel's bottom
            edge exactly as the picture sits off its top, and whatever height
            a 16:9 picture could not use falls between the two as air rather
            than being split into two unequal margins. */}
        <div className="flex min-h-[var(--stage-row)] w-full flex-1 items-end justify-between gap-2">
          {/* Level with the controls' own text rather than the row's floor,
              and stepped in so the word clears the panel's corner curve. */}
          <span className="tri-label flex h-[var(--tri-control-h)] shrink-0 items-center pl-2.5 lowercase text-[var(--tri-ink-muted)]">
            {label}
          </span>
          <div className="flex min-w-0 items-center gap-[var(--tri-gap)]">{controls}</div>
        </div>
      </div>
    </Panel>
  );
}

function Stage({
  previewTheme,
  liveTheme,
  onPromoteTheme,
  say,
}: {
  previewTheme: ThemeSettings;
  liveTheme: ThemeSettings;
  onPromoteTheme?: () => void;
  /** The service log — where a refused act explains itself. */
  say?: (line: { text: string }) => void;
}) {
  const projector = useProjector();
  const engine = useEngine();
  const { preview, live, slide, screen } = projector;

  /*
   * Staged readings show their first slide, always.
   *
   * The preview box deliberately does NOT get its own slide cursor. Two
   * cursors is two places to be lost, and what the operator wants from the
   * left box is "what will appear when I press this" — which is slide one.
   */
  const toSlide = (item: LiveItem | null, slideIdx = 0): VerseSlide | null => {
    if (!item) return null;
    if (item.slides && item.slides.length > 0) {
      return item.slides[Math.min(slideIdx, item.slides.length - 1)];
    }
    if (item.text) {
      return {
        reference: item.reference ?? item.label ?? null,
        lines: [{ version: item.version ?? 'KJV', text: item.text }],
        verseStart: 1,
        verseEnd: 1,
        index: 1,
        total: 1,
      };
    }
    return null;
  };

  const staged = toSlide(preview, 0);
  const onAir = toSlide(live, slide);

  /*
   * Going live is two acts that have to happen together, and the order
   * matters.
   *
   * The real projector is driven by handing a REFERENCE to the resolver —
   * there is no channel that renders arbitrary text — so the engine gets
   * told first and this surface mirrors it locally. When there is no engine
   * (a browser tab, or DESIGN_MODE=1 with the services skipped) the local
   * half still runs, which is what makes the whole screen demonstrable with
   * nothing behind it.
   *
   * An engine-authored proposal is pushed with pushToLive() instead: main
   * already holds it as the current preview, and re-resolving the same
   * reference would send it round the detection path a second time.
   */
  const goLive = () => {
    if (!preview) return;
    /* The wall slices a range by the church's own setting, so the choice made
       here has to become that setting or the preview would be a picture of
       something the congregation never sees. */
    if ((preview.verses?.length ?? 0) > 1) {
      void window.api?.setSetting('breakOnVerse', (preview.slides?.length ?? 0) > 1);
    }
    if (preview.origin === 'engine') engine.pushEnginePreview();
    else if (preview.reference) engine.pushReference(preview.reference);
    projector.promote();
    onPromoteTheme?.();
  };

  const blacked = screen === 'black' || screen === 'logo';

  /*
   * One verse forward, one verse back — from whatever is staged.
   *
   * The preacher reads on past the verse that was called, and the operator's
   * move is always the same: the next one. It belongs on the preview box
   * because that is where the eyes are when it is needed. A range steps off
   * its ends (4-5 → 6, or → 3), and the chapter's own rows are the bound, so
   * the arrow that would walk off the end of a chapter is simply disabled by
   * finding nothing there.
   */
  const stagedRef = preview?.source === 'scripture' ? parseStagedRef(preview.reference) : null;
  const step = (dir: 1 | -1) => {
    if (!stagedRef || !preview) return;
    const bookIndex = BOOKS.indexOf(stagedRef.book);
    const target = dir === 1 ? stagedRef.end + 1 : stagedRef.start - 1;
    if (bookIndex < 0 || target < 1 || !window.api?.getChapter) return;
    const version = preview.version || 'KJV';
    void window.api.getChapter(bookIndex, stagedRef.chapter, version).then((res) => {
      const row = res?.data?.find((v) => v.id === target);
      if (!row) return;
      const verses = [{ verse: target, text: row.text }];
      const reference = `${stagedRef.book} ${stagedRef.chapter}:${target}`;
      projector.stage({
        source: 'scripture',
        id: reference,
        label: reference,
        reference,
        version,
        text: row.text,
        verses,
        slides: buildVerseSlides({ book: stagedRef.book, chapter: stagedRef.chapter, version }, verses, fitRules(verses)),
        origin: 'operator',
      });
    });
  };

  /*
   * Together or apart — a range's one real choice.
   *
   * "Verse four and five" is staged on one slide while it fits, because that
   * is what was asked for. The meter beside it is the honest check: words,
   * not pixels, since the projector's type size is the church's own setting.
   * Pressing the control re-slices the same verses; nothing is fetched.
   */
  const range = (preview?.verses?.length ?? 0) > 1;
  const together = range && (preview?.slides?.length ?? 0) === 1;
  const words = preview?.text ? wordCount(preview.text) : 0;
  const fit = fitOf(words);
  const reslice = () => {
    if (!preview?.verses || !stagedRef) return;
    projector.stage({
      ...preview,
      slides: buildVerseSlides(
        { book: stagedRef.book, chapter: stagedRef.chapter, version: preview.version || 'KJV' },
        preview.verses,
        fitRules(preview.verses, !together),
      ),
    });
  };

  /*
   * ← and → for the verse before and after, now that the arrows are gone.
   *
   * Two ways in, because an operator's hands are on the keyboard and their
   * pointer is wherever it was left: the box answers when it has focus, and
   * also while the pointer is simply over it. Typing is never stolen — a
   * key pressed inside a field belongs to the field, which matters here
   * because the reference input below uses the same arrows.
   */
  const [overPreview, setOverPreview] = useState(false);
  const stepRef = useRef(step);
  stepRef.current = step;
  const onStepKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    step(e.key === 'ArrowRight' ? 1 : -1);
  };
  const canStep = !!stagedRef;
  useEffect(() => {
    if (!overPreview || !canStep) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      /* Focused, the box's own handler has already taken this one. */
      if (e.defaultPrevented) return;
      e.preventDefault();
      stepRef.current(e.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overPreview, canStep]);

  /*
   * Whether the companion code is what the wall is showing.
   *
   * Learned from the engine rather than remembered from the press: main
   * announces every picture it puts up, the code included, and announces a
   * cleared wall too — so another window showing a photo over the code, or
   * clearing it, turns this off without being told. Anything going live
   * replaces it by definition.
   */
  const [qrUp, setQrUp] = useState(false);
  /* Whether the clip on the wall is paused, as far as this window knows. */
  const [videoPaused, setVideoPaused] = useState(false);
  const liveKey = projector.live ? `${projector.live.source}:${projector.live.id}` : '';
  useEffect(() => setVideoPaused(false), [liveKey]);
  useEffect(() => {
    const api = window.api;
    if (!api) return;
    const offShow = api.onShowMedia?.((file) => setQrUp(/trilorah-companion-qr/.test(file)));
    const offClear = api.onShowCleanBackground?.(() => setQrUp(false));
    return () => {
      offShow?.();
      offClear?.();
    };
  }, []);
  useEffect(() => {
    if (live) setQrUp(false);
  }, [live]);

  const toggleQr = () => {
    if (live) return;
    if (qrUp) {
      void window.api?.clearMedia?.();
      setQrUp(false);
      return;
    }
    if (!window.api?.showQr) {
      say?.({ text: 'the phone code needs the engine — it cannot be shown from here' });
      return;
    }
    void window.api
      .showQr()
      .then((res) => {
        if (res?.success) setQrUp(true);
        /* Main's own message names two settings keys. The operator needs the
           sentence that says where to go, not which keys were empty. */
        else say?.({ text: "companion isn't set up yet — add your public web address and account in Settings" });
      })
      .catch(() => say?.({ text: "couldn't show the phone code — try again" }));
  };

  return (
    /*
     * The stage is as tall as its pictures make it — not as tall as the
     * window happens to leave.
     *
     * Each panel is, top to bottom: gutter, a 16:9 screen as wide as the
     * panel less a gutter each side, gutter, the control row, gutter. Every
     * term is either a token or the panel's width, so the height is a
     * calc() — but a calc() over the width needs container units, and an
     * element cannot read units off itself. Hence two boxes: the outer one
     * is the inline-size container (its height stays auto, which that kind
     * of containment allows), the inner one carries the height.
     *
     * Both may shrink (min-h-0, no shrink-0). They only do on a window too
     * short for the browser's floor; see the grid in LiveBody.
     */
    <div
      className="flex min-h-0 flex-col"
      style={
        {
          containerType: 'inline-size',
          '--tri-control-h': '26px',
          /* What the row under the picture needs: its controls, and the
             gutter between them and the picture. */
          '--stage-row': 'calc(var(--tri-control-h) + var(--tri-gap))',
        } as React.CSSProperties
      }
    >
    <div
      className="flex min-h-0 gap-[var(--tri-gap)]"
      style={{
        height:
          /* panel width = half the row less half the gap between the two;
             picture width = that less the inset each side. */
          'calc(((100cqw - var(--tri-gap)) / 2 - 2 * var(--tri-gap)) * 9 / 16 + var(--stage-row) + 2 * var(--tri-gap))',
      }}
    >
      {/*
        The halves are equal by construction (basis-1/2 on both) rather
        than by flex ratio: with the same basis they shrink by the same
        amount to make room for the gap, so the split lands dead centre
        and cannot drift as either side gains contents. Same reasoning as
        the themes editor below.
      */}
      <StageBox
        label="preview"
        onKeyDown={stagedRef ? onStepKey : undefined}
        onHover={setOverPreview}
        canvas={
          <>
            <SlideCanvas seated theme={previewTheme} slide={staged} empty="nothing staged" />
            {/*
              The verse before and the verse after, with nothing drawn.

              These were two tall arrow strips either side of the picture,
              and they cost the picture their width at exactly the size
              where width is what limits it. The act is kept and the chrome
              is not: the outer thirds of the screen are the buttons, the way
              a photo viewer's are, and ← / → do the same while the pointer is
              over the box or it holds focus. The middle third stays inert
              so a stray click on the words does nothing.
            */}
            {stagedRef && (
              <>
                <button
                  type="button"
                  aria-label="previous verse"
                  title={stagedRef.start > 1 ? 'previous verse  ←' : undefined}
                  disabled={stagedRef.start <= 1}
                  onClick={() => step(-1)}
                  className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize disabled:cursor-default"
                />
                <button
                  type="button"
                  aria-label="next verse"
                  title="next verse  →"
                  onClick={() => step(1)}
                  className="absolute inset-y-0 right-0 w-1/3 cursor-e-resize"
                />
              </>
            )}
          </>
        }
        controls={
          <>
            {range && (
              <Button
                label={together ? 'separate' : 'together'}
                tone="ash"
                title={
                  (together ? 'show one verse per slide' : 'show the verses together on one slide') +
                  /* The word count used to be printed under the picture. It
                     is a check the operator makes once, on a range, at the
                     moment of choosing — which is here. */
                  ` — ${words} words, ${together ? fit : 'split'}; a slide reads comfortably up to ${FIT_WORDS}`
                }
                onClick={reslice}
              />
            )}
            {/* The staged reading's length, without a cursor to move — it
                says "this is three screens" before the operator commits to
                reading it out. */}
            {(preview?.slides?.length ?? 0) > 1 && (
              <span className="shrink-0 text-[length:var(--tri-size-xs)] tabular-nums text-[rgb(229_243_242_/_0.4)]">
                {preview!.slides!.length} slides
              </span>
            )}
            {preview && (
              <Button
                label=""
                tone="ash"
                icon={<PlusIcon size={12} className="rotate-45" />}
                title="unstage — take it out of preview"
                onClick={() => projector.stage(null)}
              />
            )}
            {/* The one act on this screen that reaches the congregation.
                Green by the owner's call, and the LIT green (tone 'go'), not
                the system's dark teal surface: at 30% alpha beside three ash
                buttons it was indistinguishable from them, and this is the
                button that has to be found without looking for it. Not gold:
                gold is what is ALREADY live (the ring opposite, a live row),
                and a gold button on the box that is by definition not live
                yet said the wrong thing about which side was on air.
                Disabled rather than hidden with nothing staged — the same
                green at reduced opacity, so the operator can see where the
                push lives before they have something to push. */}
            <Button
              label="go live"
              tone="go"
              disabled={!preview}
              title={preview ? `put ${preview.label} on the projector` : 'stage something first'}
              onClick={goLive}
            />
          </>
        }
      />

      <StageBox
        label="live"
        tone={live && !blacked ? 'live' : 'default'}
        canvas={
          <SlideCanvas
            seated
            theme={liveTheme}
            slide={onAir}
            screen={screen}
            empty="nothing on the projector"
          />
        }
        controls={
          <>
            <SlidePager
              at={Math.min(slide, (live?.slides?.length ?? 1) - 1)}
              total={live?.slides?.length ?? 0}
              onStep={(d) => projector.stepSlide(d)}
            />
            {/* A clip on the wall gets a transport. Only then: a pause button
                beside a verse is a button that does nothing. The projector
                window owns the <video>, so these are messages to it — the
                paused flag here is this window's own best guess, flipped on
                press and reset whenever a different thing goes live. */}
            {live?.mediaKind === 'video' ? (
              <>
                <Button
                  label=""
                  tone="ash"
                  icon={videoPaused ? <PlayIcon size={12} /> : <PauseIcon size={12} />}
                  title={videoPaused ? 'play the video' : 'pause the video'}
                  onClick={() => {
                    void window.api?.mediaControl?.({ type: videoPaused ? 'play' : 'pause' });
                    setVideoPaused((p) => !p);
                  }}
                />
                <Button
                  label=""
                  tone="ash"
                  icon={<ResetIcon size={13} />}
                  title="play the video again from the start"
                  onClick={() => {
                    void window.api?.mediaControl?.({ type: 'restart' });
                    setVideoPaused(false);
                  }}
                />
              </>
            ) : null}
            {/* Clear drops the words and keeps the picture — the app's own
                meaning of the word, not a blank screen. */}
            <Button
              label="clear"
              tone="ash"
              disabled={!engine.caps.outputs && !live}
              title="drop the words, keep the background"
              onClick={() => {
                engine.setScreen(screen === 'clear' ? 'live' : 'clear');
                projector.setScreen(screen === 'clear' ? 'live' : 'clear');
              }}
            />
            {/*
              The companion code, on the wall.

              Only ever onto an EMPTY wall: the code is for the minutes before
              a service and the gaps in it, and a press that swapped a verse
              the room was reading for a QR would be the worst kind of
              mis-click. So while anything is live the button is dimmed and
              inert — dimmed, not blurred or hidden, because it has to stay
              findable for the moment it becomes useful. Up, it wears gold
              like everything else that is on the projector, and the same
              press takes it down.
            */}
            <Button
              label=""
              tone={qrUp ? 'gold' : 'ash'}
              icon={<QrIcon size={13} />}
              disabled={!!live}
              title={
                live
                  ? 'the projector is in use — clear it to show the phone code'
                  : qrUp
                    ? 'take the phone code off the projector'
                    : 'show the phone code on the projector'
              }
              onClick={toggleQr}
            />
            <Button
              label=""
              tone="ash"
              icon={<MediaIcon size={13} />}
              disabled={!engine.caps.bridge}
              title={engine.caps.bridge ? 'open the projector window' : 'open the projector window — needs the engine (run with SANDBOX=1)'}
              onClick={engine.openProjector}
            />
          </>
        }
      />
    </div>
    </div>
  );
}

export function LiveScreen({ state }: { state?: string } = {}) {
  return (
    <AppShell model={{ tab: 'LIVE', engine: 'connected' }}>
      {/* Both above the tabs on purpose: what is on the projector, and what
          is in the run, must survive the operator switching away to queue
          the next thing. */}
      <EngineProvider>
        <ProjectorProvider>
          <RunProvider>
            <RunDragBridge state={state} />
          </RunProvider>
        </ProjectorProvider>
      </EngineProvider>
    </AppShell>
  );
}

/*
 * Sits between the two so the drag layer can hand a dropped stack to the
 * run without either knowing about the other: the layer carries items and
 * announces where they landed, the run stores them, and this is the one
 * line that joins the two.
 */
function RunDragBridge({ state }: { state?: string }) {
  const run = useRun();
  return (
    <DragProvider onDrop={(segmentKey, items) => run.dropInto(segmentKey, items)}>
      <DragKeyframes />
      <ServiceLogKeyframes />
      <LiveBody state={state} />
    </DragProvider>
  );
}

/* Inside the providers, so the screen itself can read the run — the rail and
   the browser are both in here and both need it. */
function LiveBody({ state }: { state?: string }) {
  const [tab, setTab] = useState(0);
  const [previewTheme, setPreviewTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const [liveTheme, setLiveTheme] = useState<ThemeSettings>(DEFAULT_THEME);

  const engine = useEngine();
  const projector = useProjector();

  /*
   * Which of the fourteen states the screen is in.
   *
   * TWO sources, and which one wins is the whole design. The sandbox strip
   * names a state for design review — that is what the strip is for, and
   * every one of the fourteen has to stay reachable from it. Everything else
   * comes off the engine.
   *
   * So: a state named on the strip is held, because someone asked to look at
   * it. Land on the strip's default and the screen reports itself instead.
   * The orb stops being a stepper the moment there is a real engine behind
   * it, because a control that overwrites the truth about what a
   * congregation is looking at is not a control anyone should have
   * mid-service.
   */
  const stripLabel = LIVE_STATES.find((s) => s.id === state)?.label ?? null;
  const [pinned, setPinned] = useState<string | null>(stripLabel);
  useEffect(() => setPinned(stripLabel), [stripLabel]);

  /*
   * Silence, timed.
   *
   * An open microphone hearing nothing looks exactly like an open
   * microphone, which is why this is the failure that gets found late. Eight
   * seconds is past any natural pause in preaching and well short of the
   * length that would make the warning useless.
   */
  const [quiet, setQuiet] = useState(false);
  useEffect(() => {
    if (engine.asr !== 'listening') {
      setQuiet(false);
      return;
    }
    setQuiet(false);
    const t = window.setTimeout(() => setQuiet(true), 8000);
    return () => window.clearTimeout(t);
  }, [engine.asr, engine.level]);

  const derived = engineState(engine, projector.live, projector.preview, quiet);
  /*
   * The engine wins whenever there is one.
   *
   * The strip does not offer an "unpinned" chip — opening this screen from
   * the gallery lands on its FIRST state, so a named state was always in
   * play and the orb reported that instead of the room. During a service
   * that is not a demo control, it is a lie about what the congregation is
   * looking at.
   *
   * Design review of the fourteen states happens where there is no engine:
   * a browser tab, or DESIGN_MODE=1. That is where the pin still holds, and
   * it is the only place it should.
   */
  const stateLabel = engine.caps.bridge ? derived : (pinned ?? derived);
  /* Only when nothing real is behind it. See the note above. */
  const stepState = engine.caps.bridge
    ? undefined
    : () =>
        setPinned((l) =>
          STATE_LABELS[(STATE_LABELS.indexOf(l ?? 'idle') + 1) % STATE_LABELS.length],
        );

  const [view, setView] = useState<ViewMode>('operator');
  const run = useRun();

  /*
   * The engine put something up itself — auto mode, or the app window
   * running beside this one pushed it. Either way the congregation is
   * reading it and this surface has to agree, so it mirrors rather than
   * argues. This is the one place engine truth overwrites local state.
   */
  const mirror = projector.send;
  useEffect(() => engine.onEngineLive((item) => mirror(item)), [engine, mirror]);

  /* The engine took the verse down — the preacher has moved on and stopped
     saying its words. The wall is already clear; this box has to agree, or
     the operator is looking at a "live" verse nobody can see. */
  useEffect(() => window.api?.onVerseAutoDismiss?.(() => projector.clear()), [projector]);

  /* Whenever the engine hears a scripture reference, immediately stage to preview AND push to live screen! */
  const latestProposal = engine.proposals[0];
  const lastAutoPushedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!latestProposal || latestProposal.missing || !latestProposal.reference) return;
    if (lastAutoPushedRef.current === latestProposal.id) return;
    lastAutoPushedRef.current = latestProposal.id;

    const item: LiveItem = {
      source: 'scripture',
      id: latestProposal.reference,
      label: latestProposal.reference,
      reference: latestProposal.reference,
      version: latestProposal.version,
      text: latestProposal.text,
      slides: latestProposal.slides,
      verses: latestProposal.verses,
      origin: 'engine',
    };

    projector.stage(item);
    projector.send(item);
    if (window.api?.pushToLive) {
      window.api.pushToLive();
    }
  }, [latestProposal?.id, projector]);

  /* The bar's contents. The log listens to the state so a change speaks
     for itself, and the one action any line offers lands back here. */
  const log = useServiceLog(stateLabel);
  const say = log.say;
  /* When listening fails the engine says why in a full sentence ("add a
     Deepgram key in Settings…"). The button has room for three words, so the
     sentence goes to the log, where there is room to read it. */
  useEffect(() => {
    if (engine.asr === 'error' && engine.asrMessage) say({ text: engine.asrMessage });
  }, [engine.asr, engine.asrMessage, say]);
  /* What the OPERATOR does to the wall belongs in the record too. The log used
     to speak only for the engine — a verse caught, a command heard — so on a
     service run by hand, or with the microphone off, it sat silent and read
     as broken. Keyed on the live item's identity, not the object, so stepping
     slides inside one reading does not chatter. */
  const onWall = projector.live ? `${projector.live.source}:${projector.live.id}` : '';
  const wasOnWall = useRef(onWall);
  useEffect(() => {
    if (wasOnWall.current === onWall) return;
    const had = wasOnWall.current;
    wasOnWall.current = onWall;
    if (projector.live) say({ text: `on the wall: ${projector.live.label}` });
    else if (had) say({ text: 'wall cleared' });
  }, [onWall, projector.live, say]);
  const goManual = useCallback(() => say({ text: "suggestions off — you're driving" }), [say]);

  const [songAddRequest, setSongAddRequest] = useState(0);
  const hiddenImageInputRef = useRef<HTMLInputElement>(null);
  const hiddenSlideInputRef = useRef<HTMLInputElement>(null);

  const handleImportImage = useCallback(() => {
    if (window.api?.pickBackgroundImage) {
      void window.api.pickBackgroundImage().then((res) => {
        if (!res?.success || !res.url) return;
        const name = decodeURIComponent(res.url.split('/').pop() ?? 'image');
        const media: ThemeMedia = {
          id: `local:${res.url}`,
          label: name.replace(/\.[a-z0-9]+$/i, ''),
          detail: 'imported image',
          seed: 4,
          style: 'smoke' as const,
          source: 'local' as const,
          url: res.src ?? res.url,
          kind: 'photo' as const,
        };
        addMedia(media);
        setPreviewTheme((prev) => ({ ...prev, backgroundId: media.id }));
        setView('operator');
        setTab(TABS.findIndex((t) => t.id === 'media'));
        say({ text: `imported image: ${media.label}` });
      });
    } else {
      hiddenImageInputRef.current?.click();
    }
  }, [say]);

  const handleImageFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const media: ThemeMedia = {
      id: `local:${Date.now()}`,
      label: file.name.replace(/\.[a-z0-9]+$/i, ''),
      detail: 'imported image',
      seed: 4,
      style: 'smoke' as const,
      source: 'local' as const,
      url,
      kind: 'photo' as const,
    };
    addMedia(media);
    setPreviewTheme((prev) => ({ ...prev, backgroundId: media.id }));
    setView('operator');
    setTab(TABS.findIndex((t) => t.id === 'media'));
    say({ text: `imported image: ${media.label}` });
    e.target.value = '';
  };

  const handleImportSlides = useCallback(() => {
    if (window.api?.importPresentation) {
      say({ text: 'importing presentation slides…' });
      void window.api
        .importPresentation()
        .then((res) => {
          if (res?.success) {
            setView('operator');
            setTab(TABS.findIndex((t) => t.id === 'slides'));
            say({ text: `imported ${res.data?.slides?.length ?? 0} slides` });
          } else if (res?.error && res.error !== 'Cancelled') {
            say({ text: `slide import: ${res.error}` });
          }
        })
        .catch(() => say({ text: 'slide import failed' }));
    } else {
      hiddenSlideInputRef.current?.click();
    }
  }, [say]);

  const handleSlideFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setView('operator');
    setTab(TABS.findIndex((t) => t.id === 'slides'));
    say({ text: `selected presentation deck: ${file.name}` });
    e.target.value = '';
  };

  /* The songs tab owns the add-song dialog (and the rule that nothing is
     added until the editor's Save). The header only asks for it. */
  const handleImportSongs = useCallback(() => {
    setView('operator');
    setTab(TABS.findIndex((t) => t.id === 'songs'));
    setSongAddRequest(Date.now());
  }, []);

  return (
    <>
      {/*
        Two columns, per the owner's drawing.
        
        This reverses a call made here earlier, and the reason it was made
        still stands: the browser is where the operator does the finding —
        a chapter, a song, a deck — and running the rail the full height
        takes 18% of that width away from it. The drawing is the spec, so the
        rail gets its height back and the tab strip moves inside the right
        column, starting where the stage starts rather than at the window
        edge. If the browser turns out to be starved at 1280, that is the
        trade to revisit — not the rail.
      */}
      {view === 'dashboard' ? (
        <div className="flex h-full w-full min-w-0 flex-col gap-[var(--tri-gap)] p-2.5">
          {/* Top header row */}
          <div
            className="flex shrink-0 items-stretch gap-[var(--tri-gap)]"
            style={{ height: 'var(--tri-topbar-h)' }}
          >
            {/* Left gap matching the Run of Service column so header controls do not shift */}
            <div aria-hidden className="shrink-0" style={{ width: 'var(--tri-rail-w)' }} />

            {/* View switch with matched proportional width so buttons and orb stay in exact position */}
            <div
              className="flex shrink-0 items-stretch gap-[var(--tri-gap)]"
              style={{ width: 'calc((100% - var(--tri-rail-w) - var(--tri-gap)) * 0.215)' }}
            >
              {VIEWS.map((m) => {
                const active = m === view;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setView(m)}
                    aria-pressed={active}
                    className={cx(
                      'tri-rounded-control flex flex-1 cursor-pointer items-center justify-center text-[12.5px] font-medium lowercase tracking-wide transition-all select-none',
                      active
                        ? 'bg-[rgb(255_255_255_/_0.15)] font-semibold text-white shadow-[0_1px_4px_rgba(0,0,0,0.5)]'
                        : 'text-[rgb(255_255_255_/_0.78)] hover:bg-[rgb(255_255_255_/_0.06)] hover:text-white',
                    )}
                    style={EDGE}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            <StatusOrb label={stateLabel} onClick={stepState} />
            <ListenControl />

            {/* Middle stretch spacer */}
            <div className="flex-1" />

            {/* Import Bento Pill Menu beside timer */}
            <ImportBentoMenu
              onImportImage={handleImportImage}
              onImportSlides={handleImportSlides}
              onImportSongs={handleImportSongs}
            />

            {/* Device Digital Clock Bento */}
            <DigitalClockBento />

            {/* Right: separate logs bento card matching the width of the empty space below */}
            <div
              className="flex shrink-0 items-stretch"
              style={{ width: 'var(--tri-rail-w)' }}
            >
              <ServiceLogBar entries={log.entries} onAction={goManual} />
            </div>
          </div>

          {/* Dashboard bento: moves to the left; the empty space moves to the right */}
          <div className="flex min-h-0 flex-1 items-stretch gap-[var(--tri-gap)]">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[var(--tri-gap)]">
              <DashboardBento />
            </div>
            {/* Was an empty spacer. The log's history, directly under the bar
                that says the newest line — see LogHistory. */}
            <LogHistory
              entries={log.entries}
              onAction={goManual}
              className="shrink-0"
              style={{ width: 'var(--tri-rail-w)' }}
            />
          </div>
        </div>
      ) : (
        /*
         * Two rows, and the first one is sized by the STAGE.
         *
         * The rows used to be percentages of the window — stage takes what is
         * left over a 40% browser — and a 16:9 picture fitted into a box
         * whose height came from somewhere else leaves a band of nothing
         * under itself at every window size but one. The stage now states its
         * own height from its width (see Stage), row one is `auto` around
         * it, and the browser row takes everything that frees up.
         *
         * A grid rather than two flex columns because the rail's lower panel
         * and the browser have to keep starting on the same line, and now
         * that the line is wherever the stage ends, only a shared track can
         * promise that. Both columns span the two rows and subgrid them.
         *
         * minmax(0, auto): row one may be squeezed below what the stage asks
         * for. On a wide, short window (1920×800) a full-width 16:9 pair would
         * leave the browser a strip; the browser's floor wins there and the
         * pictures shrink inside their panels instead — StageBox's min()
         * already knows how.
         */
        <ViewEnter
          /* Its panels settle in when the dashboard is turned away from —
             but not at launch, where the surface is simply there. */
          skipFirst
          className="grid h-full gap-[var(--tri-gap)] p-2.5"
          style={{
            gridTemplateColumns: 'var(--tri-rail-w) minmax(0, 1fr)',
            gridTemplateRows: 'minmax(0, auto) minmax(30%, 1fr)',
          }}
        >
          <div
            data-drop-segment=""
            className="row-span-2 grid min-h-0 grid-rows-subgrid"
          >
            {/* Out of flow inside its cell: the run can be any length, and a
                long one must scroll inside the row the stage sized rather
                than be counted as a reason to make that row taller. */}
            <div className="relative min-h-0">
            <Panel
              title={`run of service (${run.segments.length})`}
              className="absolute inset-0"
              /* The live-transcript variant, not the plain topbar height:
                 the strip across the top of the right column is sized by the
                 transcript pill, and this header has to be exactly as tall or
                 the top of the window comes apart into two lines that nearly
                 agree. See --tri-topbar-live-h. */
              style={{ '--tri-bar-h': 'var(--tri-topbar-live-h)' } as React.CSSProperties}
              right={<RunHeaderActions say={say} />}
            >
              <RunOfService
                renderAdd={(seg) => <SegmentAdd seg={seg} />}
                fallbackSongs={SONGS}
              />
            </Panel>
            </div>

            <Panel
              className="min-h-0"
              bodyClass="pt-3"
              bodyStyle={{ paddingBottom: 'var(--tri-card-gap)' }}
            >
              <HeardMotion />
              <ProposalStack />
            </Panel>
          </div>

          <div className="row-span-2 grid min-h-0 min-w-0 grid-rows-subgrid">
            <div className="flex min-h-0 min-w-0 flex-col gap-[var(--tri-gap)]">
            {/*
              The strip is as tall as the transcript needs, floored at the
              control height. items-center rather than items-stretch so the
              controls keep their own --tri-topbar-h height and sit on the
              strip's centre line — a button stretched to the full strip is a
              slab, and one left at its own height under `stretch` would hang
              off the top. At two lines the floor is what wins, but the rule
              has to hold either way.
            */}
            <div
              className="flex min-w-0 shrink-0 items-center gap-[var(--tri-gap)]"
              style={{ height: 'var(--tri-topbar-live-h)' }}
            >
              <div
                className="flex shrink-0 items-stretch gap-[var(--tri-gap)]"
                style={{ width: '21.5%', height: 'var(--tri-topbar-h)' }}
              >
                {VIEWS.map((m) => {
                  const active = m === view;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setView(m)}
                      aria-pressed={active}
                      className={cx(
                        'tri-rounded-control flex flex-1 cursor-pointer items-center justify-center text-[12.5px] font-medium lowercase tracking-wide transition-all select-none',
                        active
                          ? 'bg-[rgb(255_255_255_/_0.15)] font-semibold text-white shadow-[0_1px_4px_rgba(0,0,0,0.5)]'
                          : 'text-[rgb(255_255_255_/_0.78)] hover:bg-[rgb(255_255_255_/_0.06)] hover:text-white',
                      )}
                      style={EDGE}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
              {/* These two sized their own height off the strip when it
                  stretched them. The strip is now taller than a control, so
                  they get the control height explicitly and centre in it —
                  otherwise the orb, which is an aspect-square of h-full,
                  inflates to a three-line circle. */}
              <div
                className="flex shrink-0 items-stretch gap-[var(--tri-gap)]"
                style={{ height: 'var(--tri-topbar-h)' }}
              >
                <StatusOrb label={stateLabel} onClick={stepState} />
                <ListenControl />
              </div>

              {/* Live speech transcript in top header. Two lines here, the
                  whole scrollable log on the dashboard — so the pill routes
                  there rather than pretending to be the log. */}
              <HeaderKineticFocus
                spoken={engine.spoken}
                asr={engine.asr}
                onOpenDashboard={() => setView('dashboard')}
              />

              {/* Import Bento Pill Menu beside timer */}
              <ImportBentoMenu
                onImportImage={handleImportImage}
                onImportSlides={handleImportSlides}
                onImportSongs={handleImportSongs}
              />

              {/* Device Digital Clock Bento */}
              <DigitalClockBento />

              {/* Right: the service log.
                  Narrower on the operator view than it is on the dashboard,
                  and deliberately so. It shows one line here; the whole
                  history is a column on the dashboard now. The width it gives
                  up goes to the transcript beside it, which at 1280 was
                  truncating a preacher's sentence at about 28 characters —
                  the one thing in this strip that is worth more room. */}
              <div
                className="flex shrink-0 items-stretch"
                style={{ width: 'calc((100% + var(--tri-gap)) * 0.11 / 0.82)' }}
              >
                <ServiceLogBar entries={log.entries} onAction={goManual} />
              </div>
            </div>

            <Stage
              say={say}
              previewTheme={previewTheme}
              liveTheme={liveTheme}
              onPromoteTheme={() => {
                setLiveTheme(previewTheme);
                /* The two layout choices the projector reads from settings.
                   Written only here, on promote, so moving the safe area in
                   the preview never shifts words the room is reading. */
                void window.api?.setSetting?.('verseLayout', previewTheme.layout);
                void window.api?.setSetting?.('safeMargin', previewTheme.safeMargin);
                /*
                 * The reference's size and the space in front of it, in the
                 * units the wall reads (src/output.css). The editor's sliders
                 * are steps around zero; the wall scales a clamp() by a
                 * ratio, so the step becomes a multiplier on the same curve
                 * the reference already had.
                 *
                 * The gap is stored as ems of the BODY in the editor (that is
                 * what it is dragged against there) and as ems of the
                 * REFERENCE on the wall, so it is converted rather than
                 * copied — 0.45em of body at the default sizes is the 2em of
                 * reference that .output-ref used to hard-code as 4vh.
                 */
                const refScale = Math.max(0.28, 0.46 + previewTheme.verseSize * 0.035) / 0.46;
                void window.api?.setSetting?.('refScale', refScale);
                void window.api?.setSetting?.('refGap', (previewTheme.refGap / 0.45) * 2);
              }}
            />

            <div className="flex h-[var(--tri-field-h)] shrink-0 items-stretch gap-[var(--tri-gap)]">
              {TABS.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(i)}
                  className={cx(
                    'tri-rounded-control flex flex-1 items-center justify-center text-[length:var(--tri-size-xs)] lowercase transition-colors',
                    i === tab
                      ? 'bg-[rgb(255_255_255_/_0.06)] text-[var(--tri-ink)] font-semibold'
                      : 'text-[rgb(229_243_242_/_0.62)]',
                  )}
                  style={EDGE}
                >
                  {t.label}
                </button>
              ))}
            </div>
            </div>

            <Panel
              className="min-h-0"
              /* Themes sits on the panel like every other tab — see
                 ThemesEditor. Its inset is the stage's, --tri-gap all round,
                 because it seats a projector the same way the stage does. */
              bodyClass={TABS[tab]?.id === 'themes' ? undefined : 'pt-3'}
              bodyStyle={TABS[tab]?.id === 'themes' ? { padding: 'var(--tri-gap)' } : undefined}
            >
              {TABS[tab]?.id === 'themes' ? (
                <ThemesEditor
                  theme={previewTheme}
                  onChange={setPreviewTheme}
                  onReset={() => setPreviewTheme(DEFAULT_THEME)}
                />
              ) : null}
              {TABS[tab]?.id === 'scriptures' ? <ScripturesBrowser /> : null}
              {TABS[tab]?.id === 'songs' ? <SongsBrowser addRequest={songAddRequest} /> : null}
              {TABS[tab]?.id === 'slides' ? <SlidesBrowser /> : null}
              {TABS[tab]?.id === 'media' ? (
                <MediaBrowser
                  selected={previewTheme.backgroundId}
                  onSelect={(backgroundId) => {
                    setPreviewTheme((prev) => ({ ...prev, backgroundId }));
                    setTab(0);
                  }}
                />
              ) : null}
            </Panel>
          </div>
        </ViewEnter>
      )}

      {/* Hidden file pickers for web fallback */}
      <input
        ref={hiddenImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFilePicked}
        className="hidden"
      />
      <input
        ref={hiddenSlideInputRef}
        type="file"
        accept=".pptx,.ppt,.odp,.pdf"
        onChange={handleSlideFilePicked}
        className="hidden"
      />

    </>
  );
}
