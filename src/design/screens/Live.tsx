import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import ThinkingOrbsPill from '../orb/ThinkingOrbsPill';
import {
  ActionMenu,
  AddCard,
  Button,
  cx,
  ScanIcon,
  HistoryIcon,
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
  BookIcon,
  MusicIcon,
  TrashIcon,
  SlideThumb,
  PlusIcon,
  PlayIcon,
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
} from '../../ui';
import { BOOKS, CHAPTER_COUNTS } from '../../lib/books';
import { parseVerse } from '../../lib/scriptureText';
import { AppShell } from './AppShell';
import { DashboardBento } from './dashboard';
import { LibraryBrowser, LibraryPane, useLibrarySelection } from './library';
import { SlideCanvas } from './slide';
import { buildVerseSlides, type VerseSlide } from '../../../shared/verseDisplay';
import { SlidesBrowser } from './presentations';
import { StockSearch } from './stockSearch';
import { addMedia, mediaSrc, useMediaLibrary, type MediaSource } from './mediaLibrary';
import { ProjectorProvider, useProjector, type LiveItem } from './projector';
import { EngineProvider, useEngine, SLIDE_RULES, fitRules, fitOf, wordCount, FIT_WORDS, TIGHT_WORDS } from './engine';
import { RunProvider, useRun, type RunSegment, type QueueItem } from './run';
import { DragKeyframes, DragProvider, useDrag } from './drag';
import { Empty, Panel } from './parts';
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
  { id: 'scriptures', label: 'scriptures' },
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
  layout: 'top',
  safeMargin: 7,
};

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

/*
 * D-72 — the segment types a service is built from, plus a way out for the
 * ones no list will ever have.
 *
 * Ordered by how often a church reaches for one, NOT by where it falls in a
 * service. The list is scanned, not read: every service has worship and a
 * sermon, most have a welcome and announcements, and communion is monthly
 * at best — so chronological order buried the two universal ones in the
 * middle of the column. Running order is what the picking order sets (see
 * ArrangeList), which leaves this list free to be ordered by reach.
 */
const SEGMENT_TYPES: SelectOption[] = [
  { value: 'worship', label: 'worship' },
  { value: 'sermon', label: 'sermon' },
  { value: 'welcome', label: 'welcome' },
  { value: 'announcements', label: 'announcements' },
  { value: 'offering', label: 'offering' },
  { value: 'altar-call', label: 'altar call' },
  { value: 'closing', label: 'closing' },
  { value: 'communion', label: 'communion' },
  { value: 'custom', label: 'something else…' },
];

/*
 * What the "+" offers. Two ways in at the top level — scan the flyer the
 * church already made, or name a segment yourself — and the second opens the
 * list rather than flying it out sideways, because there is no room beside a
 * rail pinned to the left edge.
 */
