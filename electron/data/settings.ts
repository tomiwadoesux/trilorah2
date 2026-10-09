import type { PersistedRun, RunSegment } from '../../shared/operatorRun';
import StoreModule from 'electron-store'
import type { ScheduleEntry } from '../../shared/types'
import { SERVICE_DEFAULTS } from '../asr/serviceDefaults'

const Store: typeof StoreModule =
  typeof (StoreModule as any).default === 'function'
    ? (StoreModule as any).default
    : StoreModule

export const defaults = {
  operatorRunV1: null as PersistedRun | RunSegment[] | null,
  hfToken: '',
  deepgramApiKey: '',
  pixabayApiKey: '',
  pexelsApiKey: '',
  agentEnabled: true,
  /** Lets speech detection blank the projector by itself (prayer-mode verse
   *  dismiss, the 30 s worship auto-clear). Off: the screen changes only when
   *  an operator pushes, clears or blacks it. */
  autoScreenActions: false,
  /** How words arrive on the projector (shared/textTransitions.ts). */
  textTransition: 'fade',
  textTransitionMs: 450,
  autoDisplayTimeout: 15,
  falsePositiveFilterEnabled: true,
  defaultFontSize: 1,
  defaultFontFamily: 'serif',
  defaultFontWeight: 400,
  defaultTextColor: '#ffffff',
  overlayOpacity: 0.3,
  mlModel: 'regex',
  serviceSchedule: [
    { type: 'worship' },
    { type: 'announcements' },
    { type: 'offering' },
    { type: 'sermon' },
    { type: 'altar-call' },
    { type: 'closing' }
  ] as ScheduleEntry[],
  scheduleTemplates: [] as any[],
  serviceStartTime: '',
  serviceEndTime: '',
  slowPathEnabled: false,
  batchIntervalMs: 3000,
  activePreacherId: '',
  obsEnabled: false,
  obsHost: 'localhost',
  obsPort: 4455,
  obsPassword: '',
  vmixEnabled: false,
  vmixHost: 'localhost',
  vmixPort: 8088,
  audienceTrainingEnabled: false,
  givingZelle: '',
  givingVenmo: '',
  givingCashApp: '',
  givingPaypal: '',
  givingBankInfo: '',
  givingCustomUrl: '',
  givingNote: '',
  // Where the companion page is served. It is encoded into a QR that phones
  // scan, so it must be an address a PHONE can reach — never localhost.
  publicWebUrl: 'https://trilorah.com',
  accountSlug: '',
  defaultBackgroundUrl: '',
  backgroundBlur: 0,
  backgroundVideoSpeed: 1,
  backgroundVideoBass: 0,
  backgroundVideoSound: false,
  backgroundFit: 'cover' as 'cover' | 'contain' | 'fill',
  backgroundPosition: 'center' as 'center' | 'top' | 'bottom',
  qrCompanionCaption: 'Follow along on your phone',
  qrBackgroundPath: '',
  churchName: '',
  churchLogoUrl: '',
  accentId: 'green',
  colorMode: 'dark',
  uiFont: 'default',
  scriptureFontPreset: 'display-serif',
  rememberPreacherStyle: true,
  adaptToAudienceCorrections: true,
  useIncrementalNotes: true,
  deepgramKeyMasked: false,
  hfTokenMasked: false,
  // --- added post-recovery (agentic feature set, 2026-07) ---
  // whisper-local is the default: free, on-device, no account or key needed.
  // Deepgram stays available as the low-latency cloud option for churches
  // that bring their own key.
  asrProvider: 'whisper-local' as 'deepgram' | 'whisper-local',
  notesProvider: 'cloud' as 'cloud' | 'local',
  displayVersion: 'KJV',
  seasonalEnabled: true,
  graceWindowEnabled: true,
  voiceCommandsEnabled: true,
  // Language: what the ASR listens in (BCP-47 for Deepgram) and which
  // language pack the reference resolver / voice commands use.
  asrLanguage: 'en-US',
  engineLanguage: 'en' as 'en' | 'es' | 'fr' | 'pt' | 'hi' | 'zh',
  // Trust meter & auto-mode gate — fully tunable per church.
  autoModeMinTrust: 0.9,
  autoModeMinSamples: 100,
  autoModeMinServices: 5,
  // Training thermostat.
  matureMaxCorrections: 2,
  matureStreak: 3,
  reopenCorrections: 4,
  // --- 2026-09 engine additions (see IDEAS-BACKLOG.md / BUILD-MAP.md) ---
  // Auto mode: a ping when a verse is auto-pushed (EdgeGlow spec, item 11/16).
  autoPingEnabled: false,
  autoPingVolume: 0.5,
  // Two candidates within this many points = a clash → hold and ask the operator.
  clashMarginPts: 15,
  // Local Whisper model size — 'small' is the right pick for strong accents.
  whisperModelSize: 'base' as 'base' | 'small' | 'medium',
  // Companion page (item 7/8): who may open the shared link, and the church's
  // own livestream URL shown as a "Watch the stream" button.
  companionShareMode: 'anyone' as 'anyone' | 'wifi-only',
  streamUrl: '',
  // Congregation polls on low-confidence detections (item 10).
  companionPollsEnabled: true,
  companionPollMinTop: 40,
  companionPollMaxTop: 75,
  companionPollMinSecond: 15,
  companionPollTtlMs: 45000,
  companionPollCooldownMs: 180000,
  companionPollMaxShiftPts: 15,
  companionRoundCitiesBelow: 5,
  companionGeoDbPath: '',
  // Per-preacher vocabulary (names, titles) applied to transcripts + ASR keyword boost.
  vocabularyEnabled: true,
  // A manual reversal within this window marks the last voice command a false positive.
  commandUndoWindowMs: 10000,
  // Church brand colour that seeds every generated avatar (item 14).
  churchBrandColor: '',
  // Remote control page / paired devices (item 22).
  remoteControlEnabled: true,
  // --- 2026-09-08 EasyWorship parity pass (BUILD-MAP 2.10–2.13) ---
  // Which job each output window does; ids are the three windows main.ts
  // opens (main / alternate / third). See electron/output/outputState.ts.
  outputRoles: {} as Partial<Record<string, 'projector' | 'stream' | 'stage' | 'timer'>>,
  /** Operator's display choice per output, by Electron display id. Unset →
   *  externals are handed out in order (output/displays.ts). */
  outputDisplays: {} as Partial<Record<string, number | 'none'>>,
  // Stream output: lower-third band for OBS/vMix capture, or the full
  // projector look on a transparent canvas.
  streamLayout: 'lower-third' as 'lower-third' | 'full',
  // Scripture layout on the wall, written by the themes tab on promote.
  verseLayout: 'center',
  safeMargin: 10,
  refScale: 1,
  refGap: 0.9,
  // Stage confidence monitor extras.
  stageShowClock: true,
  stageShowNext: true,
  // Message alerts: default seconds on screen, and the operator's quick list.
  alertDefaultSeconds: 20,
  alertPresets: [
    'Parent of child {child} please come to the nursery',
    'A car is blocking the driveway — please move it',
    'Please silence your phones'
  ] as string[],
  // --- 2026-09-09 ProPresenter parity pass (BUILD-MAP 2.16–2.21) ---
  // How a passage is laid out on the screen. Mirrors ProPresenter's Bible
  // options: one slide per verse or the whole range together, inline verse
  // numbers, and where the reference line appears across the slides.
  breakOnVerse: false,
  showVerseNumbers: false,
  referenceMode: 'each' as 'each' | 'last' | 'first' | 'none',
  showTranslation: true,
  // Soft character cap before a long verse splits onto another slide; 0 = off.
  maxCharsPerSlide: 0,
  // A second translation under the first — bilingual congregations read the
  // verse in both at once instead of the operator switching versions.
  secondaryVersion: '',
  // Timers (BUILD-MAP 2.16). Definitions live here so a church's pre-service
  // countdown survives a restart; running state is in-memory only.
  timers: [] as Array<{
    id: string
    name: string
    kind: 'countdown' | 'to-time' | 'elapsed'
    durationSec?: number
    targetTime?: string
    overrun: boolean
  }>,
  // Stage confidence monitor: what the preacher sees beside the verse.
  stageShowVerseText: true,
  stageShowTimer: '',
  stageShowElapsed: true,
  // Unsaved song-editor work, keyed by song id (shared/songDraft.ts). Opaque
  // to the main process; the LIVE screen reads and writes it whole.
  songDrafts: {} as Record<string, unknown>
}

