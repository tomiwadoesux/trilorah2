/**
 * Global declaration of the `window.api` bridge exposed by the Electron
 * preload script (recovery/preload.js is the authoritative surviving
 * contract; payload shapes were confirmed against the surviving main-process
 * bundle where possible, and typed pragmatically otherwise).
 *
 * This file is intentionally a script (no top-level import/export) so every
 * interface here is ambient — screens use these types without imports.
 *
 * Members marked optional (`?`) are the UPCOMING IPC surface being added to
 * the main process; always consume them defensively:
 *   window.api?.getPreacherStats?.()
 *
 * `window.api` itself is optional so the renderer typechecks — and renders —
 * in a plain browser with no Electron present.
 */

type Unsubscribe = () => void;

/** Stock backgrounds — mirrors electron/media/stockImages.ts. */
type StockKind = 'photo' | 'video';
type StockProvider = 'pixabay' | 'pexels';
interface StockItem {
  id: string;
  provider: StockProvider;
  kind: StockKind;
  thumb: string;
  preview: string;
  full: string;
  width: number;
  height: number;
  duration?: number;
  credit: string;
  pageUrl: string;
  tags: string;
}
interface StockSearchParams {
  query: string;
  kind?: StockKind;
  page?: number;
  provider?: StockProvider;
}
interface StockSearchResult {
  items: StockItem[];
  page: number;
  total: number;
  provider: StockProvider;
  cached: boolean;
}

