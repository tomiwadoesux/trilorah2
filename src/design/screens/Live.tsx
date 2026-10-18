import { StageGradient } from './StageGradient';
import { AutoAdvance } from './AutoAdvance';
import { BookClarification, ScriptureTools } from './ScriptureTools';
import { useLibraryNavigation } from '../../stores/libraryNavigation';
import { mediaPreview } from '../../lib/mediaPreview';
import { useOperatorTyping } from '../../lib/useOperatorTyping';
import { QrProjectionConfirm } from './QrProjectionConfirm';
import type { ScriptureReferenceInputHandle } from '../../ui/primitives/ScriptureReferenceInput';
import { selectBackgroundContent } from '../../lib/backgroundSelection';
import { videoSpeed, videoBass } from '../../lib/backgroundPlayback';
import { rearrangeLyrics } from '../../../shared/rearrangeLyrics';
import { isEmptyPreview } from '../emptyPreviewMode';
import { NotificationCenter, type NotificationTriggerProps } from '../../components/NotificationCenter';
import { nextOrbPhrase } from '../../lib/orbPhrases';
import { ProductGuide } from '../../components/ProductGuide';
import type { GuideDestination } from '../../lib/productGuide';
import { OrbActions, type OrbSuggestion } from '../../components/OrbActions';
import { OrbStatusHint } from '../../components/OrbStatusHint';
import type { OrbDestination } from '../../lib/orbActions';
import { useNotificationStore } from '../../stores/notificationStore';
import { useNoticeNavigation } from '../../lib/notificationNavigation';
import './themesEditor.css';
import './listeningSign.css';
import { presentationImageSrc } from '../../lib/presentationImport';
import { stageSlide } from '../../lib/stageSlide';
import { liveKey } from '../../lib/liveKey';
import { outputThemeSettings } from '../../lib/outputTheme';
import { NO_BACKGROUND, backgroundDropAction, backgroundSrc, backgroundFor, canBeBackground, isBackgroundDropKey, liveBackgroundNotice, liveThemeFromSettings, previewBackgroundNotice, sameTheme, wallBackgroundMedia, wallUrlToMediaId, type BackgroundDropKey } from '../../lib/backgroundDrop';
import { toDisplayUrl } from '../../../shared/mediaUrl';
import { TEXT_WIDTH } from '../../../shared/textWidth';
import { resolveTextCase, type TextCase } from '../../../shared/textCase';
import { resolveTextSpacing, type TextSpacing } from '../../../shared/textSpacing';
import { forgetTriMedia, normalizeTriTheme, readTriLocal, stageTriDisplay, updateStagedTriDisplay, TRI_DISPLAY_EVENT, TRI_DISPLAY_KEY, TRI_THEME_EVENT, TRI_THEME_KEY } from '../../lib/triClient';
import { arrangeSongCards, editSongCard, songCards } from '../../../shared/songCards';
import { createVerseHintSession, visitVerseHint } from '../../lib/verseHints';
import { useSongListeningStore } from '../../stores/songListeningStore';
import { recentSongWords } from '../../lib/songMatch';
import { useSongMatches } from './songs/useSongMatches';
import { Children, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useMobileRemote } from './useMobileRemote';
import { MicPicker } from '../../components/MicPicker';
import { MobileMenu } from '../../components/MobileMenu';
import { ScriptureCatches, ScriptureFindOverlay, ScriptureSearch } from './ScriptureCatches';
import { useScriptureFindStore } from '../../stores/scriptureFindStore';
import SvgOrbsPill from '../orb/SvgOrbsPill';
import { ORB_BY_STATE, STATUS_ORB_INK as INK } from '../orb/statusLooks';
import { useOrbShape } from '../orb/orbIdle';
import { LiveTranscript } from './transcript/LiveTranscript';
import { OperatorRail } from './OperatorRail';
import {
  ActionMenu,
  Button,
  cx,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
  CheckIcon,
  CloseIcon,
  AddSongIcon,
  DisplayFontPicker,
  TextTransitionPicker,
  ScriptureReferenceInput,
  MediaIcon,
  MicIcon,
  SearchField,
  Select,
  surface,
  toneClass,
  PencilIcon,
  MusicIcon,
  TrashIcon,
  GlobeIcon,
  LaptopIcon,
  PlusIcon,
  ImportIcon,
  PlayIcon,
  PauseIcon,
  Slider,
  TextPositionPicker,
  ResetIcon,
  type FontOption,
  type ResolvedReference,
  type ScriptureBook,
  type SelectOption,
  type TextPositionOption,
  PresentationIcon,
  BookIcon,
  ClockIcon,
  PaletteIcon,
  QrIcon,
  OperatorIcon,
  DashboardIcon,
  ProfileIcon,
  SettingsIcon,
  type IconProps,
} from '../../ui';
import { BOOKS, CHAPTER_COUNTS } from '../../lib/books';
import { STOCK_PRESETS } from '../../lib/stockPresets';
import { parseVerse } from '../../lib/scriptureText';
import { AppShell } from './AppShell';
import { useArtboard } from './artboard';
import { DashboardBento } from './dashboard';
import { useOutputsStatus, saveDisplay } from './dashboard/outputs/fromEngine';
import { ProfileView } from './dashboard/ProfileView';
import { SettingsSurface } from './Settings';
import { ViewEnter } from './viewEnter';
import { RunOfService } from './run/RunRail';
import { EmptyMark, EqBars } from './emptyArt';
import { TranscriptFace } from './dashboard/PreachingTile';
import { ScriptureLibraryEmpty } from './ScriptureLibraryEmpty';
import { SongRackArt } from './SongRackArt';
import { GlobeEmptyArt } from './GlobeEmptyArt';
import { loadScriptureChapter } from '../../lib/loadScriptureChapter';
import { ScriptureQuoteArt } from './ScriptureQuoteArt';
import { LibraryBrowser, LibraryPane, LibrarySearch, useLibrarySelection } from './library';
import { REFERENCE_CAP_EMS, bookAllowance, referenceColumnWidth, splitReference } from '../../lib/referenceColumn';
import { catchEntries, queuedIds, spotlightIndex, spotlightItem } from '../../lib/catchSets';
import { useCatchStore } from '../../stores/catchStore';
import { useLiveStore } from '../../stores/liveStore';
import { versionOptions, versionRowOptions, type BibleVersionRow } from '../../../shared/bibleVersions';
import { CatchPeek, CatchesPane } from './CatchesPane';
import { CatchSignals } from './CatchSignals';
import { ScriptureTravel } from './ScriptureTravel';
import { chapterOrdinal, liveSpan, passingRows, spanReference, travelShape, type LiveSpan, type ReelRow } from '../../lib/scriptureReel';
import { reducedMotion } from './dashboard/expand';
import { AddSongDialog, type SongSource } from './songs/AddSongDialog';
import { SongEditor, type EditorSession } from './songs/SongEditor';
import { LibraryAction, LibraryToolbar } from './LibraryToolbar';
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
import { MediaKindPicker, StockSearch } from './stockSearch';
import { addMedia, addFromLaptop, removeMedia, mediaSrc, randomStill, useMediaLibrary, getMediaLibrary, type ThemeMedia } from './mediaLibrary';
import { finderDropProps, useFinderDrag, type FinderDropProps } from './finderDrop';
import { finderPaneHint, finderStageHint, finderStagePick, shelfFor, type FinderStageKey } from '../../lib/laptopImport';
import { ProjectorProvider, useProjector, type LiveItem, type ScreenState } from './projector';
import { previewClearPlan } from '../../lib/previewClear';
import { EngineProvider, useEngine, SLIDE_RULES, fitRules, fitOf, wordCount, FIT_WORDS, type Proposal } from './engine';
import { RunProvider, useRun } from './run';
import { DragKeyframes, DragProvider, useDrag, type DragItem, type DropTargetProps } from './drag';
import { Panel } from './parts';
import './liveHeader.css';
import './dottedSurface.css';
import { DitheredPatches } from './DitheredPatches';

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
];

/*
 * The six tabs, down the left of the browser rather than across the top of
 * it. Across, they cost a full row of height between the stage and the
 * browser; down the side they cost a narrow column and the browser gets the
 * height back, which is what it is short of — a verse table, a song list
 * and a slide grid all want more rows, not wider ones.
 *
 * The six are ONE list, not six pills (owner, 2026-10-08, pointing at
 * Notion's menus): a single group with one hairline round it and a rule
 * between each row, so the column reads as one control rather than six
 * loose buttons. The group's corner is the control radius and the panel's
 * is that plus the --tri-card-gap inset, so the two curves stay concentric.
 * Words are control-sized, with a glyph ahead of each so the column can be
 * scanned without reading it.
 *
 * The lit row is ONE fill that slides to the tab chosen, not a fill that
 * blinks off one row and on at another: the eye follows it, and the old and
 * new tab are never both half-lit. 200ms on a strong ease-out, so it has
 * arrived before the browser below has finished swapping. A switch made
 * from the keyboard jumps instead — arrowing through tabs is repeated and a
 * slide on every press would lag the key. Reduced motion jumps too. Rows
 * do not dip on a press: a row that shrank would pull its rules in with it.
 *
 * Every row is --tri-field-h tall, its rule inside that height, so where
 * the light sits is arithmetic on the index — nothing is measured, and a
 * change of density moves it with the rows.
 *
 * The column is as wide as the longest label in bold, reserved by an
 * invisible bold copy under every label, so choosing a tab (which bolds it)
 * never nudges the browser sideways.
 */
/** Where the verses card sits in the library's tabs. */
const SCRIPTURES_TAB = Math.max(0, TABS.findIndex((t) => t.id === 'scriptures'));

const TAB_ICONS: Record<string, (p: IconProps) => ReactNode> = {
  scriptures: BookIcon,
  themes: PaletteIcon,
  songs: MusicIcon,
  slides: PresentationIcon,
  media: MediaIcon,
};

/** Intrinsic width shared by the library rail and its compact selectors. */
function LibraryControlSizer() {
  return (
      <span aria-hidden="true" className="invisible col-start-1 row-start-1 grid h-[var(--tri-field-h)] items-center pl-3 pr-4 text-[length:var(--tri-control-size)] font-semibold" style={{ border: 'var(--tri-border) solid transparent' }}>
        {TABS.map((item) => (
          <span key={item.id} className="col-start-1 row-start-1 flex items-center gap-2 whitespace-nowrap">
            <span className="w-[14px] shrink-0" />{item.label}
          </span>
        ))}
      </span>
  );
}