export type Settings = typeof defaults

let store: StoreModule<Settings> | null = null

export function migrateServiceSchedule(s: StoreModule<Settings>): void {
  const current = s.get('serviceSchedule') as unknown[]
  if (!Array.isArray(current) || current.length === 0) return
  if (typeof current[0] === 'object' && current[0] !== null && 'type' in current[0]) {
    return
  }
  if (typeof current[0] === 'string') {
    const upgraded = (current as string[]).map((type) => ({
      type
    }))
    s.set('serviceSchedule', upgraded)
    console.log(
      `🔄 Migrated serviceSchedule: ${upgraded.length} entries upgraded to ScheduleEntry[]`
    )
  }
}

/**
 * Keys typed into Settings live in electron-store, but the ASR/LLM modules
 * read process.env — in a packaged app there is no .env.local, so without
 * this mirror a key entered in the UI silently never reached the engine.
 */
function mirrorKeysToEnv(s: StoreModule<Settings>): void {
  const dg = s.get('deepgramApiKey')
  if (dg) process.env.DEEPGRAM_API_KEY = dg
  const hf = s.get('hfToken')
  if (hf) process.env.HF_API_TOKEN = hf
  const px = s.get('pixabayApiKey')
  if (px) process.env.PIXABAY_API_KEY = px
  const pe = s.get('pexelsApiKey')
  if (pe) process.env.PEXELS_API_KEY = pe
}