/** Generic success/error envelope used by most invoke handlers. */
interface OpResult {
  success: boolean;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Scripture                                                           */
/* ------------------------------------------------------------------ */

interface ChapterVerse {
  /** Verse number within the chapter. */
  id: number;
  /** e.g. "John 3:16" */
  ref: string;
  text: string;
  version: string;
}

interface ChapterResult {
  success: boolean;
  data?: ChapterVerse[];
  error?: string;
}

interface VerseSearchResult {
  success: boolean;
  data: { text: string; version: string } | null;
  error?: string;
}

/** A detected scripture reference flowing out of the engine. */
interface VerseDetection {
  book: string;
  chapter: number;
  verse: number | null;
  endVerse?: number | null;
  confidence?: number;
  source?: string;
  isPreview?: boolean;
  version?: string;
}

/* ------------------------------------------------------------------ */
/* Service / segments / schedule                                       */
/* ------------------------------------------------------------------ */

type SegmentType =
  | 'pre-service'
  | 'worship'
  | 'announcements'
  | 'offering'
  | 'sermon'
  | 'altar-call'
  | 'closing'
  | 'prayer'
  | (string & {});

interface ScheduleEntry {
  type: SegmentType;
  title?: string;
  time?: string;
  notes?: string;
  /** Schedule may pin a preacher to the sermon slot. */
  preacherId?: string;
}

interface SegmentChange {
  type: SegmentType;
  startedAt: number;
  confidence: number;
  previous?: SegmentType;
}

interface ScheduleImportResult {
  canceled: boolean;
  success?: boolean;
  entries?: ScheduleEntry[];
  unmatchedLines?: string[];
  rawText?: string;
  error?: string;
}

interface ScheduleSuggestionSegment {
  type: SegmentType;
  avgDurationMinutes: number;
  occurrenceCount: number;
}

interface ScheduleSuggestion {
  segments: ScheduleSuggestionSegment[];
  basedOnServices: number;
  /** 0..1 */
  confidence: number;
  modalMatch: boolean;
}

/* ------------------------------------------------------------------ */
/* Sermon notes                                                        */
/* ------------------------------------------------------------------ */

interface SermonNotePoint {
  title: string;
  scriptures?: string[];
  content?: string;
}

interface SermonNotes {
  title?: string;
  theme?: string;
  points?: SermonNotePoint[];
  definitions?: { term: string; definition: string }[];
  applications?: string[];
  quotes?: string[];
  [key: string]: unknown;
}

/** Incremental snapshot emitted while the sermon is still in progress. */
interface NotesSnapshot {
  title?: string;
  theme?: string;
  currentPoints: {
    heading: string;
    explanation: string;
    scriptures: string[];
  }[];
  definitions: { term: string; definition: string }[];
  quotes: string[];
  applications: string[];
}

/* ------------------------------------------------------------------ */
/* Preachers / trust / review                                          */
/* ------------------------------------------------------------------ */

interface PreacherProfileSummary {
  id: string;
  name: string;
}

/** Per-preacher adaptation state surfaced to the UI. */
interface PreacherStats {
  id: string;
  name: string;
  samples: number;
  services: number;
  /** 0..1 fraction. */
  precision: number;
  /** Wilson lower bound on precision — the number the auto-mode gate uses. */
  trustLowerBound: number;
  autoModeEligible: boolean;
  /** Mature profiles stop prompting for corrections. */
  mature: boolean;
  correctionsLastService: number;
}

interface VerseRef {
  book: string;
  chapter: number;
  verse: number | null;
}

type ReviewResolution = 'confirmed' | 'rejected' | 'amended';

/** One uncertain moment queued for the end-of-service operator review. */
interface ReviewItem {
  id: string;
  ts: number;
  kind: 'detection' | 'correction' | 'quote' | 'segment';
  heard: string;
  proposed: VerseRef | null;
  resolution?: ReviewResolution;
  amendedTo?: VerseRef;
}

interface VerseQueueItem {
  /** e.g. "Romans 8:28" */
  ref: string;
  /** Why it was queued instead of shown, e.g. "we'll come back to that". */
  reason: string;
  ts: number;
}

/* ------------------------------------------------------------------ */
/* Voice commands / engine state                                       */
/* ------------------------------------------------------------------ */

type VoiceCommandKind =
  | 'correction-verse'
  | 'correction-chapter'
  | 'navigate-next'
  | 'navigate-previous'
  | 'display-dismiss'
  | 'display-hold'
  | 'version-switch'
  | 'prayer-start'
  | 'prayer-end'
  | (string & {});

interface VoiceCommandEvent {
  kind: VoiceCommandKind;
  /** The transcript fragment that triggered the command. */
  utterance: string;
  /** e.g. corrected verse number, or a version code like "KJV". */
  value?: string | number;
  ts: number;
}

type ASRStatus = 'idle' | 'connecting' | 'listening' | 'error' | 'stopped';

type IntentState = 'idle' | 'intent' | 'reference' | 'reading' | 'commentary';

interface ExternalCommand {
  command: string;
  value?: string;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

interface AppSettings {
  deepgramApiKey?: string;
  hfToken?: string;
  agentEnabled?: boolean;
  autoDisplayTimeout?: number;
  falsePositiveFilterEnabled?: boolean;
  slowPathEnabled?: boolean;
  batchIntervalMs?: number;
  mlModel?: string;
  serviceSchedule?: ScheduleEntry[];
  serviceStartTime?: string;
  serviceEndTime?: string;
  activePreacherId?: string;
  obsEnabled?: boolean;
  obsHost?: string;
  obsPort?: number;
  obsPassword?: string;
  vmixEnabled?: boolean;
  vmixHost?: string;
  vmixPort?: number;
  churchName?: string;
  publicWebUrl?: string;
  accountSlug?: string;
  givingZelle?: string;
  givingVenmo?: string;
  givingCashApp?: string;
  givingPaypal?: string;
  givingBankInfo?: string;
  givingCustomUrl?: string;
  givingNote?: string;
  /* Keys expected from today's main-process work (names guessed). */
  asrProvider?: 'deepgram' | 'whisper-local' | (string & {});
  notesProvider?: 'cloud' | 'local' | (string & {});
  defaultVersion?: string;
  seasonalThemingEnabled?: boolean;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/* Streaming (OBS / vMix)                                              */
/* ------------------------------------------------------------------ */

interface ObsStatus {
  enabled: boolean;
  connected?: boolean;
  scenes?: unknown;
  error?: string;
  [key: string]: unknown;
}

interface VmixStatus {
  enabled: boolean;
  reachable?: boolean;
  error?: string;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/* Cloud                                                               */
/* ------------------------------------------------------------------ */

interface CloudStatus {
  configured: boolean;
  signedIn: boolean;
  hasAccount?: boolean;
  email?: string | null;
  activeServiceId?: string | null;
}

interface CloudOpResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/* Library folders                                                     */
/* ------------------------------------------------------------------ */

type LibraryId = 'presentations' | 'songs' | 'media';

/** Mirrors `Folder` in electron/library/folders.ts. */
interface LibraryFolder {
  id: string;
  name: string;
  color?: string;
  order: number;
  createdAt: number;
}

/**
 * One row per folder plus a `folderId: null` row for the unfoldered items,
 * so a sidebar can render counts without counting anything itself.
 */
interface LibraryFolderStats {
  folderId: string | null;
  name: string;
  count: number;
}

interface LibraryFoldersApi {
  /**
   * Passing `itemIds` also prunes mappings for items that no longer exist —
   * the folder index is an overlay and never learns about deletions on its
   * own, so the caller that knows the live ids is the one that tells it.
   */
  list(libraryId: LibraryId, itemIds?: string[]): Promise<{ folders: LibraryFolder[]; stats: LibraryFolderStats[] }>;
  create(libraryId: LibraryId, name: string): Promise<LibraryFolder>;
  rename(libraryId: LibraryId, id: string, name: string): Promise<LibraryFolder>;
  setColor(libraryId: LibraryId, id: string, color: string): Promise<LibraryFolder>;
  /** Deleting a folder never deletes items — they fall back to unfoldered. */
  remove(libraryId: LibraryId, id: string): Promise<void>;
  moveItem(libraryId: LibraryId, itemId: string, folderId: string | null): Promise<void>;
  reorder(libraryId: LibraryId, ids: string[]): Promise<LibraryFolder[]>;
  of(libraryId: LibraryId, itemId: string): Promise<string | null>;
}

/* ------------------------------------------------------------------ */
/* Songs                                                               */
/* ------------------------------------------------------------------ */

/**
 * The song types live in shared/types.ts (the stored record) and
 * electron/songs/import.ts (the parser output). They are pulled in with
 * `import(...)` expressions rather than top-level imports so this file stays
 * an ambient script — one top-level import would turn it into a module and
 * every interface above would stop being global.
 */
type ImportedSong = import('../../electron/songs/import').ImportedSong;
type Song = import('../../shared/types').Song;
type SongSection = import('../../shared/types').SongSection;
type SongOrigin = import('../../shared/types').SongOrigin;
type SongPatch = import('../../shared/types').SongPatch;
type SongDuplicate = import('../../shared/types').SongDuplicate;
type SongImportResult = import('../../shared/types').SongImportResult;

/**
 * What `importFiles()` returns — parsed only; nothing has reached the library
 * yet. The UI shows the duplicate review off this, then calls `importCommit`.
 */
interface SongParseResult {
  success: boolean;
  canceled?: boolean;
  songs?: ImportedSong[];
  /**
   * Files that could not be read or parsed, named individually. One unreadable
   * file in a folder of exports never stops the other thirty-nine, so a
   * non-empty `errors` alongside a full `songs` is a normal outcome.
   */
  errors?: { file: string; error: string }[];
}

interface SongsApi {
  list(): Promise<Song[]>;
  /**
   * Why the library may be lying to you, or null when it is not.
   *
   * A songs.json the store could not parse leaves it read-only holding an
   * empty list, so an empty library is ambiguous until this is checked: a
   * fresh install and a truncated file look identical otherwise, and the
   * wrong guess has a church re-importing four hundred songs over a file
   * that still has them in it.
   */
  problem(): Promise<string | null>;
  /** Null when there is no such song — a normal answer, not an error. */
  get(id: string): Promise<Song | null>;
  add(song: ImportedSong): Promise<Song>;
  /** Null when the id is unknown or the patch is rejected (e.g. a blank title). */
  update(id: string, patch: SongPatch): Promise<Song | null>;
  /** False when the id was already gone. Deleting a seeded hymn is permanent. */
  remove(id: string): Promise<boolean>;
  importText(text: string, filename?: string): Promise<ImportedSong>;
  /** Opens the native picker and parses. Writes nothing — follow with `importCommit`. */
  importFiles(): Promise<SongParseResult>;
  /**
   * The write step. Everything passed in is imported; likely duplicates come
   * back named in the report rather than dropped, for the operator to settle.
   */
  importCommit(songs: ImportedSong[]): Promise<SongImportResult>;
}

/* ------------------------------------------------------------------ */
/* The bridge                                                          */
/* ------------------------------------------------------------------ */

interface WindowApi {
  /* Scripture ------------------------------------------------------ */
  getChapter(bookId: number, chapter: number, version?: string): Promise<ChapterResult>;
  getAvailableVersions(): Promise<string[]>;
  getDbStatus?(): Promise<{ connected: boolean; verses?: number; error?: string }>;
  searchVerse(book: string, chapter: number, verse: number, version?: string): Promise<VerseSearchResult>;

