import StoreModule from 'electron-store'
import type { ScheduleEntry } from '../../shared/types'

const Store: typeof StoreModule =
  typeof (StoreModule as any).default === 'function'
    ? (StoreModule as any).default
    : StoreModule

export const defaults = {
  hfToken: '',
  deepgramApiKey: '',
  agentEnabled: true,
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
  publicWebUrl: 'http://localhost:3003',
  accountSlug: '',
  defaultBackgroundUrl: '',
  qrCompanionCaption: 'Scan to follow live verses, transcript, and notes',
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
  asrProvider: 'deepgram' as 'deepgram' | 'whisper-local',
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
  reopenCorrections: 4
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

export function getStore(): StoreModule<Settings> {
  if (!store) {
    store = new Store({ defaults })
    migrateServiceSchedule(store)
    if (!store.get('deepgramApiKey') && process.env.DEEPGRAM_API_KEY) {
      store.set('deepgramApiKey', process.env.DEEPGRAM_API_KEY)
    }
    if (!store.get('hfToken') && process.env.HF_API_TOKEN) {
      store.set('hfToken', process.env.HF_API_TOKEN)
    }
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
  getStore().set(key, value)
}
