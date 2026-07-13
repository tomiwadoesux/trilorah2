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
/* The bridge                                                          */
/* ------------------------------------------------------------------ */

interface WindowApi {
  /* Scripture ------------------------------------------------------ */
  getChapter(bookId: number, chapter: number, version?: string): Promise<ChapterResult>;
  getAvailableVersions(): Promise<string[]>;
  searchVerse(book: string, chapter: number, verse: number, version?: string): Promise<VerseSearchResult>;

  /* Engine events --------------------------------------------------- */
  onTranscriptUpdate(callback: (text: string) => void): Unsubscribe;
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
  setDisplayVersion?(version: string): Promise<void>;
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
}

interface Window {
  /** Absent when running in a plain browser (no Electron preload). */
  api?: WindowApi;
}