  /* Engine events --------------------------------------------------- */
  onTranscriptUpdate(callback: (text: string) => void): Unsubscribe;
  /** Punctuated transcript lines, each marked final or still growing. */
  onTranscriptLine?(callback: (line: { text: string; isFinal: boolean }) => void): Unsubscribe;
  onVersePreview(callback: (detection: VerseDetection) => void): Unsubscribe;
  onVerseDetected(callback: (detection: VerseDetection) => void): Unsubscribe;
  onAudioLevel(callback: (level: number) => void): Unsubscribe;
  onShowCleanBackground(callback: () => void): Unsubscribe;
  onSegmentChanged(callback: (data: SegmentChange) => void): Unsubscribe;
  onMediaSuggestion(callback: (data: unknown) => void): Unsubscribe;
  onVerseAutoDismiss(callback: () => void): Unsubscribe;
  onNotesUpdated(callback: (snapshot: NotesSnapshot) => void): Unsubscribe;
  onExternalCommand(callback: (data: ExternalCommand) => void): Unsubscribe;

  /* Audio / display control ----------------------------------------- */
  startListening(deviceLabel?: string): void;
  stopListening(): void;
  sendText(text: string): void;
  pushToLive(): void;
  openOutput(outputId?: string | number): void;

  /* Presentations ---------------------------------------------------- */
  importPresentation(): Promise<any>;
  importGeneratedPresentation(payload: any): Promise<any>;
  deletePresentation(payload: any): Promise<any>;
  savePresentations(presentations: any[]): Promise<any>;
  loadPresentations(): Promise<any[]>;

