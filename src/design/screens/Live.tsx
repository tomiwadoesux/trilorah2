import { isEmptyPreview } from '../emptyPreviewMode';
import { importAndSavePresentation, presentationImageSrc } from '../../lib/presentationImport';
import { stageSlide } from '../../lib/stageSlide';
import { outputThemeSettings } from '../../lib/outputTheme';
import { TEXT_WIDTH } from '../../../shared/textWidth';
import { resolveTextCase, type TextCase } from '../../../shared/textCase';
import { resolveTextSpacing, type TextSpacing } from '../../../shared/textSpacing';
import { normalizeTriTheme, readTriLocal, stageTriDisplay, updateStagedTriDisplay, TRI_DISPLAY_EVENT, TRI_DISPLAY_KEY, TRI_THEME_EVENT, TRI_THEME_KEY } from '../../lib/triClient';
import { editSongCard, songCards } from '../../../shared/songCards';
import { createVerseHintSession, visitVerseHint } from '../../lib/verseHints';
import { useSongListeningStore } from '../../stores/songListeningStore';
import { lyricScore } from '../../lib/songMatch';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useMobileRemote } from './useMobileRemote';
import { SermonStartControl } from './SermonStartControl';
import { ScriptureCatches, ScriptureFindOverlay } from './ScriptureCatches';
import SvgOrbsPill from '../orb/SvgOrbsPill';
import { ORB_BY_STATE, STATUS_ORB_INK as INK } from '../orb/statusLooks';
import { orbStatusDescription, useOrbShape } from '../orb/orbIdle';
import { LiveTranscript } from './transcript/LiveTranscript';
import { D27_HEIGHT } from './transcript/StripShell';
import {
  ActionMenu,
  Button,
  cx,
  ChevronDownIcon,
  CheckIcon,
  CloseIcon,
  ClipboardIcon,
  AddSongIcon,
  VideoPlayIcon,
  type ActionMenuGroup,
  DisplayFontPicker,
  TextTransitionPicker,
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
  PlusIcon,
  PlayIcon,
  PauseIcon,
  slideBackdrop,
  BACKDROP_BY_CONTENT,
  Slider,
  TextPositionPicker,
  ResetIcon,
  type FontOption,
  type ResolvedReference,
  type ScriptureBook,
  type SelectOption,
  type TextPositionOption,
  ImportIcon,
  PresentationIcon,
  BookIcon,
  PaletteIcon,
  QrIcon,
  OperatorIcon,
  DashboardIcon,
  ProfileIcon,
  SettingsIcon,
} from '../../ui';
import { BOOKS, CHAPTER_COUNTS } from '../../lib/books';
import { STOCK_PRESETS } from '../../lib/stockPresets';
import { parseVerse } from '../../lib/scriptureText';
import { AppShell } from './AppShell';
import { DashboardBento } from './dashboard';
import { ProfileView } from './dashboard/ProfileView';
import { SettingsSurface } from './Settings';
import { ViewEnter } from './viewEnter';
import { RunHeaderActions } from './run/RunHeaderActions';
import { RunOfService } from './run/RunRail';
import { EmptyMark, EqBars } from './emptyArt';
import { TranscriptFace } from './dashboard/PreachingTile';
import { ScriptureLibraryEmpty } from './ScriptureLibraryEmpty';
import { SongRackArt } from './SongRackArt';
import { MediaSlideArt } from './MediaSlideArt';
import { MediaFilmArt } from './MediaFilmArt';
import { loadScriptureChapter } from '../../lib/loadScriptureChapter';
import { ScriptureQuoteArt } from './ScriptureQuoteArt';
import { LibraryBrowser, LibraryPane, LibrarySearch, useLibrarySelection } from './library';
import { AddSongDialog, type SongSource } from './songs/AddSongDialog';
import { SongEditor, type EditorSession } from './songs/SongEditor';
import { LibraryToolbar } from './LibraryToolbar';
import { useSongDrafts } from './songs/useSongDrafts';
import { NEW_PREFIX, cardsToSections, isNewId, type SongBase, type SongDraft } from '../../../shared/songDraft';
import './songs/songs.css';
import { SlideCanvas } from './slide';
import { buildVerseSlides, type VerseSlide } from '../../../shared/verseDisplay';
import { formatTimerDisplay } from '../../../shared/timerDisplay';
import { getTimerColor } from '../../../shared/timerColor';
import {
  TRANSITION_MS,
  clampTransitionMs,
  isTextTransition,
  type TextTransition,
} from '../../../shared/textTransitions';
import { SlidesBrowser } from './presentations';
import { StockSearch } from './stockSearch';
import { addMedia, mediaSrc, randomStill, useMediaLibrary, videoLength, videoPoster, getMediaLibrary, type ThemeMedia } from './mediaLibrary';
import { ProjectorProvider, useProjector, type LiveItem } from './projector';
import { EngineProvider, useEngine, SLIDE_RULES, fitRules, fitOf, wordCount, FIT_WORDS } from './engine';
import { RunProvider, useRun, type RunSegment } from './run';
import { DragKeyframes, DragProvider, useDrag } from './drag';
import { Panel } from './parts';
import { useForesight } from './foresight';
import './liveHeader.css';
import './dottedSurface.css';
import { dottedSurfaceStyles } from './dottedSurface';

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
 * width, context bar 5% of height, the stage 48%, browser 38%. The tab
 * strip that sat mid-screen between the stage and the browser now runs down
 * the browser's left edge, and the browser has its height (LibraryTabs).
 */

/*
 * The library's six tabs.
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
  { id: 'slides', label: 'slides' },
  { id: 'media', label: 'media' },
  /* The free photo and video library on the internet, one click away
     instead of a shelf inside media. The media tab keeps its search shelf
     too: that is where it was, and moving it would break a habit. */
  { id: 'online', label: 'online' },
];

/*
 * The six tabs, down the left of the browser rather than across the top of
 * it. Across, they cost a full row of height between the stage and the
 * browser; down the side they cost a narrow column and the browser gets the
 * height back, which is what it is short of — a verse table, a song list
 * and a slide grid all want more rows, not wider ones.
 *
 * The pills sit together on one panel, the same surface as the browser
 * beside it, so the six read as one control rather than six loose
 * buttons. Each pill is a control — tri-rounded-control, the smoothed 18px
 * corner every field and button has, a soft rounded rect and not a capsule
 * — and the panel's corner is that plus the --tri-card-gap inset, so the
 * two curves stay concentric and no pill corner crowds the panel's. Words
 * are control-sized, with a glyph ahead of each so the column can be
 * scanned without reading it.
 *
 * The lit pill is ONE surface that slides to the tab chosen, not a fill
 * that blinks off one pill and on at another: the eye follows it, and the
 * old and new tab are never both half-lit. 200ms on a strong ease-out, so
 * it has arrived before the browser below has finished swapping. A switch
 * made from the keyboard jumps instead — arrowing through tabs is repeated
 * and a slide on every press would lag the key. Reduced motion jumps too.
 * Pressing a pill dips it to --tri-press-scale, the press every button gets.
 *
 * Every row is --tri-field-h tall with --tri-card-gap between, so where the
 * light sits is arithmetic on the index — nothing is measured, and a change
 * of density moves it with the pills.
 *
 * The column is as wide as the longest label in bold, reserved by an
 * invisible bold copy under every label, so choosing a tab (which bolds it)
 * never nudges the browser sideways.
 */
const TAB_ICONS: Record<string, (p: { size?: number; className?: string }) => ReactNode> = {
  scriptures: BookIcon,
  themes: PaletteIcon,
  songs: MusicIcon,
  slides: PresentationIcon,
  media: MediaIcon,
  online: GlobeIcon,
};