function LibraryTabs({ tab, onChange }: { tab: number; onChange: (i: number) => void }) {
  const railRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const rail = railRef.current;
    const list = rail?.querySelector<HTMLElement>('[role="tablist"]');
    const workspace = rail?.closest<HTMLElement>('[data-library-workspace]');
    if (!list || !workspace) return;
    const syncWidth = () => workspace.style.setProperty('--library-pill-width', `${list.getBoundingClientRect().width}px`);
    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);
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
      ref={railRef}
      aria-label="library navigation"
      className="tri-library-tabs tri-dotted-surface relative min-h-0 min-w-0 shrink-0 self-start max-h-full overflow-x-hidden overflow-y-auto overscroll-contain"
      style={{
        ...EDGE,
      }}
    >
      <DitheredPatches />
      {/* The whole rail scrolls, including its padding. Decorative layers
          never sit between the pointer and the native scroll container. */}
      <div
        role="tablist"
        data-guide-area="library"
        aria-orientation="vertical"
        aria-label="library"
        /* A real border keeps the active fill inside the group's edge. */
        className="relative z-10 flex flex-col overflow-hidden bg-[#111111]"
        style={{ border: 'var(--tri-border) solid rgb(255 255 255 / 0.12)' }}
      >
        <span
          aria-hidden="true"
          data-library-indicator
          className={cx(
            'pointer-events-none absolute inset-x-0 top-0 h-[var(--tri-field-h)] bg-white/[0.07]',
            'transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
            jump && 'transition-none',
          )}
          style={{ transform: `translateY(calc(${tab} * var(--tri-field-h)))` }}
        />
        {TABS.map((t, i) => {
          const Icon = TAB_ICONS[t.id];
          const on = i === tab;
          return (
            <button
              key={t.id}
              data-guide={`library-${t.id}`}
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
                'relative flex h-[var(--tri-field-h)] shrink-0 items-center gap-2 pl-3 pr-4 text-left text-[length:var(--tri-control-size)] lowercase',
                'transition-[color,background-color] duration-150 ease-out',
                i > 0 && 'border-t border-white/[0.08]',
                on
                  ? 'font-semibold text-[var(--tri-ink)]'
                  : 'text-[rgb(229_243_242_/_0.58)] hover:bg-white/[0.04] hover:text-[rgb(229_243_242_/_0.85)]',
              )}
            >
              {Icon && (
                <Icon
                  selected={on}
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
  videoSpeed?: number;
  videoBass?: number;
  videoSound?: boolean;
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
  videoSpeed: 1,
  videoBass: 0,
  videoSound: false,
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
 * it moves words people are reading. (The one exception is the background
 * alone, put on the wall on purpose — a double-click in themes or a drop on
 * the LIVE box — which changes the picture behind the words and nothing that
 * moves them.) A transition cannot disturb what is
 * already up — it only decides how the NEXT thing arrives — so it is written
 * through the moment it is chosen, like any other setting.
 *
 * `play` counts the reasons to show it again. With no engine (a browser tab)
 * the writes fall away and the picker still works on the canvas.
 */
function useTextTransition() {
  const [id, setId] = useState<TextTransition>('blur');
  const [ms, setMs] = useState<number>(TRANSITION_MS.default);
  const [play, setPlay] = useState(0);

  useEffect(() => {
    let gone = false;
    void window.api
      ?.getSettings?.()
      ?.then((s: Record<string, unknown> | undefined) => {
        if (gone || !s) return;
        const appearance = { ...s, ...readTriLocal<Record<string, unknown>>(TRI_DISPLAY_KEY, {}) };
        if (isTextTransition(appearance.textTransition)) setId(appearance.textTransition === 'zoom' ? 'zoom' : 'blur');
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
      if (isTextTransition(display.textTransition)) setId(display.textTransition === 'zoom' ? 'zoom' : 'blur');
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
  const media = useMediaLibrary();
  const hasVideo = media.find(item => item.id === theme.backgroundId)?.kind === 'video';
  const [query, setQuery] = useState('');
  const searchToolbar = useRef<HTMLDivElement>(null);
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = (keywords: string) => terms.every(term => keywords.includes(term));
  const clearSearch = () => { setQuery(''); searchToolbar.current?.querySelector('input')?.focus(); };
  const textGroups = [
    { id: 'font', keywords: 'text font typeface typography case uppercase lowercase capital spacing letters tracking', content:
      <DisplayFontPicker
        value={theme.font}
        textCase={resolveTextCase(theme.textCase, theme.font)}
        textSpacing={resolveTextSpacing(theme.textSpacing)}
        onChange={(font) => onChange({ ...theme, font, textCase: resolveTextCase(theme.textCase, theme.font) })}
        onTextCaseChange={(textCase) => onChange({ ...theme, font: theme.font === 'uppercase' ? 'default' : theme.font, textCase })}
        onTextSpacingChange={(textSpacing) => onChange({ ...theme, textSpacing })}
      /> },
    { id: 'size', keywords: 'text font size shadow strength readability', content:
      <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4">
        <Slider guideId="themes-text-size" label="text size" value={theme.size} onChange={(size) => onChange({ ...theme, size })} min={-2} max={8} />
        <Slider guideId="themes-shadow" label="shadow strength" value={theme.shadow} onChange={(shadow) => onChange({ ...theme, shadow })} />
      </div> },
    { id: 'reference', keywords: 'reference scripture verse size gap spacing', content:
      <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4">
        <Slider guideId="themes-reference-size" label="reference size" value={theme.verseSize} onChange={(verseSize) => onChange({ ...theme, verseSize })} min={-2} max={8} />
        <Slider guideId="themes-ref-gap" label="gap from the verse" value={theme.refGap} onChange={(refGap) => onChange({ ...theme, refGap })} min={REF_GAP.min} max={REF_GAP.max} step={REF_GAP.step} />
      </div> },
    { id: 'transition', keywords: 'text transition animation motion fade cut speed duration milliseconds ms', content: <>
      <TextTransitionPicker value={tx.id} duration={tx.ms} play={tx.play} onChange={tx.choose} />
      <Slider guideId="themes-transition-speed" label="speed · ms" value={tx.ms} onChange={tx.pace} min={TRANSITION_MS.min} max={TRANSITION_MS.max} step={50} disabled={tx.id === 'cut'} />
    </> },
  ].filter(group => matches(group.keywords));
  const backgroundGroups = [
    { id: 'background', keywords: 'background dimness dim brightness dark blur image picture photo gif video media', content: <>
      <Slider guideId="themes-dimness" label="dimness" value={theme.dimness} onChange={(dimness) => onChange({ ...theme, dimness })} />
      <Slider guideId="themes-blur" label="blur" value={theme.blur} onChange={(blur) => onChange({ ...theme, blur })} min={0} max={12} />
      <p className="text-[length:var(--tri-size-xs)] lowercase text-[var(--tri-ink-muted)]">choose a background in media › themes, or drop a picture, GIF or video on the preview or the live screen</p>
    </> },
    ...(hasVideo ? [{ id: 'video', keywords: 'background video speed playback sound audio bass boost volume soundtrack', content: <>
      <Slider guideId="themes-video-speed" label="video speed" value={videoSpeed(theme.videoSpeed)} min={.25} max={2} step={.25} valueSuffix="×" onChange={(videoSpeed) => onChange({ ...theme, videoSpeed })}/>
      <Button guideId="themes-video-sound" label={theme.videoSound ? 'background audio on' : 'background audio off'} pressed={!!theme.videoSound} onClick={() => onChange({ ...theme, videoSound: !theme.videoSound })}/>
      <Slider guideId="themes-video-bass" label="bass boost" value={videoBass(theme.videoBass)} min={0} max={12} step={1} valueSuffix=" dB" disabled={!theme.videoSound} onChange={(videoBass) => onChange({ ...theme, videoBass })}/>
      <p className="text-xs text-[var(--tri-ink-muted)]">Audio plays on the main live screen. Clips without a soundtrack stay silent.</p>
    </> }] : []),
    { id: 'position', keywords: 'text layout position alignment screen top middle center bottom left right', content:
      <TextPositionPicker label="position on the screen" value={theme.layout} onChange={(layout) => onChange({ ...theme, layout })} columns={4} /> },
    { id: 'spacing', keywords: 'text layout width safe margin spacing edges screen', content: <>
      <div className="grid min-w-0 grid-cols-2 gap-x-4">
        <Slider guideId="themes-safe-margin" label="safe margin" value={theme.safeMargin} onChange={(safeMargin) => onChange({ ...theme, safeMargin })} min={SAFE_MARGIN.min} max={SAFE_MARGIN.max} step={SAFE_MARGIN.step} valueSuffix="%" ticks={5} />
        <Slider guideId="themes-text-width" label="width" value={theme.textWidth} onChange={(textWidth) => onChange({ ...theme, textWidth })} min={TEXT_WIDTH.min} max={TEXT_WIDTH.max} step={TEXT_WIDTH.step} valueSuffix="%" ticks={5} />
      </div>
      <p className="text-[length:var(--tri-size-xs)] text-[var(--tri-ink-muted)]">width can extend beyond the safe guide; 100% fills the screen</p>
    </> },
    { id: 'reset', keywords: 'reset theme default restore', content:
      <div className="flex justify-end"><Button guideId="themes-reset" label="reset theme" tone="danger" icon={<ResetIcon size={15} />} title="reset theme" onClick={onReset} /></div> },
  ].filter(group => matches(group.keywords));

  return (
    <div data-guide-area="themes" className="tri-themes-editor flex h-full min-h-0 min-w-0 flex-col">
      <div ref={searchToolbar} className="tri-themes-search" onKeyDown={event => { if (event.key === 'Escape' && query) { event.stopPropagation(); clearSearch(); } }}>
        <SearchField guideId="themes-search" operatorSearch value={query} onChange={setQuery} ariaLabel="Search theme controls" placeholder="Start typing to search" />
        {!!query && <Button guideId="themes-search-clear" label="clear" icon={<CloseIcon size={13} />} tone="ash" onClick={clearSearch} />}
      </div>
      {textGroups.length || backgroundGroups.length ? <div className="tri-theme-control-columns grid min-h-0 min-w-0 flex-1 grid-cols-2" data-single={!textGroups.length || !backgroundGroups.length || undefined}>
        {!!textGroups.length && <ThemeControls key={`text:${query}`} label="text">
          {textGroups.map(group => <div key={group.id} className="tri-theme-control-group">{group.content}</div>)}
        </ThemeControls>}
        {!!backgroundGroups.length && <ThemeControls key={`background:${query}`} label="background & layout">
          {backgroundGroups.map(group => <div key={group.id} className="tri-theme-control-group">{group.content}</div>)}
        </ThemeControls>}
      </div> : <div className="tri-themes-no-results" role="status"><p>No matching theme controls</p><span>Try font, text size, blur, transition, or layout.</span><Button guideId="themes-search-reset" label="clear search" tone="ash" onClick={clearSearch} /></div>}
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
    <section aria-label={label} className="tri-theme-controls flex min-h-0 min-w-0 flex-col overflow-hidden">
      <FadeScroller thumbRight={3} className="min-h-0 flex-1" contentClassName="flex flex-col gap-4 px-4 pb-4 [&>*]:min-w-0 [&>*]:shrink-0">
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
 * Both shelves can browse pictures and videos, locally or online.
 */
type MediaView = 'themes' | 'media';

/** Puts a still behind the words — in the preview, or on the wall now — and
    says what happened (LiveBody's chooseBackground). */
type ChooseBackground = (id: string, where: 'preview' | 'live', how?: 'click' | 'drop' | 'pick') => Promise<string>;

function MediaBrowser({ selected, live, onChoose, onBackgroundGone, onOpenSettings }: {
  /** The preview's background — the ring, in themes only: in media a click
      stages content, and a ring there would read as that. */
  selected: string;
  /** The wall's background — the gold "live" tag, on whichever shelf the
      card sits: a media photo dropped on LIVE is the wall's background too. */
  live: string;
  onChoose: ChooseBackground;
  /** The preview's background was deleted: LiveBody picks another, without
      leaving this tab (its onSelect used to throw the operator back to
      verses), and says which. */
  onBackgroundGone?: () => string | undefined;
  onOpenSettings: () => void;
}) {
  const [view, setView] = useState<MediaView>('media');
  const [kind, setKind] = useState<'photo' | 'video'>('photo');
  const [online, setOnline] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const library = useMediaLibrary();
  const projector = useProjector();
  const drag = useDrag();
  const [notice, setNotice] = useState('');
  const shown = library.filter(m => (m.collection ?? 'themes') === view && (m.kind ?? 'photo') === kind && (online || !m.url || m.source === 'local') &&
    (online || `${m.label} ${m.detail}`.toLowerCase().includes(query.trim().toLowerCase())));
  const store = (media: ThemeMedia) => {
    /* Store on the requested shelf; the themes shelf also plays video backgrounds. */
    const shelf = shelfFor({ kind: media.kind ?? 'photo' }, view);
    addMedia({ ...media, collection: shelf });
    /* Picked or added while looking at backgrounds, a still is wanted as one:
       it goes into the preview as well as onto the shelf. */
    if (view === 'themes' && canBeBackground(media)) {
      void onChoose(media.id, 'preview', 'click').then((said) => setNotice(`added to themes · ${said}`));
      return;
    }
    const item = mediaPreview(media);
    if (item) projector.stage(item);
    setNotice(`added to ${shelf} · in preview`);
  };
  /*
   * A card's press. On the drag-bound wrapper, not on the card's button: the
   * drag binding captures the pointer on the wrapper at pointerdown, and a
   * captured pointer's click is delivered to the capture target — so a click
   * handler on the button inside never ran for any card with a file (every
   * photo or clip from the laptop or online), in either view. Enter and Space
   * on the focused button still click it, and that click bubbles here.
   *
   *   themes  click previews it as the background; double-click puts it on
   *           the wall now, the way a verse row previews on one press and
   *           sends on two
   *   media   click stages it as content, a picture instead of words
   */
  const press = (media: ThemeMedia) => {
    if (view === 'themes' && canBeBackground(media)) {
      void onChoose(media.id, 'preview', 'click').then(setNotice);
      return;
    }
    const item = mediaPreview(media);
    if (item) projector.stage(item);
  };
  const pressTwice = (media: ThemeMedia) => {
    if (view === 'themes' && canBeBackground(media)) void onChoose(media.id, 'live').then(setNotice);
  };
  /* What a carried card can be dropped on, said while it is carried. */
  const carried = drag.active?.mediaId ? drag.active : null;
  /*
   * Pictures and clips from this laptop — the picker, or files dropped from
   * Finder on this pane. They land on the shelf being looked at (a clip
   * always in media), and the status line says how far along it is and
   * then how it went: never silent, because an add that did nothing reads
   * exactly like a broken one.
   *
   * In themes, one picture is wanted as a background, so it goes into the
   * preview too — the same as picking one online there.
   */
  const [adding, setAdding] = useState(false);
  const canAdd = !!(window.api?.pickMediaPaths || window.api?.pickMediaFile);
  const addHere = async (paths?: string[]) => {
    const wanted = view;
    setAdding(true);
    try {
      const { cards, notice: said, canceled } = await addFromLaptop({ paths, wanted, onProgress: setNotice });
      if (canceled) {
        setNotice('');
        return;
      }
      const one = cards.length === 1 ? cards[0] : undefined;
      if (one) setKind(one.kind ?? 'photo');
      if (wanted === 'themes' && one && canBeBackground(one)) {
        setNotice(`${said} · ${await onChoose(one.id, 'preview', 'click')}`);
        return;
      }
      if (wanted === 'media' && one) {
        const item = mediaPreview(one);
        if (item) projector.stage(item);
      }
      setNotice(said);
    } finally {
      setAdding(false);
    }
  };
  const finder = useFinderDrag();
  const finderHere = finder.active && finder.over === 'media-pane';
  const dropHere = finderDropProps('media-pane', (paths, count) => {
    if (paths.length) void addHere(paths);
    else setNotice(count ? 'drag the files themselves from Finder' : 'nothing to add there');
  });
  /*
   * Off the shelf, and out of the last saved service so it does not come
   * back on the next launch. The file stays where it is: a run row or a
   * saved service may still point at it.
   *
   * Not the wall's own background — the wall would go on showing a picture
   * the shelf no longer has, and the LIVE box could not draw it. The
   * preview's is fine: LiveBody moves the preview to another background.
   */
  const remove = (media: ThemeMedia) => {
    if (media.id === live) {
      setNotice(`${media.label} is on the wall — put another background up before deleting it`);
      return;
    }
    const gone = removeMedia(media.id);
    if (!gone) return;
    void forgetTriMedia(gone.id);
    window.dispatchEvent(new Event('trilorah-library-changed'));
    const next = gone.id === selected ? onBackgroundGone?.() : undefined;
    setNotice(next ? `deleted ${gone.label} · the preview is on ${next} now` : `deleted ${gone.label}`);
  };
  const pill = 'flex h-[var(--tri-field-h)] min-w-0 items-center gap-1 tri-rounded-control border border-white/10 bg-white/[0.035] p-1';
  const button = 'flex h-[calc(var(--tri-field-h)-10px)] shrink-0 items-center justify-center rounded-md px-3 text-xs transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2';
  return (
    <div ref={root} data-guide-area="media" className="media-browser relative -mx-3 flex h-full min-h-0 flex-col gap-3 px-[var(--tri-card-gap)]" {...dropHere}>
      {/* A container, so the add action can drop its words before the row —
          which does not wrap — runs out of room. */}
      <div role="toolbar" aria-label="media library" className="library-toolbar @container/mediabar flex shrink-0 items-center gap-2">
        <div className="library-toolbar-search"><SearchField guideId="media-search" operatorSearch ariaLabel={`Search ${view}`} placeholder="Start typing to search" value={query} onChange={setQuery} /></div>
        <div className={pill} role="group" aria-label="Search source">
          <button type="button" data-guide="media-online" className={`${button} ${online ? 'bg-white/10' : ''}`} aria-label="search online" title="search online" aria-pressed={online} onClick={() => { setOnline(true); }}><GlobeIcon selected={online} size={15} /></button>
          {/* A filter, not an add: it shows what is already on this laptop's
              shelf. It used to sit beside the add button and read as one. */}
          <button type="button" data-guide="media-local" className={`${button} ${!online ? 'bg-white/10' : ''}`} aria-label="show what is on this laptop" title="show what is on this laptop" aria-pressed={!online} onClick={() => { setOnline(false); }}><LaptopIcon selected={!online} size={15} /></button>
        </div>
        {/* Its own control in the library toolbars' material — the slides
            tab's "import slides" is the same act — rather than a + tucked
            inside the search field, where it read as part of the search. */}
        <LibraryAction
          guideId="media-import"
          textClassName="hidden @min-[30rem]/mediabar:inline"
          action={{
            id: 'add',
            label: canAdd ? 'add pictures and clips from this laptop — or drop them here from Finder' : 'adding from the laptop needs the desktop app',
            text: 'add from laptop',
            icon: <ImportIcon size={13} />,
            disabled: !canAdd || adding,
            onClick: () => void addHere(),
          }}
        />
        <div className={`${pill} ml-auto`} role="group" aria-label="library collection">
          {/* Only the carried media is used as a background; parked run items stay put. */}
          {(['themes','media'] as const).map(value => <button key={value} type="button" data-guide={`media-view-${value}`} {...(value === 'themes' && carried ? drag.dropProps('media-themes', { solo: true }) : {})}
            className={`${button} ${view === value || (value === 'themes' && drag.over === 'media-themes') ? 'bg-white/15 text-[var(--tri-ink)]' : 'text-[var(--tri-ink-muted)]'}`}
            aria-pressed={view === value} onClick={() => { setView(value); setQuery(''); setNotice(''); }}>{value}</button>)}
        </div>
      </div>
      <MediaKindPicker value={kind} onChange={setKind} />
      {online ? (
        <div className="min-h-0 flex-1">
          <StockSearch searchQuery={query} searchMode={view} mediaKind={kind} onPick={store} onOpenSettings={onOpenSettings} />
        </div>
      ) : <>
      <div role="status" className="media-browser__notice shrink-0 text-xs text-[var(--tri-ink-muted)]">{carried
        ? 'drop on themes, the preview or the live screen to use it as a background'
        : finder.active ? finderPaneHint(view, finder.kinds, finderHere)
        : notice || (view === 'themes' ? 'click to preview a background · double-click to put it on the wall now' : 'select to preview · drag to themes or into the service')}</div>
      {shown.length ? <MediaGrid key={`${view}-${kind}-${query}`}>{shown.map(media => <div key={media.id} className="group/media relative min-w-0" {...(media.url ? drag.bind(() => ({ source: 'media', mediaId: media.id, label: media.label, preview: mediaSrc(media), path: media.url, mediaKind: media.kind ?? 'photo' })) : {})}
        onClick={() => press(media)} onDoubleClick={() => pressTwice(media)}>
        <MediaCard src={mediaSrc(media)} label={media.label} detail={media.detail} selected={view === 'themes' && selected === media.id} badge={media.kind === 'video' ? 'video' : null}
          live={live === media.id} />
        {/* The card's acts, on the picture, the way a song card carries
            its own. Only something the church added can be deleted; the
            stock washes have no file and come back on the next launch. */}
        {media.url || (view === 'themes' && canBeBackground(media)) ? <div className="absolute right-2 top-2 flex items-center gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/media:opacity-100"
          onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          {/* The double-click's twin, for a keyboard or a hand that does
              not know to double-click: the wall's background, now. */}
          {view === 'themes' && canBeBackground(media) ? <button type="button" data-guide="media-wall" title="on the wall now — the background only, the words stay" aria-label={`put ${media.label} on the wall now`}
            className={cx(surface({ tone: 'gold', shape: 'control', interactive: true }), toneClass('gold'), 'grid size-7 place-items-center')}
            onClick={(e) => { e.stopPropagation(); void onChoose(media.id, 'live').then(setNotice); }}><MediaIcon size={12} /></button> : null}
          {view === 'media' && canBeBackground(media) ? <button type="button" data-guide="media-to-themes" title="use as a background for text" aria-label={`use ${media.label} as a background`}
            className={cx(surface({ shape: 'control', interactive: true }), toneClass(), 'grid size-7 place-items-center')}
            onClick={(e) => { e.stopPropagation(); addMedia({ ...media, collection: 'themes' }); void onChoose(media.id, 'preview', 'pick').then((said) => setNotice(`added to themes · ${said}`)); }}><PaletteIcon size={12} /></button> : null}
          {media.url ? <button type="button" data-guide="media-delete" title={`delete ${media.label}`} aria-label={`delete ${media.label}`}
            className={cx(surface({ tone: 'danger', shape: 'control', interactive: true }), toneClass('danger'), 'grid size-7 place-items-center')}
            onClick={(e) => { e.stopPropagation(); remove(media); }}><TrashIcon size={12} /></button> : null}
        </div> : null}
      </div>)}</MediaGrid> : <div className="min-h-0 flex-1"><EmptyMark w={220} h={220} plain art={<GlobeEmptyArt />}
        line={query && !online ? 'nothing matches' : `no ${kind === 'video' ? 'videos' : 'pictures'} in ${view} yet`}
        hint={query && !online ? 'try another name' : 'add pictures and clips, or drop them here from Finder'}
        below={<div className="mt-4 flex flex-wrap justify-center gap-2"><Button guideId="media-add-empty" label="add from laptop" icon={<ImportIcon size={13} />} disabled={!canAdd || adding} onClick={() => void addHere()} /><Button guideId="media-explore" label="explore online" onClick={() => { setOnline(true); }} /></div>} /></div>}
      </>}
      {/* Files from Finder over this pane: where they will land. Over
          everything, taking no pointer, so the drop still reaches the pane;
          a dashed edge, not a glow — the ground stays plain. */}
      {finderHere ? (
        <div aria-hidden className="tri-rounded-control pointer-events-none absolute inset-0 z-50 grid place-items-center border border-dashed border-[rgb(229_243_242_/_0.55)] bg-[rgb(0_0_0_/_0.45)]">
          <span className="tri-label rounded-md px-3 py-1.5 lowercase text-[var(--tri-ink)]" style={{ backgroundColor: 'rgb(0 0 0 / 0.78)' }}>
            {finderPaneHint(view, finder.kinds)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Five-card pages preserve each picture's original proportions. */
function MediaGrid({ children }: { children: ReactNode }) {
  const cards = Children.toArray(children);
  const pages = Array.from({ length: Math.ceil(cards.length / 5) }, (_, i) => cards.slice(i * 5, i * 5 + 5));
  const rail = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const move = (index: number) => rail.current?.scrollTo({ left: index * rail.current.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  return <div className="media-carousel flex min-h-0 flex-1 flex-col gap-2">
    <div className="media-carousel__rail min-h-0 flex-1" ref={rail} onScroll={event => setAt(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))} role="region" aria-label="Media carousel" tabIndex={0}>
      {pages.map((page, i) => <div key={i} className="media-carousel__page" role="group" aria-label={`Media page ${i + 1} of ${pages.length}`}><div className="media-carousel__bento">{page}</div></div>)}
    </div>
    {pages.length > 1 && <div className="flex shrink-0 items-center justify-end gap-2">
      <Button guideId="media-previous" label="previous" disabled={at === 0} onClick={() => move(at - 1)}/>
      <span className="text-xs text-white/50">{at + 1} / {pages.length}</span>
      <Button guideId="media-next" label="next" disabled={at >= pages.length - 1} onClick={() => move(at + 1)}/>
    </div>}
  </div>;
}

function MediaCard({
  src,
  label,
  detail,
  selected,
  badge,
  live = false,
}: {
  src: string;
  label: string;
  detail: string;
  selected: boolean;
  badge: string | null;
  /** Behind the words on the wall right now. */
  live?: boolean;
}) {
  /* No onClick here: the press belongs to the wrapper the drag binding sits
     on (see MediaBrowser's `press`). The button is kept for focus — Enter
     and Space click it, and that click bubbles up to the wrapper. */
  return (
    <button
      type="button"
      data-guide="media-card"
      aria-pressed={selected}
      aria-label={`${label} — ${detail}`}
      className="media-picture-card group/card relative block w-full overflow-hidden text-left tri-rounded-control"
    >
      <span className="tri-rounded-control relative block overflow-hidden">
        {/* Not natively draggable: the browser's own image drag starts on the
            first move, cancels the pointer the drag layer is following, and
            the card never leaves the shelf — nor do the parked chips survive
            the cancel. */}
        <img src={src} alt="" draggable={false} className="block h-auto w-full" />
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
        {/* The wall's own background, tagged the way everything on the
            projector is: gold. Top left, clear of the badge and of the
            card's acts at top right; the ring stays the preview's. */}
        {live ? (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
              style={{ background: 'linear-gradient(to bottom, rgb(0 0 0 / 0.62), transparent)' }}
            />
            <span className="absolute left-2 top-2 flex items-center gap-[5px] text-[length:var(--tri-size-xs)] leading-none lowercase text-[var(--tri-accent-yellow)]">
              <span aria-hidden className="h-[5px] w-[5px] rounded-full bg-[var(--tri-accent-yellow)]" />
              live
            </span>
          </>
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
      <span className="media-picture-caption">
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
 * The list follows the wall.
 *
 * When a verse goes live — a caught one the operator pressed, a card from
 * "find scripture", the phone — the table goes to that chapter and lights
 * the verse, so the operator is looking at where the preacher is and the
 * arrows carry on from there. Going to another chapter is shown as travel
 * (ScriptureTravel): up the page when the verse is further on, down when it
 * is further back. It moves the LIST only. The preview box keeps whatever
 * the operator had staged, and while they are typing a reference the list
 * is theirs and stays put.
 */
interface Journey {
  id: number;
  dir: 1 | -1;
  to: LiveSpan;
  /** Rows above the live verse when the list lands. */
  lead: number;
  departure: ReelRow[];
  passing: ReelRow[];
  rowHeight: number;
  height: number;
  visible: number;
  ms: number;
  /** The reel has stopped; only waiting for the chapter, if it is not here yet. */
  done: boolean;
}

interface Landing extends LiveSpan {
  lead: number;
  /** After the reel: the words fade up through its bars. */
  fromReel: boolean;
}

let journeys = 0;
const spanKey = (bookIndex: number, chapter: number, verse: number | null | undefined) => `${bookIndex}:${chapter}:${verse ?? ''}`;
/* Two verses of context above the live one, where there are two. */
const leadFor = (span: LiveSpan) => Math.min(2, span.first - 1);

/** The rows on screen as the list leaves, measured as they are drawn. */
function measureDeparture(list: HTMLElement, scroller: HTMLElement, rows: VerseRow[], isLive: (i: number) => boolean) {
  const drawn = [...list.querySelectorAll<HTMLElement>('[data-row]')];
  if (!drawn.length) return null;
  const top = scroller.getBoundingClientRect().top;
  const firstIndex = Math.max(0, drawn.findIndex((el) => el.getBoundingClientRect().bottom > top + 1));
  /* A one-line verse: the reel's rows are all one line. */
  const rowHeight = Math.max(28, Math.round(Math.min(...drawn.slice(0, 16).map((el) => el.getBoundingClientRect().height))));
  const height = scroller.clientHeight;
  const visible = Math.ceil(height / rowHeight) + 1;
  const shown = rows.slice(firstIndex, firstIndex + visible);
  if (!shown.length || height <= 0) return null;
  const reel: ReelRow[] = Array.from({ length: visible }, (_, k) =>
    shown[k] ? { ref: shown[k].ref, length: shown[k].text.length, live: isLive(firstIndex + k) } : { ref: '', length: 0 });
  return { rows: reel, rowHeight, height, visible };
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
/* The reference column's width — set on the browser as --scripture-ref-w
   once measured; until then, the cap. See src/lib/referenceColumn.ts. */
const REFERENCE_COLUMN = `var(--scripture-ref-w, calc(var(--tri-size) * ${REFERENCE_CAP_EMS}))`;

/**
 * Measures the chapter's references in the list's own font and returns the
 * column width for them. Re-measured when the chapter changes, when the
 * window crosses a size tier (the text size moves with it), and once the
 * web font has loaded (the first measure may be in the fallback face).
 */
function useReferenceColumn(
  refs: readonly string[],
  listRef: React.RefObject<HTMLElement | null>,
  headerRef: React.RefObject<HTMLElement | null>,
): { column: number; book: number | null } | null {
  const [width, setWidth] = useState<{ column: number; book: number | null } | null>(null);
  const key = refs.join('|');
  useLayoutEffect(() => {
    let alive = true;
    const measure = () => {
      const list = listRef.current;
      if (!alive || !list) return;
      const style = getComputedStyle(list);
      const size = parseFloat(style.getPropertyValue('--tri-size')) || parseFloat(style.fontSize) || 12;
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return;
      ctx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
      /* +2: the canvas and the page round a hair differently, and a column
         a pixel short would put an ellipsis on a name that fits. */
      const widths = refs.map((r) => ctx.measureText(r).width + 2);
      const places = refs.map((r) => {
        const { place } = splitReference(r);
        return place ? ctx.measureText(` ${place}`).width + 2 : 0;
      });
      const floor = headerRef.current?.getBoundingClientRect().width ?? 0;
      const column = referenceColumnWidth(widths, floor, size * REFERENCE_CAP_EMS);
      setWidth({ column, book: bookAllowance(column, widths, places) });
    };
    measure();
    void document.fonts?.ready.then(measure);
    window.addEventListener('resize', measure);
    return () => { alive = false; window.removeEventListener('resize', measure); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return width;
}

/** A reference as two pieces: the book, which may be cut short, and the numbers, which may not. */
function ReferenceParts({ reference }: { reference: string }) {
  const { book, place } = splitReference(reference);
  return (
    <>
      <span className="min-w-0 truncate" style={{ maxWidth: 'var(--scripture-book-w, none)' }}>{book}</span>
      {place ? <span className="shrink-0 whitespace-pre">{` ${place}`}</span> : null}
    </>
  );
}

function ScripturesBrowser({ searchRef }: { searchRef: React.RefObject<ScriptureReferenceInputHandle | null> }) {
  const engine = useEngine();
  const drag = useDrag();
  const projector = useProjector();
  const [versions, setVersions] = useState<SelectOption[]>(() => versionOptions(['KJV']));
  /*
   * This service's Bible, not a picker of the library's own. It lives in the
   * live store (App feeds it from on-version-changed), so it survives the
   * tab switch that unmounts this browser, follows the preacher's "read it
   * in the BSB", and the catches read from it too. Choosing one here tells
   * the engine; the church's saved default is never touched.
   */
  const sessionVersion = useLiveStore((s) => s.displayVersion);
  const version = sessionVersion ?? 'KJV';
  const setVersion = useCallback((next: string | null) => {
    // The list answers both pointerdown and click; one choice is one change.
    if (next && next === useLiveStore.getState().displayVersion) return;
    if (next) useLiveStore.getState().setDisplayVersion(next);
    const api = window.api;
    if (!api?.setSessionVersion) {
      if (!next) useLiveStore.getState().setDisplayVersion('KJV');
      return;
    }
    void api.setSessionVersion(next).then((using) => {
      if (typeof using === 'string' && using) useLiveStore.getState().setDisplayVersion(using);
    }).catch(() => undefined);
  }, []);
  /* Opened while a verse is live: open on it, not on Genesis. */
  const [startAt] = useState(() => liveSpan(projector.live));
  const libraryRequest = useLibraryNavigation(s => s.request);
  const [query, setQuery] = useState(() => libraryRequest?.item.source === 'scripture' ? libraryRequest.item.label : startAt ? spanReference(startAt) : '');
  useEffect(() => {
    if (libraryRequest?.item.source !== 'scripture') return;
    const reference = libraryRequest.item.label;
    setQuery(reference);
    projector.stage({source:'scripture',id:reference,label:reference,reference,origin:'operator'});
    useLibraryNavigation.getState().consume();
  }, [libraryRequest]);
  const [ref, setRef] = useState<ResolvedReference | null>(null);
  const [rows, setRows] = useState<VerseRow[]>([]);
  /* Which chapter `rows` holds. Naming another leaves the old rows up for a
     render or two while the new ones load. */
  const [loadedFor, setLoadedFor] = useState<{ bookIndex: number; chapter: number } | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'no-api' | 'empty' | 'error'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  /* Whatever translations the database actually holds — not a guessed list
     — each with its name beside the code, because "AA APEE BBE" means
     nothing to a volunteer. Opens on the version the service is using.
     NKJV and NIV come from YouVersion: listed greyed, with the reason,
     until the build's key unlocks them, and the list follows when it does. */
  const [rowsByCode, setRowsByCode] = useState<Record<string, BibleVersionRow>>({});
  useEffect(() => {
    const api = window.api;
    const take = (list: { versions?: BibleVersionRow[] } | null | undefined) => {
      if (!list?.versions?.length) return;
      setVersions(versionRowOptions(list.versions));
      setRowsByCode(Object.fromEntries(list.versions.map((r) => [r.code, r])));
    };
    if (api?.getBibleVersions) void api.getBibleVersions().then(take).catch(() => undefined);
    else api?.getAvailableVersions().then((v) => {
      if (v?.length) setVersions(versionOptions(v));
    }).catch(() => { /* KJV remains available if the version list fails. */ });
    const off = api?.onEngineEvent?.('on-bible-versions-changed', (list) => take(list as { versions?: BibleVersionRow[] }));
    if (useLiveStore.getState().displayVersion == null) {
      void window.api?.getSessionVersion?.().then((using) => {
        if (typeof using === 'string' && using && useLiveStore.getState().displayVersion == null) {
          useLiveStore.getState().setDisplayVersion(using);
        }
      }).catch(() => undefined);
    }
    return () => off?.();
  }, []);
  /* An online Bible's copyright line goes wherever its words are read. */
  const versionRow = rowsByCode[version];
  const onlineVersion = versionRow?.source === 'online';
  /* "Read it in the default Bible" when an online one cannot load — unless
     the church's default IS that Bible (Settings offers NIV as a default),
     where going back to it only fails again: then a Bible on this computer. */
  const bundledStandIn = rowsByCode.KJV?.source === 'bundled' ? 'KJV'
    : Object.values(rowsByCode).find((r) => r.source === 'bundled' && r.available)?.code ?? 'KJV';
  const [savedDefault, setSavedDefault] = useState<string | null>(null);
  const failedOnline = onlineVersion && status === 'error';
  useEffect(() => {
    if (!failedOnline) return;
    let current = true;
    void window.api?.getSetting?.('displayVersion').then((saved) => {
      if (current) setSavedDefault(typeof saved === 'string' && saved ? saved.toUpperCase() : null);
    }).catch(() => undefined);
    return () => { current = false; };
  }, [failedOnline]);
  const readInDefault = useCallback(async () => {
    const saved = await window.api?.getSetting?.('displayVersion').catch(() => null);
    setVersion(typeof saved === 'string' && saved.toUpperCase() === version ? bundledStandIn : null);
  }, [version, bundledStandIn, setVersion]);

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
    setLoadedFor(null);
    setLoadError(null);
    if (!target) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    const at = { bookIndex: target.bookIndex, chapter: target.chapter };
    const load = () => loadScriptureChapter(window.api, target.bookIndex, target.chapter, version).then((res) => {
      if (cancelled) return;
      setRows(res.data.map((v) => ({ verse: v.id, ref: v.ref, text: v.text })));
      setLoadedFor(at);
      setLoadError(res.error);
      setStatus(res.status);
    });
    /* An online chapter costs one of the hour's YouVersion requests, so the
       "John 1" passed on the way to typing "John 14" is not fetched. */
    const wait = onlineVersion ? setTimeout(load, 300) : (void load(), undefined);
    return () => {
      cancelled = true;
      clearTimeout(wait);
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
        verses: [{ verse: r.verse, text }],
        slides: buildVerseSlides(
          { book: target?.book ?? '', chapter: target?.chapter ?? 0, version },
          [{ verse: r.verse, text }],
          SLIDE_RULES,
        ),
      };
    },
  });
  const refHeader = useRef<HTMLSpanElement>(null);
  const refColumn = useReferenceColumn(rows.map((r) => r.ref), sel.listRef, refHeader);

  /* A browser preview has no Bible database. Never attach another verse's
     words to the requested reference just to fill the design specimen. */
  const FALLBACK_VERSE = (_v: number) =>
    'Bible text is unavailable in this browser preview. Open the desktop app to load this passage.';

  /** The bound the input refuses against — straight off the loaded chapter. */
  const versesInChapter = (bookIndex: number, chapter: number) =>
    target && target.bookIndex === bookIndex && target.chapter === chapter && rows.length
      ? rows[rows.length - 1].verse
      : undefined;

  /* ---- following the wall (see Journey) --------------------------- */
  const followed = useRef<string | null>(startAt ? spanKey(startAt.bookIndex, startAt.chapter, startAt.first) : null);
  const landing = useRef<Landing | null>(startAt ? { ...startAt, lead: leadFor(startAt), fromReel: false } : null);
  const followedAt = useRef(0);
  const pointAt = useRef<number | null>(null);
  const seenDelivery = useRef(projector.delivery);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [arrived, setArrived] = useState<'landing' | 'arriving' | null>(null);
  const live = liveSpan(projector.live);
  const showing = (at: { bookIndex: number; chapter: number } | null | undefined) =>
    !!at && !!loadedFor && loadedFor.bookIndex === at.bookIndex && loadedFor.chapter === at.chapter;
  /* A live range lights every verse in it, not only the one whose
     reference happens to be the live item's id. */
  const isLiveRow = (i: number) =>
    sel.isLive(i) || (!!live && showing(live) && !!rows[i] && rows[i].verse >= live.first && rows[i].verse <= live.last);

  const follow = (span: LiveSpan) => {
    const key = spanKey(span.bookIndex, span.chapter, span.first);
    /* The same verse delivered twice in a moment — the press, then the
       engine's echo of it — is one arrival. Sent again later, it is a new
       one, and the list comes back to it. */
    if (followed.current === key && Date.now() - followedAt.current < 3000) return;
    followed.current = key;
    followedAt.current = Date.now();
    const reference = spanReference(span);
    const lead = leadFor(span);
    const list = sel.listRef.current;
    const scroller = list?.parentElement ?? null;
    if (showing(span) && !journey) {
      /* The chapter is already up: bring the verse into view. */
      landing.current = null;
      setQuery(reference);
      const first = rows.findIndex((r) => r.verse === span.first);
      const last = rows.findIndex((r) => r.verse === span.last);
      const row = list?.querySelector<HTMLElement>(`[data-row="${first}"]`);
      if (row && scroller) {
        const r = row.getBoundingClientRect();
        const box = scroller.getBoundingClientRect();
        if (r.top < box.top || r.bottom > box.bottom) row.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
      if (first >= 0) sel.point(last >= 0 ? last : first);
      setArrived('arriving');
      return;
    }
    const here = target && showing(target) ? target : null;
    const departure = here && list && scroller && !reducedMotion() ? measureDeparture(list, scroller, rows, isLiveRow) : null;
    landing.current = { ...span, lead, fromReel: !!departure };
    if (here && departure) {
      const fromOrdinal = chapterOrdinal(here.bookIndex, here.chapter);
      const toOrdinal = chapterOrdinal(span.bookIndex, span.chapter);
      const dir = toOrdinal >= fromOrdinal ? 1 : -1;
      const shape = travelShape(fromOrdinal, toOrdinal);
      setJourney({
        id: ++journeys, dir, to: span, lead,
        departure: departure.rows, passing: passingRows(here, span, shape.passing),
        rowHeight: departure.rowHeight, height: departure.height, visible: departure.visible,
        ms: Math.min(160, shape.ms), done: false,
      });
    } else {
      setJourney(null);
    }
    setQuery(reference);
  };

  /* What the reel lands on: the chapter's real rows once they are here,
     numbered placeholders until then. */
  const arrivalRows = (j: Journey): ReelRow[] => {
    const real = showing(j.to) ? rows : null;
    const start = Math.max(1, j.to.first - j.lead);
    return Array.from({ length: j.visible }, (_, k) => {
      const verse = start + k;
      const lit = verse >= j.to.first && verse <= j.to.last;
      if (!real) return { ref: `${j.to.book} ${j.to.chapter}:${verse}`, length: 90, live: lit };
      const row = real.find((r) => r.verse === verse);
      return row ? { ref: row.ref, length: row.text.length, live: lit } : { ref: '', length: 0 };
    });
  };

  /* A new delivery to the wall. Read once per delivery, not per render. */
  useEffect(() => {
    if (projector.delivery === seenDelivery.current) return;
    seenDelivery.current = projector.delivery;
    const span = liveSpan(projector.live);
    if (!span) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && active.closest('[data-scripture-browser]')) return;
    follow(span);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projector.delivery]);

  /* The reel has stopped. Hand over once the chapter is here — or has
     failed to come, so the list can say why. */
  useEffect(() => {
    if (!journey) return;
    if (showing(journey.to) || status === 'error' || status === 'empty' || status === 'no-api') setJourney(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey, loadedFor, status]);

  /* Land: the row two above the live verse at the top of the table, where
     the reel left it. Before paint, so the list never shows its top first. */
  useLayoutEffect(() => {
    const dest = landing.current;
    if (!dest || journey || !showing(dest)) return;
    landing.current = null;
    const first = rows.findIndex((r) => r.verse === dest.first);
    if (first < 0) return;
    const last = rows.findIndex((r) => r.verse === dest.last);
    const list = sel.listRef.current;
    const scroller = list?.parentElement;
    const top = list?.querySelector<HTMLElement>(`[data-row="${Math.max(0, first - dest.lead)}"]`);
    if (scroller && top) scroller.scrollTop += top.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    pointAt.current = last >= 0 ? last : first;
    setArrived(dest.fromReel ? 'landing' : 'arriving');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, loadedFor, journey]);

  /* After the selection's own reset for a new list, which would put the
     highlight back on verse 1. */
  useEffect(() => {
    if (pointAt.current === null) return;
    sel.point(pointAt.current);
    pointAt.current = null;
  });

  useEffect(() => {
    if (!arrived) return;
    const t = setTimeout(() => setArrived(null), 1200);
    return () => clearTimeout(t);
  }, [arrived]);

  /* Typing a verse selects its row rather than reloading anything. */
  useEffect(() => {
    if (!ref?.verse) return;
    /* Unless the list went there itself, following the wall: then the
       preview box is not the list's to change. */
    if (followed.current === spanKey(ref.bookIndex, ref.chapter, ref.verse)) return;
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
        slides: buildVerseSlides({ book: ref.book, chapter: ref.chapter, version }, verses, fitRules(verses)),
        origin: 'operator',
      });
    }
  }, [ref?.book, ref?.chapter, ref?.verse, ref?.rangeEnd, rows.length, version, projector]);

  return (
    /* A box-less wrapper: lets the list tell whether the field the operator
       is typing in is this one (see the follow above). */
    <div data-scripture-browser data-guide-area="scripture" className="contents"
      style={refColumn ? ({
        '--scripture-ref-w': `${refColumn.column}px`,
        '--scripture-book-w': refColumn.book === null ? 'none' : `${refColumn.book}px`,
      } as CSSProperties) : undefined}>
    <LibraryBrowser
      searchInset="var(--tri-card-gap)"
      search={
        /* Keep the rail inset, with extra room between the two searches. */
        <div className="flex w-full min-w-0 items-center gap-[calc(3*var(--tri-gap))]">
        <div className="flex min-w-0 flex-1 items-center gap-[var(--tri-gap)]">
          <div className="relative grid shrink-0" style={{ width: 'var(--library-pill-width, max-content)' }}>
            <LibraryControlSizer />
            <Select guideId="scripture-version" className="!absolute inset-0" options={versions} value={version} onChange={setVersion} preserveCase menuMinWidth={300} />
          </div>
          {/* An online Bible that could not load is not a broken library: the
              operator can still type another reference, or change Bible. */}
          <LibrarySearch disabled={(status === 'error' && !onlineVersion) || status === 'no-api' || status === 'empty'}>
          <ScriptureReferenceInput
            ref={searchRef}
            guideId="scripture-reference"
            className="scripture-reference-search min-w-0 flex-1"
            books={BOOK_DATA}
            versesInChapter={versesInChapter}
            value={query}
            onChange={(next) => {
              /* The operator has taken the list back. */
              followed.current = null;
              landing.current = null;
              setJourney(null);
              setQuery(next);
            }}
            onReferenceChange={setRef}
            onSubmit={async (r) => {
              /*
               * A typed range is a READING, not a verse: "5-9" stages all
               * five, on one slide that the screen shrinks to fit (see
               * fitRules). Before this, the field could not even parse the dash
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

              /* A typed range is one slide, like a spoken one (fitRules). */
              const slides = buildVerseSlides(
                { book: r.book, chapter: r.chapter, version },
                verses,
                fitRules(verses),
              );

              const item: LiveItem = {
                source: 'scripture',
                id: reference,
                label: reference,
                reference,
                version,
                text: verses.map((v) => v.text).join(' '),
                verses,
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
        </div>
        <div className="flex min-w-0 basis-[40%] shrink-0 items-center">
          <ScriptureSearch />
        </div>
        </div>
      }
    >
      {/* Keep most of the reading space for scripture; catches stay beside it. */}
      <LibraryPane
        grow={3 / 2}
        rule
        title={
          <>
            <span className="shrink-0" style={{ width: REFERENCE_COLUMN }}><span ref={refHeader} className="whitespace-nowrap">reference</span></span>
            <span className="min-w-0 flex-1">scripture text</span>
          </>
        }
      >
        <div ref={sel.listRef}
          className={cx(rows.length === 0 || journey ? 'h-full' : undefined, arrived === 'landing' && 'scripture-landing', arrived === 'arriving' && 'scripture-arriving')}
          aria-busy={status === 'loading' || !!journey}>
          {journey ? (
            <ScriptureTravel key={journey.id} dir={journey.dir} departure={journey.departure} passing={journey.passing}
              arrival={arrivalRows(journey)} rowHeight={journey.rowHeight} height={journey.height} ms={journey.ms}
              onDone={() => setJourney((j) => (j && j.id === journey.id ? { ...j, done: true } : j))} />
          ) : rows.length === 0 ? (
            <ScriptureLibraryEmpty status={status} error={loadError} version={version}
              onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
              onReset={() => { setQuery(''); setRef(null); setVersion(null); setLoadAttempt((attempt) => attempt + 1); }}
              onDefaultBible={onlineVersion ? () => void readInDefault() : undefined}
              defaultBible={savedDefault === version ? bundledStandIn : undefined} />
          ) : (
            rows.map((row, i) => (
              <button
                key={row.ref}
                data-row={i}
                data-guide="scripture-verse"
                data-live={isLiveRow(i) || undefined}
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
                  'group/verse relative flex w-full items-baseline gap-4 px-4 py-2 text-left transition-colors',
                  isLiveRow(i)
                    ? 'bg-[rgb(228_216_122_/_0.10)]'
                    : sel.preview === i
                      ? 'bg-[rgb(255_255_255_/_0.06)]'
                      : 'hover:bg-[rgb(255_255_255_/_0.03)]',
                )}
              >
                {/* As wide as the chapter's longest reference, to a cap; past
                    it the BOOK name takes the ellipsis and the numbers stay
                    ("Song of Sol… 8:14"). See useReferenceColumn. */}
                <span
                  title={row.ref}
                  style={{ width: REFERENCE_COLUMN }}
                  className={cx(
                    'scripture-reference-label flex min-w-0 shrink-0 text-[length:var(--tri-size)]',
                    /* The accent yellow, held back: references read as the
                       list's index, the live row's at full strength. */
                    isLiveRow(i)
                      ? 'text-[rgb(228_216_122_/_0.95)]'
                      : 'text-[rgb(228_216_122_/_0.55)]',
                  )}
                >
                  <ReferenceParts reference={row.ref} />
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
                {/* Floats over the row's right edge rather than holding a column of
                    its own: in the half-width list an invisible hint was
                    taking a third of the room the words had. */}
                {!isLiveRow(i) && <span className="verse-live-hint pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-white/15 bg-[rgb(26_26_26_/_0.96)] px-2 py-1 text-[10px] text-white/60 opacity-0 shadow-[0_0_12px_6px_rgb(17_17_17_/_0.9)] group-hover/verse:opacity-100 group-focus-visible/verse:opacity-100">double click · live</span>}
                {isLiveRow(i) && (
                  <span className="shrink-0 text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.14em] text-[rgb(228_216_122_/_0.9)]">
                    live
                  </span>
                )}
              </button>
            ))
          )}
          {/* The licence's own words under an online Bible's text (YouVersion:
              "always display a Bible Version's copyright attribution"). The
              wall carries the initials (shared/verseDisplay). */}
          {onlineVersion && rows.length > 0 && !journey && (
            <p className="px-4 py-3 text-[length:var(--tri-size-xs)] leading-relaxed text-white/40">
              {versionRow.attribution || `${versionRow.name} (${version})`} · via YouVersion
            </p>
          )}
        </div>
      </LibraryPane>
      {/* Everything the engine catches lands here, beside the Bible it came
          from — see CatchesPane. */}
      <LibraryPane header={false} scroll={false}>
        <ScriptureTools><CatchesPane /></ScriptureTools>
      </LibraryPane>
    </LibraryBrowser>
    </div>
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
  originalSections?: SongBase["sections"];
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
  /** Opened from an online search result, over the search; its id there. */
  discoveryId?: string;
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
  const openId = useLibraryNavigation(s => s.songId);
  const setOpenId = useLibraryNavigation(s => s.selectSong);
  const projector = useProjector();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  /* Search results saved while the search is up, so each card can say so.
     Forgotten when the search closes: next time is a different list. */
  const [addedFromSearch, setAddedFromSearch] = useState<ReadonlySet<string>>(() => new Set());
  const [songSource, setSongSource] = useState<SongSource>('search');
  const [query, setQuery] = useState('');
  const [deleted, setDeleted] = useState<ReadonlySet<string>>(() => new Set());
  const { drafts, save: saveDraft, clear: clearDraft } = useSongDrafts();

  const store = typeof window === 'undefined' ? undefined : window.api?.songs;
  const [loading,setLoading] = useState(!!store);
  const [loadProblem,setLoadProblem] = useState('');
  const [stored, setStored] = useState<Song[] | null>(store || isEmptyPreview ? [] : null);
  const refresh = useCallback(() => {
    if (!store) return;
    setLoading(true); setLoadProblem('');
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
            originalSections: song.originalSections ?? song.sections,
            verses: song.sections.map((sec, i) => ({ id: `${song.id}:${i}`, label: sec.label, lines: sec.lines })),
          })),
        ),
      )
      .catch(() => setLoadProblem('Your songs could not load. Try again.'))
      .finally(() => setLoading(false));
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
  const libraryRequest = useLibraryNavigation(s => s.request);
  useEffect(() => {
    const item=libraryRequest?.item;
    if (item?.source !== 'song') return;
    const found=songs.find(song=>song.id===item.songId) ?? songs.find(song=>song.title===(item.title ?? item.label.split(' — ')[0]));
    if (found) {
      setOpenId(found.id);
      const cards=songCards({id:found.id,sections:found.verses});
      const card=cards.find(card=>item.lines ? JSON.stringify(card.lines)===JSON.stringify(item.lines) : card.label===item.section) ?? cards[0];
      if(card) projector.stage({source:'song',id:card.id,label:`${found.title} — ${card.label}`,title:found.title,section:card.label,lines:card.lines,origin:'operator'});
      useLibraryNavigation.getState().consume();
    }
  }, [libraryRequest, songs]);
  useEffect(() => {
    if (openId || projector.live?.source !== 'song') return;
    const song = songs.find(s => projector.live?.id.startsWith(`${s.id}/`) || s.title === projector.live?.title);
    if (song) setOpenId(song.id);
  }, [songs, projector.live]);

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
        originalSections: isNew ? song.sections : songs.find(s => s.id === id)?.originalSections ?? songs.find(s => s.id === id)?.verses.map(v => ({label:v.label,lines:v.lines})) ?? song.sections,
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
        added={addedFromSearch}
        onRequestClose={() => setAddOpen(false)}
        onClosed={() => setAddedFromSearch(new Set())}
        onReady={({ base, note, route, discoveryId, origin }) => {
          /* A song found by search opens over the search, which stays up:
             save it, or close it, and the results are there for the next
             one. Youtube and paste are one song at a time and close. */
          const overSearch = route === 'search';
          if (!overSearch) setAddOpen(false);
          setOpenId(null);
          setEditor({
            session: { id: `${NEW_PREFIX}${Date.now().toString(36)}`, isNew: true, base, note },
            origin: overSearch ? origin ?? null : null,
            open: true,
            discoveryId: overSearch ? discoveryId : undefined,
          });
        }}
      />
      {editor ? (
        <SongEditor
          key={editor.session.id}
          session={editor.session}
          open={editor.open}
          origin={editor.origin}
          /* Above the search's own layer when opened from it, so its ground
             covers the results instead of sliding under them. */
          layer={editor.discoveryId !== undefined ? 60 : undefined}
          onSave={async (song) => {
            const saved = await saveSong(editor.session.id, editor.session.isNew, song);
            const found = editor.discoveryId;
            if (saved && found) setAddedFromSearch((done) => new Set(done).add(found));
            return saved;
          }}
          onDraft={(draft) => (draft ? saveDraft(editor.session.id, draft) : clearDraft(editor.session.id))}
          onRequestClose={() => setEditor((e) => (e ? { ...e, open: false } : e))}
          onClosed={() => setEditor(null)}
        />
      ) : null}
      {!open && Object.keys(drafts).length > 0 ? (
        <details className="relative shrink-0 px-4 text-xs text-[var(--tri-ink-muted)]">
          <summary data-guide="songs-drafts" className="cursor-pointer py-2">continue editing · {Object.keys(drafts).length}</summary>
          <div className="absolute left-4 top-full z-30 min-w-64 rounded-xl border border-white/15 bg-[#141719] p-2 shadow-xl">
            {Object.entries(drafts).sort((a,b) => b[1].updatedAt-a[1].updatedAt).map(([id,draft]) => (
              <button key={id} type="button" data-guide={`songs-draft-${id}`} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/10" onClick={() => edit(songs.find(song => song.id === id) ?? songFromDraft(id,draft),null)}>
                {draft.title || 'new song'} · {Math.max(1,Math.ceil((draft.updatedAt + 1800000-Date.now())/60000))} min left
              </button>
            ))}
          </div>
        </details>
      ) : null}
      {loading ? <div className="song-library-loading" role="status" aria-label="Loading songs"><span/><span/><span/><span/></div> : loadProblem ? <div className="p-5"><p role="alert">{loadProblem}</p><Button guideId="songs-retry" label="retry" onClick={refresh}/></div> : open ? (
        <SongSheet key={open.id} song={open} onBack={() => setOpenId(null)} onSave={(base) => saveSong(open.id, false, base)} />
      ) : (
        <SongGrid
          songs={songs}
          query={query}
          onQuery={setQuery}
          onOpen={(id, cardId) => {
            /* A song that is only a draft has nothing to put on the wall
               yet; opening it means carrying on editing it. */
            const song = songs.find((s) => s.id === id);
            if (song && isNewId(id)) edit(song, null);
            else {
              setQuery(''); setOpenId(id);
              const cards = song && songCards({id:song.id,sections:song.verses});
              const card = cards && (cards.find(card => card.id === (cardId ?? projector.live?.id)) ?? cards[0]);
              if (song && card) projector.stage({source:'song',id:card.id,label:`${song.title} — ${card.label}`,title:song.title,section:card.label,lines:card.lines,origin:'operator'});
            }
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

/** Song titles and lyric excerpts share one card; paging never opens the song. */
function SongGrid({
  songs, query, onQuery, onOpen, onEdit, onDelete, onAdd, onSource,
}: {
  songs: readonly Song[];
  query: string;
  onQuery: (q: string) => void;
  onOpen: (id: string, cardId?: string) => void;
  onEdit?: (song: Song, origin: HTMLElement | null) => void;
  onDelete: (id: string) => void;
  onAdd?: () => void;
  onSource: (source: SongSource) => void;
}) {
  const drag = useDrag();
  const projector = useProjector();
  const engine = useEngine();
  const hearingSongs = useSongListeningStore(state => state.active);
  const setHearingSongs = useSongListeningStore(state => state.setActive);
  const clearMatches = useSongListeningStore(state => state.clear);
  const heardByItself = useSongListeningStore(state => state.heard);
  const [searchMode, setSearchMode] = useState<'songs' | 'lyrics'>('songs');
  const [pageBySong, setPageBySong] = useState<Record<string, number>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [sendProblem, setSendProblem] = useState<string | null>(null);
  const searchRow = useRef<HTMLDivElement>(null);
  const matchable = useMemo(() => songs.map(song => ({ id: song.id, title: song.title, sections: song.verses })), [songs]);
  const heardMatches = useSongMatches(matchable);
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (hearingSongs) return heardMatches.map(match => songs.find(song => song.id === match.song.id)).filter((song): song is Song => !!song);
    if (!needle) {
      // A song heard without asking comes to the front, open at what was heard (CatchSignals).
      const first = heardByItself.map(heard => songs.find(song => song.id === heard.match.song.id)).filter((song): song is Song => !!song);
      return first.length ? [...first, ...songs.filter(song => !first.includes(song))] : songs;
    }
    if (searchMode === 'lyrics') return songs.filter(song => song.verses.some(verse => verse.lines.join(' ').toLowerCase().includes(needle)));
    return songs.filter(song => song.title.toLowerCase().includes(needle) || song.author.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.title.toLowerCase().startsWith(needle)) - Number(a.title.toLowerCase().startsWith(needle)));
  }, [songs, needle, searchMode, hearingSongs, heardMatches, heardByItself]);
  const liveId = projector.live?.source === 'song' ? projector.live.id : null;
  const focusSearch = () => searchRow.current?.querySelector('input')?.focus();
  const sendCard = async (song: Song, card: ReturnType<typeof songCards>[number]) => {
    if (sending) return;
    setSending(song.id); setSendProblem(null);
    const content: LiveItem = { source: 'song', id: card.id, label: `${song.title} — ${card.label}`, title: song.title, section: card.label, lines: card.lines, origin: 'operator' };
    projector.stage(content);
    try {
      await projector.send(content);
      // The opening view must keep the exact excerpt just sent, even when
      // the overview card was paged past the first verse.
      onOpen(song.id, card.id);
    } catch (error) {
      setSendProblem(error instanceof Error ? error.message : 'Could not send these lyrics live. Try again.');
    } finally { setSending(null); }
  };

  return (
    <LibraryBrowser guideArea="songs" searchInset="var(--tri-card-gap)" gap={10}
      search={null}
      dock={<LibraryToolbar label="songs"
        search={<div ref={searchRow} className="song-library-search">
          <LibrarySearch disabled={songs.length === 0}>
            <SearchField guideId="songs-search" operatorSearch value={query}
              onChange={value => { onQuery(value); if (hearingSongs) setHearingSongs(false); }}
              ariaLabel={searchMode === 'songs' ? 'Search song titles and artists' : 'Search lyrics in your song library'}
              placeholder="Start typing to search" />
          </LibrarySearch>
        </div>}
        searchModes={<div className="song-search-modes" aria-label="Search in">
          <button type="button" data-guide="songs-search-titles" aria-pressed={searchMode === 'songs'} onClick={() => { setSearchMode('songs'); setHearingSongs(false); focusSearch(); }}>Songs</button>
          <button type="button" data-guide="songs-search-lyrics" aria-pressed={searchMode === 'lyrics'} onClick={() => { setSearchMode('lyrics'); setHearingSongs(false); focusSearch(); }}>Lyrics</button>
        </div>}
        actions={[
          { id: 'add', label: 'add a song', text: 'add song', icon: <AddSongIcon size={13} />, onClick: onAdd },
          { id: 'lyrics', label: 'find lyrics online to add a song', text: 'find online lyrics', icon: <GlobeIcon size={13} />, onClick: () => onSource('search') },
        ]} />}
    >
      <LibraryPane header={false}>
        {sendProblem && <p role="alert" className="song-send-problem">{sendProblem}</p>}
        {hearingSongs && matches.length > 0 && <div className="song-match-note"><span>Listening · suggestions stay here until cleared</span><button type="button" data-guide="songs-clear-matches" onClick={() => clearMatches(recentSongWords(engine.spoken))}>Clear results</button></div>}
        {matches.length === 0 ? (
          <EmptyMark w={220} h={220} plain art={<SongRackArt />} play="hover"
            line={hearingSongs ? 'listening for a song match' : songs.length === 0 ? 'no songs yet' : 'nothing matches'}
            hint={hearingSongs ? 'checking the last 14 words heard, including words already said' : songs.length === 0 ? 'add your first song to the library' : searchMode === 'songs' ? 'try another title, or choose Lyrics to find the words' : 'try a shorter line of lyrics'}
            below={!hearingSongs && (songs.length === 0 && onAdd
              ? <div className="mt-4"><Button guideId="songs-add-empty" label="add a song" icon={<PlusIcon size={14} />} onClick={onAdd} /></div>
              : query.trim() ? <div className="mt-4"><Button guideId="songs-clear-search" label="clear search" onClick={() => onQuery('')} /></div> : null)} />
        ) : <div className="song-library-grid" data-has-live={liveId !== null}>
          {matches.map(song => {
            const cards = songCards({ id: song.id, sections: song.verses });
            const hash = [...song.id].reduce((sum, letter) => (sum * 31 + letter.charCodeAt(0)) >>> 0, 0);
            const heardNow = !hearingSongs && !needle ? heardByItself.find(heard => heard.match.song.id === song.id)?.match : undefined;
            const heard = hearingSongs ? heardMatches.find(match => match.song.id === song.id) : heardNow;
            const found = heard ? cards.findIndex(card => card.sectionIndex === heard.section) : needle && searchMode === 'lyrics' ? cards.findIndex(card => card.lines.join(' ').toLowerCase().includes(needle)) : -1;
            const page = Math.min(pageBySong[song.id] ?? (found >= 0 ? found : hash % Math.max(1, cards.length)), Math.max(0, cards.length - 1));
            const card = cards[page];
            if (!card) return null;
            const live = liveId?.startsWith(`${song.id}/`) ?? false;
            const step = (delta: number) => setPageBySong(previous => ({ ...previous, [song.id]: (page + delta + cards.length) % cards.length }));
            return <article key={song.id} className="song-card" data-tone={hash % 4} data-live={live} data-heard={heardNow ? 'true' : undefined} onClick={() => onOpen(song.id)}
              {...drag.bind(() => ({ source: 'song', label: `${song.title} — ${card.label}`, title: song.title, section: card.label, lines: card.lines, songId: song.id }))}>
              <button type="button" data-guide={`song-${song.id}`} className="song-card-open" aria-label={`Open ${song.title}`}>
                <span className="song-card-topline"><MusicIcon size={14}/><span>{live ? 'Live now' : heardNow ? 'Heard just now' : `${cards.length} lyric ${cards.length === 1 ? 'slide' : 'slides'}`}</span><ExternalLinkIcon size={13}/></span>
                <span className="song-card-title" title={song.title}>{song.title}</span>
                <span className="song-card-artist" title={song.author}>{song.author || '\u00a0'}</span>
                <span className="song-card-excerpt">{card.lines.slice(0, 4).map((line, index) => <span key={index}>{line || '\u00a0'}</span>)}</span>
              </button>
              <div className="song-card-footer" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
                <div className="song-card-navigation">
                  <span className="song-card-section" title={card.label}>{card.label}<small>{page + 1} / {cards.length}</small></span>
                  <div className="song-card-pager" aria-label={`Browse lyrics for ${song.title}`}>
                    <button type="button" data-guide="song-card-previous" aria-label={`Previous lyrics for ${song.title}`} title="Previous lyrics" disabled={cards.length < 2} onClick={() => step(-1)}><ChevronLeftIcon size={15}/></button>
                    <button type="button" data-guide="song-card-next" aria-label={`Next lyrics for ${song.title}`} title="Next lyrics" disabled={cards.length < 2} onClick={() => step(1)}><ChevronRightIcon size={15}/></button>
                  </div>
                </div>
                <div className="song-card-command-row">
                  <div className="song-card-actions">
                    <button type="button" data-guide={`song-edit-${song.id}`} aria-label={`Edit ${song.title}`} title={`Edit ${song.title}`} onClick={event => onEdit ? onEdit(song, event.currentTarget.closest<HTMLElement>('.song-card')) : onOpen(song.id)}><PencilIcon size={13}/></button>
                    <button type="button" data-guide={`song-delete-${song.id}`} aria-label={`Delete ${song.title}`} title={`Delete ${song.title}`} className="song-card-delete" onClick={() => onDelete(song.id)}><TrashIcon size={13}/></button>
                  </div>
                  <Button guideId={`song-card-live-${song.id}`} className="song-card-go-live" label={sending === song.id ? 'sending…' : 'go live'} title={`Send ${song.title} — ${card.label} live and open the song`} tone="go" icon={<PlayIcon size={12}/>} disabled={sending !== null} onClick={() => void sendCard(song, card)}/>
                </div>
              </div>
            </article>;
          })}
        </div>}
      </LibraryPane>
    </LibraryBrowser>
  );
}

/** Open songs are lyric cards, with preview, live and editing on each card. */
function SongSheet({ song, onBack, onSave }: { song: Song; onBack: () => void; onSave: (base: SongBase) => Promise<boolean> }) {
  const drag = useDrag();
  const projector = useProjector();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [words, setWords] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const sections = song.verses.map(v => ({label:v.label,lines:v.lines}));
  const original = song.originalSections ?? sections;
  const changed = JSON.stringify(original) !== JSON.stringify(sections);
  const matches = (content: LiveItem | null, card: ReturnType<typeof songCards>[number]) => content?.source === 'song' && (content.title === song.title || content.id.startsWith(`${song.id}/`)) && JSON.stringify(content.lines) === JSON.stringify(card.lines);
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
  const rearrange = async () => {
    setSaving(true); setProblem(null);
    try {
      const sections = rearrangeLyrics(song.verses);
      if (!await onSave({ title: song.title, author: song.author, sections })) throw new Error('The rearranged lyrics could not be saved. Try again.');
      setEditing(null);
    } catch (error) { setProblem(error instanceof Error ? error.message : 'Could not rearrange the lyrics.'); }
    finally { setSaving(false); }
  };
  const changeSlides = async (sections: SongBase['sections']) => {
    if (saving) return;
    setSaving(true); setProblem(null);
    try {
      if (!await onSave({title:song.title,author:song.author,sections})) throw new Error('Could not save the slides. Try again.');
      setEditing(null);
    } catch(error) { setProblem(error instanceof Error ? error.message : 'Could not save the slides.'); }
    finally { setSaving(false); }
  };
  const locateCard = (content: LiveItem | null) => {
    const exact = cards.findIndex(card => card.id === content?.id && matches(content,card));
    return exact >= 0 ? exact : cards.findIndex(card => matches(content,card));
  };
  const at = locateCard(projector.live);
  const previewAt = locateCard(projector.preview);
  const liveCard = useRef<HTMLElement>(null);
  useEffect(() => { liveCard.current?.scrollIntoView({block:'nearest'}); },[song.id,at]);
  const next = cards.length ? cards[(at + 1) % cards.length] : null;
  const visibleCards = cards.map((card, index) => ({ card, index })).filter(({ card }) => card.id === editing || !query.trim() || `${card.label} ${card.lines.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <LibraryBrowser framed guideArea="songs" gap={8} searchInset="var(--tri-card-gap)" search={<div className="song-detail-header">
    <button type="button" data-guide="song-back" className="song-detail-back" onClick={onBack} title="Back to the song library"><ChevronLeftIcon size={16}/><span>All songs</span></button>
    <div className="song-detail-title"><strong title={song.title}>{song.title}</strong><span>{song.author || `${cards.length} lyric slides`}</span></div>
    <div className="song-detail-search"><SearchField guideId="song-lyrics-search" operatorSearch value={query} onChange={setQuery} ariaLabel={`Search lyrics in ${song.title}`} placeholder="Start typing to search…"/></div>
  </div>}>
    <LibraryPane scroll={false} header={false} footer={<div className="flex flex-wrap items-center gap-3 px-3 pb-2">
      <span className="min-w-0 flex-1 text-xs text-white/45">{at < 0 ? `${cards.length} lyric cards` : `${cards[at].label} · live`}</span>
      {changed && <Button guideId="song-restore" label="back to default" disabled={saving} title="Restore the original imported lyrics and slide order" onClick={() => void changeSlides(original)} />}
      <Button guideId="song-rearrange" label={saving ? 'saving…' : 'rearrange'} disabled={saving || editing !== null} title="Regroup imported lyric cards into balanced slides, keeping named verses and choruses" onClick={() => void rearrange()}/>
      {next && <Button guideId="song-next" label={at < 0 ? 'go live' : 'next lyrics'} tone="go" icon={<PlayIcon size={12}/>} onClick={() => void send(next)}/>}
    </div>}>
      <div className="flex h-full min-h-0 flex-col">
        {problem && <p role="alert" className="px-4 py-2 text-sm text-[var(--tri-accent-yellow)]">{problem}</p>}
        <div className="song-detail-content min-h-0 flex-1 overflow-y-auto">
          {visibleCards.length === 0 && <div className="song-lyrics-empty"><p>No lyrics match “{query}”.</p><Button guideId="song-clear-lyrics-search" label="clear search" onClick={() => setQuery('')}/></div>}
          <div className="song-sections-grid" data-has-live={projector.live?.source === 'song'}>
            {visibleCards.map(({ card, index }) => {
              const live = index === at;
              const selected = index === previewAt;
              const edit = editing === card.id;
              return <article ref={live ? liveCard : undefined} key={card.id} className="song-section-card" data-live={live} data-preview={selected} data-dragging={dragFrom === index} data-over={dragOver === index && dragFrom !== index}
                onDragOver={event => { if (dragFrom !== null && !saving) { event.preventDefault(); setDragOver(index); } }}
                onDrop={event => { event.preventDefault(); if (dragFrom !== null && dragFrom !== index) void changeSlides(arrangeSongCards(sections,dragFrom,index)); setDragFrom(null); setDragOver(null); }}>
                <div className="song-section-heading"><button type="button" className="song-slide-grip" aria-label={`Move slide ${index + 1}. Use left and right arrows to reorder.`} title="Drag to reorder · arrow keys move this slide" draggable={!saving && !editing}
                  onKeyDown={event => { const next = index + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0); if (next !== index) { event.preventDefault(); if (!saving && next >= 0 && next < cards.length) void changeSlides(arrangeSongCards(sections,index,next)); } }}
                  onDragStart={event => { setDragFrom(index); event.dataTransfer.effectAllowed='move'; event.dataTransfer.setData('text/plain',card.id); }}
                  onDragEnd={() => { setDragFrom(null); setDragOver(null); }}>⠿</button><span>{card.label}</span><span>{live ? 'live' : selected ? 'preview' : String(index + 1).padStart(2, '0')}</span></div>
                {edit ? <textarea data-guide="song-slide-text" aria-label={`Edit ${card.label} lyrics`} className="song-section-editor" autoFocus value={words} onChange={event => setWords(event.target.value)} disabled={saving}/> :
                  <button type="button" data-guide="song-slide" className="song-section-lyrics" aria-label={`Preview ${card.label}`} title="Click to preview · double-click to go live" onClick={() => projector.stage(item(card))} onDoubleClick={() => void send(card)}
                    {...drag.bind(() => ({source:'song',label:`${song.title} — ${card.label}`,title:song.title,section:card.label,lines:card.lines,songId:song.id}))}>
                    {card.lines.map((line,i) => <span key={i}>{line || '\u00a0'}</span>)}
                  </button>}
                <div className="song-section-actions">
                  {edit ? <><Button guideId="song-slide-cancel" label="cancel" tone="ash" disabled={saving} onClick={() => setEditing(null)}/><Button guideId="song-slide-save" label={saving ? 'saving…' : 'save lyrics'} disabled={saving} icon={<CheckIcon size={12}/>} onClick={() => void save(card)}/></> :
                    <><button type="button" data-guide="song-slide-delete" className="song-slide-delete" aria-label={`Delete slide ${index+1}`} title="Delete this slide" disabled={saving || cards.length <= 1} onClick={() => void changeSlides(arrangeSongCards(sections,index,null))}><TrashIcon size={14}/></button><Button guideId="song-slide-edit" label="edit" tone="ash" icon={<PencilIcon size={12}/>} onClick={() => { setEditing(card.id); setWords(card.lines.join('\n')); setProblem(null); }}/><Button guideId="song-slide-live" label="go live" tone="go" icon={<PlayIcon size={12}/>} onClick={() => void send(card)}/></>}
                </div>
              </article>;
            })}
          </div>
        </div>
      </div>
    </LibraryPane>
  </LibraryBrowser>;
}

/* ------------------------------------------------------------------ */
/* The catches pane — the room's microphone, asked two things           */
/* ------------------------------------------------------------------ */

/*
 * The microphone actions sit above the transcript in the left rail,
 * where they stay available while browsing any library tab.
 */

/* "search song": the songs it finds are drawn in the right half of the
   verses card too, and pressing it brings the verses card up to show them
   (see LiveBody). */
function SongSearchTile() {
  const engine = useEngine();
  const active = useSongListeningStore((s) => s.active);
  const setActive = useSongListeningStore((s) => s.setActive);
  return (
    <Button guideId="catches-song-search" className="catch-tile" label={active ? 'stop search' : 'search song'} icon={<MicIcon selected={active} size={14} />} tone={active ? 'gold' : 'ash'} pressed={active}
      title={active ? 'Stop song search and clear suggestions' : 'Find a song from the last 14 words heard, then keep listening'}
      onClick={() => { setActive(!active); if (!active && engine.asr !== 'listening') engine.listen(true); }} />
  );
}

/* Compact microphone controls sit together above the transcript. */
function CatchActions() {
  return (
    <div data-guide-area="catches" className="catch-actions">
      <SongSearchTile />
      <ScriptureCatches />
    </div>
  );
}

/*
 * What the preacher is saying — the same face the dashboard draws, in the
 * card the operator already watches. Before anything has been heard it is
 * the quiet placeholder: an empty transcript frame at launch said
 * "transcript" about a silent room.
 */
function CatchesTranscript({ onOpenTranscript }: { onOpenTranscript: () => void }) {
  const engine = useEngine();
  const heard = engine.spoken.lines.length > 0 || Boolean(engine.spoken.partial);
  return heard ? (
    <TranscriptFace rail spoken={engine.spoken} asr={engine.asr} className="h-full w-full" onOpen={onOpenTranscript} />
  ) : (
    <EmptyMark w={120} h={100} plain art={<ScriptureQuoteArt />} play="hover" line="what the preacher says shows here" />
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

/**
 * The orb in the context bar, gear-sized. `label` is one of the fourteen
 * state labels; anything else reads as idle, which is the honest default.
 *
 * The state sets the colour, speed and light; the SHAPE is one style from
 * that state's pool, picked when the state first comes up in a session and
 * kept until the operator stops (see pickStatusLook). The name on hover is
 * the state's, whichever style it is wearing.
 */
function OrbPortrait({ label }: { label: string }) {
  const pick = useOrbShape(label);
  const look = ORB_BY_STATE[label] ?? ORB_BY_STATE.idle;
  return <SvgOrbsPill style={pick.style} startAt={pick.startAt ?? 0} dotColor={INK} accent={look.accent}
    speed={look.speed} dotOpacity={look.opacity} showsPill={false} showsLabel={false}
    ball={68} dots={0.75} dotScale={2} fps={30} scheme="dark" />;
}

function StatusOrb({ label, notification, suggestion }: { label: string; notification: NotificationTriggerProps; suggestion: OrbSuggestion | null }) {
  const look = ORB_BY_STATE[label] ?? ORB_BY_STATE.idle;
  /* The session's shape for this state — or, during a long smooth stretch
     of listening, a borrowed one. See orb/orbIdle. */
  const pick = useOrbShape(label);
  const [named, setNamed] = useState(false);
  const hintId = useId();
  const messageAnchor = useRef<HTMLDivElement>(null);
  const [mutedSuggestion, setMutedSuggestion] = useState<string | null>(null);
  const [phrase, setPhrase] = useState(() => nextOrbPhrase(label));
  const previousPhrases = useRef<Record<string, string>>({});
  const showing = useRef(false);
  const hide = () => { showing.current = false; setNamed(false); };
  const show = () => {
    if (showing.current || notification.expanded) return;
    const next = nextOrbPhrase(label, previousPhrases.current[label]);
    previousPhrases.current[label] = next;
    showing.current = true;
    setPhrase(next);
    setNamed(true);
  };
  useEffect(() => { showing.current = false; setNamed(false); }, [label, notification.expanded]);
  const automatic = !!suggestion && mutedSuggestion !== suggestion.key;
  const speaking = !notification.expanded && (named || automatic);
  return (
    <div ref={messageAnchor} className="tri-header-orb relative flex aspect-square shrink-0" data-speaking={speaking || undefined} data-expanded={notification.expanded || undefined}>
      <button
        type="button"
        ref={notification.ref}
        data-guide="notifications"
        onClick={event => { hide(); notification.onClick(event); }}
        onPointerEnter={show}
        onPointerLeave={hide}
        onFocus={show}
        onBlur={hide}
        onKeyDown={event => { if (event.key === 'Escape') { hide(); setMutedSuggestion(suggestion?.key ?? null); } }}
        aria-label={`Open orb notifications${notification.count ? `, ${notification.count} active` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={notification.expanded}
        aria-controls={notification.controls}
        aria-describedby={speaking ? hintId : undefined}
        className="tri-header-orb-face flex h-full w-full items-center justify-center"
      >
        {/* The dot ball, drawn as SVG by the same geometry as the WebGPU
            one, so it draws on a machine with no GPU driver. Its surface
            shares the header's control height. `dots`
            is a MULTIPLIER on the style's own count (150 × 0.6 = 90), not a
            count — the full 150 is mush at this size. Speed 0 draws once
            and stops, so idle and frozen cost nothing; 30fps is plenty
            for a ball this size and halves what a moving one costs.
            52px since 2026-10-08: the owner wanted it bigger, and 0.75
            keeps the dots as dense as 0.6 was at 40px. */}
        <SvgOrbsPill
          style={pick.style}
          startAt={pick.startAt ?? 0}
          dotColor={INK}
          accent={look.accent}
          speed={look.speed}
          dotOpacity={look.opacity}
          showsPill={false}
          showsLabel={false}
          ball={52}
          dots={0.75}
          // Keep the small dot surface legible beside the action controls.
          dotScale={2}
          fps={30}
          scheme="dark"
        />
      </button>
      {notification.unread && <span className="tri-orb-unread" aria-hidden="true" />}
      {speaking && <OrbStatusHint id={hintId} message={named ? phrase : suggestion!.text} anchor={messageAnchor} automatic={automatic && !named} />}
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
const SWITCH_TO_MANUAL = { label: 'review speech settings' } as const;

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
      api.onVersePreview?.((d: { book?: string; chapter?: number; verse?: number | null; endVerse?: number | null; operatorPush?: boolean }) => {
        /* The operator's own push passes through the engine's preview on its
           way to the wall; it was not caught and nobody is waiting. */
        if (!d?.book || d.operatorPush) return;
        const verse = d.verse == null ? '' : `:${d.verse}${d.endVerse && d.endVerse !== d.verse ? `-${d.endVerse}` : ''}`;
        say({ text: `caught ${d.book} ${d.chapter}${verse} — waiting for you` });
      }),
    );

    /* A Bible the service asked for that this computer does not have (a
       default set by a .tri package, a phone naming one): the verses come
       in another version, and the operator should know which, and why. */
    off.push(
      api.onEngineEvent?.('on-bible-notice', (n) => {
        const text = (n as { text?: unknown } | null)?.text;
        if (typeof text === 'string' && text) say({ text });
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
function useCompanionQr(live: boolean, say?: (e: { text: string }) => void, qrLive = false) {
  const [qrUp, setQrUp] = useState(false);
  const [confirmQr, setConfirmQr] = useState(false);
  const showingQr = useRef(false);
  const confirmationKey = 'trilorah.qrProjection.skipConfirmation';

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

  useEffect(() => {
    if (live || qrUp || qrLive) setConfirmQr(false);
  }, [live, qrUp, qrLive]);

  const showQr = useCallback(() => {
    // Recheck the wall when Yes is pressed: another control may have changed it.
    if (live || qrUp || qrLive || showingQr.current) return;
    if (!window.api?.showQr) {
      say?.({ text: 'the phone code needs the engine — it cannot be shown from here' });
      return;
    }
    showingQr.current = true;
    void window.api
      .showQr()
      .then((res) => {
        if (res?.success) setQrUp(true);
        /* Main's own message names two settings keys. The operator needs the
           sentence that says where to go, not which keys were empty. */
        else say?.({ text: "companion isn't set up yet — add your public web address and account in Settings" });
      })
      .catch(() => say?.({ text: "couldn't show the phone code — try again" }))
      .finally(() => { showingQr.current = false; });
  }, [live, qrUp, qrLive, say]);

  const toggleQr = useCallback(() => {
    if (live) {
      say?.({ text: 'clear the projector first — the phone code only goes onto an empty screen' });
      return;
    }
    if (qrUp || qrLive) {
      void window.api?.clearMedia?.();
      setQrUp(false);
      return;
    }
    if (!window.api?.showQr) {
      say?.({ text: 'the phone code needs the engine — it cannot be shown from here' });
      return;
    }
    if (showingQr.current) return;
    let skipConfirmation = false;
    try { skipConfirmation = localStorage.getItem(confirmationKey) === 'true'; } catch { /* Ask when preferences are unavailable. */ }
    if (skipConfirmation) showQr();
    else setConfirmQr(true);
  }, [live, qrUp, qrLive, say, showQr]);

  const confirmProjection = (dontShowAgain: boolean) => {
    setConfirmQr(false);
    if (live || qrUp || qrLive) return;
    if (dontShowAgain) {
      try { localStorage.setItem(confirmationKey, 'true'); } catch { /* Still allow this confirmed projection. */ }
    }
    showQr();
  };

  return { qrUp, toggleQr, confirmQr, confirmProjection, discardProjection: () => setConfirmQr(false) };
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
            data-guide={`view-${m}`}
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
              <Icon selected={active} size={18} className="tri-header-view-icon" />
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
      data-guide="header-clock"
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
          <ClockIcon size={12} className="tri-header-icon" />
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

/* The rail's primary action. A gentle idle glow invites a press; only the
   listening state gets a moving microphone meter. The engine owns start/stop,
   and the footer keeps the same dimensions as the transcript beside it. */

/** Machined-surface grain, so the housing reads as material, not fill. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")";

const verseHintSession = createVerseHintSession();

function ListeningSign() {
  const engine = useEngine();
  const on = engine.asr === 'listening' || engine.asr === 'connecting';
  const connecting = engine.asr === 'connecting';
  const disabled = !engine.caps.bridge;
  const state = disabled ? 'disabled' : connecting ? 'connecting' : on ? 'listening' : engine.asr === 'error' ? 'error' : 'idle';

  return (
    <button
      type="button"
      data-guide="listen"
      disabled={disabled}
      onClick={() => engine.listen(!on)}
      aria-pressed={on}
      aria-label={on ? 'Stop listening' : 'Start listening'}
      data-state={state}
      title={
        disabled
          ? 'no engine in this window — run the app with SANDBOX=1'
          : on
            ? 'stop listening'
            : 'start listening for the service'
      }
      className="tri-listening-sign relative flex w-full shrink-0 cursor-pointer select-none items-center justify-center overflow-hidden tri-rounded-surface disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        /* Exactly as tall as the transcript ticker beside it: the two share
           the foot of the window, so a sign even a pixel off reads as a
           misalignment rather than as two objects on one line. Same token,
           so they keep agreeing across density. */
        height: 'var(--operator-footer-h)',
        containerType: 'inline-size',
        backgroundImage: `${GRAIN}, linear-gradient(180deg, #29271e 0%, #191b16 50%, #101410 100%)`,
      }}
    >
      {/* The invitation stays behind the label, keeping it steady and readable. */}
      <span
        aria-hidden
        className="tri-listening-sign__lamp pointer-events-none absolute inset-0 tri-rounded-surface"
      />

      {/*
        The mic rides WITH the words, not off in a corner.

        It was parked in a gutter at the left edge, which made the sign
        lopsided: a big centred word with a small mark floating beside it,
        belonging to neither the housing nor the letters. On a real sign the
        marking sits on the same optical line as the type, so it travels with
        it — one object, centred as a whole.
      */}
      <span className="relative z-[1] flex items-center">
        {/* The trailing letter-space of the last letter is real width, so the
            pair would hang right of centre. Half of it is taken back here
            rather than on the word, which keeps the mic-to-text gap honest. */}
        <span
          className="flex items-center gap-[0.3em]"
          style={{ fontSize: 'clamp(8px, 4.5cqi, 16px)', lineHeight: 1, marginRight: '0.23em', whiteSpace: 'nowrap' }}
        >
          <span
            aria-hidden
            className="flex shrink-0 items-center justify-center transition-colors"
            style={{
              transitionDuration: '260ms',
              color: 'var(--listening-ink)',
              filter: on ? 'drop-shadow(0 0 6px rgb(255 190 60 / 0.55))' : undefined,
            }}
          >
            {/* While the room is being heard the mark is a meter, not a
                mic — a moving glyph on this sign always means a live mic. */}
            {engine.asr === 'listening' ? <EqBars size={12} /> : <MicIcon size={12} />}
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
              color: 'var(--listening-ink)',
              textShadow: on
                ? '0 0 5px rgb(255 214 90 / 0.9), 0 0 16px rgb(255 190 60 / 0.5), 0 0 40px rgb(255 170 40 / 0.28)'
                : 'none',
            }}
          >
            {on ? 'stop listening' : 'start listening'}
          </span>
        </span>
      </span>
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
      data-guide={delta < 0 ? "slide-previous" : "slide-next"}
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
function PreviewScreenPicker() {
  const outputs = useOutputsStatus();
  const [screenError, setScreenError] = useState('');
  const [routing, setRouting] = useState(false);
  const mainOutput = outputs?.outputs.find((output) => output.id === 'main');
  const chosenScreen = mainOutput?.disabled ? 'none' : mainOutput?.chosenDisplayId == null ? 'automatic' : String(mainOutput.chosenDisplayId);
  const screenChoices = [
    { id: 'automatic', label: 'automatic' },
    ...(outputs?.displays.map((display) => ({ id: String(display.id), label: `${display.name}${display.primary ? ' · this computer' : ''}` })) ?? []),
    { id: 'none', label: 'no screen — off' },
  ];
  return (
    <div
      className="relative grid shrink-0"
      style={{ marginLeft: 'calc(var(--tri-card-gap) - var(--tri-gap))' }}
    >
      <LibraryControlSizer />
        <ActionMenu
          guideId="preview-screen"
          className="!absolute inset-0 w-full [&>span]:w-full"
          groups={[{ items: screenChoices.map((choice) => ({ ...choice, icon: choice.id === chosenScreen ? <CheckIcon size={14} /> : undefined })) }]}
          onSelect={(choice) => {
            if (routing || !outputs) return;
            setRouting(true);
            setScreenError('');
            void saveDisplay('main', choice.id === 'automatic' ? null : choice.id === 'none' ? 'none' : Number(choice.id))
              .catch(() => setScreenError('Could not change screen. Try again.'))
              .finally(() => setRouting(false));
          }}
          trigger={
            <button
              type="button"
              data-guide="preview-screens"
              disabled={!outputs || routing}
              aria-label="screens — choose where the preview goes live"
              title={screenError || (!outputs ? 'Screen selection is available in the desktop app' : `Go live to: ${screenChoices.find((choice) => choice.id === chosenScreen)?.label ?? 'automatic'}`)}
              className="relative flex h-[var(--tri-field-h)] w-full items-center gap-2 rounded-[var(--tri-radius-control)] border border-white/[0.12] bg-[#111111] pl-3 pr-4 text-left text-[length:var(--tri-control-size)] lowercase text-[rgb(229_243_242_/_0.58)] hover:bg-white/[0.04] hover:text-[rgb(229_243_242_/_0.85)] disabled:opacity-50"
            >
              <PresentationIcon size={14} className="shrink-0 opacity-60" />
              <span>screens</span>
              <ChevronDownIcon size={10} className="absolute right-1 top-1/2 -translate-y-1/2" />
            </button>
          }
        />
        {screenError && <span role="alert" className="absolute left-0 top-full z-10 block w-40 rounded bg-[#111111] px-2 py-1 text-[length:var(--tri-size-xs)] text-red-300">{screenError}</span>}
    </div>
  );
}

/*
 * What a stage box shows around its picture.
 *
 * Not flat grey: the picture's own background, blurred and darkened well
 * below the picture so the picture still reads as the bright thing, under
 * the same faint dot patches as the library rail and the transcript strip
 * (owner, 2026-10-17). Always a still — a clip's poster frame, never a
 * second playing video under the one in the picture. Each box keeps its own
 * patch layout for as long as it is mounted, as the empty states do.
 */
function StageBackdrop({ src }: { src: string | null }) {
  return (
    <div aria-hidden className="stage-backdrop">
      {/* Keyed, so a new background fades in rather than swapping hard. */}
      {src && <StageGradient src={src} />}
      <span className="stage-backdrop-shade" />
      <DitheredPatches className="stage-backdrop-dots" interactionParent />
    </div>
  );
}

function StageBox({
  label,
  screenPicker,
  tone = 'default',
  broadcasting = false,
  side = false,
  backdrop = null,
  canvas,
  controls,
  onKeyDown,
  onHover,
  drop,
  files,
}: {
  label: string;
  screenPicker?: ReactNode;
  tone?: 'default' | 'live';
  broadcasting?: boolean;
  /** Controls beside the picture, not in a row under or over it — see
      useSideControls, which decides it for both boxes at once. */
  side?: boolean;
  /** A still of what the picture has behind its words, for the box around
      it (StageBackdrop); null leaves the box dark. */
  backdrop?: string | null;
  canvas: ReactNode;
  controls: ReactNode;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onHover?: (over: boolean) => void;
  /** A carried background can land here: the drag layer's target props
      (none for files from Finder, which `files` takes), whether the pointer
      is over it now, and what letting go will do. */
  drop?: { props?: DropTargetProps; over: boolean; hint: string };
  /** Takes files dragged in from Finder (./finderDrop). */
  files?: FinderDropProps;
}) {
  return (
    <Panel
      guideArea={label === 'live' ? 'live' : 'preview'}
      /* Positioned and isolated for StageBackdrop, which sits behind
         everything in the box. */
      className="relative isolate basis-1/2 !bg-[#111111]"
      /* Panel already ships a gold ring as tone='live'. Using it rather
         than drawing a second highlight is what keeps "this is live" one
         visual idea across the whole app. */
      tone={tone}
      /* Inline because Panel's own px-3 pb-3 cannot be out-classed — see
         bodyStyle in ./parts. */
      bodyStyle={{ padding: 'var(--tri-gap)' }}
    >
      <StageBackdrop src={backdrop} />
      <div
        className="stage-box flex h-full min-h-0 flex-col items-center outline-none"
        /* The controls keep to the edge their row was on: the preview's
           to the picture's foot, the live box's to its head. */
        data-side={side || undefined}
        data-edge={label === 'live' ? 'start' : 'end'}
        /* Focusable only when it has keys to answer, so Tab does not stop on
           a box that would do nothing with it. */
        tabIndex={onKeyDown ? 0 : undefined}
        onKeyDown={onKeyDown}
        onPointerEnter={onHover ? () => onHover(true) : undefined}
        onPointerLeave={onHover ? () => onHover(false) : undefined}
        /* On this div rather than the Panel, which does not forward
           attributes — the whole box, picture and row, is the target. */
        {...drop?.props}
        {...files}
        style={
          {
            containerType: 'size',
            /* --tri-control-h and --stage-row come from Stage, which needs
               the same two numbers to work out how tall this panel is. */
            '--tri-control-pad-x': '10px',
          } as React.CSSProperties
        }
      >
        <div className="stage-toolbar flex w-full shrink-0 flex-wrap items-center justify-between gap-[var(--tri-gap)]" style={{ minHeight: 'var(--stage-row)', order: label === 'live' ? 0 : 2, ...(label === 'live' ? { paddingBottom: 'var(--tri-gap)' } : { paddingTop: 'var(--tri-gap)', marginTop: 'auto' }) }}>
          <div className="stage-toolbar-lead flex shrink-0 items-center gap-[var(--tri-gap)]">
            {screenPicker}
            {!screenPicker && <span className="stage-live-label" data-active={broadcasting || undefined}>
              {label === 'live' && <span className="stage-live-signal" aria-hidden="true"><span /></span>}
              {label}
              {label === 'live' && <span className="sr-only">{broadcasting ? ' — on air' : ' — no content on air'}</span>}
            </span>}
          </div>
          <div className="stage-toolbar-actions ml-auto flex min-w-0 flex-wrap items-center justify-end gap-[var(--tri-gap)]">
            {controls}
          </div>
        </div>
        <div
          className="stage-picture relative shrink-0"
          style={{
            /* Under a row, the picture gives up the row's height. Beside
               its controls it has the whole height, and gives up a column
               (--stage-side) and a gutter on each side instead. */
            width: side
              ? 'min(calc(100cqw - 2 * (var(--stage-side) + var(--tri-gap))), calc(100cqh * 16 / 9))'
              : 'min(100cqw, calc((100cqh - var(--stage-row)) * 16 / 9))',
            aspectRatio: '16 / 9',
          }}
        >
          {canvas}
          {/*
            Where a carried picture can land. A faint edge while one is in
            hand, so both boxes say they take it; a full edge and the one
            line of what letting go does once the pointer is over this one.
            White, not gold — gold is "on the projector", and this is a
            question, not a state.
          */}
          {drop ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 z-30 grid place-items-center transition-[box-shadow,background-color] duration-150 [corner-shape:var(--tri-corner)]"
              style={{
                borderRadius: 'calc(var(--tri-radius-surface) - var(--tri-gap))',
                boxShadow: drop.over ? 'inset 0 0 0 2px rgb(229 243 242 / 0.9)' : 'inset 0 0 0 1px rgb(229 243 242 / 0.35)',
                backgroundColor: drop.over ? 'rgb(0 0 0 / 0.38)' : 'transparent',
              }}
            >
              {/* On a dark chip of its own: the box is usually showing words
                  at the same centre, and a line laid over a verse reads as
                  neither. */}
              {drop.over ? (
                <span className="tri-label rounded-md px-3 py-1.5 lowercase text-[var(--tri-ink)]" style={{ backgroundColor: 'rgb(0 0 0 / 0.78)' }}>
                  {drop.hint}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>

      </div>
    </Panel>
  );
}

/*
 * Whether the two boxes' controls stand beside their pictures.
 *
 * The handle makes the stage short, and a short stage leaves each 16:9
 * picture narrower than its box: dead space either side, while the row of
 * controls under (or over) it still takes height the picture could use.
 * Beside, the controls fill the dead space and the picture gets the row's
 * height back.
 *
 * Beside wins only when it makes the bigger picture — under a row the
 * picture gives up the row's height, beside it gives up a column each side
 * — and only while the tallest stack of controls fits the picture's height.
 * Where the two are level the picture is the same size either way, so it
 * does not jump; only the controls move.
 *
 * Both boxes switch together and keep the same column, as wide as the
 * widest control in either. A pair (× and go live) counts as its wider
 * half: it sits on one line where the column has room and stacks where it
 * does not, which is what lets a laptop's narrower boxes switch at all.
 * The pictures are equal by construction; deciding per box would undo
 * that. Measured rather than tied to the handle, because how much room a
 * side has depends on the window as much as on the handle.
 *
 * But only once the operator has set a height of their own, with a drag or
 * the arrow keys (`allowed`). Opening, and each press of the handle, keep
 * the row under (or over) the picture as it always was — owner, 2026-10-17.
 *
 * And the controls glide there and back rather than jump. Before a switch
 * goes in, where every control and both pictures stand is noted; after,
 * each is drawn back where it was and let go (FLIP). Web animations, not
 * transitions: the box is a size container, and transitions inside one are
 * cancelled while the header orb ticks.
 */
function useSideControls(stage: React.RefObject<HTMLDivElement | null>, allowed: boolean) {
  const [layout, setLayout] = useState({ side: false, column: 0 });
  const allowedRef = useRef(allowed);
  allowedRef.current = allowed;
  const measureNow = useRef(() => {});
  /* The layout on screen, and where things stood before a switch away from it. */
  const onScreen = useRef(false);
  const before = useRef<{ side: boolean; rects: Map<HTMLElement, DOMRect> } | null>(null);
  useLayoutEffect(() => {
    const row = stage.current;
    if (!row) return;
    const boxes = [...row.querySelectorAll<HTMLElement>('.stage-box')];
    const groups = boxes.flatMap((box) => [...box.querySelectorAll<HTMLElement>('.stage-toolbar-lead, .stage-toolbar-actions')]);
    if (!boxes.length) return;
    const shown = (item: Element): item is HTMLElement => item instanceof HTMLElement && item.offsetWidth > 0;
    /* Each control on its own; at its narrowest a pair is its halves, one
       over the other. */
    const controls = (group: HTMLElement) => [...group.children].filter(shown).flatMap((item) => item.classList.contains('stage-pair') ? [...item.children].filter(shown) : [item]);
    const movers = () => [...boxes.flatMap((box) => [...box.querySelectorAll<HTMLElement>('.stage-picture')]), ...groups.flatMap(controls)];
    let frame = 0;
    let room = false;
    const measure = () => {
      frame = 0;
      const style = getComputedStyle(boxes[0]);
      const px = (name: string) => Number.parseFloat(style.getPropertyValue(name)) || 0;
      const gap = px('--tri-gap');
      /* --stage-row, worked out as STAGE_VARS does. */
      const rowHeight = (px('--stage-control-rows') || 1) * (Math.max(px('--tri-control-h'), px('--tri-field-h')) + gap);
      const width = Math.min(...boxes.map((box) => box.clientWidth));
      const height = Math.min(...boxes.map((box) => box.clientHeight));
      /* Computed sizes, not offsetWidth: those are whole pixels, and a
         95.2px pill in a 95px column pokes into the gutter. Nor the client
         rect, which an entrance animation's transform would shrink. */
      const outer = (item: HTMLElement) => {
        const s = getComputedStyle(item);
        const n = (value: string, fallback: number) => Number.parseFloat(value) || fallback;
        return {
          width: n(s.width, item.offsetWidth) + n(s.marginLeft, 0) + n(s.marginRight, 0),
          height: n(s.height, item.offsetHeight) + n(s.marginTop, 0) + n(s.marginBottom, 0),
        };
      };
      let column = 0;
      let stack = 0;
      for (const group of groups) {
        const items = controls(group).map(outer);
        column = Math.max(column, ...items.map((item) => item.width));
        stack = Math.max(stack, items.reduce((sum, item) => sum + item.height, 0) + gap * Math.max(0, items.length - 1));
      }
      column = Math.ceil(column);
      const under = Math.min(width, (height - rowHeight) * 16 / 9);
      const beside = Math.min(width - 2 * (column + gap), height * 16 / 9);
      /* A little give either way, so a size sitting on the line does not
         flick the controls back and forth. */
      room = beside > under + (room ? -2 : 2) && stack <= beside * 9 / 16;
      const side = allowedRef.current && room;
      if (side === onScreen.current) before.current = null;
      else if (before.current?.side !== side) before.current = { side, rects: new Map(movers().map((el) => [el, el.getBoundingClientRect()])) };
      setLayout((prev) => (side === prev.side && column === prev.column ? prev : { side, column }));
    };
    measureNow.current = measure;
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    /* The groups too: a control appearing (the pager, a clip's transport)
       changes how wide and tall a column has to be. */
    const observer = new ResizeObserver(schedule);
    for (const element of [...boxes, ...groups]) observer.observe(element);
    measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [stage]);
  /* A drag arriving, or a press taking the operator's height away. */
  useLayoutEffect(() => measureNow.current(), [allowed]);
  useLayoutEffect(() => {
    onScreen.current = layout.side;
    const from = before.current;
    before.current = null;
    if (!from || from.side !== layout.side || prefersReducedMotion()) return;
    const moves = [...from.rects].filter(([el]) => el.isConnected);
    /* From where each one is drawn now — mid-glide or not — to where it lands. */
    for (const [el] of moves) for (const glide of el.getAnimations()) if (glide.id === STAGE_GLIDE) glide.cancel();
    const lands = moves.map(([el]) => el.getBoundingClientRect());
    moves.forEach(([el, was], i) => {
      const now = lands[i];
      if (!now.width) return;
      const x = was.left - now.left;
      const y = was.top - now.top;
      /* Only the pictures change size, and both shapes are 16:9. */
      const scale = was.width / now.width;
      if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5 && Math.abs(scale - 1) < 0.002) return;
      el.animate(
        [{ transformOrigin: '0 0', transform: `translate(${x}px, ${y}px) scale(${scale})` }, { transformOrigin: '0 0', transform: 'none' }],
        /* The stage's own height animation, so a press reads as one move. */
        { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', id: STAGE_GLIDE },
      );
    });
  }, [layout.side]);
  return layout;
}
const STAGE_GLIDE = 'stage-glide';

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
  onFiles,
}: {
  transition: ReturnType<typeof useTextTransition>;
  previewTheme: ThemeSettings;
  liveTheme: ThemeSettings;
  editingTheme?: boolean;
  onThemeChange?: (theme: ThemeSettings) => void;
  /** The service log — where a refused act explains itself. */
  say?: (line: { text: string }) => void;
  /** Files from Finder let go over a box (LiveBody's dropFiles). */
  onFiles?: (key: FinderStageKey, paths: string[], count: number) => void;
}) {
  const projector = useProjector();
  const engine = useEngine();
  const { preview, live, slide, screen } = projector;

  /*
   * A still of what each picture has behind its words, for the box around
   * it (StageBackdrop): a photo or slide that fills the picture itself,
   * else the theme's background — a clip's poster frame for a video one.
   * A clip shown as content plays on black, so its box stays dark; so does
   * the live box while the wall is black or showing the logo.
   */
  const mediaLibrary = useMediaLibrary();
  const themeStill = (backgroundId: string) => {
    const media = backgroundFor(backgroundId, mediaLibrary);
    return media ? mediaSrc(media) : null;
  };
  const backdropFor = (item: typeof preview, backgroundId: string) => {
    if (item?.source === 'media' && item.mediaKind === 'video') return null;
    if (item?.path && (item.source === 'presentation' || item.source === 'media')) return presentationImageSrc(item.path);
    return themeStill(backgroundId);
  };
  const previewBackdrop = backdropFor(preview, previewTheme.backgroundId);
  const liveBackdrop = screen === 'live' ? backdropFor(live, liveTheme.backgroundId) : screen === 'clear' ? themeStill(liveTheme.backgroundId) : null;

  /*
   * The two boxes take a carried background — and only a background.
   *
   * A media card in hand lights them up: PREVIEW for any (a still becomes
   * the preview's background, a clip is staged as content), LIVE for a
   * still only (it goes behind the words on the wall now). A verse, a song
   * or a slide in hand lights up neither, so a drag can never become a new
   * way onto the wall. Solo, so chips parked for the run stay parked.
   */
  const drag = useDrag();
  const carried = drag.active?.source === 'media' && drag.active.mediaId ? drag.active : null;
  /*
   * Files from Finder land here too — imported (pictures under themes, clips
   * under media) and then treated exactly as that card dropped here would
   * be. Same rings, same lines, same refusal: the LIVE box does not light up
   * for clips, and the cursor says no over it.
   */
  const finder = useFinderDrag();
  const finderDrop = (key: FinderStageKey) => {
    const hint = finder.active ? finderStageHint(key, finder.kinds) : null;
    return hint ? { over: finder.over === key, hint } : undefined;
  };
  const filesFor = (key: FinderStageKey) =>
    onFiles ? finderDropProps(key, (paths, count) => onFiles(key, paths, count), (kinds) => finderStageHint(key, kinds) !== null) : undefined;
  const previewDrop = carried
    ? { props: drag.dropProps('stage-preview', { solo: true }), over: drag.over === 'stage-preview', hint: 'preview this background' }
    : finderDrop('stage-preview');
  const liveDrop = carried
    ? { props: drag.dropProps('stage-live', { solo: true }), over: drag.over === 'stage-live', hint: 'background on the wall now' }
    : finderDrop('stage-live');

  /*
   * Staged readings show their first slide, always.
   *
   * The preview box deliberately does NOT get its own slide cursor. Two
   * cursors is two places to be lost, and what the operator wants from the
   * left box is "what will appear when I press this" — which is slide one.
   */
  /* Except when the preview IS what is on the wall (after go live or ‹ ›):
     then it follows the wall's page, or next would walk the wall through
     verses 1, 2, 3 of a long reading while the preview sat on verse 1. */
  const previewOnAir = !!preview && !!live && liveKey(preview) === liveKey(live);
  const staged = stageSlide(preview, previewOnAir ? Math.min(slide, (preview.slides?.length ?? 1) - 1) : 0);
  const onAir = stageSlide(live, slide);

  /* A go live on its way. The preview's ✕ waits it out, like a step: a clear
     taken mid-push is lifted again when the push lands. */
  const [sending, setSending] = useState(false);
  // Pass the staged identity so a newer speech preview cannot replace it.
  const goLive = async () => {
    if (!preview) return;
    /* The wall slices a range by the church's own setting, so the choice made
       here has to become that setting or the preview would be a picture of
       something the congregation never sees. */
    if ((preview.verses?.length ?? 0) > 1) {
      /* Apart is a slide (or more) for every verse; together is fewer slides
         than verses — one, or pages of several (verseDisplay pageVerses). */
      void window.api?.setSetting('breakOnVerse', (preview.slides?.length ?? 0) >= (preview.verses?.length ?? 0));
    }
    setSending(true);
    try {
      await projector.promote();
    } catch (error) { say?.({ text: error instanceof Error ? error.message : 'Could not send to the live screen.' }); }
    finally { setSending(false); }
  };

  const blacked = screen === 'black' || screen === 'logo';
  /* One way to change the wall's screen state, for the LIVE pane's clear and
     the preview's ✕ alike: the engine (and through it every output) and this
     panel, which would otherwise wait for the round trip to redraw. */
  const setWall = (next: ScreenState) => { engine.setScreen(next); projector.setScreen(next); };
  /* What the preview's ✕ takes away — the staged item, and the words on the
     wall too when the preview is showing what the room is reading
     (lib/previewClear). Decided on the press alone: an engine withdrawal or a
     catch replacing the box never reaches the wall. */
  const clearPlan = previewClearPlan({ preview, live, screen, editingTheme });
  /* The find-scripture answers are up over the preview (ScriptureFindOverlay).
     The row's controls would act on the verse hidden behind them — the
     pager even steps the wall — so they stand down until a card is chosen or
     the answers are closed. */
  const finding = useScriptureFindStore((s) => !!s.found);

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
    if (preview?.source === 'song') {
      /* The song's own cards, in order, so ← → walk the sheet the way the
         songs tab does: chorus, verse two, the second page of a long verse.
         The item names the song and the card it came from. */
      const songId = preview.id.split('/')[0];
      const song = songId && window.api?.songs?.get ? await window.api.songs.get(songId).catch(() => null) : null;
      if (!song?.sections) return;
      const cards = songCards({ id: songId, sections: song.sections });
      const at = cards.findIndex((card) => card.id === preview.id || card.id.startsWith(`${preview.id}/`));
      const card = cards[at + dir];
      if (at < 0 || !card) return;
      const next: LiveItem = { source: 'song', id: card.id, label: `${song.title} — ${card.label}`, title: song.title, section: card.label, lines: card.lines, origin: 'operator' };
      navigating.current = true;
      setStepping(true);
      try { await projector.send(next); projector.stage(next); }
      catch (error) { say?.({ text: error instanceof Error ? error.message : 'Could not show the next lyrics. Try again.' }); }
      finally { navigating.current = false; setStepping(false); }
      return;
    }
    if (!stagedRef || !preview) return;
    try { await projector.stepScripture(dir); }
    catch (error) { say?.({ text: error instanceof Error ? error.message : 'Could not show verse. Try again.' }); }

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
  /* Together is fewer slides than verses: one slide, or pages of several. */
  const together = range && (preview?.slides?.length ?? 0) < (preview?.verses?.length ?? 0);
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
  const [stageScale, setStageScale] = useState(STAGE_SCALE_MIN);
  /* The handle between the pictures and the library is a press first: one
     press lifts the library (the pictures at their smallest), the next
     puts it back. A drag still sets any size in between; `moved` tells a
     drag's release from a press, and the height only animates for a press. */
  const resizeStart = useRef<{ y: number; scale: number; moved: boolean } | null>(null);
  const [resizing, setResizing] = useState(false);
  const suppressResizeClick = useRef(false);
  const libraryRaised = stageScale < (STAGE_SCALE_MIN + STAGE_SCALE_FULL) / 2;
  /* A height the operator set themselves — a drag or the arrow keys — which
     is when the controls may move beside the pictures. Opening and the
     handle's press leave them under (owner, 2026-10-17). */
  const [adjusted, setAdjusted] = useState(false);
  const stageRow = useRef<HTMLDivElement>(null);
  const { side, column } = useSideControls(stageRow, adjusted);
  const canStep = !editingTheme && (!!stagedRef || deckCount > 1 || preview?.source === 'song');
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
  const liveId = projector.live ? `${projector.live.source}:${projector.live.id}` : '';
  useEffect(() => setVideoPaused(false), [liveId]);

  /*
   * Is the room reading something the phone code would cover?
   *
   * Not merely "is anything live": a cleared screen keeps its live item (clear
   * drops the words, keeps the picture), so that test disabled the code for
   * the rest of the service after the first verse — and once the code itself
   * went up it counted as "something live" too, so the button could not take
   * it down again.
   */
  const qrLive = live?.source === 'media' && /trilorah-companion-qr/.test(live.path ?? '');
  const wallBusy = !!live && !qrLive && screen === 'live';
  const { qrUp, toggleQr, confirmQr, confirmProjection, discardProjection } = useCompanionQr(wallBusy, say, qrLive);

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
      className="relative flex min-h-0 flex-col"
      style={{ ...STAGE_VARS, containerType: 'inline-size', '--stage-scale': stageScale } as React.CSSProperties}
    >
    {confirmQr && <QrProjectionConfirm onDiscard={discardProjection} onConfirm={confirmProjection} />}
    <div
      ref={stageRow}
      className="flex min-h-0 gap-[var(--tri-gap)]"
      style={{
        height: STAGE_HEIGHT,
        transition: resizing || prefersReducedMotion() ? undefined : 'height 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        '--stage-side': `${column}px`,
      } as React.CSSProperties}
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
        side={side}
        backdrop={previewBackdrop}
        screenPicker={<><PreviewScreenPicker /><MicPicker compact /></>}
        onKeyDown={canStep && !editingTheme ? onStepKey : undefined}
        onHover={setOverPreview}
        drop={previewDrop}
        files={filesFor('stage-preview')}
        canvas={
          <>
            <SlideCanvas seated theme={previewTheme} transition={transition} slide={staged ?? (editingTheme && (!preview || preview.source === 'background') ? THEME_SAMPLE : null)} empty={preview?.source === 'background' ? null : "nothing staged"} guide={editingTheme} onSafeMargin={editingTheme ? (safeMargin) => onThemeChange?.({ ...previewTheme, safeMargin }) : undefined} safeRange={SAFE_MARGIN} onRefGap={editingTheme ? (refGap) => onThemeChange?.({ ...previewTheme, refGap }) : undefined} refGapRange={REF_GAP} />
            {/* Pictures have no words for the canvas to draw — the phone code
                and media-library photos showed as "nothing" here. */}
            {(preview?.source === 'presentation' || (preview?.source === 'media' && preview.mediaKind !== 'video')) && preview.path && <img src={presentationImageSrc(preview.path)} alt={preview.label} className="absolute inset-0 h-full w-full object-contain bg-black" />}
            {preview?.source === 'media' && preview.mediaKind === 'video' && preview.path && <video key={preview.path} src={toDisplayUrl(preview.path)} aria-label={preview.label} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-contain bg-black" />}
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
                  data-guide="preview-step-previous"
                  aria-label={deckCount ? "previous slide" : "previous verse"}
                  title="previous — show on both screens ←"
                  disabled={stepping || (deckCount ? deckIndex <= 0 : !!stagedRef && stagedRef.start <= 1 && (!previewOnAir || slide === 0))}
                  onClick={() => step(-1)}
                  className="verse-step verse-step--previous absolute inset-y-0 left-0 w-1/2 disabled:cursor-default"
                >{hintPass > 0 && <span key={hintPass} className="verse-nav-hint verse-nav-hint--previous"><span><ChevronLeftIcon size={20} /></span>previous</span>}</button>
                <button
                  type="button"
                  data-guide="preview-step-next"
                  aria-label={deckCount ? "next slide" : "next verse"}
                  disabled={stepping || (deckCount > 0 && deckIndex >= deckCount - 1)}
                  title="next — show on both screens →"
                  onClick={() => step(1)}
                  className="verse-step verse-step--next absolute inset-y-0 right-0 w-1/2"
                >{hintPass > 0 && <span key={hintPass} className="verse-nav-hint verse-nav-hint--next"><span><ChevronRightIcon size={20} /></span>next</span>}</button>
              </>
            )}
            <div className="scripture-book-question"><BookClarification /></div>
            <ScriptureFindOverlay />
          </>
        }
        controls={
          <>
            {deckCount > 0 && !finding && <SlidePager at={deckIndex} total={deckCount} onStep={dir => void step(dir)} disabled={stepping || editingTheme} />}
            {range && !finding && (
              <Button
                guideId="preview-together"
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
            {preview?.source === 'scripture' && !finding && <div className="stage-scripture-nav">
              <Button label="" icon={<ChevronLeftIcon size={14} />} tone="ash" title="Previous page or verse" aria-label="Previous page or verse" onClick={() => void step(-1)} />
              {(preview.slides?.length ?? 0) > 1 && <span title="Page in this reading">{(previewOnAir ? slide : 0) + 1} / {preview.slides!.length}</span>}
              <Button label="" icon={<ChevronRightIcon size={14} />} tone="ash" title="Next page or verse" aria-label="Next page or verse" onClick={() => void step(1)} />
            </div>}
            {/* These two controls stay together at the preview's right edge
                (beside the picture, × goes over go live when the column is
                too narrow for both on one line). */}
            <div className="stage-pair flex shrink-0 items-center gap-[var(--tri-gap)]">
              <Button
                guideId="preview-unstage"
                label=""
                tone="ash"
                className="[--tri-control-h:var(--tri-field-h)] w-[var(--tri-field-h)] shrink-0"
                icon={<CloseIcon size={14} />}
                disabled={!preview || finding || stepping || sending}
                title={clearPlan.clearWall
                  ? 'clear — take it out of preview and off the projector (background stays)'
                  : 'unstage — take it out of preview'}
                onClick={() => {
                  projector.stage(null);
                  if (!clearPlan.clearWall) return;
                  setWall('clear');
                  /* The log keys on what is live, which a clear keeps. Short
                     enough for the status pill; "restore" is on the LIVE pane. */
                  say?.({ text: 'words off — background stays' });
                }}
              />
            <Button
              guideId="go-live"
              label="go live"
              tone="go"
              icon={<PlayIcon size={16} />}
              className="stage-go-live [--tri-control-h:var(--tri-field-h)] min-w-[var(--library-pill-width)] shrink-0"
              disabled={!preview || stepping || finding}
              title={finding ? 'choose a passage above, or close the results (esc)' : preview ? `put ${preview.label} on the projector` : 'stage something first'}
              onClick={goLive}
            />
            </div>
          </>
        }
      />

      <StageBox
        label="live"
        side={side}
        backdrop={liveBackdrop}
        broadcasting={!!live && screen === 'live'}
        tone={live && !blacked ? 'live' : 'default'}
        drop={liveDrop}
        files={filesFor('stage-live')}
        canvas={
          <>
          <SlideCanvas
            seated
            theme={liveTheme}
            transition={{ ...transition, play: projector.delivery * 1000 + slide }}
            slide={onAir}
            screen={screen}
            empty={live?.source === 'background' ? null : "nothing on the projector"}
          />
          {(live?.source === 'presentation' || (live?.source === 'media' && live.mediaKind !== 'video')) && live.path && screen === 'live' && <img src={presentationImageSrc(live.path)} alt={live.label} className="absolute inset-0 h-full w-full object-contain bg-black" />}
          {live?.source === 'media' && live.mediaKind === 'video' && live.path && screen === 'live' && <video key={live.path} src={toDisplayUrl(live.path)} aria-label={live.label} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-contain bg-black" />}
          </>
        }
        controls={
          <>
            <Button guideId="live-clear" label="clear" tone="ash" icon={<CloseIcon size={13} />} disabled={!live || screen === 'clear'} title="Hide the words; keep the background" onClick={() => setWall('clear')} />
            <Button guideId="live-restore" label="restore" tone="ash" icon={<ResetIcon size={13} />} disabled={!live || screen === 'live'} title="Bring the live content back" onClick={() => setWall('live')} />
            {/* A clip on the wall gets a transport. Only then: a pause button
                beside a verse is a button that does nothing. The projector
                window owns the <video>, so these are messages to it — the
                paused flag here is this window's own best guess, flipped on
                press and reset whenever a different thing goes live. */}
            {live?.mediaKind === 'video' ? (
              /* One piece, so beside the picture the pair stays a pair. */
              <div className="stage-pair flex shrink-0 items-center gap-[var(--tri-gap)]">
                <Button
                  guideId="live-video-pause"
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
                  guideId="live-video-restart"
                  label=""
                  tone="ash"
                  icon={<ResetIcon size={13} />}
                  title="play the video again from the start"
                  onClick={() => {
                    void window.api?.mediaControl?.({ type: 'restart' });
                    setVideoPaused(false);
                  }}
                />
              </div>
            ) : null}
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
              guideId="live-qr"
              label={qrUp || qrLive ? 'hide QR' : 'show QR'}
              className="stage-output-control"
              tone={qrUp || qrLive ? 'gold' : 'ash'}
              icon={<QrIcon size={13} />}
              disabled={wallBusy}
              title={
                wallBusy
                  ? 'the projector is in use — clear it to show the phone code'
                  : qrUp || qrLive
                    ? 'take the phone code off the projector'
                    : 'show the phone code on the projector'
              }
              onClick={toggleQr}
            />
            <Button
              guideId="live-projector"
              label="display"
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
    <div className="stage-resizer-track">
    <button type="button"
      data-guide="stage-resizer"
      aria-label={libraryRaised ? 'lower the library' : 'raise the library'}
      title={libraryRaised ? 'lower the library — drag to set any size' : 'raise the library — drag to set any size'}
      aria-pressed={libraryRaised}
      className={cx('stage-resizer', libraryRaised && 'is-raised', resizing && 'is-resizing')}
      onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setResizing(true); setAdjusted(true); setStageScale((v) => clampStageScale(v + (e.key === 'ArrowUp' ? -.05 : .05))); } }}
      onPointerDown={(e) => { if (e.button !== 0) return; suppressResizeClick.current = false; resizeStart.current = { y: e.clientY, scale: stageScale, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => {
        const start = resizeStart.current;
        if (!start) return;
        if ((e.buttons & 1) === 0) { resizeStart.current = null; setResizing(false); return; }
        if (!start.moved && Math.abs(e.clientY - start.y) < 4) return;
        if (!start.moved) { start.moved = true; setResizing(true); setAdjusted(true); }
        setStageScale(clampStageScale(start.scale + (e.clientY - start.y) / 400));
      }}
      onPointerUp={() => {
        suppressResizeClick.current = !!resizeStart.current?.moved;
        resizeStart.current = null;
        setResizing(false);
      }}
      onLostPointerCapture={() => { resizeStart.current = null; setResizing(false); }}
      onPointerCancel={() => { resizeStart.current = null; suppressResizeClick.current = true; setResizing(false); }}
      onClick={(e) => {
        /* A drag's release also lands here as a click; only a press toggles. */
        const dragged = suppressResizeClick.current;
        suppressResizeClick.current = false;
        if (dragged && e.detail !== 0) return;
        setResizing(e.detail === 0);
        setAdjusted(false);
        setStageScale(libraryRaised ? STAGE_SCALE_FULL : STAGE_SCALE_MIN);
      }}>
        <span className="stage-resizer-button">
          {libraryRaised ? <ChevronDownIcon size={12} /> : <ChevronUpIcon size={12} />}
        </span>
      </button>
    </div>
    </div>
  );
}

/* How far the pictures above the library shrink, as a share of their
   natural size. The handle's press moves between MIN and FULL, and a drag
   stops at FULL too: there the pictures are already as wide as their boxes,
   so any more height could only open a gap between a picture and its row of
   controls (owner, 2026-10-17 — a drag used to reach 1.15). */
const STAGE_SCALE_MIN = 0.55;
const STAGE_SCALE_FULL = 1;
const clampStageScale = (v: number) => Math.max(STAGE_SCALE_MIN, Math.min(STAGE_SCALE_FULL, v));

/* The divider occupies the same gutter as the other workspace panels. */
const STAGE_HANDLE_H = 'var(--tri-gap)';
const STAGE_VARS = {
  '--stage-handle-h': STAGE_HANDLE_H,
  '--tri-control-h': 'var(--tri-field-h)',
  /* What the row under the picture needs: its controls, and the
     gutter between them and the picture. */
  '--stage-row': 'calc(var(--stage-control-rows, 1) * (max(var(--tri-control-h), var(--tri-field-h)) + var(--tri-gap)))',
} as React.CSSProperties;
/* panel width = half the row less half the gap between the two;
   picture width = that less the inset each side. */
const STAGE_HEIGHT =
  'calc(((100cqw - var(--tri-gap)) / 2 - 2 * var(--tri-gap)) * 9 / 16 * var(--stage-scale) + var(--stage-row) + 2 * var(--tri-gap))';

/*
 * The stage as it stands at its natural size, drawn by nobody.
 *
 * It holds the operator grid's stage row open, so the line the rail's
 * lower card starts on stays where it is when the handle raises the
 * library: only the right-hand column goes up (owner, 2026-10-08). The
 * real stage and the library flow over it in one column.
 */
function StageSizer() {
  return (
    <div
      aria-hidden
      className="pointer-events-none invisible min-h-0 overflow-hidden"
      style={{ ...STAGE_VARS, containerType: 'inline-size', '--stage-scale': 1, gridArea: '1 / 1' } as React.CSSProperties}
    >
      <div style={{ height: `calc(${STAGE_HEIGHT} + ${STAGE_HANDLE_H})` }} />
    </div>
  );
}

/* The browser's least height — the grid's third row holds it. */
const BROWSER_FLOOR = 'var(--operator-browser-floor, min(190px, 36vh))';
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* A push whose item has not landed this long after its theme was written
   has failed; the wall sync stops waiting for it. */
const LANDING_GRACE_MS = 4000;

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
  /* The three background targets (the themes toggle, the two stage boxes)
     are not run segments: their drops go to LiveBody, which owns the theme,
     through this ref. They are solo targets, so `items` is the one card. */
  const backgroundDrop = useRef<BackgroundDropHandler | null>(null);
  return (
    <DragProvider onDrop={(segmentKey, items) => {
      if (isBackgroundDropKey(segmentKey)) {
        const item = items[items.length - 1];
        if (item) backgroundDrop.current?.(segmentKey, item);
      } else run.dropInto(segmentKey, items);
    }}>
      <DragKeyframes />
      <ServiceLogKeyframes />
      <LiveBody state={state} backgroundDrop={backgroundDrop} />
    </DragProvider>
  );
}

type BackgroundDropHandler = (key: BackgroundDropKey, item: DragItem) => void;

/* Inside the providers, so the screen itself can read the run — the rail and
   the browser are both in here and both need it. */
function LiveBody({ state, backgroundDrop }: { state?: string; backgroundDrop?: React.MutableRefObject<BackgroundDropHandler | null> }) {
  const viewport = useArtboard();
  useMobileRemote();
  const textTransition = useTextTransition();
  const [tab, setTab] = useState(0);
  /* The preview opens on a background off the shelf, so there is a picture
     in it from the first frame; the one from the online library replaces it
     a moment later (below). Only the preview: the wall's own background is a
     setting. It changes on promote with the rest of the theme — or on its
     own, at once, when the operator puts one on the wall on purpose (a
     double-click in themes, a drop on the LIVE box; chooseBackground). */
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
  /*
   * The LIVE box's theme: a picture of the wall's, not a memory of the last
   * push. It is read off the wall's own settings at launch and whenever they
   * change (below), so a background chosen in Settings, or one the box never
   * saw go up, is what the box shows — it used to open on 'quiet sea' while
   * the wall showed something else, or nothing.
   */
  const [liveTheme, setLiveTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const liveThemeNow = useRef(liveTheme);
  liveThemeNow.current = liveTheme;
  /* The wall's background as this window last wrote or read it (display
     form). A change that arrives with any other URL was made somewhere else.
     Null until the first read. */
  const wallBg = useRef<string | null>(null);
  /*
   * The theme a push in flight will land in.
   *
   * beforeSend writes the theme to the wall BEFORE the item is published, and
   * used to set the LIVE box's theme right there — so for a moment the box
   * repainted the verse already up in the new theme, then swapped in the new
   * verse: two changes for one press. Now the theme waits here and goes on in
   * the same frame as the item it was written for (the layout effect on
   * `delivery` below), and the wall sync leaves the box alone meanwhile.
   */
  const landing = useRef<{ theme: ThemeSettings; at: number } | null>(null);
  const resyncWall = useRef<() => void>(() => undefined);

  const engine = useEngine();
  const projector = useProjector();
  const themeLibrary = useMediaLibrary();
  useEffect(() => projector.beforeSend(async () => {
    const chosen = previewTheme.backgroundId;
    const media = chosen === NO_BACKGROUND ? undefined : themeLibrary.find(item => item.id === chosen && canBeBackground(item));
    /* '' takes the wall's picture down (NO_BACKGROUND). null — a background
       that has left the shelf, or a clip — leaves the wall's picture alone:
       this used to fall back to themeLibrary[0], whatever was added last,
       which could be an announcement photo or a video's poster. */
    const url = chosen === NO_BACKGROUND ? '' : media ? backgroundSrc(media, mediaSrc) : null;
    const appearance = readTriLocal<Record<string, unknown>>(TRI_DISPLAY_KEY, {});
    const settings: Record<string, unknown> = { ...appearance, ...outputThemeSettings(previewTheme, url ?? ''),
      ...(typeof appearance.backgroundFit === 'string' ? { backgroundFit: appearance.backgroundFit } : {}),
      ...(typeof appearance.backgroundPosition === 'string' ? { backgroundPosition: appearance.backgroundPosition } : {}),
    };
    if (url === null) delete settings.defaultBackgroundUrl;
    else wallBg.current = toDisplayUrl(url);
    landing.current = {
      theme: url === null ? { ...previewTheme, backgroundId: liveThemeNow.current.backgroundId } : previewTheme,
      at: Date.now(),
    };
    if (window.api) {
      await Promise.all(Object.entries(settings).map(([key, value]) => window.api!.setSetting(key, value)));
      if (Object.keys(appearance).length) {
        await window.api.setSetting('triThemeDisplay', null);
        localStorage.removeItem(TRI_DISPLAY_KEY);
      }
    }
  }), [projector.beforeSend, previewTheme, themeLibrary]);

  /* The pushed theme goes on with the pushed item — before the browser
     paints the frame the item arrives in, so the box changes once. */
  useLayoutEffect(() => {
    const next = landing.current;
    if (!next) return;
    landing.current = null;
    setLiveTheme((current) => (sameTheme(current, next.theme) ? current : next.theme));
    resyncWall.current();
  }, [projector.delivery]);

  /*
   * Keep the LIVE box honest with the wall — read-only.
   *
   * At launch, and (debounced: a push writes a dozen theme keys, each one a
   * broadcast) whenever a theme setting changes anywhere. Nothing is ever
   * written from here: nothing about a launch is a press, and the wall
   * changing is not a reason to change it again.
   *
   * The URL is matched back to a card on the shelf; a picture the shelf has
   * never seen (chosen in Settings, left by an older build) is filed under
   * themes as "current background" so the box can draw it and the operator
   * can find it. A change made somewhere else is also adopted by the
   * preview — otherwise the next go live, which writes the preview's
   * background, would quietly put the old one back.
   */
  useEffect(() => {
    const api = window.api;
    if (!api?.getSettings) return;
    let gone = false;
    let first = true;
    let timer: number | undefined;
    let revision = 0;
    const soon = (ms = 100) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void sync(), ms);
    };
    const sync = async () => {
      const mine = ++revision;
      const settings = (await api.getSettings().catch(() => null)) as unknown as Record<string, unknown> | null;
      if (gone || mine !== revision || !settings) return;
      /* A push is on its way and its theme lands with it; look again after.
         One that has not landed in a few seconds failed, and the wall —
         which it did write — is the truth again. */
      const pending = landing.current;
      if (pending && Date.now() - pending.at < LANDING_GRACE_MS) {
        soon(LANDING_GRACE_MS - (Date.now() - pending.at) + 50);
        return;
      }
      landing.current = null;
      const raw = typeof settings.defaultBackgroundUrl === 'string' ? settings.defaultBackgroundUrl : '';
      const url = toDisplayUrl(raw);
      let backgroundId = wallUrlToMediaId(url, getMediaLibrary(), mediaSrc, liveThemeNow.current.backgroundId);
      if (backgroundId === undefined) {
        const card = wallBackgroundMedia(raw);
        addMedia(card);
        backgroundId = card.id;
      }
      const id = backgroundId;
      const elsewhere = !first && url !== wallBg.current;
      first = false;
      wallBg.current = url;
      setLiveTheme((current) => {
        const next = liveThemeFromSettings(settings, current, id);
        return sameTheme(next, current) ? current : next;
      });
      if (elsewhere) setPreviewTheme((prev) => (prev.backgroundId === id ? prev : { ...prev, backgroundId: id }));
    };
    resyncWall.current = () => soon();
    void sync();
    const off = api.onThemeChanged?.(() => soon());
    return () => {
      gone = true;
      window.clearTimeout(timer);
      off?.();
      resyncWall.current = () => undefined;
    };
  }, []);

  /*
   * The one way a background is chosen — from a card, a drop, a pick.
   *
   * Always into the preview, so the next go live (which writes the preview's
   * background) keeps it. 'live' also puts it on the wall now, and ONLY the
   * background: one setting, which repaints the picture and leaves the words
   * where they are — dimness, type and layout still wait for go live,
   * because changing those moves words people are reading. Standalone media
   * is replaced so it cannot keep covering the chosen background.
   *
   * Resolves to a sentence saying what happened, including when nobody will
   * see it yet (lib/backgroundDrop).
   */
  const projectorNow = useRef(projector);
  projectorNow.current = projector;
  const chooseBackground = useCallback<ChooseBackground>(async (id, where, how = 'drop') => {
    const media = getMediaLibrary().find((m) => m.id === id);
    if (!media) return 'that background is no longer on the shelf';
    setPreviewTheme((prev) => (prev.backgroundId === id ? prev : { ...prev, backgroundId: id }));
    const nextPreview = selectBackgroundContent(projectorNow.current.preview, media);
    if (nextPreview !== projectorNow.current.preview) projectorNow.current.stage(nextPreview);
    if (where === 'preview') {
      return previewBackgroundNotice(nextPreview, how);
    }
    const url = backgroundSrc(media, mediaSrc);
    wallBg.current = toDisplayUrl(url);
    setLiveTheme((prev) => (prev.backgroundId === id ? prev : { ...prev, backgroundId: id }));
    const api = window.api;
    if (api) await api.setSetting('defaultBackgroundUrl', url);
    const nextLive = selectBackgroundContent(projectorNow.current.live, media);
    if (nextLive.source === 'background') await projectorNow.current.sendBackground({ ...nextLive, source: 'background' });
    if (!api) return 'no engine here — only this window changed';
    const status = await api.getOutputsStatus?.().catch(() => undefined);
    const { screen } = projectorNow.current;
    return liveBackgroundNotice({ screen, live: nextLive, outputs: status?.outputs });
  }, []);

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
        /* Nobody chose it, so the first catch may take its place: as
           'operator' it blocked every catch from the preview box until the
           operator happened to stage something themselves. */
        origin: 'engine',
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
   * comes off the engine. The orb itself opens notification history;
   * changing demo states belongs to the design strip.
   */
  const stripLabel = LIVE_STATES.find((s) => s.id === state)?.label ?? null;
  const [pinned, setPinned] = useState<string | null>(stripLabel);
  useEffect(() => setPinned(stripLabel), [stripLabel]);

  // The orb and notifications use the same measured no-input condition.
  const quiet = useNotificationStore(s => s.entries.some(e => e.id === 'audio-signal' && e.status === 'active'));

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

  const [view, setView] = useState<ViewMode>(isEmptyPreview ? 'dashboard' : 'operator');
  const operatorRoot = useRef<HTMLDivElement>(null);
  const [orbSuggestion, setOrbSuggestion] = useState<OrbSuggestion | null>(null);
  const scriptureSearch = useRef<ScriptureReferenceInputHandle>(null);
  const skipOperatorEntryFocus = useRef(false);
  useOperatorTyping({ enabled: view === 'operator', root: operatorRoot, search: scriptureSearch, activeLibrary: TABS[tab]?.id, revealSearch: () => setTab(SCRIPTURES_TAB), skipNextEntryFocus: skipOperatorEntryFocus });
  const [settingsPage, setSettingsPage] = useState('S-10a');
  useEffect(() => {
    const live=projector.live;
    if (live?.source !== 'song') return;
    let current=true;
    if (live.id.includes('/')) useLibraryNavigation.getState().selectSong(live.id.split('/')[0]);
    else void window.api?.songs?.list().then(songs=>{
      const song=songs.find(song=>song.title===live.title);
      if(current && song) useLibraryNavigation.getState().selectSong(song.id);
    }).catch(()=>undefined);
    return ()=>{current=false;};
  }, [projector.live]);
  const libraryRequest = useLibraryNavigation(s => s.request);
  useEffect(() => {
    if (!libraryRequest) return;
    const item = libraryRequest.item;
    skipOperatorEntryFocus.current = true;
    setView('operator');
    const source = item.source === 'scripture' ? 'scriptures' : item.source === 'presentation' ? 'slides' : item.source === 'song' ? 'songs' : 'media';
    setTab(TABS.findIndex(t => t.id === source));
    // A mounted browser may already have resolved the exact slide in this commit.
    if (useLibraryNavigation.getState().request !== libraryRequest) return;
    if (item.source === 'scripture') projector.stage({source:'scripture',id:item.label,label:item.label,reference:item.label,origin:'operator'});
    else if (item.source === 'song') {
      if (item.songId) useLibraryNavigation.getState().selectSong(item.songId);
    } else if (item.path && item.source !== 'note') projector.stage({source:item.source,id:item.label,label:item.label,path:item.path,mediaKind:item.mediaKind,origin:'operator'});
  }, [libraryRequest]);
  const noticeRequest = useNoticeNavigation(s => s.request);
  useEffect(() => {
    const target = useNoticeNavigation.getState().target;
    if (!target) return;
    const settings: Record<string, string> = { keys: 'S-10k', speech: 'S-10b', displays: 'S-10f', cloud: 'S-10l', language: 'S-10c', recognition: 'S-10d', storage: 'S-10m' };
    if (settings[target]) { setSettingsPage(settings[target]); setView('settings'); useNoticeNavigation.getState().clear(); }
    else if (target === 'connections' || target === 'notes' || target === 'timers') setView('dashboard');
    else if (target === 'audio' || target === 'phone') {
      skipOperatorEntryFocus.current = true;
      setView('operator');
    }
    else if (target === 'media' || target === 'songs' || target === 'slides' || target === 'run') {
      // Follow the requested destination once, including Run's own focus.
      // Typing from a neutral area still opens the scripture search later.
      if (view !== 'operator') skipOperatorEntryFocus.current = true;
      setView('operator');
      if (target !== 'run') setTab(Math.max(0, TABS.findIndex(t => t.id === target)));
      if (target !== 'run') useNoticeNavigation.getState().clear();
    }
  }, [noticeRequest]);
  const [orbFocus, setOrbFocus] = useState<{ selector: string } | null>(null);
  const navigateOrb = (target: OrbDestination) => {
    const selectors = { preview: '.stage-go-live', 'live-controls': '.stage-output-control', listen: '[data-guide="listen"]' };
    if (target === 'preview' || target === 'live-controls' || target === 'listen') {
      skipOperatorEntryFocus.current = true;
      setView('operator');
      setOrbFocus({ selector: selectors[target] });
    } else useNoticeNavigation.getState().open(target);
  };
  useEffect(() => {
    if (!orbFocus || view !== 'operator') return;
    const frame = requestAnimationFrame(() => {
      const control = operatorRoot.current?.querySelector<HTMLElement>(orbFocus.selector);
      control?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      control?.focus({ preventScroll: true });
      setOrbFocus(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [orbFocus, view]);
  const openOnlineSettings = () => { setSettingsPage('S-10k'); setView('settings'); };
  const navigateGuide = (destination: GuideDestination): string => {
    skipOperatorEntryFocus.current = true;
    if (destination === 'notifications') return '[data-guide="notifications"]';
    if (destination === 'mobile') return '[data-guide="mobile-tools"]';
    const pages: Partial<Record<GuideDestination, string>> = { speech: 'S-10b', language: 'S-10c', cloud: 'S-10l', appearance: 'S-10g', church: 'S-10a', settings: 'S-10a' };
    if (pages[destination]) {
      setSettingsPage(pages[destination]!); setView('settings');
      return '[data-guide="settings-content"]';
    }
    if (destination === 'profile') { setView('profile'); return '[data-guide="workspace-view"]'; }
    if (['outputs', 'notes', 'timers', 'companion'].includes(destination)) {
      setView('dashboard');
      return `[data-guide="dashboard-${destination}"]`;
    }
    setView('operator');
    if (destination === 'audio' || destination === 'phone') return '[data-guide="audio-input"]';
    if (destination === 'run') return '[data-guide="run"]';
    const id = destination === 'scripture' ? 'scriptures' : destination === 'online' ? 'media' : destination;
    const index = TABS.findIndex(item => item.id === id);
    if (index >= 0) setTab(index);
    return `[data-guide="library-${id}"]`;
  };
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
   * The catches pane exists precisely so that answering a catch is a
   * deliberate act (see CatchesPane), and pushing here went behind it.
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
  /*
   * What it stages is what the spotlight in the verses card shows
   * (lib/catchSets): for references named in one breath that is the FIRST
   * one said — the one the preacher will read first — not the last one
   * heard.
   */
  const catchSent = useCatchStore((st) => st.sent);
  const catchPicked = useCatchStore((st) => st.picked);
  const pruneCatches = useCatchStore((st) => st.prune);
  const catchView = useMemo(() => catchEntries(engine.proposals, catchSent, catchPicked), [engine.proposals, catchSent, catchPicked]);
  const spotIndex = spotlightIndex(catchView);
  /* Caught verses are drawn in the verses card; on any other tab the one in
     the spotlight comes to the left card instead (CatchPeek), and the
     transcript it displaces rises along the foot of the window. */
  const catchesAway = TABS[tab]?.id !== 'scriptures' && catchView.length > 0;
  const latestProposal = spotIndex >= 0 ? catchView[spotIndex].current : undefined;
  const stagedKey = (proposal: Proposal) => `${proposal.id}:${proposal.reference}:${proposal.version}:${proposal.arrivedAt}`;
  const latestProposalKey = latestProposal ? stagedKey(latestProposal) : null;
  const lastStagedRef = useRef<string | null>(null);
  const proposalsForWithdrawal = useRef(engine.proposals);
  proposalsForWithdrawal.current = engine.proposals;
  const catchesNow = useRef({ sent: catchSent, picked: catchPicked });
  catchesNow.current = { sent: catchSent, picked: catchPicked };
  const withdrawnSuggestions = useRef(new Set<string>());
  /* What the spotlight shows once these verses are gone. A verse leaving —
     withdrawn by the engine, or out of time — must not put the one behind
     it into the preview box; only a verse arriving does that. */
  const spotlightWithout = (gone: (proposal: Proposal) => boolean) => {
    const rest = proposalsForWithdrawal.current.filter((proposal) => !gone(proposal) &&
      (!proposal.recognition || !withdrawnSuggestions.current.has(proposal.recognition.suggestionId)));
    const next = spotlightItem(rest, catchesNow.current.sent, catchesNow.current.picked);
    return next ? stagedKey(next) : null;
  };
  const withdrawRecognition = projector.withdrawRecognition;
  useEffect(() => window.api?.onRecognitionWithdrawn?.(({ suggestionId }) => {
    withdrawnSuggestions.current.add(suggestionId);
    lastStagedRef.current = spotlightWithout(() => false);
    withdrawRecognition(suggestionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [withdrawRecognition]);
  /* A catch whose six seconds ran out leaves the same way a withdrawn one
     does. The preview keeps whatever is in it — the verse the catch put
     there is still one press from the wall. */
  const onProposalExpired = engine.onProposalExpired;
  useEffect(() => onProposalExpired((id) => {
    lastStagedRef.current = spotlightWithout((proposal) => proposal.id === id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [onProposalExpired]);

  useEffect(() => {
    if (!latestProposal || latestProposal.missing || !latestProposal.reference) return;
    if (lastStagedRef.current === latestProposalKey) return;
    lastStagedRef.current = latestProposalKey;
    /* Never over the operator's own pick, and not again when it is already
       there (the catches pane stages the next verse of a set itself). Asked
       of the box as React applies it: this render's projector.preview can be
       stale by a step's own stage(next), still queued behind it. */
    projector.stageUnlessOperator({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestProposalKey, projector]);

  /* Verses waiting their turn in a set do not spend their six seconds until
     they are up (lib/catchSets) — held here rather than in the catches pane,
     so a set keeps its order while the verses card is not showing. */
  const holdProposal = engine.holdProposal;
  const queued = useMemo(() => new Set(queuedIds(catchView)), [catchView]);
  const queuedBefore = useRef(new Set<string>());
  useEffect(() => {
    for (const id of queued) if (!queuedBefore.current.has(id)) holdProposal(id, true, 'queued');
    for (const id of queuedBefore.current) if (!queued.has(id)) holdProposal(id, false, 'queued');
    queuedBefore.current = queued;
  }, [queued, holdProposal]);
  useEffect(() => {
    pruneCatches([...new Set(engine.proposals.map((proposal) => proposal.group))]);
  }, [engine.proposals, pruneCatches]);

  /* "search song" draws what it finds in the verses card, so pressing it
     brings that card up. */
  const songSearchOn = useSongListeningStore((st) => st.active);
  useEffect(() => {
    if (songSearchOn) setTab(SCRIPTURES_TAB);
  }, [songSearchOn]);

  /* The bar's contents. The log listens to the state so a change speaks
     for itself, and the one action any line offers lands back here. */
  const log = useServiceLog(stateLabel);
  const say = log.say;
  /* When listening fails the engine says why in a full sentence ("add a
     Deepgram key in Settings…"). The button has room for three words, so the
     sentence goes to the log, where there is room to read it. */
  useEffect(() => {
    if (engine.asr === 'error' && engine.asrMessage) say({ text: engine.asrMessage });
    /* The practice sermon names what each line tests, or what to press, as
       it starts (shared/practiceSermon.ts). */
    else if (/^listening — practice/i.test(engine.asrMessage)) say({ text: engine.asrMessage.replace(/^listening — /i, '') });
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
  const goManual = useCallback(() => useNoticeNavigation.getState().open('speech'), []);

  /*
   * A media card let go over a background target (see RunDragBridge).
   *
   *   themes toggle  a still is filed under themes and previewed
   *   PREVIEW        a still is previewed; a clip is staged as content
   *   LIVE           a still goes behind the words on the wall now
   *
   * The stage boxes never move a card between shelves — an announcement
   * photo used once as a background is still an announcement photo. What
   * happened is said in the service log, beside the boxes it happened to.
   */
  const dropMedia = useCallback(async (key: BackgroundDropKey, media: ThemeMedia | undefined): Promise<string> => {
    const action = backgroundDropAction(key, media);
    if (!media || action === 'refuse') return 'that background is no longer on the shelf';
    if (key === 'media-themes') addMedia({ ...media, collection: 'themes' });
    const text = await chooseBackground(media.id, action, 'drop');
    return key === 'media-themes' ? `added to themes · ${text}` : text;
  }, [chooseBackground, projector]);
  useEffect(() => {
    if (!backgroundDrop) return;
    backgroundDrop.current = (key, item) => {
      void dropMedia(key, getMediaLibrary().find((m) => m.id === item.mediaId)).then((text) => say({ text }));
    };
    return () => {
      backgroundDrop.current = null;
    };
  }, [backgroundDrop, dropMedia, say]);

  /*
   * Files from Finder let go over the PREVIEW or the LIVE box: onto the
   * shelf first (pictures under themes, clips under media, anything already
   * there left where it is), then exactly what dropping that card there
   * does — the first still, or on the preview a clip when there is none.
   * One line in the log says both halves.
   */
  const dropFiles = useCallback((key: FinderStageKey, paths: string[], count: number) => {
    if (!paths.length) {
      say({ text: count ? 'drag the files themselves from Finder' : 'nothing to add there' });
      return;
    }
    void (async () => {
      /* A picture lands in a blink; a folder of clips does not, and a box
         that says nothing for ten seconds reads as a drop that missed. So
         a slow one says it has started — once, to keep the log quiet. */
      const slow = window.setTimeout(() => say({ text: paths.length > 1 ? `adding ${paths.length}…` : 'adding…' }), 800);
      const { cards, notice } = await addFromLaptop({ paths, wanted: 'themes' }).finally(() => window.clearTimeout(slow));
      const pick = finderStagePick(key, cards);
      if (!pick) {
        say({ text: notice });
        return;
      }
      /* Apply the imported background without replacing the staged words. */
      const done = await dropMedia(key, pick);
      say({ text: `${notice} · ${done}` });
    })();
  }, [dropMedia, say]);

  /* The preview's background was deleted from the shelf: another themes
     still, chosen now, so the preview and the next go live agree on it. */
  const backgroundGone = useCallback(() => {
    const next = backgroundFor('', getMediaLibrary());
    setPreviewTheme((prev) => ({ ...prev, backgroundId: next?.id ?? NO_BACKGROUND }));
    return next?.label;
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
        ref={operatorRoot}
        data-guide-area="operator"
        className={cx(
          'grid h-full w-full min-w-0 gap-[var(--tri-gap)]',
          'tri-workspace-aurora',
          (viewport.h < 650 || viewport.w < 1100) && 'operator-compact',
          viewport.h <= 560 && 'operator-short',
          viewport.h <= 460 && 'operator-tight',
        )}
        style={{
          '--tri-gap': '5px',
          padding: 'var(--tri-gap)',
          // Keep the run readable when the window is narrower than a booth monitor.
          '--tri-rail-w': 'clamp(160px, 20%, 300px)',
          '--tri-topbar-h': 'calc(var(--tri-field-h) + 4px)',
          '--operator-footer-h': `${Math.max(38, Math.min(58, viewport.h * 0.07))}px`,
          '--stage-control-rows': viewport.w < 1200 ? 2 : 1,
          gridTemplateColumns: 'var(--tri-rail-w) minmax(0, 1fr)',
          gridTemplateRows: `var(--tri-topbar-h) minmax(0, auto) minmax(${BROWSER_FLOOR}, 1fr) auto`,
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
          <div className="tri-header-ambient">
            <OrbActions state={stateLabel} hasPreview={!!projector.preview && (!projector.live || liveKey(projector.preview) !== liveKey(projector.live))} previewKey={liveKey(projector.preview)} onNavigate={navigateOrb} onSuggestionChange={setOrbSuggestion} />
            <NotificationCenter statusMessage={{ key: stateLabel, text: nextOrbPhrase(stateLabel) }}
              portrait={<OrbPortrait label={stateLabel} />}
              renderTrigger={notification => <StatusOrb label={stateLabel} notification={notification} suggestion={orbSuggestion} />} />
          </div>
          <div className="min-w-0 flex-1" />
          {/* Suggested actions align with the preview; service controls stay right. */}
          <MobileMenu />
          <DigitalClockBento />
          <ProductGuide onNavigate={navigateGuide} />
        </div>

        {view === 'dashboard' || view === 'profile' || view === 'settings' ? (
          /* The bento is the whole dashboard — the log is a card in it.
              Profile borrows this same frame: it is read rather than
              worked, like the dashboard, so it wants the header and the
              full width, not the operator's rail-and-stage grid. */
          <div data-guide="workspace-view" data-guide-area={view} className="col-span-2 row-span-3 flex min-h-0 min-w-0 flex-col gap-[var(--tri-gap)]">
            {view === 'settings' ? (
              /* The same surface the sandbox draws, given the posture's
                 full width. It brings its own nine-page rail, so it wants
                 the frame without the bento's padding. */
              <div className="min-h-0 flex-1 overflow-hidden">
                <SettingsSurface key={`${settingsPage}:${noticeRequest}`} pageId={settingsPage} />
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
          <OperatorRail
            run={
            /* The run scrolls within its equal starting share of the rail. */
            <div data-guide="run" data-guide-area="run" data-drop-segment="" className="operator-run-panel relative min-h-0 flex-1">
            <Panel
              title={`run of show (${run.segments.length})`}
              className="operator-empty absolute inset-0 !bg-transparent"
              style={{ borderRadius: 0, boxShadow: 'none' }}
              bodyStyle={{ padding: 0 }}
            >
              <RunOfService
                say={say}
                fallbackSongs={isEmptyPreview ? [] : SONGS}
              />
            </Panel>
            </div>
            }
            transcript={
            <Panel
              className="min-h-0 !bg-transparent"
              style={{ borderRadius: 0, boxShadow: 'none' }}
              bodyClass="flex flex-col"
              bodyStyle={{ padding: 'var(--tri-card-gap)' }}
            >
              <div className="operator-empty min-h-0 flex-1 overflow-y-auto">
                {/* Away from the verses card, a catch comes here instead,
                    and the transcript rises along the foot of the window
                    until it has gone — see CatchPeek and the strip below. */}
                {catchesAway
                  ? <CatchPeek onOpen={() => setTab(SCRIPTURES_TAB)} />
                  : <CatchesTranscript onOpenTranscript={() => setView('dashboard')} />}
              </div>
              <div className="shrink-0" style={{ paddingTop: 'var(--tri-card-gap)' }}>
                <CatchActions />
              </div>
            </Panel>
            }
            listen={<ListeningSign />}
          />

          <div data-library-workspace className="row-span-3 grid min-h-0 min-w-0 grid-rows-subgrid">
            {/* The stage row is held at the pictures' natural size by the
                sizer; the column itself is one flow across all three rows,
                so a smaller stage hands its height to the browser here and
                nowhere else. The browser's floor is its row's, plus the
                ticker's row it also spans — which is what keeps the two
                columns on one line on a window too short for the stage. */}
            <StageSizer />
            <div className="flex min-h-0 min-w-0 flex-col" style={{ gridArea: '1 / 1 / -1 / 2' }}>
            <div className="flex min-h-0 min-w-0 flex-col">
            <Stage
              transition={textTransition}
              say={say}
              editingTheme={TABS[tab]?.id === 'themes'}
              onThemeChange={setPreviewTheme}
              previewTheme={previewTheme}
              liveTheme={liveTheme}
              onFiles={dropFiles}

            />

            </div>

            {/* The browser and, under it, the transcript strip — one cell
                across the browser's row and the ticker's, so the browser
                runs to the foot of the window while the strip is away and
                gives the height back as it rises. */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ minHeight: BROWSER_FLOOR }}>
            <div className="flex min-h-0 min-w-0 flex-1 gap-[var(--tri-gap)]">
            <LibraryTabs tab={tab} onChange={setTab} />
            <Panel
              className="min-h-0 min-w-0 flex-1 !bg-[#111111]"
              /* Each theme control supplies its own heading and content inset. */
              bodyClass={TABS[tab]?.id === 'themes' ? undefined : TABS[tab]?.id === 'songs' || TABS[tab]?.id === 'slides' ? 'pt-4' : 'pt-3'}
              bodyStyle={TABS[tab]?.id === 'themes' ? { padding: 0 } : ['scriptures', 'songs', 'slides', 'media'].includes(TABS[tab]?.id) ? { paddingTop: 'var(--tri-card-gap)' } : undefined}
            >
              {TABS[tab]?.id === 'themes' ? (
                <ThemesEditor
                  tx={textTransition}
                  theme={previewTheme}
                  onChange={setPreviewTheme}
                  onReset={() => setPreviewTheme(DEFAULT_THEME)}
                />
              ) : null}
              {TABS[tab]?.id === 'scriptures' ? <ScripturesBrowser searchRef={scriptureSearch} /> : null}
              {TABS[tab]?.id === 'songs' ? <SongsBrowser /> : null}
              {TABS[tab]?.id === 'slides' ? <SlidesBrowser /> : null}
              {TABS[tab]?.id === 'media' ? (
                /* Choosing a background keeps the library on media: the
                   next thing the operator does is often the double-click
                   that puts it on the wall. */
                <MediaBrowser
                  onOpenSettings={openOnlineSettings}
                  selected={previewTheme.backgroundId}
                  live={liveTheme.backgroundId}
                  onChoose={chooseBackground}
                  onBackgroundGone={backgroundGone}
                />
              ) : null}
            </Panel>
            </div>

            {/* The live transcript, along the foot of the window — only while
                a caught verse holds the left card, which is where the
                transcript otherwise lives (owner, 2026-10-07: on a tab other
                than verses, the catch goes to the left card and the
                transcript comes up from the bottom). It grows up out of the
                bottom edge when the card is taken and sinks back when the
                card is free again; the rest of the time there is no strip
                here at all, not even an empty one. Under the right-hand
                column only: the owner does not want it under the rail. */}
            <div className="tri-strip-rise" data-open={catchesAway || undefined} aria-hidden={!catchesAway}>
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
          </div>
        </ViewEnter>
      )}
      </div>

      {/* A catch's signal, for an operator who is not looking at it — the
          app's edges, or the whole screen from another app (CatchSignals). */}
      <AutoAdvance />
      <CatchSignals view={view} tab={TABS[tab]?.id ?? ''} />

    </>
  );
}