  /* Images / OCR ----------------------------------------------------- */
  readImageDataUrl(imagePath: string): Promise<string | null>;
  ocrProcessImage(imagePath: string): Promise<{ success: boolean; text?: string; keywords?: string[]; error?: string }>;
  ocrProcessImages(imagePaths: string[]): Promise<any>;

  /* Sermon transcript & notes ---------------------------------------- */
  getSermonTranscript(): Promise<string>;
  getServiceLog(): Promise<any[]>;
  saveServiceSummary(): Promise<{ success: boolean; path?: string; error?: string }>;
  generateSermonNotes(): Promise<SermonNotes>;
  exportSermonNotesPdf(notes: SermonNotes): Promise<{ success: boolean; path?: string; error?: string }>;
  exportSermonNotesMd(notes: SermonNotes): Promise<{ success: boolean; path?: string; error?: string }>;

  /* Settings ---------------------------------------------------------- */
  getSettings(): Promise<AppSettings>;
  getSetting(key: string): Promise<unknown>;
  setSetting(key: string, value: unknown): Promise<boolean>;

  /* Service agent ------------------------------------------------------ */
  setServiceSchedule(schedule: (ScheduleEntry | string)[]): void;
  setCurrentSongLyrics(lyrics: string): void;
  setSermonPlan(jsonOrPath: string): Promise<{ success: boolean; title?: string; verseCount?: number; error?: string }>;
  endService(opts?: { preacherName?: string; sermonTitle?: string }): Promise<{
    success: boolean;
    versesDetected?: number;
    profileUpdated?: boolean;
    error?: string;
  }>;