export function getStore(): StoreModule<Settings> {
  if (!store) {
    store = new Store({ defaults })
    migrateServiceSchedule(store)
    // The old default was the developer's own machine. Any install that still
    // holds it has a QR that opens nothing on a congregant's phone.
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(String(store.get('publicWebUrl') ?? ''))) {
      store.set('publicWebUrl', defaults.publicWebUrl)
    }
    // Precedence: a developer's .env.local beats the key compiled into the
    // build, which beats nothing. The Settings screen no longer offers these
    // fields, so for a church install the compiled key is the only source.
    const seedDeepgram = process.env.DEEPGRAM_API_KEY || SERVICE_DEFAULTS.deepgramApiKey
    if (!store.get('deepgramApiKey') && seedDeepgram) {
      store.set('deepgramApiKey', seedDeepgram)
    }
    const seedHf = process.env.HF_API_TOKEN || SERVICE_DEFAULTS.hfToken
    if (!store.get('hfToken') && seedHf) {
      store.set('hfToken', seedHf)
    }
    if (!store.get('pixabayApiKey') && process.env.PIXABAY_API_KEY) {
      store.set('pixabayApiKey', process.env.PIXABAY_API_KEY)
    }
    if (!store.get('pexelsApiKey') && process.env.PEXELS_API_KEY) {
      store.set('pexelsApiKey', process.env.PEXELS_API_KEY)
    }
    mirrorKeysToEnv(store)
  }
  return store
}

export function getAllSettings(): Settings {
  return getStore().store
}

export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  return getStore().get(key)
}

export function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K]
): void {
  const s = getStore()
  s.set(key, value)
  if (key === 'deepgramApiKey' || key === 'hfToken' || key === 'pixabayApiKey' || key === 'pexelsApiKey') mirrorKeysToEnv(s)
}