function LibraryTabs({ tab, onChange }: { tab: number; onChange: (i: number) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  /* Set by the key handler, cleared by a click: whether this change should
     jump rather than slide. It changes in the same render as the tab, so
     the light gets its transition (or loses it) exactly when it moves. */
  const [jump, setJump] = useState(false);
  const go = (to: number) => {
    const i = (to + TABS.length) % TABS.length;
    setJump(true);
    onChange(i);
    refs.current[i]?.focus();
  };
  return (
    <nav
      aria-label="library navigation"
      className="tri-library-tabs tri-dotted-surface relative min-h-0 min-w-0 shrink-0 overflow-x-hidden overflow-y-auto overscroll-contain"
      style={{
        ...dottedSurfaceStyles.library,
        ...EDGE,
      }}
    >
      {/* The whole rail scrolls, including its padding. Decorative layers
          never sit between the pointer and the native scroll container. */}
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="library"
        className="relative z-10 flex flex-col gap-[var(--tri-card-gap)]"
      >
        <span
          aria-hidden="true"
          data-library-indicator
          className={cx(
            'tri-rounded-control pointer-events-none absolute inset-x-0 top-0 z-10 h-[var(--tri-field-h)]',
            'transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
            jump && 'transition-none',
          )}
          style={{
            /* The edge every surface has, and a hairline of light along the
               top, so the lit pill sits a touch above the others. */
            boxShadow:
              'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.2)',
            transform: `translateY(calc(${tab} * (var(--tri-field-h) + var(--tri-card-gap))))`,
          }}
        />
        {TABS.map((t, i) => {
          const Icon = TAB_ICONS[t.id];
          const on = i === tab;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-label={t.label}
              title={t.label}
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => {
                setJump(false);
                onChange(i);
              }}
              onKeyDown={(e) => {
                const to =
                  e.key === 'ArrowDown' ? i + 1
                  : e.key === 'ArrowUp' ? i - 1
                  : e.key === 'Home' ? 0
                  : e.key === 'End' ? TABS.length - 1
                  : null;
                if (to === null) return;
                e.preventDefault();
                go(to);
              }}
              className={cx(
                'tri-rounded-control relative flex h-[var(--tri-field-h)] shrink-0 items-center gap-2 pl-3 pr-4 text-left text-[length:var(--tri-control-size)] lowercase',
                'transition-[color,background-color,transform] duration-150 ease-out active:scale-[var(--tri-press-scale)]',
                on
                  ? 'bg-white/[0.08] font-semibold text-[var(--tri-ink)]'
                  : 'bg-[#111111] text-[rgb(229_243_242_/_0.58)] hover:bg-white/[0.05] hover:text-[rgb(229_243_242_/_0.85)]',
              )}
              style={{ boxShadow: on ? 'none' : 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.12)' }}
            >
              {Icon && (
                <Icon
                  size={14}
                  className={cx('shrink-0 transition-opacity duration-150', on ? 'opacity-100' : 'opacity-60')}
                />
              )}
              <span className="grid">
                <span className="col-start-1 row-start-1 whitespace-nowrap">{t.label}</span>
                <span aria-hidden="true" className="invisible col-start-1 row-start-1 h-0 whitespace-nowrap font-semibold">
                  {t.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}


interface ThemeSettings {
  backgroundId: string;
  dimness: number;
  blur: number;
  shadow: number;
  font: FontOption;
  textCase?: TextCase;
  textSpacing?: TextSpacing;
  size: number;
  verseSize: number;
  refGap: number;
  layout: TextPositionOption;
  safeMargin: number;
  textWidth: number;
}

/*
 * What the preview opens on, before anyone has staged anything.
 *
 * Verses a congregation already knows, so an operator who glances at the
 * preview on a cold start reads something that belongs there. One is picked
 * per launch. It is staged, never pushed: the wall stays empty until a press.
 *
 * Every one of these reads clean in the KJV. That is most of why they are
 * these and not others: the KJV here keeps supplied words and translators'
 * notes in braces inside the verse, and Psalm 23:1 or Isaiah 40:31 would
 * open the preview with them showing.
 */
const OPENING_VERSES: readonly { book: string; chapter: number; verse: number }[] = [
  { book: 'Numbers', chapter: 6, verse: 24 },
  { book: 'Psalms', chapter: 37, verse: 4 },
  { book: 'Proverbs', chapter: 3, verse: 5 },
  { book: 'Proverbs', chapter: 3, verse: 6 },
  { book: 'Matthew', chapter: 5, verse: 16 },
  { book: 'Matthew', chapter: 6, verse: 33 },
  { book: 'John', chapter: 1, verse: 1 },
  { book: 'John', chapter: 3, verse: 16 },
  { book: 'John', chapter: 8, verse: 32 },
  { book: 'John', chapter: 14, verse: 6 },
  { book: 'Romans', chapter: 10, verse: 9 },
  { book: '2 Corinthians', chapter: 5, verse: 7 },
  { book: 'Galatians', chapter: 2, verse: 20 },
  { book: 'Philippians', chapter: 4, verse: 6 },
  { book: 'Philippians', chapter: 4, verse: 13 },
  { book: 'Philippians', chapter: 4, verse: 19 },
  { book: '2 Timothy', chapter: 1, verse: 7 },
  { book: 'Hebrews', chapter: 13, verse: 8 },
  { book: '1 Peter', chapter: 5, verse: 7 },
  { book: '1 John', chapter: 4, verse: 19 },
];

const DEFAULT_THEME: ThemeSettings = {
  backgroundId: 'quiet-sea',
  dimness: 60,
  blur: 2,
  shadow: 65,
  font: 'default',
  size: 0,
  verseSize: 0,
  refGap: 0.9,
  layout: 'center',
  safeMargin: 10,
  textWidth: TEXT_WIDTH.default,
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
        const appearance = { ...s, ...readTriLocal<Record<string, unknown>>(TRI_DISPLAY_KEY, {}) };
        if (isTextTransition(appearance.textTransition)) setId(appearance.textTransition);
        if (appearance.textTransitionMs != null) setMs(clampTransitionMs(appearance.textTransitionMs));
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, []);

  useEffect(() => {
    const imported = (event: Event) => {
      const display = (event as CustomEvent<Record<string, unknown>>).detail;
      if (isTextTransition(display.textTransition)) setId(display.textTransition);
      if (display.textTransitionMs != null) setMs(clampTransitionMs(display.textTransitionMs));
    };
    window.addEventListener(TRI_DISPLAY_EVENT, imported);
    return () => window.removeEventListener(TRI_DISPLAY_EVENT, imported);
  }, []);

  const choose = useCallback((next: TextTransition) => {
    setId(next);
    setPlay((n) => n + 1);
    void window.api?.setSetting?.('textTransition', next);
    updateStagedTriDisplay({ textTransition: next });
  }, []);

  /* The speed is heard on release, not during: replaying on every step of a
     drag restarts the entrance thirty times and shows none of them. */
  const replay = useRef<number | undefined>(undefined);
  const pace = useCallback((next: number) => {
    const clamped = clampTransitionMs(next);
    setMs(clamped);
    void window.api?.setSetting?.('textTransitionMs', clamped);
    updateStagedTriDisplay({ textTransitionMs: clamped });
    window.clearTimeout(replay.current);
    replay.current = window.setTimeout(() => setPlay((n) => n + 1), 260);
  }, []);
  useEffect(() => () => window.clearTimeout(replay.current), []);

  return { id, ms, play, choose, pace };
}

/*
 * The three postures of this screen: the operator's own working surface,
 * the dashboard the rest of the team watches, and the profile of whoever is
 * preaching today.
 *
 * Not a panel swap — everything under the context bar changes, the rail
 * included, because the dashboard is read rather than worked and has no use
 * for a control column. The bar is what the three share, which is what makes
 * this a switch and not a tab.
 *
 * Profile earns a place beside the other two rather than living behind a
 * press on the preachers tile: it is the one screen an operator opens
 * BEFORE a service, to check the app has learned this preacher, and a thing
 * you reach for at a fixed moment every week should be reachable in one
 * press from anywhere — not two, through a card on a view you were not
 * otherwise going to.
 */
/*
 * Settings is the fourth, and it is a posture rather than a card.
 *
 * It arrives here because the app's top tab bar is going away and the nine
 * pages of settings have to land somewhere. A bento tile was the other
 * candidate and it is the wrong shape: a tile flies open into one box,
 * where settings is a rail of nine pages that an operator scans down. The
 * profile proved the posture — a surface you READ rather than work, given
 * the whole window — and settings is the same kind of thing.
 *
 * It sits last because it is the one you reach for least during a service,
 * and the order of these pills is how often you press them.
 */
const VIEWS = ['operator', 'dashboard', 'profile', 'settings'] as const;
type ViewMode = (typeof VIEWS)[number];
const VIEW_ICONS = {
  operator: OperatorIcon,
  dashboard: DashboardIcon,
  profile: ProfileIcon,
  settings: SettingsIcon,
} as const;

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




/** Text and background controls share one surface, split into equal halves. */
function ThemesEditor({
  theme,
  onChange,
  onReset,
  tx,
}: {
  theme: ThemeSettings;
  onChange: (next: ThemeSettings) => void;
  onReset: () => void;
  tx: ReturnType<typeof useTextTransition>;
}) {

  return (
    <div className="grid h-full min-h-0 min-w-0 grid-cols-2 divide-x divide-white/15">
      <ThemeControls label="text">
        <DisplayFontPicker
          value={theme.font}
          textCase={resolveTextCase(theme.textCase, theme.font)}
          textSpacing={resolveTextSpacing(theme.textSpacing)}
          onChange={(font) => onChange({ ...theme, font, textCase: resolveTextCase(theme.textCase, theme.font) })}
          onTextCaseChange={(textCase) => onChange({ ...theme, font: theme.font === 'uppercase' ? 'default' : theme.font, textCase })}
          onTextSpacingChange={(textSpacing) => onChange({ ...theme, textSpacing })}
        />
        <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4">
          <Slider label="text size" value={theme.size} onChange={(size) => onChange({ ...theme, size })} min={-2} max={8} />
          <Slider label="shadow strength" value={theme.shadow} onChange={(shadow) => onChange({ ...theme, shadow })} />
          <Slider label="reference size" value={theme.verseSize} onChange={(verseSize) => onChange({ ...theme, verseSize })} min={-2} max={8} />
          <Slider
            label="gap from the verse"
            value={theme.refGap}
            onChange={(refGap) => onChange({ ...theme, refGap })}
            min={REF_GAP.min}
            max={REF_GAP.max}
            step={REF_GAP.step}
          />
        </div>
        <TextTransitionPicker value={tx.id} duration={tx.ms} play={tx.play} onChange={tx.choose} />
        <Slider
          label="speed · ms"
          value={tx.ms}
          onChange={tx.pace}
          min={TRANSITION_MS.min}
          max={TRANSITION_MS.max}
          step={50}
          disabled={tx.id === 'cut'}
        />
      </ThemeControls>

      <ThemeControls label="background & layout">
        <Slider label="dimness" value={theme.dimness} onChange={(dimness) => onChange({ ...theme, dimness })} />
        <Slider label="blur" value={theme.blur} onChange={(blur) => onChange({ ...theme, blur })} min={0} max={12} />
        <p className="text-[length:var(--tri-size-xs)] lowercase text-[var(--tri-ink-muted)]">
          choose a background in media
        </p>
        <TextPositionPicker label="position on the screen" value={theme.layout} onChange={(layout) => onChange({ ...theme, layout })} columns={4} />
        <div className="grid min-w-0 grid-cols-2 gap-x-4">
          <Slider
            label="safe margin"
            value={theme.safeMargin}
            onChange={(safeMargin) => onChange({ ...theme, safeMargin })}
            min={SAFE_MARGIN.min}
            max={SAFE_MARGIN.max}
            step={SAFE_MARGIN.step}
            valueSuffix="%"
            ticks={5}
          />
          <Slider
            label="width"
            value={theme.textWidth}
            onChange={(textWidth) => onChange({ ...theme, textWidth })}
            min={TEXT_WIDTH.min}
            max={TEXT_WIDTH.max}
            step={TEXT_WIDTH.step}
            valueSuffix="%"
            ticks={5}
          />
        </div>
        <p className="text-[length:var(--tri-size-xs)] text-[var(--tri-ink-muted)]">
          width can extend beyond the safe guide; 100% fills the screen
        </p>
        <div className="flex justify-end">
          <Button
            label="reset theme"
            tone="danger"
            icon={<ResetIcon size={15} />}
            title="reset theme"
            onClick={onReset}
          />
        </div>
      </ThemeControls>
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
  thumbRight = 1,
  children,
}: {
  /** Sizing for the region — the wrapper is the flex or grid item. */
  className?: string;
  /** Layout for the content column inside it. */
  contentClassName?: string;
  /** Themes can seat the readout in their existing outer gutter. */
  thumbRight?: number;
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
          className="pointer-events-none absolute rounded-full bg-[rgb(229_243_242_/_0.28)]"
          style={{
            top: m.thumb.top,
            right: thumbRight,
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

function ThemeControls({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden px-4">
      <h3 className="shrink-0 pt-1 text-[14px] font-bold uppercase tracking-[0.06em] text-[var(--tri-ink)]">
        {label}
      </h3>
      <FadeScroller thumbRight={-9} className="min-h-0 flex-1" contentClassName="flex flex-col gap-4 pb-4 [&>*]:min-w-0 [&>*]:shrink-0">
        {children}
      </FadeScroller>
    </section>
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

/*
 * The editor's projector — the shared renderer with the guide turned on.
 *
 * This used to be the only place a slide was drawn, and the drawing lived
 * inside it. It is now one caller of SlideCanvas among three (here, the
 * preview box, the live box), which is the point: a theme change the editor
 * shows and the stage does not would be a lie told at the worst possible
 * moment. See ./slide.
 */

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

function MediaBrowser({ selected, onSelect, onOpenSettings }: { selected: string; onSelect: (id: string) => void; onOpenSettings: () => void }) {
  const [film] = useState(() => Math.random() < .5);
  const [view, setView] = useState<MediaView>('media');
  const [online, setOnline] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const library = useMediaLibrary();
  const projector = useProjector();
  const drag = useDrag();
  const [notice, setNotice] = useState('');
  const examples = view === 'themes' ? ['soft gradients', 'clouds', 'water', 'light'] : ['nature', 'people', 'church', 'city'];
  const shown = library.filter(m => (m.collection ?? 'themes') === view && (online || !m.url || m.source === 'local') &&
    (online || `${m.label} ${m.detail}`.toLowerCase().includes(query.trim().toLowerCase())));
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setSearchOpen(false); };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, []);
  const store = (media: ThemeMedia) => {
    addMedia({ ...media, collection: view });
    setSearchOpen(false);
    setNotice(`Added to ${view}.`);
  };
  const addLocal = async () => {
    const result = await window.api?.pickMediaFile?.();
    if (!result?.success || !result.url) return;
    const url = result.src ?? result.url;
    const [poster, length] = result.kind === 'video' ? await Promise.all([videoPoster(url), videoLength(url)]) : [undefined, undefined];
    store({ id: `local:${result.url}`, label: result.name ?? 'media', detail: length ? `${length} · this laptop` : 'this laptop', seed: 4,
      style: 'smoke', source: 'local', url, poster, kind: result.kind === 'video' ? 'video' : 'photo' });
  };
  const pill = 'flex h-[35px] min-w-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] p-1';
  const button = 'flex h-[25px] shrink-0 items-center justify-center rounded-full px-3 text-xs transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2';
  return (
    <div ref={root} className="relative flex h-full min-h-0 flex-col gap-3 px-3" onKeyDown={e => { if (e.key === 'Escape') setSearchOpen(false); }}>
      <div role="toolbar" aria-label="media library" className="flex shrink-0 items-center gap-2">
        <div className={`${pill} flex-1`}>
          <button type="button" className={`${button} ${online ? 'bg-white/10' : ''}`} aria-label="search online" aria-pressed={online} onClick={() => { setOnline(true); setSearchOpen(true); }}><GlobeIcon size={15} /></button>
          <button type="button" className={`${button} ${!online ? 'bg-white/10' : ''}`} aria-label="search this laptop" aria-pressed={!online} onClick={() => { setOnline(false); setSearchOpen(false); }}><LaptopIcon size={15} /></button>
          <span aria-hidden className="mx-1 h-3 w-px bg-white/15" />
          <input type="text" aria-label={`search ${view}`} placeholder={`search ${view}…`} value={query} onFocus={() => online && setSearchOpen(true)} onChange={e => { setQuery(e.target.value); setSearchOpen(online); }} className="min-w-0 flex-1 bg-transparent px-1 text-xs outline-none" />
          <button type="button" className={button} aria-label="add media from this laptop" disabled={!window.api?.pickMediaFile} onClick={() => void addLocal()}><PlusIcon size={14} /></button>
        </div>
        <div className={pill} role="group" aria-label="library collection">
          {(['themes','media'] as const).map(value => <button key={value} type="button" {...(value === 'themes' && (!drag.active || drag.active.mediaId) ? drag.dropProps('media-themes') : {})}
            className={`${button} ${view === value || (value === 'themes' && drag.over === 'media-themes') ? 'bg-white/15 text-[var(--tri-ink)]' : 'text-[var(--tri-ink-muted)]'}`}
            aria-pressed={view === value} onClick={() => { setView(value); setNotice(''); }}>{value}</button>)}
        </div>
      </div>
      {online && searchOpen ? (
        <div role="region" aria-label="online search suggestions" style={{ maxHeight: 'calc(100% - 44px)' }} className="absolute inset-x-3 top-11 z-40 flex flex-col gap-3 overflow-y-auto rounded-2xl border border-white/15 bg-[#141719] p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3"><span className="text-xs text-[var(--tri-ink-muted)]">{view === 'themes' ? 'backgrounds for readable text' : 'images and clips · search your own words'}</span><button type="button" className={button} onClick={() => setSearchOpen(false)} aria-label="close search"><CloseIcon size={12} /></button></div>
          <div className="grid grid-cols-4 gap-2">{examples.map((word,index) => <button key={word} type="button" onClick={() => setQuery(word)} className="overflow-hidden rounded-xl border border-white/10 text-left hover:bg-white/5">
            <img alt="" src={slideBackdrop(index + 1, index % 2 ? 'smoke' : 'facets')} className="aspect-[3/1] w-full object-cover" />
            <span className="block px-2 py-2 text-xs">{word}</span>
          </button>)}</div>
          <div className="h-[240px] shrink-0"><StockSearch searchQuery={query} searchMode={view} onPick={store} onOpenSettings={onOpenSettings} /></div>
        </div>
      ) : null}
      <div role="status" className="shrink-0 text-xs text-[var(--tri-ink-muted)]">{notice || (drag.active?.mediaId ? 'Drop on themes to use this as a background.' : view === 'themes' ? 'Choose a background for your text.' : 'Select to preview · drag to themes or into the service.')}</div>
      {shown.length ? <MediaGrid>{shown.map(media => <div key={media.id} className="min-w-0" {...(media.url ? drag.bind(() => ({ source: 'media', mediaId: media.id, label: media.label, preview: mediaSrc(media), path: media.url, mediaKind: media.kind ?? 'photo' })) : {})}>
        <MediaCard src={mediaSrc(media)} label={media.label} detail={media.detail} selected={view === 'themes' && selected === media.id} badge={media.kind === 'video' ? 'video' : null}
          onClick={() => view === 'themes' && media.kind !== 'video' ? onSelect(media.id) : media.url && projector.stage({ source: 'media', id: media.id, label: media.label, path: media.url, mediaKind: media.kind ?? 'photo', origin: 'operator' })} />
        {view === 'media' ? <button type="button" className="mt-1 text-xs text-[var(--tri-ink-muted)] hover:text-[var(--tri-ink)]" onClick={() => { addMedia({ ...media, collection: 'themes' }); setNotice('Moved to themes.'); }}>use as theme</button> : null}
      </div>)}</MediaGrid> : <div className="min-h-0 flex-1"><EmptyMark w={220} h={220} plain art={film ? <MediaFilmArt /> : <MediaSlideArt />}
        line={query && !online ? 'nothing matches' : `no ${view} yet`}
        hint={query && !online ? 'try another name' : 'add an image or clip to get started'}
        below={<div className="mt-4 flex flex-wrap justify-center gap-2"><Button label="add media" icon={<PlusIcon size={13} />} disabled={!window.api?.pickMediaFile} onClick={() => void addLocal()} /><Button label="explore online" onClick={() => { setOnline(true); setSearchOpen(true); }} /></div>} /></div>}
    </div>
  );
}

/** The grid both views share, so a card cannot drift between them. */
function MediaGrid({ children }: { children: ReactNode }) {
  return (
    <div
      className="grid min-h-0 auto-rows-min grid-cols-4 gap-x-3 gap-y-4 overflow-y-auto px-1"
      style={{ paddingBottom: 'var(--tri-gap)' }}
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
  const engine = useEngine();
  const drag = useDrag();
  const projector = useProjector();
  const [versions, setVersions] = useState<SelectOption[]>([{ value: 'KJV', label: 'KJV' }]);
  const [version, setVersion] = useState('KJV');
  const [query, setQuery] = useState('');
  const [ref, setRef] = useState<ResolvedReference | null>(null);
  const [rows, setRows] = useState<VerseRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'no-api' | 'empty' | 'error'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  /* Whatever translations the database actually holds — not a guessed list.
     This one ships KJV, BBE and four non-English versions. */
  useEffect(() => {
    window.api?.getAvailableVersions().then((v) => {
      if (v?.length) setVersions(v.map((code) => ({ value: code, label: code })));
    }).catch(() => { /* KJV remains available if the version list fails. */ });
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
    setRows([]);
    setLoadError(null);
    if (!target) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    loadScriptureChapter(window.api, target.bookIndex, target.chapter, version).then((res) => {
      if (cancelled) return;
      setRows(res.data.map((v) => ({ verse: v.id, ref: v.ref, text: v.text })));
      setLoadError(res.error);
      setStatus(res.status);
    });
    return () => {
      cancelled = true;
    };
  }, [target?.bookIndex, target?.chapter, version, loadAttempt]);

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

  /* A browser preview has no Bible database. Never attach another verse's
     words to the requested reference just to fill the design specimen. */
  const FALLBACK_VERSE = (_v: number) =>
    'Bible text is unavailable in this browser preview. Open the desktop app to load this passage.';

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
    if (engine.caps.bridge || !ref || !ref.book || !ref.chapter) return;
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
          <LibrarySearch disabled={status === 'error' || status === 'no-api' || status === 'empty'}>
          <ScriptureReferenceInput
            className="min-w-0 flex-1"
            books={BOOK_DATA}
            versesInChapter={versesInChapter}
            value={query}
            onChange={setQuery}
            onReferenceChange={setRef}
            onSubmit={async (r) => {
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

              const reading = engine.caps.bridge ? await engine.lookup(r.book, r.chapter, first, last, version) : null;
              if (engine.caps.bridge && !reading) return;
              const picked = reading?.verses ?? rows.filter((v) => v.verse >= first && v.verse <= last);
              const verses = picked.length
                ? picked.map((v) => ({ verse: v.verse, text: v.text }))
                : [{ verse: first, text: FALLBACK_VERSE(first) }];

              const slides = buildVerseSlides(
                { book: r.book, chapter: r.chapter, version },
                verses,
                SLIDE_RULES,
              );

              const item: LiveItem = {
                source: 'scripture',
                id: reference,
                label: reference,
                reference,
                version,
                text: verses.map((v) => v.text).join(' '),
                slides,
                origin: 'operator',
              };
              projector.stage(item);
              await projector.send(item);
            }}
            onNavigate={sel.navigate}
            onActivate={sel.activate}
          />
          </LibrarySearch>
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
        <div ref={sel.listRef} className={rows.length === 0 ? 'h-full' : undefined} aria-busy={status === 'loading'}>
          {rows.length === 0 ? (
            <ScriptureLibraryEmpty status={status} error={loadError} version={version}
              onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
              onReset={() => { setQuery(''); setRef(null); setVersion('KJV'); setLoadAttempt((attempt) => attempt + 1); }} />
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
                  'group/verse flex w-full items-baseline gap-4 px-4 py-2 text-left transition-colors',
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
                {!sel.isLive(i) && <span className="verse-live-hint shrink-0 rounded-md border border-white/15 px-2 py-1 text-[10px] text-white/60 opacity-0 group-hover/verse:opacity-100 group-focus-visible/verse:opacity-100">double click · live</span>}
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
  const [songSource, setSongSource] = useState<SongSource>('search');
  const [query, setQuery] = useState('');
  const [deleted, setDeleted] = useState<ReadonlySet<string>>(() => new Set());
  const { drafts, save: saveDraft, clear: clearDraft } = useSongDrafts();

  const store = typeof window === 'undefined' ? undefined : window.api?.songs;
  const [stored, setStored] = useState<Song[] | null>(store || isEmptyPreview ? [] : null);
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
  useEffect(() => {
    window.addEventListener('trilorah-package-imported', refresh);
    return () => window.removeEventListener('trilorah-package-imported', refresh);
  }, [refresh]);

  /* The header's import menu asks for the add dialog by stamping the time —
     this tab may not have been mounted when it was pressed, so the request
     has to survive the mount; and it is a TIME so that coming back to this
     tab an hour later does not replay it. */
  const seenRequest = useRef(0);
  useEffect(() => {
    if (addRequest === seenRequest.current) return;
    seenRequest.current = addRequest;
    if (Date.now() - addRequest < 2000) {
      setSongSource('search');
      setAddOpen(true);
    }
  }, [addRequest]);

  const songs = useMemo(() => {
    const library = (stored ?? SONGS).filter((s) => !deleted.has(s.id));
    return library;
  }, [stored, deleted]);
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
    window.dispatchEvent(new Event('trilorah-library-changed'));
    return true;
  };

  return (
    <>
      <AddSongDialog
        initialRoute={songSource}
        open={addOpen}
        onRequestClose={() => setAddOpen(false)}
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
      {!open && Object.keys(drafts).length > 0 ? (
        <details className="relative shrink-0 px-4 text-xs text-[var(--tri-ink-muted)]">
          <summary className="cursor-pointer py-2">continue editing · {Object.keys(drafts).length}</summary>
          <div className="absolute left-4 top-full z-30 min-w-64 rounded-xl border border-white/15 bg-[#141719] p-2 shadow-xl">
            {Object.entries(drafts).sort((a,b) => b[1].updatedAt-a[1].updatedAt).map(([id,draft]) => (
              <button key={id} type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/10" onClick={() => edit(songs.find(song => song.id === id) ?? songFromDraft(id,draft),null)}>
                {draft.title || 'new song'} · {Math.max(1,Math.ceil((draft.updatedAt + 1800000-Date.now())/60000))} min left
              </button>
            ))}
          </div>
        </details>
      ) : null}
      {open ? (
        <SongSheet key={open.id} song={open} onBack={() => setOpenId(null)} onSave={(base) => saveSong(open.id, false, base)} />
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
          onAdd={() => setEditor({
            session: {
              id: `${NEW_PREFIX}${Date.now().toString(36)}`,
              isNew: true,
              base: { title: '', author: '', sections: [{ label: 'Verse 1', lines: [''] }] },
            },
            origin: null,
            open: true,
          })}
          onSource={(source) => { setSongSource(source); setAddOpen(true); }}
          onDelete={(id) => {
            clearDraft(id);
            if (isNewId(id)) return;
            setDeleted((d) => new Set(d).add(id));
            if (store) void store.remove(id).then(() => { refresh(); window.dispatchEvent(new Event('trilorah-library-changed')); }).catch(() => undefined);
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
  onSource,
}: {
  songs: readonly Song[];
  query: string;
  onQuery: (q: string) => void;
  onOpen: (id: string) => void;
  /** The card's own element comes too — it is what the editor lifts off from. */
  onEdit?: (song: Song, origin: HTMLElement | null) => void;
  onDelete: (id: string) => void;
  onAdd?: () => void;
  onSource: (source: SongSource) => void;
}) {
  const drag = useDrag();
  const projector = useProjector();
  const engine = useEngine();
  const hearingSongs = useSongListeningStore((s) => s.active);
  const setHearingSongs = useSongListeningStore((s) => s.setActive);
  const heard = [...engine.spoken.lines.slice(-3).map((line) => line.text), engine.spoken.partial].join(' ').split(/\s+/).slice(-10).join(' ');
  const searchRow = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  /*
   * Which verse each card is showing, once the operator has paged it off
   * its default. Keyed by song, so filtering the grid and coming back finds
   * the card where it was left. Sparse: a card that was never paged is not
   * in here, and reads its default from cardVerseIndex.
   */
  const verseOf = (song: Song, _i: number) => song.verses[hearingSongs
    ? song.verses.reduce((best, v, at) => lyricScore(heard, v.lines.join(' ')) > lyricScore(heard, song.verses[best].lines.join(' ')) ? at : best, 0)
    : needle ? Math.max(0, song.verses.findIndex((v) => v.lines.join(' ').toLowerCase().includes(needle))) : 0];

  /*
   * Lyrics are searched as well as titles — "type a song name or lyrics" is
   * what the field promises, and half-remembered words are how a song usually
   * gets found.
   */
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (hearingSongs) return songs.map((song) => ({ song, score: Math.max(...song.verses.map((v) => lyricScore(heard, v.lines.join(' ')))) }))
      .filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 6).map((item) => item.song);
    return songs.filter((song) => !needle || song.title.toLowerCase().includes(needle) || song.verses.some((v) => v.lines.join(' ').toLowerCase().includes(needle)));
  }, [songs, needle, hearingSongs, heard]);

  /* A song is live when a section of it is. The gold ring belongs on the
     card whose words the congregation is reading, and that is the only
     thing the grid still needs from the projector. */
  const liveId = projector.live?.source === 'song' ? projector.live.id : null;

  return (
    <LibraryBrowser
      gap={16}
      search={
        searchOpen || songs.length === 0 ? <div ref={searchRow} className="min-w-0 flex-1">
          <LibrarySearch disabled={songs.length === 0}>
          <SearchField
            value={query}
            onChange={onQuery}
            placeholder="type a song name or lyrics..."
          />
          </LibrarySearch>
        </div> : null
      }
      dock={
        <LibraryToolbar
          label="songs"
          actions={[
            { id: 'add', label: 'add a song', text: 'add song', icon: <AddSongIcon size={13} />, onClick: onAdd },
            { id: 'lyrics', label: 'search online', text: 'search online', icon: <GlobeIcon size={13} />, onClick: () => onSource('search') },
            { id: 'youtube', label: 'get lyrics from youtube', text: 'youtube', icon: <VideoPlayIcon size={13} />, onClick: () => onSource('youtube') },
            { id: 'paste', label: 'paste lyrics', text: 'paste', icon: <ClipboardIcon size={13} />, onClick: () => onSource('paste') },
          ]}
          searchActions={[
            { id: 'listen', label: hearingSongs ? 'stop microphone song search' : 'search songs with microphone', text: 'microphone search', icon: <MicIcon size={13} />, active: hearingSongs, disabled: songs.length === 0 && !hearingSongs, onClick: () => { setHearingSongs(!hearingSongs); if (!hearingSongs && engine.asr !== 'listening') engine.listen(true); } },
            {
              id: 'search',
              label: 'search songs by name or lyrics',
              disabled: songs.length === 0,
              text: 'search songs',
              icon: <SearchIcon size={13} />,
              active: searchOpen,
              onClick: () => {
                setSearchOpen(!searchOpen);
                if (searchOpen) onQuery('');
                else requestAnimationFrame(() => searchRow.current?.querySelector('input')?.focus());
              },
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
          <EmptyMark w={220} h={220} plain art={<SongRackArt />} play="hover"
            line={hearingSongs ? 'listening for a song match' : songs.length === 0 ? 'no songs yet' : 'nothing matches'}
            hint={hearingSongs ? 'matches appear here as more words arrive' : songs.length === 0 ? 'add your first song to the library' : 'try a line of the words'}
            below={!hearingSongs && (songs.length === 0 && onAdd
              ? <div className="mt-4"><Button label="add a song" icon={<PlusIcon size={14} />} onClick={onAdd} /></div>
              : query.trim() ? <div className="mt-4"><Button label="clear search" onClick={() => onQuery('')} /></div> : null)}
          />
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
            className="grid auto-rows-min grid-cols-5 gap-4 px-4 pb-1"
          >
            {matches.map((song, i) => {
              const verse = verseOf(song, i);
              /* This verse and the next — the card shows where the song
                 is going. The last verse stands alone; nothing follows. */
              const shown = [{ ...verse, lines: verse.lines.slice(0, 4) }];
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
                  <button type="button" className="song-sheet" onClick={() => onOpen(song.id)} aria-label={`open ${song.title}`}>
                    <span className="song-sheet-section">{verse.label}</span>
                    <span className="song-sheet-lines">{shown[0].lines.map((line, n) => <span key={n}>{line}</span>)}</span>
                    <span className="song-sheet-arrow" aria-hidden>↗</span>
                  </button>

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

/** Open songs are lyric cards, with preview, live and editing on each card. */
function SongSheet({ song, onBack, onSave }: { song: Song; onBack: () => void; onSave: (base: SongBase) => Promise<boolean> }) {
  const drag = useDrag();
  const projector = useProjector();
  const [editing, setEditing] = useState<string | null>(null);
  const [words, setWords] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const cards = songCards({id:song.id,sections:song.verses});
  const item = (card: typeof cards[number]): LiveItem => ({ source: 'song', id: card.id,
    label: `${song.title} — ${card.label}`, title: song.title, section: card.label, lines: card.lines, origin: 'operator' });
  const send = async (card: typeof cards[number]) => {
    setProblem(null);
    const content = item(card);
    projector.stage(content);
    try { await projector.send(content); }
    catch (error) { setProblem(error instanceof Error ? error.message : 'Could not send these lyrics live.'); }
  };
  const save = async (card: typeof cards[number]) => {
    setSaving(true); setProblem(null);
    try {
      const sections = editSongCard(song.verses.map(v=>({label:v.label,lines:v.lines})),card.sectionIndex,card.offset,card.lines.length,words.split(/\r?\n/));
      if (!await onSave({title:song.title,author:song.author,sections})) throw new Error('The lyrics could not be saved. Try again.');
      setEditing(null);
    } catch (error) { setProblem(error instanceof Error ? error.message : 'Could not save the lyrics.'); }
    finally { setSaving(false); }
  };
  const at = cards.findIndex(card => projector.isLive('song', card.id));
  const next = cards.length ? cards[(at + 1) % cards.length] : null;
  return <LibraryBrowser framed search={null}>
    <LibraryPane scroll={false} title={<button type="button" onClick={onBack} title="back to the song library" className="flex min-w-0 items-center gap-2 text-left">
      <ChevronDownIcon size={11} className="rotate-90"/><span>{song.title}</span><span className="font-normal text-white/40">{song.author}</span>
    </button>} footer={<div className="flex items-center gap-3 px-3 pb-2">
      <span className="min-w-0 flex-1 text-xs text-white/45">{at < 0 ? `${cards.length} lyric cards` : `${cards[at].label} · live`}</span>
      {next && <Button label={at < 0 ? 'go live' : 'next lyrics'} tone="gold" icon={<PlayIcon size={12}/>} onClick={() => void send(next)}/>}
    </div>}>
      <div className="flex h-full min-h-0 flex-col">
        {problem && <p role="alert" className="px-4 py-2 text-sm text-[var(--tri-accent-yellow)]">{problem}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="song-sections-grid">
            {cards.map((card, index) => {
              const live = projector.isLive('song', card.id);
              const selected = projector.isStaged('song', card.id);
              const edit = editing === card.id;
              return <article key={card.id} className="song-section-card" data-live={live} data-preview={selected}>
                <div className="song-section-heading"><span>{card.label}</span><span>{live ? 'live' : selected ? 'preview' : String(index + 1).padStart(2, '0')}</span></div>
                {edit ? <textarea aria-label={`Edit ${card.label} lyrics`} className="song-section-editor" autoFocus value={words} onChange={event => setWords(event.target.value)} disabled={saving}/> :
                  <button type="button" className="song-section-lyrics" aria-label={`Preview ${card.label}`} onClick={() => projector.stage(item(card))}
                    {...drag.bind(() => ({source:'song',label:`${song.title} — ${card.label}`,title:song.title,section:card.label,lines:card.lines,songId:song.id}))}>
                    {card.lines.map((line,i) => <span key={i}>{line || '\u00a0'}</span>)}
                  </button>}
                <div className="song-section-actions">
                  {edit ? <><Button label="cancel" tone="ash" disabled={saving} onClick={() => setEditing(null)}/><Button label={saving ? 'saving…' : 'save lyrics'} disabled={saving} icon={<CheckIcon size={12}/>} onClick={() => void save(card)}/></> :
                    <><Button label="edit" tone="ash" icon={<PencilIcon size={12}/>} onClick={() => { setEditing(card.id); setWords(card.lines.join('\n')); setProblem(null); }}/><Button label="go live" tone="gold" icon={<PlayIcon size={12}/>} onClick={() => void send(card)}/></>}
                </div>
              </article>;
            })}
          </div>
        </div>
      </div>
    </LibraryPane>
  </LibraryBrowser>;
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
  recognition?: import('../../../shared/types').ScriptureRecognition;
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
        {heard.recognition && (
          <span className="text-[length:var(--tri-size-eyebrow)] uppercase tracking-[0.14em] text-[rgb(229_243_242_/_0.6)]"
            title={heard.recognition.source === 'quote'
              ? 'These spoken words match part of this verse, allowing for small wording or hearing errors.'
              : `The story details suggest this passage. Check it before presenting. ${heard.recognition.evidence.join(' · ')}`}>
            {heard.recognition.source === 'quote' ? 'quote match' : 'possible passage'}
          </span>
        )}
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
          <CloseIcon size={12} />
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
function SongCatches() {
  const engine = useEngine();
  const projector = useProjector();
  const active = useSongListeningStore((s) => s.active);
  const setActive = useSongListeningStore((s) => s.setActive);
  const [songs, setSongs] = useState<Song[]>([]);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const reload = () => { void window.api?.songs?.list().then((list) => {
      if (alive) setSongs(list.map((song) => ({ id: song.id, title: song.title, author: (song.authors ?? []).join(', '), verses: song.sections.map((section, i) => ({ ...section, id: `${song.id}:${i}` })) })));
    }).catch(() => undefined); };
    reload();
    window.addEventListener('trilorah-package-imported', reload);
    window.addEventListener('trilorah-library-changed', reload);
    return () => { alive = false; window.removeEventListener('trilorah-package-imported', reload); window.removeEventListener('trilorah-library-changed', reload); };
  }, [active]);
  const heard = [...engine.spoken.lines.slice(-3).map((line) => line.text), engine.spoken.partial].join(' ').split(/\s+/).slice(-10).join(' ');
  const matches = useMemo(() => active ? songs.flatMap((song) => song.verses.map((verse) => ({ song, verse, score: lyricScore(heard, verse.lines.join(' ')) })))
    .filter((m) => m.score > 0).sort((a, b) => b.score - a.score).filter((m, i, all) => all.findIndex((a) => a.song.id === m.song.id) === i).slice(0, 4) : [], [active, songs, heard]);
  /* A fragment, like ScriptureCatches: the button is a tile in the action
     row, and what it finds runs under the whole row. */
  return <>
    <Button className="catch-tile" label={active ? 'stop search' : 'search song'} icon={<MusicIcon size={17} />} tone={active ? 'gold' : 'ash'} onClick={() => { setActive(!active); if (!active && engine.asr !== 'listening') engine.listen(true); }} />
    {active && !matches.length && <p className="catch-extra px-2 text-center text-xs text-white/50">listening for songs in your library</p>}
    {matches.map(({ song, verse }) => <button key={song.id} type="button" className="catch-extra song-sheet !min-h-0" onClick={() => projector.stage({ source: 'song', id: `${song.id}/${verse.id}`, label: song.title, title: song.title, section: verse.label, lines: verse.lines, origin: 'operator' })}>
      <strong className="text-xs">{song.title}</strong><span className="song-sheet-lines">{verse.lines.slice(0, 4).join(' · ')}</span><span className="song-sheet-arrow">↗</span>
    </button>)}
  </>;
}

/*
 * The two things an operator can ask the catches card to do, as a pair of
 * tiles across its top: glyph over word, like the tiles in the run's "+"
 * menu. They were two full-width rows, which spent the card's first 80px
 * on labels and left the catches themselves the remainder.
 */
function CatchActions() {
  return (
    <div
      className="catch-actions mx-auto mb-3 grid w-full max-w-[300px] shrink-0 grid-cols-2 gap-2"
      style={{ '--tri-control-h': '54px', '--tri-control-pad-x': '8px' } as CSSProperties}
    >
      <style>{`
        .catch-actions > .catch-tile { flex-direction: column; gap: 5px; min-width: 0; }
        .catch-actions > .catch-extra { grid-column: 1 / -1; order: 1; }
      `}</style>
      <SongCatches />
      <ScriptureCatches />
    </div>
  );
}

function ProposalStack({ onOpenTranscript }: { onOpenTranscript: () => void }) {
  const engine = useEngine();
  const projector = useProjector();
  const live = engine.caps.bridge;

  const cards: Heard[] = live || isEmptyPreview
    ? engine.proposals.map((p, i) => ({
        id: p.id,
        ref: p.reference,
        version: p.version,
        text: p.text,
        trust: p.trust,
        recognition: p.recognition,
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

  if (cards.length === 0) {
    /*
     * Nothing waiting, so this is where the transcript lives: the same face
     * the dashboard draws, in the card the operator is already watching for
     * a catch. When a verse lands here the transcript gives the card up and
     * rises along the foot of the window instead (see `stripOpen` in the
     * screen), and comes back once the verse has been answered or has gone.
     *
     * Before anything has been heard it is the quiet placeholder — an empty
     * transcript frame at launch said "transcript" about a silent room.
     */
    const heard = engine.asr === 'listening' || engine.spoken.lines.length > 0 || Boolean(engine.spoken.partial);
    return heard ? (
      <TranscriptFace rail spoken={engine.spoken} asr={engine.asr} className="h-full w-full" onOpen={onOpenTranscript} />
    ) : (
      <EmptyMark w={120} h={100} plain art={<ScriptureQuoteArt />} play="hover" line="verses caught land here" />
    );
  }

  return (
    <FadeScroller className="h-full" contentClassName="flex flex-col gap-[var(--tri-gap)]">
      {cards.map((c, i) => {
        const handleActivate = (toLive: boolean) => {
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
            // Clicking a suggestion is a deliberate choice. A later ASR
            // revision may remove its card, but cannot undo this selection.
            origin: 'operator',
          };
          projector.stage(item);
          if (toLive) {
            if (live) {
              engine.dismissProposal(c.id);
            }
            projector.send(item);
          }
        };

        return (
          <DetectedScripture
            key={c.id}
            heard={c}
            index={i}
            onSelect={!c.missing ? () => handleActivate(false) : undefined}
            onLive={!c.missing ? () => handleActivate(true) : undefined}
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
 *
 * The table itself is ORB_BY_STATE in orb/statusLooks.ts, shared with the
 * Thinking orb 2 sheet so the sheet shows exactly what the bar does.
 */
const STATE_LABELS = LIVE_STATES.map((s) => s.label);

/**
 * The orb in the context bar, gear-sized. `label` is one of the fourteen
 * state labels; anything else reads as idle, which is the honest default.
 *
 * The state sets the colour, speed and light; the SHAPE is one style from
 * that state's pool, picked when the state first comes up in a session and
 * kept until the operator stops (see pickStatusLook). The name on hover is
 * the state's, whichever style it is wearing.
 */
function StatusOrb({ label, onClick }: { label: string; onClick?: () => void }) {
  const look = ORB_BY_STATE[label] ?? ORB_BY_STATE.idle;
  /* The session's shape for this state — or, during a long smooth stretch
     of listening, a borrowed one. See orb/orbIdle. */
  const pick = useOrbShape(label);
  const [named, setNamed] = useState(false);
  const phrase = orbStatusDescription(label);
  const show = () => setNamed(true);
  return (
    <div className="tri-header-orb relative flex aspect-square shrink-0" style={{ height: 'var(--tri-control-h)' }}>
      <button
        type="button"
        onClick={onClick}
        onPointerEnter={show}
        onPointerLeave={() => setNamed(false)}
        onFocus={show}
        onBlur={() => setNamed(false)}
        aria-label={phrase}
        className="tri-header-control flex h-full w-full items-center justify-center"
      >
        {/* The dot ball, drawn as SVG by the same geometry as the WebGPU
            one, so it draws on a machine with no GPU driver. Its surface
            shares the header's control height. `dots`
            is a MULTIPLIER on the style's own count (150 × 0.6 = 90), not a
            count — the full 150 is mush at this size. Speed 0 draws once
            and stops, so idle and frozen cost nothing; 30fps is plenty
            for a 30px ball and halves what a moving one costs. */}
        <SvgOrbsPill
          style={pick.style}
          startAt={pick.startAt ?? 0}
          dotColor={INK}
          accent={look.accent}
          speed={look.speed}
          dotOpacity={look.opacity}
          showsPill={false}
          showsLabel={false}
          ball={30}
          dots={0.6}
          fps={30}
          scheme="dark"
        />
      </button>
      <span
        role="tooltip"
        aria-hidden={!named}
        className={cx(
          'tri-rounded-control pointer-events-none absolute left-0 top-[calc(100%+4px)] z-30',
          'w-64 max-w-[calc(100vw-2rem)] whitespace-normal px-3 py-2 text-left text-[length:var(--tri-size-sm)] leading-relaxed',
          'text-[var(--tri-ink)] transition-opacity duration-150',
          named ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          background: 'rgb(14 18 18 / 0.96)',
          boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.12)',
        }}
      >
        {phrase}
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
    (typeof window !== 'undefined' && window.api) || isEmptyPreview
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
    if (api || isEmptyPreview) return;
    const tick = setInterval(() => {
      say(LOG_ROUTINE[cursor.current % LOG_ROUTINE.length]);
      cursor.current += 1;
    }, 4200);
    return () => clearInterval(tick);
  }, [api, say]);

  return { entries, say };
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
          'tri-header-control tri-header-import flex shrink-0 cursor-pointer items-center gap-1.5 lowercase',
        )}
        title="import images, presentation slides, or songs"
        aria-expanded={open}
      >
        <ImportIcon size={12} className="opacity-80" />
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
                pptx, ppt or odp decks
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
/*
 * Whether the companion code is what the wall is showing, and the one press
 * that puts it there or takes it down.
 *
 * Shared by the stage's icon button and the header bento, because two
 * controls for one wall that each remembered their own answer would
 * disagree the moment either was used. State is learned from the engine
 * rather than from the press: main announces every picture it puts up, the
 * code included, and announces a cleared wall too, so a photo shown over
 * the code from another window turns this off without being told.
 */
function useCompanionQr(live: boolean, say?: (e: { text: string }) => void) {
  const [qrUp, setQrUp] = useState(false);

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

  /* Anything going live replaces the code by definition. */
  useEffect(() => {
    if (live) setQrUp(false);
  }, [live]);

  const toggleQr = useCallback(() => {
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
  }, [live, qrUp, say]);

  return { qrUp, toggleQr };
}

/*
 * The companion code as the third bento in the header strip.
 *
 * It was only ever an unlabelled icon down in the stage controls, which is
 * the wrong place for the one thing an operator reaches for BEFORE a service
 * starts — the minutes when the room is filling and the wall is empty are
 * exactly when the code should go up, and at that moment the operator is
 * looking at the top of the window, not at a row of glyphs under a blank
 * preview.
 *
 * So it sits up here beside the clock, named, with its state on its face.
 * Same rule as the icon: only onto an empty wall, dimmed and inert while
 * anything is live, because swapping a verse the room is reading for a QR is
 * the worst mis-click in the app.
 */

/** One pill follows the selected view without remounting the header. */
function ViewTabs({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const hintBubble = useRef<HTMLSpanElement>(null);
  const pointerView = useRef<ViewMode | null>(null);
  const focusView = useRef<ViewMode | null>(null);
  const hintCloseTimer = useRef<number | undefined>(undefined);
  const hintOpen = useRef(false);
  const hintClosedAt = useRef(-Infinity);
  const previousView = useRef(view);
  const [pill, setPill] = useState({ x: 0, width: 0 });
  const [labelWidth, setLabelWidth] = useState(0);
  const [sliding, setSliding] = useState(false);

  const [hint, setHint] = useState<{
    view: ViewMode | null;
    previous: ViewMode | null;
    x: number;
    width: number;
    direction: number;
    open: boolean;
    moving: boolean;
  }>({ view: null, previous: null, x: 0, width: 0, direction: 0, open: false, moving: false });
  const hintFadeMs = 120;

  const hideHint = useCallback(() => {
    window.clearTimeout(hintCloseTimer.current);
    hintCloseTimer.current = undefined;
    if (!hintOpen.current) return;
    hintOpen.current = false;
    hintClosedAt.current = performance.now();
    setHint((current) => ({ ...current, open: false }));
  }, []);

  const showHint = useCallback((target: ViewMode | null) => {
    if (!target || target === view) {
      /* Preserve the same bubble across a brief exit or the selected tab. */
      if (hintOpen.current && hintCloseTimer.current === undefined) {
        hintCloseTimer.current = window.setTimeout(hideHint, 80);
      }
      return;
    }
    window.clearTimeout(hintCloseTimer.current);
    hintCloseTimer.current = undefined;
    const el = root.current;
    const bubble = hintBubble.current;
    const button = el?.querySelector<HTMLButtonElement>(`button[data-view="${target}"]`);
    const symbol = button?.querySelector<HTMLElement>('.tri-header-view-symbol');
    const label = button?.querySelector<HTMLElement>('.tri-header-view-label > span');
    if (!el || !bubble || !symbol || !label) return;
    const groupBox = el.getBoundingClientRect();
    const symbolBox = symbol.getBoundingClientRect();
    const scale = groupBox.height / el.offsetHeight;
    if (!scale) return;
    const bubbleStyle = getComputedStyle(bubble);
    const labelStyle = getComputedStyle(label);
    const x = (symbolBox.left + symbolBox.width / 2 - groupBox.left) / scale;
    const width = Math.ceil(
      label.getBoundingClientRect().width / scale - parseFloat(labelStyle.paddingRight)
      + parseFloat(bubbleStyle.paddingLeft) + parseFloat(bubbleStyle.paddingRight)
      + parseFloat(bubbleStyle.borderLeftWidth) + parseFloat(bubbleStyle.borderRightWidth),
    );
    /* A first entry fades in at its icon; reversals retarget the running motion. */
    const moving = hintOpen.current || performance.now() - hintClosedAt.current < hintFadeMs;
    hintOpen.current = true;
    setHint((current) => {
      if (current.open && current.view === target && current.x === x && current.width === width) return current;
      const changing = moving && current.view !== target;
      return {
        view: target,
        previous: changing ? current.view : moving ? current.previous : null,
        x,
        width,
        direction: changing && current.view
          ? Math.sign(VIEWS.indexOf(target) - VIEWS.indexOf(current.view))
          : moving ? current.direction : 0,
        open: true,
        moving,
      };
    });
  }, [view, hideHint]);

  useEffect(() => () => {
    window.clearTimeout(hintCloseTimer.current);
    hintCloseTimer.current = undefined;
  }, []);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const selected = el.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      if (!selected) return;
      /* Only selection expands a tab; size it to its own label. */
      const label = selected.querySelector<HTMLElement>('.tri-header-view-label > span');
      setLabelWidth(label?.offsetWidth ?? 0);
      const x = selected.offsetLeft;
      const width = selected.offsetWidth;
      setPill((current) => current.x === x && current.width === width ? current : { x, width });
      showHint(pointerView.current ?? focusView.current);
    };
    const changed = previousView.current !== view;
    previousView.current = view;
    setSliding(changed);
    measure();

    /* Follow the selected tab through its label animation and density changes. */
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.querySelectorAll('button[data-view]').forEach((button) => observer.observe(button));
    el.querySelectorAll('.tri-header-view-label > span').forEach((label) => observer.observe(label));
    const finishSlide = changed ? window.setTimeout(() => setSliding(false), 500) : undefined;
    return () => {
      observer.disconnect();
      if (finishSlide !== undefined) window.clearTimeout(finishSlide);
    };
  }, [view, showHint]);

  return (
    <div
      ref={root}
      role="group"
      aria-label="Workspace view"
      className="tri-header-views flex min-w-0 flex-1 items-stretch"
      data-pill-sliding={sliding || undefined}
      onPointerMove={(event) => {
        if (event.pointerType === 'touch') return;
        /* In a flexible gap, the next tab owns the hover. Only real pointer
           movement changes the target, so click animations cannot steal it. */
        const button = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-view]'))
          .find((candidate) => candidate.getBoundingClientRect().right >= event.clientX);
        const target = (button?.dataset.view as ViewMode | undefined) ?? null;
        if (target === pointerView.current) return;
        pointerView.current = target;
        showHint(target ?? focusView.current);
      }}
      onPointerLeave={() => {
        pointerView.current = null;
        showHint(focusView.current);
      }}
      onFocusCapture={(event) => {
        const button = (event.target as Element).closest<HTMLButtonElement>('button[data-view]');
        focusView.current = button?.matches(':focus-visible') ? button.dataset.view as ViewMode : null;
        showHint(pointerView.current ?? focusView.current);
      }}
      onBlurCapture={() => {
        focusView.current = null;
        showHint(pointerView.current);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        pointerView.current = null;
        focusView.current = null;
        hideHint();
      }}
      style={{
        '--tri-view-pill-x': `${pill.x}px`,
        '--tri-view-pill-w': pill.width ? `${pill.width}px` : undefined,
        '--tri-view-label-w': labelWidth ? `${labelWidth}px` : undefined,
        '--tri-view-hint-fade': `${hintFadeMs}ms`,
      } as CSSProperties}
    >
      <span className="tri-header-view-pill" aria-hidden="true" />
      {VIEWS.map((m) => {
        const active = m === view;
        const Icon = VIEW_ICONS[m];
        return (
          <button
            key={m}
            type="button"
            onClick={() => {
              pointerView.current = null;
              focusView.current = null;
              hideHint();
              onChange(m);
            }}
            aria-label={m}
            aria-pressed={active}
            data-view={m}
            data-hint-target={hint.open && hint.view === m || undefined}
            className="tri-header-control tri-header-view flex cursor-pointer items-center justify-center select-none"
          >
            <span className="tri-header-view-symbol">
              <Icon size={18} className="tri-header-view-icon" />
            </span>
            <span className="tri-header-view-label" aria-hidden="true">
              <span>{m}</span>
            </span>
          </button>
        );
      })}
      <span
        className="tri-header-view-hint"
        aria-hidden="true"
        data-open={hint.open || undefined}
        data-moving={hint.moving || undefined}
        style={{
          '--tri-view-hint-x': `${hint.x}px`,
          '--tri-view-hint-w': `${hint.width}px`,
          '--tri-view-hint-shift': `${hint.direction * 6}px`,
        } as CSSProperties}
      >
        <span ref={hintBubble} className="tri-header-view-hint-bubble">
          {hint.previous && (
            <span key={`out-${hint.view}`} className="tri-header-view-hint-old">{hint.previous}</span>
          )}
          <span key={`in-${hint.view}`} className="tri-header-view-hint-name">{hint.view}</span>
        </span>
      </span>
    </div>
  );
}

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
      className="tri-header-control tri-header-clock relative flex shrink-0 cursor-pointer items-center gap-2 lowercase"
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
          <span className="font-mono tracking-wider text-[rgb(229_243_242_/_0.75)] tabular-nums">
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
        'tri-header-control tri-header-log relative flex min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden lowercase',
        className,
      )}
      data-attention={hasAction || undefined}
      style={style}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="tri-header-status-dot h-1.5 w-1.5 shrink-0 rounded-full" />
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
      aria-pressed={on}
      data-error={asr === 'error' || undefined}
      title={
        caps.bridge
          ? on
            ? 'stop listening'
            : 'start listening for the service'
          : 'no engine in this window — run the app with SANDBOX=1'
      }
      className="tri-header-control tri-header-listen flex shrink-0 items-center gap-2 lowercase"
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

/* ---------------------------------------------------------------------------
 * ON AIR — the main action, as the studio's sign.
 *
 * Start listening is the act that opens the service, so it wears the weight
 * a radio station's sign carries, in the card at the foot of the rail. A
 * real sign is a housing with letters cut into the face: dark, the letters
 * are still faintly there — an unlit sign is how a sign says off, it never
 * says "off air" — and lit, the lamp is BEHIND them, hottest above centre,
 * bleeding past the box. Gold, because gold is already the app's "now,
 * look here" colour. While the engine connects it flickers like a warming
 * tube: catches, drops, catches. Chosen 2026-09-27 over a console switch,
 * a bare wordmark and a transport key — and it carries those two's hardware
 * on its housing at the owner's ask: the switch's pilot lamp and the key's
 * mic glyph, at the left edge.
 *
 * It is real: press = start/stop listening, same wiring as the header's
 * ListenControl.
 *
 * It is the card, not a button inside one: it fills its grid cell and wears
 * the panel radius, so it sits in the bento on the same footing as the run
 * of service above it rather than as a box inside a box with a rim of dead
 * space round it, and exactly as tall as the transcript ticker it shares
 * the foot of the window with. The mic marking travels with the lettering
 * as one centred object; there is no pilot lamp, because the lit sign IS
 * the lamp.
 * ------------------------------------------------------------------------- */

/** Machined-surface grain, so the housing reads as material, not fill. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")";

const verseHintSession = createVerseHintSession();

const SIGN_EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

function OnAirSign() {
  const engine = useEngine();
  const on = engine.asr === 'listening' || engine.asr === 'connecting';
  const connecting = engine.asr === 'connecting';
  const disabled = !engine.caps.bridge;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => engine.listen(!on)}
      title={
        disabled
          ? 'no engine in this window — run the app with SANDBOX=1'
          : on
            ? 'stop listening'
            : 'start listening for the service'
      }
      className="group relative flex w-full shrink-0 cursor-pointer select-none items-center justify-center overflow-hidden tri-rounded-surface transition-transform active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        /* Exactly as tall as the transcript ticker beside it: the two share
           the foot of the window, so a sign even a pixel off reads as a
           misalignment rather than as two objects on one line. Same token,
           so they keep agreeing across density. */
        height: D27_HEIGHT,
        transitionDuration: '120ms',
        transitionTimingFunction: SIGN_EASE,
        background: `${GRAIN}, linear-gradient(180deg, #131817 0%, #0b0e0d 100%)`,
        boxShadow: on
          ? 'inset 0 1px 0 rgb(255 255 255 / 0.07), inset 0 -10px 22px rgb(0 0 0 / 0.55), 0 1px 2px rgb(0 0 0 / 0.6), 0 0 34px rgb(255 190 60 / 0.13)'
          : 'inset 0 1px 0 rgb(255 255 255 / 0.07), inset 0 -10px 22px rgb(0 0 0 / 0.55), 0 1px 2px rgb(0 0 0 / 0.6)',
      }}
    >
      {/* The lamp, behind the face. Off it does not exist. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 tri-rounded-surface transition-opacity"
        style={{
          transitionDuration: '260ms',
          transitionTimingFunction: SIGN_EASE,
          opacity: on ? 1 : 0,
          background:
            'radial-gradient(120% 115% at 50% 20%, rgb(240 186 66 / 0.30) 0%, rgb(240 186 66 / 0.10) 46%, transparent 72%)',
          animation: connecting ? 'tri-sign-flicker 1.4s steps(1) infinite' : undefined,
        }}
      />

      {/*
        The mic rides WITH the words, not off in a corner.

        It was parked in a gutter at the left edge, which made the sign
        lopsided: a big centred word with a small mark floating beside it,
        belonging to neither the housing nor the letters. On a real sign the
        marking sits on the same optical line as the type, so it travels with
        it — one object, centred as a whole.
      */}
      <span className="relative flex flex-col items-center gap-[3px]">
        {/* The trailing letter-space of the last R is real width, so the
            pair would hang right of centre. Half of it is taken back here
            rather than on the word, which keeps the mic-to-O gap honest. */}
        <span
          className="flex items-baseline gap-[0.3em]"
          style={{ fontSize: 18, marginRight: '0.23em' }}
        >
          <span
            aria-hidden
            className="transition-colors"
            style={{
              transitionDuration: '260ms',
              /* On the caps' baseline, then nudged to the optical middle of
                 the letterform: a glyph box's centre is not a cap's centre. */
              transform: 'translateY(1px)',
              color: on ? 'rgb(255 214 130 / 0.92)' : 'rgb(214 180 118 / 0.82)',
              filter: on ? 'drop-shadow(0 0 6px rgb(255 190 60 / 0.55))' : undefined,
            }}
          >
            {/* While the room is being heard the mark is a meter, not a
                mic — a moving glyph on this sign always means a live mic. */}
            {engine.asr === 'listening' ? <EqBars size={14} /> : <MicIcon size={14} />}
          </span>
          <span
            className="font-extrabold uppercase transition-colors"
            style={{
              transitionDuration: '260ms',
              fontSize: 'inherit',
              /* The tracking is the sign: wide-set caps read as signage
                 rather than as a label. The indent gives back the trailing
                 letter-space so the pair centres true. */
              letterSpacing: '0.46em',
              textIndent: '0.46em',
              color: on ? '#ffe9ae' : 'rgb(214 180 118 / 0.82)',
              textShadow: on
                ? '0 0 5px rgb(255 214 90 / 0.9), 0 0 16px rgb(255 190 60 / 0.5), 0 0 40px rgb(255 170 40 / 0.28)'
                : 'none',
            }}
          >
            on air
          </span>
        </span>
        {/*
          Engraved on the housing, not printed on the light — and only while
          the sign is dark. Lit, it says nothing: a sign that is on is the
          whole message, and "press to end" under a live ON AIR reads as an
          instruction to kill the service.
        */}
        {(
          <span
            className="text-[9.5px] lowercase tracking-[0.08em]"
            style={{
              color: 'rgb(229 243 242 / 0.8)',
              textShadow: '0 1px 0 rgb(0 0 0 / 0.7)',
            }}
          >
            {on ? 'stop listening' : 'start listening'}
          </span>
        )}
        {connecting && (
          <span
            className="text-[9.5px] lowercase tracking-[0.08em]"
            style={{ color: 'rgb(229 243 242 / 0.38)', textShadow: '0 1px 0 rgb(0 0 0 / 0.7)' }}
          >
            warming up…
          </span>
        )}
      </span>
      {/* A warming tube does not fade in — it catches, drops, catches. */}
      <style>{`
        @keyframes tri-sign-flicker {
          0% { opacity: 0.15 } 7% { opacity: 0.8 } 11% { opacity: 0.3 }
          22% { opacity: 1 } 30% { opacity: 0.45 } 42% { opacity: 1 }
          70% { opacity: 0.85 } 100% { opacity: 1 }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*='tri-sign-flicker'] { animation: none !important; }
        }
      `}</style>
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
  disabled = false,
}: {
  at: number;
  total: number;
  onStep: (delta: -1 | 1) => void;
  disabled?: boolean;
}) {
  if (total <= 1) return null;
  const step = (delta: -1 | 1) => (
    <button
      type="button"
      onClick={() => onStep(delta)}
      disabled={disabled || (delta < 0 ? at <= 0 : at >= total - 1)}
      aria-label={delta < 0 ? "previous slide" : "next slide"}
      title={delta < 0 ? 'previous slide' : 'next slide'}
      className="tri-rounded-control grid size-[22px] place-items-center text-[rgb(229_243_242_/_0.55)] transition-colors hover:text-[var(--tri-ink)] disabled:opacity-30"
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
      className="basis-1/2 !bg-[#111111]"
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

const THEME_SAMPLE: VerseSlide = {
  lines: [{ version: 'KJV', text: 'The LORD is my shepherd; I shall not want.' }],
  reference: 'Psalm 23:1 · theme preview',
  verseStart: 1, verseEnd: 1, index: 1, total: 1,
};

function Stage({
  transition,
  previewTheme,
  liveTheme,
  editingTheme,
  onThemeChange,
  say,
}: {
  transition: ReturnType<typeof useTextTransition>;
  previewTheme: ThemeSettings;
  liveTheme: ThemeSettings;
  editingTheme?: boolean;
  onThemeChange?: (theme: ThemeSettings) => void;
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
  const staged = stageSlide(preview, 0);
  const onAir = stageSlide(live, slide);

  // Pass the staged identity so a newer speech preview cannot replace it.
  const goLive = async () => {
    if (!preview) return;
    /* The wall slices a range by the church's own setting, so the choice made
       here has to become that setting or the preview would be a picture of
       something the congregation never sees. */
    if ((preview.verses?.length ?? 0) > 1) {
      void window.api?.setSetting('breakOnVerse', (preview.slides?.length ?? 0) > 1);
    }
    try {
      await projector.promote();
    } catch (error) { say?.({ text: error instanceof Error ? error.message : 'Could not send to the live screen.' }); }
  };

  const blacked = screen === 'black' || screen === 'logo';

  // Preview navigation is an explicit presentation action: both panels and
  // the audience output follow. Selecting a new library item still only stages it.
  const stagedRef = preview?.source === 'scripture' ? parseStagedRef(preview.reference) : null;
  const navigating = useRef(false);
  const [stepping, setStepping] = useState(false);
  const deckCount = preview?.deckPaths?.length ?? 0;
  const deckIndex = preview?.deckIndex ?? 0;
  const step = async (dir: 1 | -1) => {
    if (navigating.current) return;
    if (preview?.deckPaths) {
      const index = deckIndex + dir;
      if (index < 0 || index >= deckCount) return;
      const next = { ...preview, id: `${preview.deckId}:${index}`, path: preview.deckPaths[index], deckIndex: index, label: `${preview.title} — slide ${index + 1}` };
      navigating.current = true;
      setStepping(true);
      try { await projector.send(next); projector.stage(next); }
      catch (error) { say?.({ text: error instanceof Error ? error.message : 'Could not show slide. Try again.' }); }
      finally { navigating.current = false; setStepping(false); }
      return;
    }
    if (!stagedRef || !preview) return;
    const bookIndex = BOOKS.indexOf(stagedRef.book);
    const target = dir === 1 ? stagedRef.end + 1 : stagedRef.start - 1;
    if (bookIndex < 0 || target < 1 || !window.api?.getChapter) return;
    const version = preview.version || 'KJV';
    navigating.current = true;
    setStepping(true);
    try {
      const res = await window.api.getChapter(bookIndex, stagedRef.chapter, version);
      const row = res?.data?.find((v) => v.id === target);
      if (!row) return;
      const verses = [{ verse: target, text: row.text }];
      const reference = `${stagedRef.book} ${stagedRef.chapter}:${target}`;
      const next: LiveItem = {
        source: 'scripture',
        id: reference,
        label: reference,
        reference,
        version,
        text: row.text,
        verses,
        slides: buildVerseSlides({ book: stagedRef.book, chapter: stagedRef.chapter, version }, verses, fitRules(verses)),
        origin: 'operator',
      };
      await projector.send(next);
      projector.stage(next);
    } catch (error) { say?.({ text: error instanceof Error ? error.message : 'Could not show verse. Try again.' }); }
    finally { navigating.current = false; setStepping(false); }
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
  const [hintPass, setHintPass] = useState(0);
  useEffect(() => {
    if (!stagedRef) return;
    const hint = visitVerseHint(verseHintSession, preview!.id, Date.now());
    if (!hint) return;
    setHintPass(hint.pass);
    const timer = setTimeout(() => setHintPass(0), hint.remaining);
    return () => { clearTimeout(timer); setHintPass(0); };
  }, [preview?.id]);
  const [stageScale, setStageScale] = useState(1);
  const resizeStart = useRef<{ y: number; scale: number } | null>(null);
  const canStep = !editingTheme && (!!stagedRef || deckCount > 1);
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
   * Whether the clip on the wall is paused, as far as this window knows.
   */
  const [videoPaused, setVideoPaused] = useState(false);
  const liveKey = projector.live ? `${projector.live.source}:${projector.live.id}` : '';
  useEffect(() => setVideoPaused(false), [liveKey]);

  const { qrUp, toggleQr } = useCompanionQr(!!live, say);

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
          '--stage-scale': stageScale,
        } as React.CSSProperties
      }
    >
    <div
      className="flex min-h-0 gap-[var(--tri-gap)]"
      style={{
        height:
          /* panel width = half the row less half the gap between the two;
             picture width = that less the inset each side. */
          'calc(((100cqw - var(--tri-gap)) / 2 - 2 * var(--tri-gap)) * 9 / 16 * var(--stage-scale) + var(--stage-row) + 2 * var(--tri-gap))',
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
        onKeyDown={canStep && !editingTheme ? onStepKey : undefined}
        onHover={setOverPreview}
        canvas={
          <>
            <SlideCanvas seated theme={previewTheme} transition={transition} slide={staged ?? (editingTheme && !preview ? THEME_SAMPLE : null)} empty="nothing staged" guide={editingTheme} onSafeMargin={editingTheme ? (safeMargin) => onThemeChange?.({ ...previewTheme, safeMargin }) : undefined} safeRange={SAFE_MARGIN} onRefGap={editingTheme ? (refGap) => onThemeChange?.({ ...previewTheme, refGap }) : undefined} refGapRange={REF_GAP} />
            {preview?.source === 'presentation' && preview.path && <img src={presentationImageSrc(preview.path)} alt={preview.label} className="absolute inset-0 h-full w-full object-contain bg-black" />}
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
            {canStep && !editingTheme && (
              <>
                <button
                  type="button"
                  aria-label={deckCount ? "previous slide" : "previous verse"}
                  title="previous — show on both screens ←"
                  disabled={stepping || (deckCount ? deckIndex <= 0 : (stagedRef?.start ?? 1) <= 1)}
                  onClick={() => step(-1)}
                  className="verse-step absolute inset-y-0 left-0 w-1/2 cursor-w-resize disabled:cursor-default"
                >{hintPass > 0 && <span key={hintPass} className="verse-nav-hint verse-nav-hint--previous"><span>‹</span>previous</span>}</button>
                <button
                  type="button"
                  aria-label={deckCount ? "next slide" : "next verse"}
                  disabled={stepping || (deckCount > 0 && deckIndex >= deckCount - 1)}
                  title="next — show on both screens →"
                  onClick={() => step(1)}
                  className="verse-step absolute inset-y-0 right-0 w-1/2 cursor-e-resize"
                >{hintPass > 0 && <span key={hintPass} className="verse-nav-hint verse-nav-hint--next"><span>›</span>next</span>}</button>
              </>
            )}
            <ScriptureFindOverlay />
          </>
        }
        controls={
          <>
            {deckCount > 0 && <SlidePager at={deckIndex} total={deckCount} onStep={dir => void step(dir)} disabled={stepping || editingTheme} />}
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
                icon={<CloseIcon size={12} />}
                title="unstage — take it out of preview"
                onClick={() => projector.stage(null)}
              />
            )}
            <Button
              label="go live"
              tone="go"
              disabled={!preview || stepping}
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
          <>
          <SlideCanvas
            seated
            theme={liveTheme}
            transition={{ ...transition, play: projector.delivery * 1000 + slide }}
            slide={onAir}
            screen={screen}
            empty="nothing on the projector"
          />
          {live?.source === 'presentation' && live.path && screen === 'live' && <img src={presentationImageSrc(live.path)} alt={live.label} className="absolute inset-0 h-full w-full object-contain bg-black" />}
          </>
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
    <div role="separator" aria-label="resize preview and library" aria-orientation="horizontal" aria-valuemin={55} aria-valuemax={115} aria-valuenow={Math.round(stageScale * 100)} tabIndex={0}
      className="stage-resizer"
      onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setStageScale((v) => Math.max(.55, Math.min(1.15, v + (e.key === 'ArrowUp' ? -.05 : .05)))); } }}
      onPointerDown={(e) => { resizeStart.current = { y: e.clientY, scale: stageScale }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { if (resizeStart.current) setStageScale(Math.max(.55, Math.min(1.15, resizeStart.current.scale + (e.clientY - resizeStart.current.y) / 400))); }}
      onPointerUp={() => { resizeStart.current = null; }} onPointerCancel={() => { resizeStart.current = null; }}><span><svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2v14M6 5l3-3 3 3M6 13l3 3 3-3M3 9h2M13 9h2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/></svg></span></div>
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
    <DragProvider onDrop={(segmentKey, items) => {
      if (segmentKey === 'media-themes') {
        for (const item of items) {
          const media = getMediaLibrary().find(m => m.id === item.mediaId);
          if (media) addMedia({ ...media, collection: 'themes' });
        }
      } else run.dropInto(segmentKey, items);
    }}>
      <DragKeyframes />
      <ServiceLogKeyframes />
      <LiveBody state={state} />
    </DragProvider>
  );
}

/* Inside the providers, so the screen itself can read the run — the rail and
   the browser are both in here and both need it. */
function LiveBody({ state }: { state?: string }) {
  useMobileRemote();
  const textTransition = useTextTransition();
  const [tab, setTab] = useState(0);
  /* The preview opens on a background off the shelf, so there is a picture
     in it from the first frame; the one from the online library replaces it
     a moment later (below). Only the preview: the wall's own background is a
     setting, and it changes on promote like everything else. */
  const restoredTheme = useRef(!!readTriLocal(TRI_THEME_KEY, null));
  const [previewTheme, setPreviewTheme] = useState<ThemeSettings>(() => normalizeTriTheme(readTriLocal(TRI_THEME_KEY, null), {
    ...DEFAULT_THEME,
    backgroundId: randomStill()?.id ?? DEFAULT_THEME.backgroundId,
  }));
  const latestTheme = useRef(previewTheme);
  latestTheme.current = previewTheme;
  useEffect(() => {
    try { localStorage.setItem(TRI_THEME_KEY, JSON.stringify(previewTheme)); } catch { /* Desktop package saves also hold the layout. */ }
    window.dispatchEvent(new Event('trilorah-theme-changed'));
  }, [previewTheme]);
  useEffect(() => {
    const initial = latestTheme.current;
    const importTheme = (event: Event) => {
      restoredTheme.current = true;
      setPreviewTheme(current => normalizeTriTheme((event as CustomEvent).detail, current));
    };
    window.addEventListener(TRI_THEME_EVENT, importTheme);
    if (!readTriLocal(TRI_DISPLAY_KEY, null)) {
      void window.api?.getSetting('triThemeDisplay').then(value => {
        if (value && typeof value === 'object' && !readTriLocal(TRI_DISPLAY_KEY, null)) stageTriDisplay(value as Record<string, unknown>);
      }).catch(() => undefined);
    }
    if (!restoredTheme.current) {
      void window.api?.getSetting('triThemeLayout').then(value => {
        if (!value || latestTheme.current !== initial || restoredTheme.current) return;
        restoredTheme.current = true;
        setPreviewTheme(current => normalizeTriTheme(value, current));
      }).catch(() => undefined);
    }
    return () => window.removeEventListener(TRI_THEME_EVENT, importTheme);
  }, []);
  const openedOn = useRef(previewTheme.backgroundId);
  const [liveTheme, setLiveTheme] = useState<ThemeSettings>(DEFAULT_THEME);

  const engine = useEngine();
  /* The foot strip is up only while a catch holds the rail's card — that
     card is the transcript's home (see ProposalStack). With no engine the
     card shows the seed catches, so the strip stays up for the design sheet. */
  const stripOpen = engine.caps.bridge ? engine.proposals.length > 0 : !isEmptyPreview;
  const projector = useProjector();
  const themeLibrary = useMediaLibrary();
  useEffect(() => projector.beforeSend(async () => {
    const media = themeLibrary.find(item => item.id === previewTheme.backgroundId) ?? themeLibrary[0];
    const appearance = readTriLocal<Record<string, unknown>>(TRI_DISPLAY_KEY, {});
    const settings = { ...appearance, ...outputThemeSettings(previewTheme, media ? mediaSrc(media) : ''),
      ...(typeof appearance.backgroundFit === 'string' ? { backgroundFit: appearance.backgroundFit } : {}),
      ...(typeof appearance.backgroundPosition === 'string' ? { backgroundPosition: appearance.backgroundPosition } : {}),
    };
    if (window.api) {
      await Promise.all(Object.entries(settings).map(([key, value]) => window.api!.setSetting(key, value)));
      if (Object.keys(appearance).length) {
        await window.api.setSetting('triThemeDisplay', null);
        localStorage.removeItem(TRI_DISPLAY_KEY);
      }
    }
    setLiveTheme(previewTheme);
  }), [projector.beforeSend, previewTheme, themeLibrary]);

  /*
   * A verse in the preview from the first frame.
   *
   * Once per launch, and only into an empty preview — the read is async, and
   * by the time it lands the operator or the engine may have staged
   * something, which always wins over a verse nobody chose.
   */
  const stagedNow = useRef(projector.preview);
  stagedNow.current = projector.preview;
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const api = window.api;
    if (!api?.getChapter) return;
    /* Drawn in a random order and taken in turn: the first that reads clean
       opens the preview. In the KJV that is the first drawn; the check is
       for the other versions, which keep their notes in places of their own.
       A version where every one carries a note gets the first drawn, as it
       is — the projector would set it that way too. */
    const drawn = [...OPENING_VERSES].sort(() => Math.random() - 0.5);
    void (async () => {
      const chosen = await api.getSetting?.('displayVersion');
      const version = typeof chosen === 'string' && chosen ? chosen : 'KJV';
      let found: { pick: (typeof OPENING_VERSES)[number]; text: string } | null = null;
      for (const pick of drawn) {
        const bookIndex = BOOKS.indexOf(pick.book);
        if (bookIndex < 0) continue;
        const res = await api.getChapter(bookIndex, pick.chapter, version);
        const text = res?.data?.find((v) => v.id === pick.verse)?.text;
        if (!text) continue;
        found ??= { pick, text };
        if (!/[{[]/.test(text)) {
          found = { pick, text };
          break;
        }
      }
      if (!found || stagedNow.current) return;
      const { pick, text } = found;
      const verses = [{ verse: pick.verse, text }];
      const reference = `${pick.book} ${pick.chapter}:${pick.verse}`;
      projector.stage({
        source: 'scripture',
        id: reference,
        label: reference,
        reference,
        version,
        text,
        verses,
        slides: buildVerseSlides({ book: pick.book, chapter: pick.chapter, version }, verses, fitRules(verses)),
        origin: 'operator',
      });
    })().catch((err) => console.error('opening verse: could not stage', err));

    /*
     * And a background from the online library, under one of its own themes
     * — forest, ocean, gold bokeh — drawn fresh each launch.
     *
     * It is fetched the way the online tab fetches one, so it lands on the
     * shelf like any other pick and is still there with the network gone.
     * Never applied: `apply` would make it the wall's background, and
     * nothing about a launch is a press.
     *
     * No network, or no key for the library, and the picture off the shelf
     * simply stays. It also stays if the operator has chosen a background in
     * the meantime — theirs is a choice and this one is a default.
     */
    if (restoredTheme.current || !api.searchStock || !api.downloadStock) return;
    const { searchStock, downloadStock } = api;
    void (async () => {
      const preset = STOCK_PRESETS[Math.floor(Math.random() * STOCK_PRESETS.length)];
      const res = await searchStock({ query: preset.query, kind: 'photo', page: 1 });
      if (!res.success || !res.items.length) return;
      /* A portrait photo behind a landscape slide is mostly cropped away. */
      const wide = res.items.filter((i) => i.width >= i.height);
      const pool = wide.length ? wide : res.items;
      const item = pool[Math.floor(Math.random() * pool.length)];
      const saved = await downloadStock({ item });
      if (!saved.success || !saved.url) return;
      addMedia({
        id: item.id,
        label: preset.label,
        detail: item.credit,
        seed: 0,
        style: 'smoke',
        source: 'local',
        url: saved.src ?? saved.url,
        poster: item.thumb,
        kind: 'photo',
      });
      setPreviewTheme((prev) =>
        !restoredTheme.current && prev.backgroundId === openedOn.current ? { ...prev, backgroundId: item.id } : prev,
      );
    })().catch((err) => console.error('opening background: could not fetch one', err));
  }, [projector]);

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

  const [view, setView] = useState<ViewMode>(isEmptyPreview ? 'dashboard' : 'operator');
  const [settingsPage, setSettingsPage] = useState('S-10a');
  const openOnlineSettings = () => { setSettingsPage('S-10k'); setView('settings'); };
  const run = useRun();

  /*
   * The engine put something up itself — auto mode, or the app window
   * running beside this one pushed it. Either way the congregation is
   * reading it and this surface has to agree, so it mirrors rather than
   * argues. This is the one place engine truth overwrites local state.
   */
  const mirror = projector.reflect;
  useEffect(() => engine.onEngineLive((item) => mirror(item)), [engine, mirror]);

  /* The engine took the verse down — the preacher has moved on and stopped
     saying its words. The wall is already clear; this box has to agree, or
     the operator is looking at a "live" verse nobody can see. */
  useEffect(() => window.api?.onVerseAutoDismiss?.(() => {
    if (projector.live?.source === 'scripture') projector.reflect(null);
  }), [projector]);

  /*
   * A caught reference STAGES. It does not go live.
   *
   * This used to stage and push in the same breath, which put the engine's
   * guess in front of the congregation the instant it heard one — over
   * whatever the operator had chosen, mid-sentence, with no press involved.
   * The proposal stack exists precisely so that answering a catch is a
   * deliberate act (see ProposalStack), and pushing here went behind it.
   *
   * So it fills the preview box only: the operator sees the verse arrive,
   * reads it, and presses live when the preacher actually gets there. The
   * press is in the proposal card and in the preview panel's own live
   * button, both of which already do the full round trip.
   *
   * It also will not touch preview while something is already staged by
   * hand — a catch is a suggestion, and overwriting a chosen verse is the
   * same mistake one step quieter.
   */
  const latestProposal = engine.proposals[0];
  const latestProposalKey = latestProposal ? `${latestProposal.id}:${latestProposal.reference}:${latestProposal.version}` : null;
  const lastStagedRef = useRef<string | null>(null);
  const proposalsForWithdrawal = useRef(engine.proposals);
  proposalsForWithdrawal.current = engine.proposals;
  const withdrawnSuggestions = useRef(new Set<string>());
  const withdrawRecognition = projector.withdrawRecognition;
  useEffect(() => window.api?.onRecognitionWithdrawn?.(({ suggestionId }) => {
    withdrawnSuggestions.current.add(suggestionId);
    // Removing the newest provisional card must not automatically stage an
    // older card behind it. A subsequent new detection still stages normally.
    const next = proposalsForWithdrawal.current.find(proposal =>
      !proposal.recognition || !withdrawnSuggestions.current.has(proposal.recognition.suggestionId));
    lastStagedRef.current = next ? `${next.id}:${next.reference}:${next.version}` : null;
    withdrawRecognition(suggestionId);
  }), [withdrawRecognition]);

  useEffect(() => {
    if (!latestProposal || latestProposal.missing || !latestProposal.reference) return;
    if (lastStagedRef.current === latestProposalKey) return;
    lastStagedRef.current = latestProposalKey;
    if (projector.preview?.origin === 'operator') return;

    projector.stage({
      source: 'scripture',
      id: latestProposal.reference,
      label: latestProposal.reference,
      reference: latestProposal.reference,
      version: latestProposal.version,
      text: latestProposal.text,
      slides: latestProposal.slides,
      verses: latestProposal.verses,
      origin: 'engine',
      recognitionSuggestionId: latestProposal.recognition?.suggestionId,
    });
  }, [latestProposalKey, projector]);

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
      void importAndSavePresentation().then(deck => {
        if (!deck) return;
        setView('operator');
        setTab(TABS.findIndex(t => t.id === 'slides'));
        say({ text: `Imported ${deck.slides.length} slides. Select the deck to preview.` });
      }).catch(error => say({ text: error instanceof Error ? error.message : 'Slide import failed. Try another file.' }));
    } else {
      say({ text: 'Open the desktop app to import PowerPoint slides.' });
    }
  }, [say]);

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
      <div
        className={cx(
          'grid h-full w-full min-w-0 gap-[var(--tri-gap)] p-2.5',
          'tri-workspace-aurora',
        )}
        style={{
          // Keep the run readable when the window is narrower than a booth monitor.
          '--tri-rail-w': 'max(232px, 20%)',
          gridTemplateColumns: 'var(--tri-rail-w) minmax(0, 1fr)',
          gridTemplateRows: 'var(--tri-topbar-h) minmax(0, auto) minmax(min(190px, 36vh), 1fr) auto',
        } as CSSProperties}
      >
        {/* Shared across views so the selection pill can slide continuously. */}
        <div
          className="tri-live-header tri-live-navigation flex min-w-0 items-center"
          style={{ height: 'var(--tri-topbar-h)' }}
        >
          <ViewTabs view={view} onChange={setView} />
        </div>
        <div
          className="tri-live-header tri-live-controls flex min-w-0 items-center"
          style={{ height: 'var(--tri-topbar-h)' }}
        >
          <StatusOrb label={stateLabel} onClick={stepState} />
          <ListenControl />
          <SermonStartControl />
          <div className="min-w-0 flex-1" />
          <ImportBentoMenu
            onImportImage={handleImportImage}
            onImportSlides={handleImportSlides}
            onImportSongs={handleImportSongs}
          />
          <DigitalClockBento />
          <div className="tri-header-log-slot flex min-w-0 items-stretch">
            <ServiceLogBar entries={log.entries} onAction={goManual} />
          </div>
        </div>

        {view === 'dashboard' || view === 'profile' || view === 'settings' ? (
          /* The bento is the whole dashboard — the log is a card in it.
              Profile borrows this same frame: it is read rather than
              worked, like the dashboard, so it wants the header and the
              full width, not the operator's rail-and-stage grid. */
          <div className="col-span-2 row-span-3 flex min-h-0 min-w-0 flex-col gap-[var(--tri-gap)]">
            {view === 'settings' ? (
              /* The same surface the sandbox draws, given the posture's
                 full width. It brings its own nine-page rail, so it wants
                 the frame without the bento's padding. */
              <div className="min-h-0 flex-1 overflow-hidden">
                <SettingsSurface pageId={settingsPage} />
              </div>
            ) : view === 'profile' ? (
              <ProfileView />
            ) : (
              <DashboardBento log={log.entries} onLogAction={goManual} onViewProfile={() => setView('profile')}
                onOpenSettings={page => { setSettingsPage(page === 'appearance' ? 'S-10g' : 'S-10c'); setView('settings'); }} />
            )}
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
          className="col-span-2 row-span-3 grid min-h-0 min-w-0 grid-rows-subgrid"
          style={{ gridTemplateColumns: 'var(--tri-rail-w) minmax(0, 1fr)', columnGap: 'var(--tri-gap)' }}
        >
          <div
            data-drop-segment=""
            className="row-span-3 min-h-0 min-w-0 grid grid-rows-subgrid"
          >
            {/* Out of flow inside its cell: the run can be any length, and a
                long one must scroll inside the row the stage sized rather
                than be counted as a reason to make that row taller. */}
            <div className="relative min-h-0">
            <Panel
              title={`run of service (${run.segments.length})`}
              className="operator-empty absolute inset-0 !bg-[#111111]"
              /* Always mounted, drawn only once the run has something in
                 it. While it is empty the empty state carries the same
                 actions at a size you cannot miss, and a second, smaller
                 set in the header was the same offer made twice in one
                 card — but the dialogs those actions open live here, and
                 must outlast the rail filling up. */
              right={<RunHeaderActions say={say} hidden={run.segments.length === 0} />}
            >
              <RunOfService
                renderAdd={(seg) => <SegmentAdd seg={seg} />}
                fallbackSongs={isEmptyPreview ? [] : SONGS}
              />
            </Panel>
            </div>

            {/* Catches, down to the ticker's row. */}
            <Panel
              className="min-h-0 !bg-[#111111]"
              bodyClass="pt-3 flex flex-col"
              bodyStyle={{ paddingBottom: 'var(--tri-card-gap)' }}
            >
              <HeardMotion />
              <CatchActions />
              <div className="operator-empty min-h-0 flex-1 overflow-y-auto"><ProposalStack onOpenTranscript={() => setView('dashboard')} /></div>
            </Panel>

            {/* The ticker's row, under the rail: the ON AIR sign, the
                screen's main action. It is its own card — see OnAirSign. */}
            <OnAirSign />
          </div>

          <div className="row-span-3 grid min-h-0 min-w-0 grid-rows-subgrid">
            <div className="flex min-h-0 min-w-0 flex-col gap-[var(--tri-gap)]">
            <Stage
              transition={textTransition}
              say={say}
              editingTheme={TABS[tab]?.id === 'themes'}
              onThemeChange={setPreviewTheme}
              previewTheme={previewTheme}
              liveTheme={liveTheme}

            />

            </div>

            {/* The browser and, under it, the transcript strip — one cell
                across the browser's row and the ticker's, so the browser
                runs to the foot of the window while the strip is away and
                gives the height back as it rises. */}
            <div className="row-span-2 flex min-h-0 min-w-0 flex-col">
            <div className="flex min-h-0 min-w-0 flex-1 gap-[var(--tri-gap)]">
            <LibraryTabs tab={tab} onChange={setTab} />
            <Panel
              className="min-h-0 min-w-0 flex-1 !bg-[#111111]"
              /* Themes sits on the panel like every other tab — see
                 ThemesEditor. Its inset is the stage's, --tri-gap all round,
                 because it seats a projector the same way the stage does. */
              bodyClass={TABS[tab]?.id === 'themes' ? undefined : TABS[tab]?.id === 'songs' || TABS[tab]?.id === 'slides' ? 'pt-4' : 'pt-3'}
              bodyStyle={TABS[tab]?.id === 'themes' ? { padding: 'var(--tri-gap)' } : undefined}
            >
              {TABS[tab]?.id === 'themes' ? (
                <ThemesEditor
                  tx={textTransition}
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
                  onOpenSettings={openOnlineSettings}
                  selected={previewTheme.backgroundId}
                  onSelect={(backgroundId) => {
                    setPreviewTheme((prev) => ({ ...prev, backgroundId }));
                    setTab(0);
                  }}
                />
              ) : null}
              {TABS[tab]?.id === 'online' ? (
                /* The same search the media tab's third shelf opens, and a
                   pick does what a pick there does: the file is saved to
                   this laptop, joins the library, becomes the preview's
                   background, and the browser goes back to verses. */
                <StockSearch
                  onOpenSettings={openOnlineSettings}
                  onPick={(media) => {
                    addMedia(media);
                    setPreviewTheme((prev) => ({ ...prev, backgroundId: media.id }));
                    setTab(0);
                  }}
                />
              ) : null}
            </Panel>
            </div>

            {/* The live transcript, along the foot of the window — but only
                while a caught verse is holding the catches card, which is
                where the transcript otherwise lives. It grows up out of the
                bottom edge when the card is taken and sinks back when the
                card is free again; the rest of the time there is no strip
                here at all, not even an empty one. Under the right-hand
                column only: the owner does not want it under the rail. */}
            <div className="tri-strip-rise" data-open={stripOpen || undefined} aria-hidden={!stripOpen}>
              <style>{`
                .tri-strip-rise {
                  display: grid; grid-template-rows: 0fr; margin-top: 0; opacity: 0; visibility: hidden;
                  transition: grid-template-rows 340ms var(--tri-ease-out, ease-out), margin-top 340ms var(--tri-ease-out, ease-out),
                    opacity 220ms ease-out, visibility 0s 340ms;
                }
                .tri-strip-rise > div { display: flex; min-height: 0; min-width: 0; overflow: hidden; align-items: stretch; }
                .tri-strip-rise[data-open] {
                  grid-template-rows: 1fr; margin-top: var(--tri-gap); opacity: 1; visibility: visible;
                  transition: grid-template-rows 340ms var(--tri-ease-out, ease-out), margin-top 340ms var(--tri-ease-out, ease-out),
                    opacity 260ms ease-out 80ms, visibility 0s;
                }
                /* Unclipped once it is up, so the sandbox's demo bar can hang above it. */
                .tri-strip-rise[data-open] > div { animation: tri-strip-unclip 340ms step-end both; }
                @keyframes tri-strip-unclip { from { overflow: hidden; } to { overflow: visible; } }
                @media (prefers-reduced-motion: reduce) {
                  .tri-strip-rise, .tri-strip-rise[data-open] { transition: opacity 150ms linear; }
                }
              `}</style>
              <div>
                <LiveTranscript
                  spoken={engine.spoken}
                  asr={engine.asr}
                  onOpenDashboard={() => setView('dashboard')}
                />
              </div>
            </div>
            </div>
          </div>
        </ViewEnter>
      )}
      </div>

      {/* Hidden file pickers for web fallback */}
      <input
        ref={hiddenImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFilePicked}
        className="hidden"
      />


    </>
  );
}