  /* Preacher profiles --------------------------------------------------- */
  setActivePreacher(preacherId: string): Promise<{ success: boolean; name?: string; error?: string }>;
  listPreacherProfiles(): Promise<PreacherProfileSummary[]>;
  createPreacherProfile(id: string, name: string): Promise<{ success: boolean; id?: string; error?: string }>;
  deletePreacherProfile(id: string): Promise<{ success: boolean }>;

  /* Streaming — OBS Studio ----------------------------------------------- */
  obsConnect(): Promise<OpResult>;
  obsDisconnect(): Promise<OpResult>;
  obsStatus(): Promise<ObsStatus>;
  obsSetScene(sceneName: string): Promise<OpResult>;
  obsSetBrowserSourceUrl(sourceName: string, url: string): Promise<OpResult>;

  /* Streaming — vMix ------------------------------------------------------ */
  vmixStatus(): Promise<VmixStatus>;
  vmixSetActive(input: number | string): Promise<OpResult>;
  vmixOverlay(channel: number, action: 'in' | 'out', input?: number | string): Promise<OpResult>;
  vmixSetTitleText(input: number | string, selectedName: string, value: string): Promise<OpResult>;

  /* Schedule import / learning --------------------------------------------- */
  importScheduleImage(): Promise<ScheduleImportResult>;
  scheduleSuggestion(): Promise<{ success: boolean; suggestion?: ScheduleSuggestion | null; error?: string }>;
  applyScheduleSuggestion(): Promise<{ success: boolean; entries?: ScheduleEntry[]; error?: string }>;

  /* Cloud (Supabase) --------------------------------------------------------- */
  cloudStatus(): Promise<CloudStatus>;
  cloudSignIn(email: string, password: string): Promise<CloudOpResult>;
  cloudSignUp(email: string, password: string, accountName?: string): Promise<CloudOpResult>;
  cloudSignOut(): Promise<CloudOpResult>;
  cloudStartService(opts?: Record<string, unknown>): Promise<CloudOpResult & { serviceId?: string }>;
  cloudEndService(): Promise<CloudOpResult>;
  cloudMarkVersePushed(verseId: string): Promise<{ success: boolean }>;
  cloudUpsertNotes(notes: SermonNotes | Record<string, unknown>): Promise<{ success: boolean }>;
  cloudSyncGiving(methods: Record<string, unknown>): Promise<{ success: boolean }>;
  cloudGenerateLinkCode(): Promise<{ success?: boolean; code?: string; expiresAt?: string; error?: string; [key: string]: unknown }>;
  cloudRedeemLinkCode(code: string): Promise<CloudOpResult>;
  cloudCompleteAccountSetup(churchName: string, slug: string): Promise<CloudOpResult>;
  cloudFetchMyAccount(): Promise<{ name?: string; slug?: string; [key: string]: unknown } | null>;
  cloudFetchPastors(): Promise<any[]>;
  cloudFetchCampuses(): Promise<any[]>;
  cloudFetchRecentServices(): Promise<any[]>;
  cloudFetchRecentNotes(): Promise<any[]>;
  cloudFetchAudienceSessions(): Promise<any[]>;
  cloudRunRetentionCleanup(): Promise<any>;
  cloudVerifyPassword(password: string): Promise<any>;
  cloudSignOutAllDevices(): Promise<CloudOpResult>;