const ADD_MENU: ActionMenuGroup[] = [
  {
    items: [
      /* The one route that saves real work: the church already made a flyer,
         so read it rather than retyping it. It gets the gradient; nothing
         else in the menu does, or the emphasis means nothing. */
      { id: 'scan', label: 'scan image', icon: <ScanIcon size={14} />, accent: true },
      {
        id: 'segment',
        label: 'add segment',
        icon: <PlusIcon size={13} />,
        /* Not a list of nine choices — a set you tick and put in order, which
           is what a run of service is. What you arrange here is literally
           what lands in the rail behind the menu. */
        arrange: true,
        items: SEGMENT_TYPES.map((t) => ({ id: t.value, label: t.label })),
      },
    ],
  },
  {
    /* Attaching to the service rather than building it — a clip or a note
       hangs off a segment rather than being one. Tiles because they are peers
       and neither leads anywhere. */
    layout: 'tiles',
    items: [
      { id: 'media', label: 'add media', icon: <MediaIcon size={15} /> },
      { id: 'note', label: 'add note', icon: <NoteIcon size={15} /> },
    ],
  },
];


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
  return (
    /*
     * The design as drawn: two control columns and the projector, except the
     * three are now three SURFACES rather than three regions of one panel
     * divided by a hairline.
     *
     * The hairline was doing a surface's job. Once the columns each sit on
     * their own background the grouping is carried by the boxes themselves —
     * which is what every other region of this screen already does — and the
     * divider becomes the thing it always was: a line drawn because the
     * groups were not visible otherwise.
     *
     * They are spaced on --tri-gap, the same gutter as the bento above, so
     * this panel's interior is on the screen's grid rather than a private
     * one. The halves stay equal by construction (flex-1 both sides) rather
     * than by ratio, so the split cannot drift as the controls change.
     */
    <div className="flex h-full gap-[var(--tri-gap)]">
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
            <Slider label="text size" value={theme.size} onChange={(size) => onChange({ ...theme, size })} min={-2} max={8} />
            <Slider label="verse size" value={theme.verseSize} onChange={(verseSize) => onChange({ ...theme, verseSize })} min={-2} max={8} />
            <Slider label="safe margin" value={theme.safeMargin} onChange={(safeMargin) => onChange({ ...theme, safeMargin })} min={3} max={16} />
            <DisplayFontPicker value={theme.font} onChange={(font) => onChange({ ...theme, font })} />
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

      <ThemePreview theme={theme} />
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
     * The left half — its own surface, matching the stage row above: two
     * boxes side by side on --tri-gap, equal by construction (basis-1/2 on
     * both) rather than by flex ratio, so the seam lands dead centre and
     * cannot drift as either side gains contents.
     *
     * Padding is --tri-card-gap on all four sides — the system's concentric
     * inset, px and py the same number, a frame rather than a margin.
     *
     * The mask lives on the scroller INSIDE the surface, not on the surface
     * itself: applied out here it would fade the box's own bottom corners
     * along with the content, and a surface that dissolves at one end reads
     * as a rendering fault rather than as more-below.
     */
    <div
      className="tri-rounded-surface flex min-h-0 basis-1/2 flex-col overflow-hidden bg-[rgb(255_255_255_/_0.032)] px-[var(--tri-card-gap)] py-[var(--tri-card-gap)]"
      style={{ boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.075)' }}
    >
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
function ThemePreview({ theme }: { theme: ThemeSettings }) {
  return (
    <div className="flex min-h-0 min-w-0 basis-1/2 items-center justify-center">
      <SlideCanvas theme={theme} slide={THEME_SPECIMEN} guide />
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
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
        <MediaGrid
          add={shelf === 'local' ? { label: 'add media', hint: 'an image from this computer' } : null}
          onAdd={() => {
            /* The engine copies the file into its own folder — so the
               background survives the USB stick being pulled — and makes it
               the projector's background. It lands on this shelf and is
               selected, the same as a stock pick. */
            void window.api?.pickBackgroundImage?.().then((res) => {
              if (!res?.success || !res.url) return;
              const name = decodeURIComponent(res.url.split('/').pop() ?? 'background');
              const media = {
                id: `local:${res.url}`,
                label: name.replace(/\.[a-z0-9]+$/i, ''),
                detail: 'from this laptop',
                seed: 4,
                style: 'smoke' as const,
                source: 'local' as const,
                url: res.src ?? res.url,
                kind: 'photo' as const,
              };
              addMedia(media);
              onSelect(media.id);
            });
          }}
        >
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
                  }))
                : {})}
            >
              <MediaCard
                src={mediaSrc(media)}
                label={media.label}
                detail={media.detail}
                selected={selected === media.id}
                badge={selected === media.id ? 'in use' : null}
                onClick={() => onSelect(media.id)}
              />
            </div>
          ))}
        </MediaGrid>
      ) : (
        <MediaGrid add={{ label: 'add media', hint: 'image, video, loop' }}>
          {SERVICE_MEDIA.map((item) => (
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
function MediaGrid({
  add,
  onAdd,
  children,
}: {
  add: { label: string; hint: string } | null;
  onAdd?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-0 auto-rows-min grid-cols-5 gap-x-3 gap-y-4 overflow-y-auto px-1 pb-3">
      {add ? <AddCard label={add.label} hint={add.hint} onClick={onAdd} /> : null}
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
function SongsBrowser() {
  const [openId, setOpenId] = useState<string | null>(null);
  /* The grid's search outlives a visit to a song: search "amazing", open
     it, come back, and the grid is still where you left it. The sheet's own
     search does not outlive the song, which is what the key below says. */
  const [query, setQuery] = useState('');
  /* Deleted songs, by id. SONGS is a seed list in this sandbox, so a
     delete cannot remove a row from anywhere — it hides one here, which is
     enough for the card's button to be a real gesture rather than a dead
     shape. Swap for the store's own delete when the library is backed. */
  const [deleted, setDeleted] = useState<ReadonlySet<string>>(() => new Set());

  /*
   * The library, when there is one.
   *
   * With an engine the grid is the song store — the same songs.json the rest
   * of the app reads, seeded hymns included — so a song added here is there
   * next Sunday. With no bridge it is still the seed list, which is what
   * keeps this a reviewable sheet in a browser tab.
   */
  const store = typeof window === 'undefined' ? undefined : window.api?.songs;
  const [stored, setStored] = useState<Song[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const refresh = useCallback(() => {
    if (!store) return;
    void store
      .list()
      .then((list) =>
        setStored(
          list.map((song) => ({
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

  /* Pick files, write them, show them. The store names likely duplicates in
     its report rather than dropping them, so the note says what happened. */
  const addSongs = async () => {
    if (!store) return;
    const picked = await store.importFiles();
    if (!picked?.success || !picked.songs?.length) {
      if (picked?.errors?.length) setNote(`could not read ${picked.errors.map((e) => e.file).join(', ')}`);
      return;
    }
    await store.importCommit(picked.songs);
    setNote(`added ${picked.songs.length} song${picked.songs.length === 1 ? '' : 's'}`);
    refresh();
  };

  const songs = useMemo(
    () => (stored ?? SONGS).filter((s) => !deleted.has(s.id)),
    [stored, deleted],
  );
  const open = songs.find((s) => s.id === openId);

  return open ? (
    <SongSheet key={open.id} song={open} onBack={() => setOpenId(null)} />
  ) : (
    <SongGrid
      songs={songs}
      query={query}
      onQuery={setQuery}
      onOpen={setOpenId}
      onAdd={store ? () => void addSongs() : undefined}
      note={note}
      onDelete={(id) => {
        setDeleted((d) => new Set(d).add(id));
        if (store) void store.remove(id).then(refresh).catch(() => undefined);
      }}
    />
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
  onDelete,
  onAdd,
  note,
}: {
  songs: readonly Song[];
  query: string;
  onQuery: (q: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  /** Absent with no engine, which leaves the card drawn but inert. */
  onAdd?: () => void;
  note?: string | null;
}) {
  const drag = useDrag();
  const projector = useProjector();

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
        <SearchField
          value={query}
          onChange={onQuery}
          placeholder="type a song name or lyrics..."
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
          <div className="grid auto-rows-min grid-cols-5 gap-x-3 gap-y-4 px-5 pt-4 pb-5">
            {/*
              "add song" is a card in the grid, not a button in a band
              above it: it is the same shape as what it makes — an empty
              slide where the next song goes — which is a better
              explanation of what it does than the words are. First,
              because the way to add a song should be where the eye starts
              and not behind however many rows the library has grown to.
              Only on an unfiltered grid: a search that found nothing
              should say so, not offer to make a song out of the search
              text.
            */}
            {needle === '' ? (
              <AddCard label="add song" hint={note ?? 'chordpro, openlyrics or .txt'} onClick={onAdd} />
            ) : null}

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

                    The whole cell lifts on hover, so the thing that
                    answers the pointer is the card, not the picture
                    inside it.
                  */
                  /*
                    A rule under each cell, like the foot of a list row.
                    1px and faint — a line between rows, not an outline,
                    so it is not --tri-border (see the token's note). It
                    gives the grid a baseline the captions sit on, which
                    the eye wants once there are two lines of text under
                    every picture.
                  */
                  className="group/card pb-3 transition-transform duration-150 ease-out hover:-translate-y-[2px]"
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
                          'truncate text-[length:var(--tri-size-sm)] font-semibold leading-[1.25] transition-colors',
                          live
                            ? 'text-[var(--tri-accent-yellow)]'
                            : 'text-[rgb(229_243_242_/_0.86)] group-hover/card:text-[var(--tri-ink)]',
                        )}
                      >
                        {song.title}
                      </p>
                      {/* Quiet by a wide margin. The artist settles ties
                          between two songs of the same name; it is never
                          what the eye should land on first. */}
                      <p className="mt-[2px] truncate text-[length:var(--tri-size-xs)] leading-[1.3] text-[rgb(229_243_242_/_0.42)]">
                        {song.author}
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
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        title={`edit ${song.title}`}
                        aria-label={`edit ${song.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(song.id);
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

const EMPTY_SEGMENT_HINT = 'use + , or hold a row below and drag it here';

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
  onLive,
  onDismiss,
}: {
  heard: Heard;
  index?: number;
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
      className={cx(
        surface({ tone: 'indigo', shape: 'panel', wide: true }),
        'relative isolate shrink-0 overflow-hidden p-3',
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
          onClick={onDismiss}
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
          onClick={onLive}
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
function SpokenLyrics() {
  const { spoken } = useEngine();
  const shown = spoken.lines.slice(-5);
  return (
    <div
      className="flex h-full flex-col justify-center overflow-hidden px-3"
      style={{
        maskImage: 'linear-gradient(to bottom, transparent 0, black 28%, black 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 28%, black 100%)',
      }}
    >
      <style>{`@keyframes tri-lyric-in { from { opacity: 0; transform: translateY(14px); } }`}</style>
      <div className="flex flex-col justify-end gap-2.5">
        {shown.map((line, i) => {
          const age = shown.length - 1 - i + (spoken.partial ? 1 : 0);
          return (
            <p
              key={line.id}
              className="text-center leading-[1.5] text-[var(--tri-ink)]"
              style={{
                fontSize: age === 0 ? 13 : 12,
                opacity: Math.max(0.16, 0.9 - age * 0.22),
                transition: 'opacity 400ms var(--tri-ease-out), font-size 400ms var(--tri-ease-out)',
                animation: 'tri-lyric-in 360ms var(--tri-ease-out) both',
              }}
            >
              {line.text}
            </p>
          );
        })}
        {spoken.partial && (
          <p className="text-center text-[13px] leading-[1.5] text-[var(--tri-ink)]">
            {spoken.partial}
            <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-[rgb(228_216_122_/_0.8)]" />
          </p>
        )}
      </div>
    </div>
  );
}

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
    const hearing = engine.spoken.lines.length > 0 || engine.spoken.partial !== '';
    if (engine.asr === 'listening' && hearing) return <SpokenLyrics />;
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
      {cards.map((c, i) => (
        <DetectedScripture
          key={c.id}
          heard={c}
          index={i}
          /* Only wired when there is an engine. A seed card with a live
             button that did nothing would be worse than one that plainly
             cannot be pressed. */
          onLive={
            live && !c.missing
              ? () => {
                  /* Straight to the wall. The operator answering a proposal
                     HAS looked at it — the words are on the card — so a
                     second stop in the preview box would be a step that
                     asks them to read what they just read. */
                  const item: LiveItem = {
                    source: 'scripture',
                    id: c.ref,
                    label: c.ref,
                    reference: c.ref,
                    version: c.version,
                    text: c.text,
                    slides: c.slides,
                    verses: c.verses,
                    origin: 'engine',
                  };
                  /* origin 'engine' means main already holds it as its own
                     preview, so this is a promote and not a round trip. */
                  engine.pushEnginePreview();
                  projector.send(item);
                  engine.dismissProposal(c.id);
                }
              : undefined
          }
          onDismiss={live ? () => engine.dismissProposal(c.id) : undefined}
        />
      ))}
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

/** The hover ✕ on a queued item. Parent row needs the `group` class. */
function RemoveItem({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="remove"
      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-60 hover:opacity-100"
    >
      <PlusIcon size={10} className="rotate-45" />
    </button>
  );
}

/*
 * The source's own mark, standing where the dash was.
 *
 * A dash says "an item"; the operator's question is "WHICH item", and at a
 * glance, mid-service. So scripture wears the book, a song the note pair, a
 * note its page — and an image shows the image itself, because no glyph
 * reminds anyone which photo they queued. Mint, like the menu's icons: the
 * marks are wayfinding, not content.
 */
function ItemMark({ item }: { item: QueueItem }) {
  if ((item.source === 'media' || item.source === 'presentation') && item.preview) {
    return <img src={item.preview} alt="" className="size-[18px] shrink-0 rounded-[5px] object-cover" />;
  }
  const cls = 'shrink-0 text-[rgb(143_211_192_/_0.6)]';
  if (item.source === 'scripture') return <BookIcon size={12} className={cls} />;
  if (item.source === 'song') return <MusicIcon size={12} className={cls} />;
  if (item.source === 'note') return <NoteIcon size={12} className={cls} />;
  return <MediaIcon size={12} className={cls} />;
}

/** One queued thing, with what its source earns it: a verse can go live
    from here, a note is edited in place, an image shows itself. */
function QueuedItemRow({ segKey, item }: { segKey: string; item: QueueItem }) {
  const run = useRun();
  const projector = useProjector();
  const engine = useEngine();
  const isVerse = item.source === 'scripture';
  const canGoLive = isVerse || (item.source === 'song' && !!item.lines) || !!item.path;
  const live = canGoLive && projector.isLive(item.source === 'note' ? 'scripture' : item.source, item.label);

  /* A verse is pushed through the engine, which looks the text up and logs
     the review item — sending it to the projector context alone would light
     the row and show the congregation nothing. A song or a picture carries
     its own content and goes straight out. */
  const putUp = () => {
    if (isVerse) {
      engine.pushReference(item.label);
      projector.send({ source: 'scripture', id: item.label, label: item.label });
    } else if (item.source === 'song' && item.lines) {
      projector.send({
        source: 'song',
        id: item.label,
        label: item.label,
        title: item.title,
        section: item.section,
        lines: item.lines,
      });
    } else if (item.path && (item.source === 'media' || item.source === 'presentation')) {
      projector.send({ source: item.source, id: item.label, label: item.label, path: item.path });
    }
  };

  return (
    <li className="group flex items-center gap-2 rounded-[8px] bg-[rgb(0_0_0_/_0.14)] px-2 py-[5px] text-[length:var(--tri-size-body)] text-[rgb(229_243_242_/_0.62)]">
      <ItemMark item={item} />

      {item.source === 'note' ? (
        /* The row IS the editor. No edit mode, no pencil, no dialog — a note
           in the run is a line of text you can always put the cursor in. */
        <input
          value={item.label}
          onChange={(e) => run.updateItem(segKey, item.key, e.target.value)}
          placeholder="type a note…"
          className="min-w-0 flex-1 bg-transparent text-[length:var(--tri-size-body)] text-[rgb(229_243_242_/_0.72)] placeholder:text-[rgb(229_243_242_/_0.28)] focus:outline-none"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      )}

      {canGoLive && (
        /*
         * The push. A single deliberate click, not the browser's
         * double-click: everything in this list was queued on purpose
         * before the service, which is the deliberation the two-step
         * gesture exists to force. Hidden until hover while idle; once
         * live it holds the gold pill and clicking again takes it down.
         */
        <button
          type="button"
          onClick={() => (live ? projector.clear() : putUp())}
          title={live ? 'take it off the projector' : `put this ${isVerse ? 'verse' : item.source} on the projector`}
          className={cx(
            'shrink-0 rounded-full px-1.5 py-[1px] text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.12em] transition-all',
            live
              ? 'bg-[rgb(228_216_122_/_0.16)] text-[#e4d87a]'
              : 'text-[rgb(229_243_242_/_0.4)] opacity-0 hover:text-[#e4d87a] group-hover:opacity-100',
          )}
        >
          live
        </button>
      )}

      <RemoveItem onClick={() => run.remove(segKey, item.key)} />
    </li>
  );
}

/**
 * The run list — the cards variant carrying the rows variant's anatomy.
 *
 * Chosen from four live candidates, then merged: the slab is what won from
 * cards — each segment a physical object in the system's own gradient
 * surface, so state lives in the material (hover lights it like a button,
 * the open card holds the active alpha, a drop target turns gold) — and the
 * row anatomy is what won from rows: the quiet tabular number in the
 * margin, the count pill, the chevron, dash items. The cards variant's
 * ghost numerals are gone at the owner's call; the margin number carries
 * the order on its own.
 */
function RunOfService() {
  const run = useRun();
  const drag = useDrag();

  if (run.segments.length === 0) {
    return <Empty>nothing in the run yet — use + to pick and order the segments</Empty>;
  }

  return (
    /* The panel body clips; the list scrolls inside it, so a long service
       never pushes the cards out of reach under the panel's edge. */
    <ul className="h-full overflow-y-auto flex flex-col gap-[6px] px-1 py-1.5">
      {run.segments.map((seg, i) => {
        const open = run.isOpen(seg.key);
        const over = drag.over === seg.key;
        return (
          <li
            key={seg.key}
            {...drag.dropProps(seg.key)}
            data-active={open || undefined}
            className={cx(
              surface({ shape: 'panel', wide: true, interactive: true }),
              over && 'tri-surface--gold',
              'relative shrink-0 overflow-hidden',
            )}
            /*
             * The system teal, held at half its resting voltage. Only the
             * REST alpha is overridden — hover and the open card's active
             * state still reach their full values through the normal
             * channels, so a card wakes up exactly like every other control
             * and merely sleeps more quietly.
             */
            style={{ borderRadius: 12, '--tri-alpha-rest': 0.15 } as React.CSSProperties}
          >
            <div className="flex items-center gap-2 py-[6px] pl-2.5 pr-[7px]">
              <button
                type="button"
                onClick={() => run.toggleOpen(seg.key)}
                className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-[length:var(--tri-size)] lowercase"
              >
                <span className="w-4 shrink-0 text-right text-[length:var(--tri-size-xs)] tabular-nums text-[rgb(229_243_242_/_0.38)]">
                  {i + 1}
                </span>
                {/* The chevron rides the name rather than the far edge: it
                    belongs to what it discloses, and out at the edge it was
                    one more thing in the button cluster. */}
                <span
                  className={cx(
                    'min-w-0 truncate transition-colors',
                    open ? 'text-[var(--tri-ink)]' : 'text-[rgb(229_243_242_/_0.72)]',
                  )}
                >
                  {seg.label}
                </span>
                <ChevronDownIcon
                  size={10}
                  className={cx(
                    'shrink-0 text-[rgb(229_243_242_/_0.4)] transition-transform duration-150',
                    open ? 'rotate-0' : '-rotate-90',
                  )}
                />
                <span className="min-w-0 flex-1" />
                {seg.items.length > 0 && (
                  <span className="shrink-0 rounded-full bg-[rgb(255_255_255_/_0.08)] px-1.5 text-[length:var(--tri-size-xs)] tabular-nums text-[rgb(229_243_242_/_0.55)]">
                    {seg.items.length}
                  </span>
                )}
              </button>
              <SegmentAdd seg={seg} />
              {/* The undo of the +, in the danger set, glyph only — the
                  trash already says it, and a card is no place for the word
                  "delete" seven times over. */}
              <button
                type="button"
                onClick={() => run.removeSegment(seg.key)}
                title={`remove ${seg.label} from the run`}
                className={cx(
                  surface({ tone: 'danger', interactive: true }),
                  'flex size-[22px] shrink-0 items-center justify-center text-[var(--tri-ink-danger)]',
                )}
                style={{ borderRadius: 8 }}
              >
                <TrashIcon size={11} />
              </button>
            </div>

            {open && (
              <div className="px-2.5 pb-2">
                {/* The rule starts where the name starts, not at the card
                    edge — contents belong to the name, not to the slab. */}
                <div aria-hidden className="mb-1 ml-6 h-px bg-[rgb(255_255_255_/_0.07)]" />
                {/* Separated by shape, not by rule. Hairlines here fought
                    the one under the header — two grades of horizontal line
                    in a 200px card, with the lesser one running longer. A
                    faint well under each row makes the entries discrete the
                    way the cards themselves are: fills on a surface, and
                    the header rule stays the only line in the card. */}
                <ul className="flex flex-col gap-[3px]">
                  {seg.items.length === 0 ? (
                    <li className="px-2 py-[3px] text-[length:var(--tri-size-body)] lowercase text-[rgb(229_243_242_/_0.32)]">
                      {EMPTY_SEGMENT_HINT}
                    </li>
                  ) : (
                    seg.items.map((item) => (
                      <QueuedItemRow key={item.key} segKey={seg.key} item={item} />
                    ))
                  )}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
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
interface LogSeed {
  text: string;
  /** The way out, when there is one. Rendered as its own row beneath. */
  action?: { label: string };
}

interface LogEntry extends LogSeed {
  id: number;
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
      : LOG_SEED.map((seed, i) => ({ ...seed, id: i })),
  );

  const say = useCallback((seed: LogSeed) => {
    setEntries((list) => [
      ...list.slice(-7),
      { ...seed, id: nextId.current++ },
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


/** Two visible rows; a third is rendered so it can be clipped as it goes. */
const LOG_ROWS = 2;

interface LogRow {
  key: string;
  text: string;
  /** An action row is the way out of the line above it, not an event. */
  isAction: boolean;
}

/**
 * The bar. Bottom-anchored inside a fixed two-row window: a new line
 * appears at the bottom and the one above it moves up by exactly one row,
 * which is the whole animation. The stack is keyed on the newest row so
 * the rise restarts on every arrival.
 *
 * Both rows are at full strength. An earlier pass faded the older line to
 * half — with three rows that was a reading order, but at two rows the
 * older line is the only context there is, and dimming half of a
 * two-line log is dimming half the log.
 */
function ServiceLogBar({ entries, onAction }: { entries: LogEntry[]; onAction: () => void }) {
  const rows = useMemo<LogRow[]>(
    () =>
      entries.flatMap((e) =>
        e.action
          ? [
              { key: `${e.id}`, text: e.text, isAction: false },
              { key: `${e.id}-do`, text: e.action.label, isAction: true },
            ]
          : [{ key: `${e.id}`, text: e.text, isAction: false }],
      ),
    [entries],
  );

  const shown = rows.slice(-(LOG_ROWS + 1));
  const newest = shown[shown.length - 1]?.key ?? '';

  return (
    <div
      className="tri-rounded-control relative min-w-0 flex-1"
      style={{
        ...EDGE,
        /*
         * Leading, not layout. Splitting the bar's height in two gave each
         * row half of 46px and the pair read as two unrelated lines with a
         * gap between them — a log is one block of text, and consecutive
         * lines of it belong close enough to be read as consecutive. So
         * the row is sized off the TYPE (5px of leading on the type size)
         * and the resulting two-row block is centred in the bar instead.
         */
        ['--tri-log-row' as string]: 'calc(var(--tri-size-xs) + 5px)',
        /*
         * One inset, all four sides. The two-row block is centred, so
         * whatever is left over above it is the gap — and the text is
         * held off the left edge by exactly that same figure rather than
         * by a hand-typed 8px that only matched at one density tier. The
         * line then sits in the box evenly, which is the only reason the
         * gap is worth deriving at all.
         */
        ['--tri-log-gap' as string]:
          'calc((var(--tri-topbar-h) - var(--tri-log-row) * 2) / 2)',
      }}
    >
      {/*
        The window is its own box, EXACTLY two rows tall and centred in
        the bar. Both halves matter: the stack renders a third row on
        purpose — the one on its way out — and a window of exactly two is
        what holds it out of sight until the rise carries it through
        (clip on the outer box instead and a 2px sliver of it shows above
        the top line, which looks like a rendering fault and is one).
      */}
      <div
        className="absolute top-1/2 -translate-y-1/2 overflow-hidden"
        style={{
          left: 'var(--tri-log-gap)',
          right: 'var(--tri-log-gap)',
          height: 'calc(var(--tri-log-row) * 2)',
        }}
      >
        <div key={newest} className="tri-log-stack absolute inset-x-0 bottom-0 flex flex-col">
          {shown.map((row) => {
            /* One row shape for both kinds, so the text starts on the same
               pixel whether the line is an event or the way out of one. */
            const common =
              'flex h-[var(--tri-log-row)] shrink-0 items-center gap-2 text-[length:var(--tri-size-xs)] leading-none lowercase text-[var(--tri-accent-yellow)]';
            return row.isAction ? (
              <div key={row.key} className={common}>
                <button
                  type="button"
                  onClick={onAction}
                  className={cx(
                    'flex items-center gap-1 leading-none underline underline-offset-2',
                    'transition-[text-decoration-thickness] hover:decoration-[1.5px]',
                  )}
                >
                  <span aria-hidden>←</span>
                  {row.text}
                </button>
              </div>
            ) : (
              <div key={row.key} className={common}>
                <span className="min-w-0 flex-1 truncate">{row.text}</span>
              </div>
            );
          })}
        </div>
      </div>
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
          ? 'engine error'
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
        'tri-rounded-control flex shrink-0 items-center gap-2 px-3 text-[length:var(--tri-size-xs)] lowercase transition-colors',
        !caps.bridge
          ? 'cursor-not-allowed text-[rgb(229_243_242_/_0.3)]'
          : on
            ? 'text-[var(--tri-ink)]'
            : 'text-[rgb(229_243_242_/_0.62)] hover:text-[var(--tri-ink)]',
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

/** The line under a canvas naming what is on it. */
function StageCaption({ item }: { item: LiveItem | null }) {
  return (
    <span className="min-w-0 flex-1 truncate text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.45)]">
      {item ? item.label : '—'}
    </span>
  );
}

/** "Genesis 1:4-5" → its parts. Null for anything that is not a verse. */
function parseStagedRef(reference?: string): { book: string; chapter: number; start: number; end: number } | null {
  const m = reference?.match(/^(.+?)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if (!m) return null;
  const start = Number(m[3]);
  return { book: m[1], chapter: Number(m[2]), start, end: m[4] ? Number(m[4]) : start };
}

/** The verse before, the verse after — a tall quiet strip beside the slide. */
function StepArrow({ dir, onClick, disabled }: { dir: 1 | -1; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={dir === 1 ? 'next verse' : 'previous verse'}
      className={cx(
        surface({ tone: 'ash', shape: 'control', interactive: !disabled }),
        'flex w-7 shrink-0 items-center justify-center text-[15px] text-[rgb(229_243_242_/_0.7)]',
        disabled && 'opacity-30',
      )}
    >
      {dir === 1 ? '›' : '‹'}
    </button>
  );
}

function Stage({ theme }: { theme: ThemeSettings }) {
  const projector = useProjector();
  const engine = useEngine();
  const { preview, live, slide, screen } = projector;

  /*
   * Staged readings show their first slide, always.
   *
   * The preview box deliberately does NOT get its own slide cursor. Two
   * cursors is two places to be lost, and what the operator wants from the
   * left box is "what will appear when I press this" — which is slide one.
   * Stepping belongs to the reading that is actually out in the room.
   */
  const staged = preview?.slides?.[0] ?? null;
  const onAir = live?.slides?.[Math.min(slide, (live.slides?.length ?? 1) - 1)] ?? null;

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

  return (
    <div className="flex min-h-0 flex-1 gap-[var(--tri-gap)]">
      {/*
        The halves are equal by construction (basis-1/2 on both) rather
        than by flex ratio: with the same basis they shrink by the same
        amount to make room for the gap, so the split lands dead centre
        and cannot drift as either side gains contents. Same reasoning as
        the themes editor below.
      */}
      <Panel
        className="basis-1/2"
        title="preview"
        bodyClass="pt-3"
        right={
          <div
            className="flex items-center gap-[var(--tri-gap)]"
            style={{ '--tri-control-h': '26px', '--tri-control-pad-x': '10px' } as React.CSSProperties}
          >
            {preview && (
              <Button
                label=""
                tone="ash"
                icon={<PlusIcon size={12} className="rotate-45" />}
                title="unstage — take it out of preview"
                onClick={() => projector.stage(null)}
              />
            )}
            {/* The one act on this screen that reaches the congregation, in
                the one colour reserved for that. Disabled rather than hidden
                with nothing staged: the operator should be able to see where
                the push lives before they have something to push. */}
            <Button
              label="go live"
              tone="gold"
              disabled={!preview}
              title={preview ? `put ${preview.label} on the projector` : 'stage something first'}
              onClick={goLive}
            />
          </div>
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-2">
          <div className="flex min-h-0 flex-1 items-stretch gap-1.5">
            {stagedRef && <StepArrow dir={-1} onClick={() => step(-1)} disabled={stagedRef.start <= 1} />}
            <div className="min-h-0 min-w-0 flex-1">
              <SlideCanvas theme={theme} slide={staged} empty="nothing staged" />
            </div>
            {stagedRef && <StepArrow dir={1} onClick={() => step(1)} />}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StageCaption item={preview} />
            {preview?.source === 'scripture' && words > 0 && (
              <span
                className="shrink-0 text-[length:var(--tri-size-xs)] tabular-nums"
                style={{ color: fit === 'fits' ? 'rgb(143 211 192 / 0.8)' : fit === 'tight' ? 'rgb(228 216 122 / 0.85)' : '#eac7c6' }}
                title={`one slide reads comfortably up to ${FIT_WORDS} words and holds about ${TIGHT_WORDS}`}
              >
                {words} words · {together || !range ? fit : 'split'}
              </span>
            )}
            {range && (
              <button
                type="button"
                onClick={reslice}
                className={cx(
                  surface({ tone: 'ash', shape: 'control', interactive: true }),
                  'tri-label shrink-0 px-2 py-[3px] lowercase text-[var(--tri-ink)]',
                )}
                title={together ? 'show one verse per slide' : 'show the verses together on one slide'}
              >
                {together ? 'separate' : 'together'}
              </button>
            )}
            {/* The staged reading's length, without a cursor to move — it
                says "this is three screens" before the operator commits to
                reading it out. */}
            {(preview?.slides?.length ?? 0) > 1 && (
              <span className="shrink-0 text-[length:var(--tri-size-xs)] tabular-nums text-[rgb(229_243_242_/_0.4)]">
                {preview!.slides!.length} slides
              </span>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        className="basis-1/2"
        title="live"
        bodyClass="pt-3"
        /* Panel already ships a gold ring as tone='live'. Using it rather
           than drawing a second highlight is what keeps "this is live" one
           visual idea across the whole app. */
        tone={live && !blacked ? 'live' : 'default'}
        right={
          <div
            className="flex items-center gap-[var(--tri-gap)]"
            style={{ '--tri-control-h': '26px', '--tri-control-pad-x': '10px' } as React.CSSProperties}
          >
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
            {/* Black is the panic button, so it toggles and says which way
                it is pointing. A control that reads "black" while the screen
                is already black is the one you press twice. */}
            <Button
              label={blacked ? 'unblack' : 'black'}
              tone={blacked ? 'gold' : 'ash'}
              title={blacked ? 'put the screen back' : 'kill the screen'}
              onClick={() => {
                const next = blacked ? 'live' : 'black';
                engine.setScreen(next);
                projector.setScreen(next);
              }}
            />
            <Button
              label=""
              tone="ash"
              icon={<MediaIcon size={13} />}
              disabled={!engine.caps.bridge}
              title={engine.caps.bridge ? 'open the projector window' : 'no engine — run with SANDBOX=1'}
              onClick={engine.openProjector}
            />
          </div>
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-2">
          <div className="min-h-0 flex-1">
            <SlideCanvas
              theme={theme}
              slide={onAir}
              screen={screen}
              empty="nothing on the projector"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StageCaption item={live} />
            <SlidePager
              at={Math.min(slide, (live?.slides?.length ?? 1) - 1)}
              total={live?.slides?.length ?? 0}
              onStep={(d) => projector.stepSlide(d)}
            />
          </div>
        </div>
      </Panel>
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
  const [tab, setTab] = useState(1);
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);

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

  /* The bar's contents. The log listens to the state so a change speaks
     for itself, and the one action any line offers lands back here. */
  const log = useServiceLog(stateLabel);
  const say = log.say;
  const goManual = useCallback(() => say({ text: "suggestions off — you're driving" }), [say]);

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
      <div className="flex h-full gap-[var(--tri-gap)] p-2.5">
        {/* Rail — 18% of the width, full height, split in two.

            A flat 18% now the tab strip no longer spans it: the old
            one-tab-pill construction was measured against a strip that
            reached the window edge, and there is nothing left down there
            for the rail to share an edge with.

            Operator posture only. The dashboard is read, not worked, and a
            control column beside a surface with no controls is 18% of the
            window spent on something nobody is going to touch — so the rail
            leaves with the rest of the body rather than staying as a frame
            around it. See ./dashboard.

            The COLUMN stays, though, even when the rail does not. The rail
            and the context bar are siblings in this row, so taking the
            column out of the flow moves the bar with it: the whole top strip
            slid left by the rail's width and then stretched to fill the
            space, which also resized the view switch inside it. That switch
            is the one control the two postures share — it is the way back —
            and a control that jumps a quarter of the window the instant you
            press it is a control you have to find again.

            So the dashboard holds the same measure open on the same side and
            draws nothing in it. The top of the window is then identical in
            both postures, and the run of service keeps its header level with
            the bar, because neither one has moved. */}
        {view === 'operator' ? (
        // The whole rail is a drop target, not just the segments in it.
        // data-drop-segment with an EMPTY value means "the run, but nowhere
        // in particular" — the drag layer reads that as a drop with no
        // segment and dropInto makes the one the carry belongs in. Without
        // this the rail was inert until the operator had already built it by
        // hand, which is the wrong way round. Segments inside carry their
        // own key and win, because elementFromPoint finds the innermost.
        <div
          data-drop-segment=""
          className="flex shrink-0 flex-col gap-[var(--tri-gap)]"
          style={{ width: 'var(--tri-rail-w)' }}
        >
          {/* Named, so the empty box says what it is for. The rail is the
              order of service — what is coming next, in sequence — which is
              a different question from anything the browser below answers. */}
          <Panel
            title={`run of service (${run.segments.length})`}
            className="flex-1"
            /* The header band is --tri-bar-h, and this is the one panel that
               must not be: it starts at the window's ceiling level with the
               context bar, so its band is scoped up to the taller strip
               token. Every other panel header on the screen keeps the bar
               height — they sit under this line, not on it. */
            style={{ '--tri-bar-h': 'var(--tri-topbar-h)' } as React.CSSProperties}
            /* C-01 twice, in the header's `right` slot — the slot exists for
               exactly this, so the panel gets its actions without any new
               layout around it. The pair is spaced on the same 0.45rem the
               regions of the screen are, so two buttons in a header read at
               the same rhythm as everything else on it. */
            right={
              /*
               * One step down from the control height, via the tokens rather
               * than a size prop: Button reads --tri-control-h and its
               * padding from the vars, so scoping smaller values to this
               * wrapper resizes the pair without Button learning a "small"
               * variant it has not earned yet.
               */
              <div
                className="flex items-center gap-[var(--tri-gap)]"
                style={
                  {
                    '--tri-control-h': '26px',
                    '--tri-control-pad-x': '8px',
                  } as React.CSSProperties
                }
              >
                <ActionMenu
                  groups={ADD_MENU}
                  onArrange={(_parent, picked) => run.addSegments(picked)}
                  trigger={<Button label="" icon={<PlusIcon size={12} />} title="add to the run" />}
                />
                {/* Ash — the system's neutral, for a control that is not
                    about anything in particular. Next to a "+" that is the
                    whole point of the header, a second teal button would
                    read as a second primary action; ash lets it sit there
                    without competing.

                    Inert for now, like the settings glyph on the context
                    bar: the button is the design decision, and what history
                    the rail keeps is not one this screen gets to make. */}
                <Button
                  label=""
                  tone="ash"
                  icon={<HistoryIcon size={12} />}
                  title="history"
                />
              </div>
            }
          >
            <RunOfService />
          </Panel>

          {/*
            The lower box, unnamed — the drawing gives it no words, and
            naming it here would be inventing a job for it.

            Exactly the browser's height, so the rail's divide falls on the
            browser's top edge: the gap under the tab strip runs unbroken
            across the whole window as one line, rather than the rail
            breaking somewhere near it. The tab strip therefore has the top
            box beside it, not this one.

            The 40% MUST track the browser panel's h-[40%] below — it is the
            one number written in two places, and there is no way to say it
            once, because Tailwind cannot read a height off a sibling.
          */}
          {/* pt-3 because the panel body ships px-3 pb-3 and no top — fine
              under a header band, wrong here: this box has no header, so
              without it the first card sat flat against the panel's ceiling
              with an inset on its other three sides. The note below has
              always said the top gap comes from the panel; now it does. */}
          {/* The body's own pb-3 is overridden to --tri-card-gap, the inset
              the themes surface opposite gives ITS scroller. Both panels are
              the same 40% of the same height, so matching the inset is what
              puts the two fades on one line across the foot of the window
              instead of 7px apart — which, on two dissolving edges, reads as
              one of them being wrong. Inline rather than in bodyClass: the
              panel joins its classes with cx, so a second pb-* would sit
              beside pb-3 and let source order pick the winner. */}
          <Panel
            className="h-[40%] shrink-0"
            bodyClass="pt-3"
            bodyStyle={{ paddingBottom: 'var(--tri-card-gap)' }}
          >
            {/*
              The proposals, top-down and newest first.

              The mic box that used to hold this ceiling is gone. It was an
              on-switch for a service that has one starting moment, parked
              permanently in the one column the operator watches all through
              the sermon — so it spent the whole service being a control
              nobody would touch again, above the only thing here that is
              ever news. The panel is the proposals now, and nothing else.

              A column rather than a floor-pinned single: catches arrive
              while earlier ones are still unanswered, and a stack is the
              only arrangement that does not make the second one destroy the
              first. Cards keep their natural height and the column scrolls
              past three, which is the same bargain every fixed-height panel
              on this screen makes — the box never moves, the contents do.
            */}
            <HeardMotion />
            <ProposalStack />
          </Panel>
        </div>
        ) : (
          /* The rail's column, held open and drawn empty — the whole reason
             the top of the window does not move when the posture switches.

             aria-hidden because there is nothing here to read: it is a
             measure, not a region, and a screen reader announcing an empty
             box would be announcing the layout rather than the screen. */
          <div aria-hidden className="shrink-0" style={{ width: 'var(--tri-rail-w)' }} />
        )}

        {/* The right column — bar, stage, tabs, browser. Everything below
            the stage is in here now, which is what puts the tab strip on
            the stage's left edge instead of the window's.

            With the rail gone the column beside it is empty but still held,
            so this one keeps exactly the width it had and the bento starts
            under the bar where the stage did. The bar is not rebuilt for the
            dashboard — it is the same row, in the same place in the tree, at
            the same width. */}
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--tri-gap)]">
          {/* Context bar — title, glyph, breadcrumb, split 21.5 / 4 / 73.
              --tri-topbar-h, not --tri-bar-h: this row holds the view
              switch — the two pills the operator reaches for most — and
              wants to be a hand's target, not a header. The run of service
              on the left sets its header band to the same token, so the two
              start level and the top of the window reads as one line rather
              than two that nearly agree. Still a token, so it moves with the
              tier: at touch the labels grow, and a bar that did not would
              simply crop them. */}
          <div
            className="flex shrink-0 items-stretch gap-[var(--tri-gap)]"
            style={{ height: 'var(--tri-topbar-h)' }}
          >
            {/* The segment left of the settings icon is the view switch. */}
            <div className="flex shrink-0 items-stretch gap-[var(--tri-gap)]" style={{ width: '21.5%' }}>
              {VIEWS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setView(m)}
                  aria-pressed={m === view}
                  className={cx(
                    'tri-rounded-control flex flex-1 items-center justify-center text-[length:var(--tri-size-xs)] lowercase transition-colors',
                    m === view
                      ? 'bg-[rgb(255_255_255_/_0.06)] text-[var(--tri-ink)]'
                      : 'text-[rgb(229_243_242_/_0.62)] hover:bg-[rgb(255_255_255_/_0.03)]',
                  )}
                  style={EDGE}
                >
                  {m}
                </button>
              ))}
            </div>
            {/* The orb took the gear's place: the bar had one square and
                the status of the engine is worth more in it than a door
                to settings, which the rail's own gear already opens. */}
            {/* Hover names the state, click steps it — the chip that used
                to do both is gone and the bar beside it is the log. */}
            <StatusOrb label={stateLabel} onClick={stepState} />
            <ListenControl />
            <ServiceLogBar entries={log.entries} onAction={goManual} />

          </div>

          {/* Everything under the bar is the posture. The switch above is
              the one control the two share, which is what makes it a switch
              rather than a tab. */}
          {view === 'dashboard' ? (
            <DashboardBento />
          ) : (
          <>
          {/* The stage — the two boxes, filled. See Stage. */}
          <Stage theme={theme} />

          {/* The tab strip. Six flex-1 pills on the stage's own width. */}
          <div className="flex h-[var(--tri-field-h)] shrink-0 items-stretch gap-[var(--tri-gap)]">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(i)}
                className={cx(
                  'tri-rounded-control flex flex-1 items-center justify-center text-[length:var(--tri-size-xs)] lowercase transition-colors',
                  i === tab
                    ? 'bg-[rgb(255_255_255_/_0.06)] text-[var(--tri-ink)]'
                    : 'text-[rgb(229_243_242_/_0.62)]',
                )}
                style={EDGE}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/*
            Fixed share of the screen, the wireframe's — the panel does not
            grow to fit its contents. When a tab's controls are taller than
            this, they scroll inside it; the panel itself never moves. That
            keeps the stage above at a constant size, which matters more
            than any one tab seeing all of itself at once.

            40% — and the rail's lower box is the same 40%, so the two are
            the same height and their top edges line up. Move one, move the
            other. See the note there.

            40% and not a half: the browser is the reference, not the thing
            being watched, so it takes the smaller share and the stage keeps
            the rest. The two strips above are sized by their tier tokens
            rather than by percentages — deliberately, so labels cannot crop
            at touch — so the stage gets whatever is left after those and
            this 40%. The number that matters is the stage's, not this one.
          */}
          {/* bare + no body padding for themes: that tab's contents are
              surfaces of their own now, and they space themselves on
              --tri-gap, the same gutter as the strip above. Every other tab
              is still content in a panel and keeps the panel. */}
          <Panel
            className="h-[40%] shrink-0"
            bare={TABS[tab].id === 'themes'}
            bodyClass={TABS[tab].id === 'themes' ? undefined : 'pt-3'}
          >
            {TABS[tab].id === 'themes' ? (
              <ThemesEditor
                theme={theme}
                onChange={setTheme}
                onReset={() => setTheme(DEFAULT_THEME)}
              />
            ) : null}
            {TABS[tab].id === 'scriptures' ? <ScripturesBrowser /> : null}
            {TABS[tab].id === 'songs' ? <SongsBrowser /> : null}
            {TABS[tab].id === 'slides' ? <SlidesBrowser /> : null}
            {TABS[tab].id === 'media' ? (
              <MediaBrowser
                selected={theme.backgroundId}
                onSelect={(backgroundId) => {
                  setTheme({ ...theme, backgroundId });
                  setTab(TABS.findIndex((item) => item.id === 'themes'));
                }}
              />
            ) : null}
          </Panel>
          </>
          )}
        </div>
      </div>
    </>
  );
}