  /* ------------------------------------------------------------------ */
  /* UPCOMING IPC — being added to the main process; may be absent.      */
  /* Always call as window.api?.method?.().                              */
  /* ------------------------------------------------------------------ */
  getPreacherStats?(preacherId?: string): Promise<PreacherStats[]>;
  getReviewItems?(): Promise<ReviewItem[]>;
  resolveReviewItem?(id: string, resolution: ReviewResolution, amendedTo?: VerseRef): Promise<void>;
  getVerseQueue?(): Promise<VerseQueueItem[]>;
  showQueuedVerse?(ref: string): Promise<{ success: boolean }>;
  setDisplayVersion?(version: string): Promise<void>;
  getSeasonalTheme?(): Promise<string>;
  getNotesProviderStatus?(): Promise<{ id: string; status: string }>;
  getAvailableLanguages?(): Promise<Array<{ code: string; label: string }>>;
  getVoiceCommandConfig?(): Promise<{ merged: any; user: any; filePath: string }>;
  saveVoiceCommandConfig?(userConfig: any): Promise<{ success: boolean }>;
  // Window-mic capture (SoX-free audio path)
  requestMicPermission?(): Promise<{ granted: boolean; error?: string }>;
  sendAudioChunk?(chunk: ArrayBuffer): void;
  sendAudioLevel?(level: number): void;
  onMicRequest?(callback: (req: { sampleRate: number; deviceLabel?: string }) => void): Unsubscribe;
  onMicStop?(callback: () => void): Unsubscribe;
  // Media on outputs + themes
  pickBackgroundImage?(): Promise<{ success: boolean; url?: string; canceled?: boolean; error?: string }>;
  // Stock backgrounds — electron/media/stockImages.ts
  getStockProviders?(): Promise<StockProvider[]>;
  searchStock?(
    params: StockSearchParams,
  ): Promise<({ success: true } & StockSearchResult) | { success: false; error: string }>;
  /** `url` is file:// (what the theme stores); `src` is local-media:// (what an <img> can load). */
  downloadStock?(payload: { item: StockItem; apply?: boolean }): Promise<{ success: boolean; url?: string; src?: string; error?: string }>;
  showMedia?(imagePath: string): Promise<{ success: boolean }>;
  clearMedia?(): Promise<{ success: boolean }>;
  /** Render the companion QR (publicWebUrl + accountSlug) on every open output. */
  showQr?(): Promise<{ success: boolean; url?: string; error?: string }>;
  /**
   * The companion code as SVG markup, for drawing inside the app.
   * `svg`/`url` are null when no link is configured yet — a normal state,
   * not an error.
   */
  getQrSvg?(size?: number): Promise<{
    success: boolean;
    url?: string | null;
    svg?: string | null;
    error?: string;
  }>;
  onShowMedia?(callback: (imagePath: string) => void): Unsubscribe;
  onThemeChanged?(callback: () => void): Unsubscribe;
  onVoiceCommand?(callback: (event: VoiceCommandEvent) => void): Unsubscribe;
  onVersionChanged?(callback: (version: string) => void): Unsubscribe;
  onQueueUpdated?(callback: (queue: VerseQueueItem[]) => void): Unsubscribe;
  onPrayerMode?(callback: (active: boolean) => void): Unsubscribe;
  onIntentState?(callback: (state: IntentState) => void): Unsubscribe;
  /**
   * The surviving main bundle emits "on-asr-status" but the surviving
   * preload never exposed it — declared optional in case the new preload
   * adds it. The UI also tracks status optimistically from start/stop.
   */
  onAsrStatus?(callback: (status: ASRStatus) => void): Unsubscribe;

  /* Outputs, alerts, keyword search — 2026-09-08 (BUILD-MAP 2.10–2.13) */
  setScreenState?(state: ScreenState): Promise<ScreenState>;
  getScreenState?(): Promise<ScreenState>;
  onScreenState?(callback: (state: ScreenState) => void): Unsubscribe;
  getOutputRole?(outputId: string): Promise<OutputRole>;
  showAlert?(
    text: string,
    opts?: { target?: AlertTarget; durationSec?: number | null; values?: Record<string, string> },
  ): Promise<ScreenAlert | null>;
  dismissAlert?(): Promise<boolean>;
  getAlert?(): Promise<ScreenAlert | null>;
  onAlert?(callback: (alert: ScreenAlert | null) => void): Unsubscribe;
  searchBibleText?(query: string, opts?: { version?: string; limit?: number }): Promise<BibleSearchHit[]>;

  /* Library folders (BUILD-MAP 1.12) */
  folders?: LibraryFoldersApi;

  /* Songs — import (backlog 23) and the library behind it (BUILD-MAP 1.11) */
  songs?: SongsApi;
  /** Parse pasted text. Equivalent to `songs.importText`; kept for callers that predate the namespace. */
  importSongText?(text: string, filename?: string): Promise<ImportedSong>;
  /** Equivalent to `songs.importFiles`; kept for callers that predate the namespace. */
  importSongFiles?(): Promise<SongParseResult>;

  /* Timers + message tokens — 2026-09-09 (BUILD-MAP 2.16–2.17) */
  listTimers?(): Promise<TimerSnapshot[]>;
  createTimer?(input: {
    name?: string;
    kind: TimerKind;
    durationSec?: number;
    targetTime?: string;
    overrun?: boolean;
  }): Promise<TimerRecord | null>;
  updateTimer?(id: string, patch: Record<string, unknown>): Promise<TimerRecord | null>;
  removeTimer?(id: string): Promise<boolean>;
  startTimer?(id: string): Promise<TimerRecord | null>;
  pauseTimer?(id: string): Promise<TimerRecord | null>;
  resetTimer?(id: string): Promise<TimerRecord | null>;
  onTimers?(callback: (timers: TimerSnapshot[]) => void): Unsubscribe;
  inspectAlert?(text: string): Promise<{ slots: AlertTokenSlot[]; unfilled: boolean; preview: string }>;
}

type TimerKind = 'countdown' | 'to-time' | 'elapsed';
type TimerState = 'stopped' | 'running' | 'paused';

interface TimerSnapshot {
  id: string;
  name: string;
  kind: TimerKind;
  state: TimerState;
  /** Negative once a countdown passes zero with overrun on. */
  remainingMs: number;
  overrunning: boolean;
  display: string;
}

interface TimerRecord {
  id: string;
  name: string;
  kind: TimerKind;
  durationSec?: number;
  targetTime?: string;
  overrun: boolean;
  state: TimerState;
}

interface AlertTokenSlot {
  name: string;
  kind: 'clock' | 'timer' | 'custom';
  raw: string;
  arg?: string;
}

type ScreenState = 'live' | 'clear' | 'black' | 'logo';
type OutputRole = 'projector' | 'stream' | 'stage';
type AlertTarget = 'all' | 'projector' | 'stream' | 'stage';

interface ScreenAlert {
  id: string;
  text: string;
  target: AlertTarget;
  shownAt: number;
  expiresAt: number | null;
}

interface BibleSearchHit {
  bookId: number;
  book: string;
  chapter: number;
  verse: number;
  version: string;
  text: string;
  /** Match-highlighted with <b>…</b> when the FTS index exists. */
  snippet: string;
}

interface Window {
  /** Absent when running in a plain browser (no Electron preload). */
  api?: WindowApi;
}
