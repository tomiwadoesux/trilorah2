// `session` is already the ScriptureSession instance in this file, so Electron's
// comes in aliased rather than renaming an engine object used throughout.
import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, protocol, screen as electronScreen, session as electronSession, shell, systemPreferences } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import dotenv from 'dotenv'
import {
  shouldEmit,
  emitVerseDetected,
  emitTranscript,
  emitTranscriptLine,
  emitASRStatus,
  emitSegmentChanged,
  emitMediaSuggestion,
  emitVerseAutoDismiss,
  emitVoiceCommand,
  emitVersionChanged,
  emitQueueUpdated,
  emitPrayerMode,
  emitIntentState,
  emitAudioLevel
} from './emitters'
import { feedAudioChunk } from './asr/audioBus'
import { queueHealth } from './cloud/offlineQueue'
import { longestCommandPhrase } from '../shared/voiceCommandText'
// In-process TS resolver — drop-in replacement for the lost Python ml/ service
import {
  connectML,
  disconnectML,
  sendTranscript,
  discardPartialReference,
  setBareBookGate,
  setResolverLanguage,
  makePackNumberParser
} from './engine/referenceResolver'
import { getLanguagePack, availableLanguages } from './engine/lang'
import {
  DEFAULT_COMMANDS,
  mergeCommandConfigs,
  loadUserCommandConfig,
  saveUserCommandConfig,
  userCommandFilePath,
  loadPreacherCommandConfig,
  savePreacherCommandConfig,
  stripIgnoreTails,
  type CommandPhraseConfig
} from './engine/commandConfig'
// --- 2026-09 engine additions (IDEAS-BACKLOG.md / BUILD-MAP.md) ---
import { buildCandidates, candidatesFromQuotes, type Candidate } from './engine/candidates'
import { AutoModeController } from './engine/autoMode'
import { VerseDelivery, detectionKey, readVersePreview, type VersePushSource } from './engine/verseDelivery'
import { CommandLog } from './preachers/commandLog'
import { VocabularyStore, applyVocabulary, deepgramKeywords } from './preachers/vocabulary'
import { exportFixturesFromLedger } from './preachers/evalExport'
import { setDeepgramKeywords } from './asr/deepgram'
import { startWhisperLocal, stopWhisperLocal } from './asr/whisperLocal'
import { TeachingStore, applyBookAliases } from './preachers/teaching'
import { SoundCheck } from './preachers/soundCheck'
import type { PreacherTeaching } from '../shared/preacherLearning'
import { PairingStore } from './integrations/pairing'
import { MobileServer } from './integrations/mobileServer'
import { MobileBridge } from './integrations/mobileBridge'
import { PhoneMicLink, supabaseMicChannel } from './mic/phoneMicLink'
import { hostname } from 'node:os'

let mobileServer: MobileServer | null = null
let mobilePairing: PairingStore | null = null
let publicSharingPaused = false
let cloudLifecycle: Promise<unknown> = Promise.resolve()
function serializeService<T>(operation: () => Promise<T>): Promise<T> {
  const next = cloudLifecycle.then(operation, operation)
  cloudLifecycle = next.catch(() => undefined)
  return next
}
const mobileBridge = new MobileBridge(request => {
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error('Open the desktop control surface first.')
  mainWindow.webContents.send('mobile-request', request)
})
ipcMain.on('mobile-reply', (event, reply) => {
  if (event.sender === mainWindow?.webContents) mobileBridge.reply(reply.id, reply.result, reply.error)
})
/*
 * The phone microphone. Main holds the code and the approval; the renderer
 * holds the call. See shared/phoneMic.ts.
 */
let phoneMic: PhoneMicLink | null = null
function getPhoneMic(): PhoneMicLink {
  if (phoneMic) return phoneMic
  const supa = getSupabase()
  if (!supa) throw new Error('cloud is off in this build — the phone microphone needs it to find the laptop')
  phoneMic = new PhoneMicLink({
    openChannel: supabaseMicChannel(supa),
    qr: async (url) => (await import('qrcode')).toDataURL(url, { width: 320, margin: 1, color: { dark: '#e5f3f2', light: '#0e1413' } }),
    laptopName: hostname().replace(/\.local$/i, '').replace(/-/g, ' ') || 'the laptop',
    onStatus: (status) => broadcastToWindows('on-phone-mic-status', status),
    onSignal: (message) => mainWindow?.webContents.send('on-phone-mic-signal', message),
  })
  return phoneMic
}
const noPhoneMic = (error: string) => ({ state: 'error', code: null, url: null, qr: null, phoneName: null, expiresAt: null, error })
ipcMain.handle('phone-mic-start', async () => {
  try { return await getPhoneMic().start(String(getSetting('publicWebUrl') ?? '')) }
  catch (e: any) { return noPhoneMic(e?.message || 'could not start') }
})
ipcMain.handle('phone-mic-stop', async () => { await phoneMic?.stop(); return phoneMic?.status() ?? noPhoneMic('') })
ipcMain.handle('phone-mic-approve', async (_event, allow: boolean) => { await phoneMic?.approve(allow === true); return phoneMic?.status() ?? noPhoneMic('') })
ipcMain.handle('phone-mic-status', () => phoneMic?.status() ?? { state: 'idle', code: null, url: null, qr: null, phoneName: null, expiresAt: null, error: null })
ipcMain.on('phone-mic-signal', (event, message) => {
  if (event.sender !== mainWindow?.webContents) return
  const parsed = parsePhoneMicMessage(message)
  if (parsed) void phoneMic?.signal(parsed)
})
ipcMain.on('phone-mic-peer-state', (event, state, detail) => {
  if (event.sender !== mainWindow?.webContents) return
  if (state === 'connected' || state === 'failed') phoneMic?.peerState(state, typeof detail === 'string' ? detail : undefined)
})

ipcMain.handle('mobile-status', () => mobileServer?.status() ?? {running:false,urls:[],pending:[],devices:[],error:null})
ipcMain.handle('mobile-enable', async (_event, enabled: boolean) => {
  if (!mobilePairing) mobilePairing = new PairingStore(path.join(app.getPath('userData'),'mobile'))
  if (!enabled) { mobileServer?.stop(); return true }
  if (!mobileServer) {
    const root = app.getAppPath()
    const file = path.join(root, app.isPackaged ? 'dist' : 'public', 'mobile-remote.html')
    mobileServer = new MobileServer(mobilePairing, () => fs.readFileSync(file,'utf8'), (command,args) => mobileBridge.request(command,args))
  }
  await mobileServer.start()
  return true
})
ipcMain.handle('mobile-approve', (_event, id: string, allow: boolean) => mobileServer?.approve(id,allow) ?? false)
ipcMain.handle('mobile-code', (_event, generate: boolean) => {
  if (generate) mobilePairing?.generateCode()
  return mobilePairing?.currentCode() ?? null
})
ipcMain.handle('mobile-revoke', (_event, id: string) => mobilePairing?.revoke(id) ?? false)
ipcMain.handle('mobile-thumbnail', (_event, imagePath: string) => {
  if (typeof imagePath !== 'string') return null
  if (imagePath.startsWith('data:image/') && imagePath.length < 4_000_000) return imagePath
  try {
    let file = imagePath
    if (/^(file|local-media):/.test(file)) file = decodeURIComponent(new URL(file).pathname)
    if (process.platform === 'win32' && /^\/[a-z]:/i.test(file)) file = file.slice(1)
    if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(file) || fs.statSync(file).size > 3_000_000) return null
    return `data:${getMimeType(file)};base64,${fs.readFileSync(file).toString('base64')}`
  } catch { return null }
})
ipcMain.handle('mobile-qr', async (_event, url: string) => {
  if (!mobileServer?.status().urls.includes(url)) throw new Error('Invalid remote address')
  const qr = await import('qrcode')
  return qr.toDataURL(url, {width:240,margin:2})
})
ipcMain.handle('mobile-verse', (_event, reference: string, version: string, live: boolean) => {
  if (!db || typeof reference !== 'string' || reference.length > 160 || typeof version !== 'string') throw new Error('Invalid reference')
  const verse = readVersePreview(db, reference, version)
  if (!verse) throw new Error('That verse or translation is unavailable.')
  if (live) { if (!stageVerseReference(reference,version)) throw new Error('Could not load verse'); pushPreviewToLive('remote') }
  return verse
})
import { PollEngine, VOTE_WEIGHT_IN_VENUE, VOTE_WEIGHT_REMOTE } from './companion/polls'
import { ViewerStats, nullGeo } from './companion/viewerStats'
import { parseCompanionMessage, shareLink, parseShareMode } from './companion/events'
import { CommandRegistry } from './search/registry'
import { SearchIndex } from './search/index'
import { ALL_ENTRIES } from './search/entries'
import { FolderIndex } from './library/folders'
import { presetForReference } from './media/presetPicker'
import { parseSong } from './songs/import'
import type { ImportedSong } from './songs/import'
import { registerLyricsIpc } from './songs/lyricsIpc'
import { SongStore } from './songs/store'
// --- 2026-09-08 EasyWorship parity pass (BUILD-MAP 2.10–2.13) ---
import { AlertManager, type AlertTarget } from './alerts/alerts'
// --- 2026-09-09 ProPresenter parity pass (BUILD-MAP 2.16–2.21) ---
import { fillTokens, hasUnfilledTokens, parseTokens } from './alerts/tokens'
import { TimerStore } from './engine/timers'
import { ScreenStateMachine, roleFor, ROLE_TITLES, isScreenState } from './output/outputState'
import { Readable } from 'node:stream'
import { placeOutput } from './output/displays'
import { applyDisplaySelection } from './output/displaySelection'
import { moveOutputWindow } from './output/moveWindow'
import { describeOutputs } from './output/outputsStatus'
import type { LiveContent } from '../shared/liveContent'
import { buildQrCard } from '../shared/qrCard'
import { searchBible } from './data/bibleSearch'
import { emitEngineEvent } from './emitters'
import { practiceSermonProvider, resolveASRProvider, type ASRProvider } from './asr/provider'
import { PRACTICE_SERMON_DEVICE } from '../shared/practiceSermon'
import { parsePhoneMicMessage } from '../shared/phoneMic'
// (startDeepgram/stopDeepgram now flow through the provider abstraction)
import { VoiceCommandEngine, type VoiceCommandCallbacks } from './engine/voiceCommands'
import { IntentEngine } from './engine/intentEngine'
import { CorrectionLedger } from './preachers/correctionLedger'
import { seasonalBoost, seasonalThemeId } from './engine/seasonalPriors'
import { resolveNotesProvider } from './llm/notesProvider'
import { ScriptureSession } from './engine/scriptureSession'
import { getAllSettings, getSetting, setSetting, getStore } from './data/settings'
import { registerTriPackages } from './packages/triIpc'
import { TransitionDetector } from './engine/transitionDetector'
import { FalsePositiveFilter } from './engine/falsePositiveFilter'
import { DisplayTimingManager } from './engine/displayTimingManager'
import { processSlides } from './media/ocrProcessor'
import { MediaMatcher } from './media/mediaMatcher'
import { searchStock, downloadStock, stockProviders } from './media/stockImages'
import { ServiceAgent } from './engine/serviceAgent'
import { PostServiceSummary } from './notes/postServiceSummary'
import {
  ToolRegistry,
  createTransitionDetectorTool,
  createFalsePositiveFilterTool,
  createDisplayTimingTool,
  createQuoteMatcherTool,
  createSermonPlanTool,
  createContextQueryTool
} from './llm/toolRegistry'
import { LLMFallback } from './llm/llmFallback'
import { ReasoningLoop } from './llm/reasoningLoop'
import { SlowPathOrchestrator } from './llm/slowPathOrchestrator'
import { loadSermonPlan, getExpectedVerseRefs } from './data/sermonPlan'
import {
  createProfile,
  loadProfile,
  saveProfile,
  listProfiles,
  deleteProfile,
  extractAndUpdateProfile
} from './preachers/preacherProfiles'
import { IncrementalNotesBuilder } from './notes/incrementalNotesBuilder'
import { generateSermonNotes } from './notes/sermonNotesGenerator'
import { exportSermonNotesPdf, exportSermonNotesMarkdown } from './notes/sermonNotesGenerator'
import { getQuoteMatcher } from './engine/quoteMatcher'
import { findNamedPassage } from './engine/namedPassages'
import { quotesForNamedPassage } from './engine/recognitionPriority'
import { PassageMatcher } from './engine/passageMatcher'
import { SemanticMatcher, loadEmbedder, loadJudge } from './engine/semanticMatcher'
import { AllusionFinder } from './engine/allusionFinder'
import { HeardWindow } from './engine/heardWindow'
import { SuggestionTracker, type RecognitionCandidate } from './engine/suggestionTracker'
import type { ScriptureRecognition } from '../shared/types'
import { initAliasLogger } from './data/aliasLogger'
import { convertPptxToImages } from './media/pptxConverter'
import {
  startWebSocketServer,
  stopWebSocketServer,
  broadcastState,
  broadcastToClients,
  connectedDevices,
  type RemoteHandlers
} from './integrations/websocketServer'
import { getOBSClient, disposeOBSClient } from './integrations/obsClient'
import { getVMixClient } from './integrations/vmixClient'
import { importScheduleFromImage } from './media/ocrSchedule'
import { suggestSchedule, suggestionToEntries } from './data/scheduleLearner'
import {
  isCloudConfigured,
  getSupabase,
  signIn,
  signUp,
  signOut,
  getCurrentUser
} from './cloud/supabaseClient'
import {
  initCloudSync,
  startService,
  endService,
  getActiveServiceId,
  pushSegment,
  setRehearsal,
  pushTranscriptChunk,
  pushDetectedVerse,
  markVersePushed,
  upsertNotes,
  syncGivingMethods,
  generateLinkCode,
  redeemLinkCode,
  completeAccountSetup,
  hasAccount,
  fetchMyAccount,
  fetchPastors,
  fetchCampuses,
  fetchRecentServices,
  fetchRecentNotes,
  fetchAudienceSessions,
  runRetentionCleanup,
  verifyPassword,
  signOutAllDevices
} from './cloud/cloudSync'
import { findDatabase, db, setDb, bookNames, resolveBookId } from './data/bibleDb'
import type { ScheduleEntry } from '../shared/types'

if (!process.versions.electron) {
  console.error('❌ Electron main process was started with Node.js.')
  console.error(
    'Run with Electron instead: `npm run dev:backend` or `./node_modules/.bin/electron .`'
  )
  process.exit(1)
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

// Dev-only: packaged apps have no .env.local — keys live in electron-store
// settings (see data/settings.ts, which syncs env → store on first run).
if (!app.isPackaged) {
  dotenv.config({ path: path.join(process.cwd(), '.env.local') })
}

function getMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.gif') return 'image/gif'
  if (extension === '.svg') return 'image/svg+xml'
  if (extension === '.mp4' || extension === '.m4v') return 'video/mp4'
  if (extension === '.mov') return 'video/quicktime'
  if (extension === '.webm') return 'video/webm'
  if (extension === '.mp3') return 'audio/mpeg'
  if (extension === '.wav') return 'audio/wav'
  return 'application/octet-stream'
}

const isDev = process.env.NODE_ENV === 'development'
if (app.isPackaged && !app.requestSingleInstanceLock()) app.quit()

// TRI_DEBUG_PORT=9222 lets a script attach over CDP (screenshots, driving the
// sandbox from the terminal). Dev-only affordance; nothing reads it in prod.
if (process.env.TRI_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.TRI_DEBUG_PORT)
}

/*
 * A projector window must keep drawing when it is covered, unfocused or
 * being shared — a Zoom window share, another app on top of it. Chromium
 * otherwise marks a covered window hidden and stops painting it: measured on
 * 2026-10-07 at 0 frames in 2 s, with a 2 s timer taking 5 s. That is the
 * "it only updates once I click on it" the owner saw while sharing the
 * output in Zoom.
 */
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')

let transitionDetector: TransitionDetector | null = null
const falsePositiveFilter = new FalsePositiveFilter()
const displayTimingManager = new DisplayTimingManager()
const mediaMatcher = new MediaMatcher()
let recentTranscriptBuffer: string[] = []
let serviceAgent: ServiceAgent | null = null
let slowPath: SlowPathOrchestrator | null = null
const postServiceSummary = new PostServiceSummary()

let currentPreviewData: any = null
const verseDelivery = new VerseDelivery()
let previewRevision = 0

/* ---------------- agentic layer state (added post-recovery) ---------------- */

let ledger: CorrectionLedger | null = null
let voiceCommands: VoiceCommandEngine | null = null

/* -------- 2026-09 engine additions: state -------- */
let commandLog: CommandLog | null = null
let vocabulary: VocabularyStore | null = null
let pairing: PairingStore | null = null

// Screen state + message alerts fan out to every open window: the outputs
// repaint, the operator UI mirrors, paired remotes get a fresh state.
function broadcastToWindows(channel: string, payload: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  })
}
const screen = new ScreenStateMachine((state) => {
  console.log(`🖥️ Screen → ${state}`)
  broadcastToWindows('on-screen-state', state)
  broadcastState()
})
const alerts = new AlertManager((alert) => {
  console.log(alert ? `📣 Alert: ${alert.text}` : '📣 Alert cleared')
  broadcastToWindows('on-alert', alert)
  broadcastState()
})

// Service timers (BUILD-MAP 2.16). Definitions persist in settings so a
// church's pre-service countdown survives a restart; the running state is
// deliberately in-memory — a countdown left running overnight should be
// stopped on Sunday morning, not resumed forty thousand seconds overrun.
const timers = new TimerStore((snapshot) => {
  broadcastToWindows('on-timers', snapshot)
})

/*
 * How many saved timers are worth carrying across a restart.
 *
 * A church runs a handful — the countdown to the service, the offering, the
 * sermon. Anything beyond that is residue: before the dashboard learned to
 * reuse a stopped countdown, every press of START wrote another row, and a
 * morning of pressing could leave dozens behind. They were invisible in the
 * UI (the face only ever shows one) but they came back on every boot and the
 * panel's own header counted them, so "service timer (21)" was the only sign
 * anything was wrong. Newest wins, because the ones a church still uses are
 * the ones it touched last.
 */
const MAX_RESTORED_TIMERS = 8

function restoreTimers(): void {
  const saved = getSetting('timers')
  if (!Array.isArray(saved)) return
  const keep = saved.slice(-MAX_RESTORED_TIMERS)
  for (const t of keep) {
    if (t && typeof t === 'object') timers.create(t as never)
  }
  /* Write the trimmed list straight back, so the pile is gone for good rather
     than re-trimmed on every launch. */
  if (keep.length < saved.length) persistTimers()
}

function persistTimers(): void {
  setSetting(
    'timers',
    timers.list().map((t) => ({
      id: t.id,
      name: t.name,
      kind: t.kind,
      durationSec: t.durationSec,
      targetTime: t.targetTime,
      overrun: t.overrun
      // extraSec is deliberately NOT persisted: grace granted to last week's
      // preacher must not still be on the clock next Sunday.
    })) as never
  )
}

/**
 * The values a message template can draw on right now: the wall clock, every
 * timer's current display, and the church constants an operator would
 * otherwise retype every week.
 */
function tokenContext(values?: Record<string, string>) {
  const byName: Record<string, string> = {}
  for (const t of timers.snapshot()) {
    byName[t.id] = t.display
    byName[t.name] = t.display
  }
  return {
    now: Date.now(),
    timers: byName,
    values: values ?? {},
    constants: {
      church: String(getSetting('churchName') ?? ''),
      room: String(getSetting('churchName') ?? '')
    }
  }
}
let isListening = false
let lastResolverConfidence: number | undefined = 0.85
let lastHeardText = ''
let lastQuoteCandidates: Candidate[] = []
let lastCandidates: Candidate[] = []
const libraryFolders: Record<string, FolderIndex> = {}
let songs: SongStore | null = null
const searchRegistry = new CommandRegistry(ALL_ENTRIES)
const searchIndex = new SearchIndex(searchRegistry)
const viewerStats = new ViewerStats({ geo: nullGeo, roundBelow: 5 })
const polls = new PollEngine({
  onEvent: (e) => {
    emitEngineEvent('on-companion-event', e)
    broadcastToClients(e)
  }
})
const autoMode = new AutoModeController({
  isEligible: (pid) => !!ledger?.stats(pid).autoModeEligible,
  isEnabled: (pid) => !!ledger?.isAutoModeEnabled(pid),
  onEvent: (evt) => {
    emitEngineEvent('on-auto-mode-event', {
      ...evt,
      ping: evt.type === 'auto-push' ? !!getSetting('autoPingEnabled') : undefined
    })
    if (evt.type === 'clash') console.log(`⚖️ Clash — holding for the operator (${evt.candidates.length} candidates)`)
  }
})

function verseExists(book: string, chapter: number, verse: number): boolean {
  if (!db) return true
  const bookId = resolveBookId(book)
  if (bookId === undefined) return false
  try {
    const row = db
      .prepare('SELECT 1 FROM bible WHERE Book = ? AND Chapter = ? AND Versecount = ? LIMIT 1')
      .get(bookId, chapter, verse)
    return !!row
  } catch {
    return false
  }
}

function remoteState() {
  const ref = currentPreviewData
    ? `${currentPreviewData.book} ${currentPreviewData.chapter}:${currentPreviewData.verse}`
    : null
  return {
    listening: isListening,
    pendingRef: currentPreviewData?.isPreview ? ref : null,
    liveRef: verseDelivery.live
      ? `${verseDelivery.live.book} ${verseDelivery.live.chapter}:${verseDelivery.live.verse}`
      : null,
    autoMode: false,
    screen: screen.get(),
    alert: alerts.current() ? { id: alerts.current()!.id, text: alerts.current()!.text } : null
  }
}

function folderIndex(libraryId: 'presentations' | 'songs' | 'media'): FolderIndex {
  if (!libraryFolders[libraryId]) {
    libraryFolders[libraryId] = new FolderIndex(app.getPath('userData'), libraryId)
  }
  return libraryFolders[libraryId]
}

/**
 * The song library, built on first use — lazy for the same reason the folder
 * index is: it reads a JSON file off disk, and a church that never opens the
 * songs screen should not pay for that at boot.
 *
 * Seeding happens here rather than at startup so the public-domain hymns
 * appear the first time somebody actually looks at the library. It is a
 * no-op afterwards, and stays a no-op for hymns the church deleted.
 */
function songStore(): SongStore {
  if (!songs) {
    songs = new SongStore(app.getPath('userData'))
    songs.seedIfNeeded()
  }
  return songs
}

const intentEngine = new IntentEngine({
  onStateChange: (state) => emitIntentState(state),
  onReadingStarted: () => {
    // Reading is an operator hint; it cannot promote a verse to the wall.
  },
  onDefer: () => console.log('🗂️ Defer window open — next detection goes to the queue')
})
let lastDisplayedRef: { book: string; chapter: number; verse: number; displayedAt: number } | null = null
let lastReviewItemId: string | null = null
const verseQueue: Array<{ ref: string; reason: string; ts: number }> = []
let activeASR: ASRProvider | null = null

function activePreacherId(): string {
  return getSetting('activePreacherId') || ''
}

let teachingStore: TeachingStore | null = null
function teachings() {
  return teachingStore ??= new TeachingStore(path.join(app.getPath('userData'), 'preacher-teaching'))
}
function teachingFor(id: string): PreacherTeaching {
  if (!id) return { soundsLike: [], vocabulary: [], ignoreTails: [], voiceCommands: true }
  const store = teachings()
  if (!store.has(id)) store.patch(id, {
    vocabulary: vocabulary?.get(id).terms ?? [],
    ignoreTails: loadPreacherCommandConfig(app.getPath('userData'), id).ignoreTails ?? [],
  })
  return store.get(id)
}
function teachTranscript(id: string, text: string): string {
  const t = teachingFor(id)
  if (getSetting('rememberPreacherStyle')) text = ledger?.correctedUtterance(id, text) ?? text
  return applyBookAliases(getSetting('vocabularyEnabled') ? applyVocabulary(text, t.vocabulary) : text, t.soundsLike)
}
function preacherCommandsEnabled() {
  return getSetting('voiceCommandsEnabled') && teachingFor(activePreacherId()).voiceCommands
}
const soundCheck = new SoundCheck({ start: startWhisperLocal, stop: stopWhisperLocal }, (pid, text) => {
  return stripIgnoreTails(teachTranscript(pid, text), teachingFor(pid).ignoreTails)
})
let soundCheckOwner: number | null = null
let lastRawHeardText = ''
let manualReferenceInput = false
let recentReview: { id: string; preacherId: string; ref: string; ts: number } | null = null

function queueRecognitionReview(data: { book: string; chapter: number | null; verse: number | null }, heard = lastRawHeardText) {
  const pid = activePreacherId()
  if (manualReferenceInput || !heard.trim() || !pid || !ledger || !data.chapter || !data.verse || !verseExists(data.book, data.chapter, data.verse)) return
  const ref = `${data.book} ${data.chapter}:${data.verse}`
  const item = ledger.addReviewItem({ preacherId: pid, ts: Date.now(), kind: 'detection', reason: 'detected', heard,
    proposed: { book: data.book, chapter: data.chapter, verse: data.verse } })
  lastReviewItemId = item.id
  recentReview = { id: item.id, preacherId: pid, ref, ts: Date.now() }
}

/** The active merged phrase config (defaults + language pack + user file). */
let activeCommandConfig: CommandPhraseConfig = DEFAULT_COMMANDS

/**
 * (Re)build everything language- or phrase-dependent. Called at startup
 * and whenever engineLanguage / thresholds / voice-commands.json change —
 * the whole engine is reconfigurable live, no restart.
 */
function applyLanguageAndConfig(): void {
  const langCode = getSetting('engineLanguage') || 'en'
  const pack = getLanguagePack(langCode)
  const substring = pack?.matchMode === 'substring'

  // 1. Resolver hears the new language (English always stays underneath).
  setResolverLanguage(pack)

  // 2. Merged phrase config: defaults ∪ pack ∪ user file.
  let config = mergeCommandConfigs(DEFAULT_COMMANDS, pack?.commands ?? {})
  config = mergeCommandConfigs(config, loadUserCommandConfig(app.getPath('userData')))
  // 4th layer: the active preacher's own phrases ("How they say it").
  const pid = activePreacherId()
  if (pid) config = mergeCommandConfigs(config, { ...loadPreacherCommandConfig(app.getPath('userData'), pid), ignoreTails: teachingFor(pid).ignoreTails })
  activeCommandConfig = config

  // 3. Engines pick up the config.
  voiceCommands = new VoiceCommandEngine(voiceCallbacks, {
    config,
    numberParser: makePackNumberParser(pack),
    substringMode: substring,
    isSuppressed: (u) => !!(pid && commandLog?.isSuppressed(pid, u))
  })
  // Per-preacher vocabulary → Deepgram keyword boost (applies on next connect).
  if (getSetting('vocabularyEnabled') && vocabulary) {
    setDeepgramKeywords(pid ? deepgramKeywords(teachingFor(pid).vocabulary) : [])
  }
  intentEngine.setConfig(config, substring)
  session.configureCommands(config)

  // 4. Ledger gates from settings.
  ledger?.setThresholds({
    autoModeMinTrust: getSetting('autoModeMinTrust'),
    autoModeMinSamples: getSetting('autoModeMinSamples'),
    autoModeMinServices: getSetting('autoModeMinServices'),
    matureMaxCorrections: getSetting('matureMaxCorrections'),
    matureStreak: getSetting('matureStreak'),
    reopenCorrections: getSetting('reopenCorrections')
  })

  console.log(
    `🌍 Engine language: ${pack ? `${pack.label} + English` : 'English'} · ` +
      `${config.versionPhrases.length} version phrases · auto-mode gate ${Math.round(getSetting('autoModeMinTrust') * 100)}%`
  )
}

/** Settings keys that require an engine reconfiguration when they change. */
const RECONFIGURE_KEYS = new Set([
  'engineLanguage',
  'activePreacherId',
  'vocabularyEnabled',
  'autoModeMinTrust',
  'autoModeMinSamples',
  'autoModeMinServices',
  'matureMaxCorrections',
  'matureStreak',
  'reopenCorrections'
])

/** Callbacks the voice-command engine drives — extracted so the engine can
 *  be rebuilt on language/config changes without re-stating the wiring. */
const voiceCallbacks: VoiceCommandCallbacks = {
  getDisplayedRef: () => lastDisplayedRef,
  getAvailableVersions: () => {
    if (!db) return ['KJV']
    try {
      return (db.prepare('SELECT DISTINCT Version FROM bible').all() as { Version: string }[]).map(
        (r) => r.Version
      )
    } catch {
      return ['KJV']
    }
  },
  onVersionSwitch: (version) => {
    setSetting('displayVersion', version)
    reEmitCurrentVerseInVersion(version)
  },
  onVerseCorrection: (verse) => {
    const pid = activePreacherId()
    const heard = lastDisplayedRef
      ? `${lastDisplayedRef.book} ${lastDisplayedRef.chapter}:${lastDisplayedRef.verse}`
      : ''
    const corrected = lastDisplayedRef
      ? `${lastDisplayedRef.book} ${lastDisplayedRef.chapter}:${verse}`
      : String(verse)
    if (pid && ledger) {
      if (lastReviewItemId && lastDisplayedRef) {
        ledger.markOperatorChange(pid, lastReviewItemId)
        lastReviewItemId = null
      } else {
        ledger.addReviewItem({ preacherId: pid, ts: Date.now(), kind: 'correction', reason: 'operator-change',
          heard: `${heard} → ${corrected}`, proposed: lastDisplayedRef ? { book: lastDisplayedRef.book, chapter: lastDisplayedRef.chapter, verse: lastDisplayedRef.verse } : null })
      }
    }
    session.applyVerseCorrection(verse)
  },
  onChapterCorrection: (chapter) => {
    const pid = activePreacherId()
    if (pid && ledger && lastDisplayedRef) {
      ledger.addReviewItem({ preacherId: pid, ts: Date.now(), kind: 'correction', reason: 'operator-change',
        heard: `${lastDisplayedRef.book} ${lastDisplayedRef.chapter} → chapter ${chapter}`,
        proposed: { book: lastDisplayedRef.book, chapter: lastDisplayedRef.chapter, verse: lastDisplayedRef.verse } })
    }
    session.applyChapterCorrection(chapter)
  },
  onDismiss: () => {
    dismissLiveVerse()
    intentEngine.onDisplayCleared()
  },
  onHold: () => {
    if (currentPreviewData?.text) {
      displayTimingManager.onVerseDisplayed(currentPreviewData.text)
    }
  },
  onPrayerChange: (inPrayer) => {
    emitPrayerMode(inPrayer)
    // Taking a verse down because the room went into prayer is a projector
    // write triggered by nothing but speech. Opt-in.
    if (inPrayer && getSetting('autoScreenActions')) dismissLiveVerse()
  },
  onNavigate: (direction) => {
    session.exitReadingMode()
    if (direction === 'next') session.advance()
    else session.goBack()
  },
  onCommand: (event) => {
    emitVoiceCommand(event)
    const pid = activePreacherId()
    if (pid) commandLog?.record(pid, event)
  }
}

/** The operator manually reversed something — if a voice command fired just
 *  before, that command was a false positive and the log learns it. */
function noteOperatorReversal(kind: 'display-dismiss' | 'display-hold' | 'navigate-next' | 'navigate-previous' | 'version-switch'): void {
  if (!commandLog) return
  const hit = commandLog.wasRecentlyFired(kind, getSetting('commandUndoWindowMs'), activePreacherId() || undefined)
  if (hit) {
    commandLog.markUndone(hit.id)
    console.log(`↩️ Voice command undone by operator — logged as false positive: "${hit.utterance}"`)
  }
}

function dismissLiveVerse(): void {
  verseDelivery.clearLive()
  displayTimingManager.onVerseCleared()
  emitVerseAutoDismiss()
  broadcastState()
}

/** Promote a preview only from an explicit operator or remote action. */
function pushPreviewToLive(via: VersePushSource): void {
  const liveVerse = verseDelivery.promote(via)
  if (!liveVerse) return
  console.log(
    `🔴 Pushing to LIVE (${via}):`,
    `${currentPreviewData.book} ${currentPreviewData.chapter}:${currentPreviewData.verse}`
  )
  currentLiveContent = null
  screen.onContentPushed()
  emitVerseDetected(liveVerse)
  // Only an operator's press teaches the finder what is being preached.
  if (!via.startsWith('auto') && currentPreviewData.book && currentPreviewData.chapter) allusionFinder.sermon.noteLive(currentPreviewData.book, currentPreviewData.chapter)
  // Explicit Go live is held until the operator clears or replaces it.
  displayTimingManager.onVerseDisplayed(currentPreviewData.text, false)
  intentEngine.disarmGraceWindow()
  // Congregation poll (if one is open) closes with this verse as the label.
  const openPoll = polls.current()
  if (openPoll) {
    const idx = openPoll.candidates.findIndex(
      (c) => c.book === currentPreviewData.book && c.chapter === currentPreviewData.chapter && c.verse === currentPreviewData.verse
    )
    polls.close(openPoll.id, idx >= 0 ? idx : null, via.startsWith('auto') ? 'auto' : 'operator')
  }
  if (autoMode.hasPendingClash()) autoMode.dismissClash()
  broadcastState()
  // Manual display changes do not count as successful recognition.
}

/** Stage the current reference in a different translation (voice or UI). */
function reEmitCurrentVerseInVersion(version: string): void {
  if (!currentPreviewData || !db) return
  try {
    const start = currentPreviewData.verse
    const end = currentPreviewData.endVerse ?? currentPreviewData.verse
    const reference = `${currentPreviewData.book} ${currentPreviewData.chapter}:${start}-${end}`
    const preview = readVersePreview(db, reference, version)
    if (!preview) return
    currentPreviewData = verseDelivery.stage({ ...currentPreviewData, ...preview })
    session.version = version
    session.setCurrentVerseText(preview.text)
    previewRevision++
    emitVerseDetected(currentPreviewData)
    emitVersionChanged(version)
  } catch (e) {
    console.error('❌ Version re-emit failed:', e)
  }
}

const suggestionTracker = new SuggestionTracker()
let passageMatcher: PassageMatcher | null = null
const heardWindow = new HeardWindow()
/** Names, stories, meaning, who "he" is and what is being preached, in one place. */
const allusionFinder = new AllusionFinder({ semantic: null, judge: null, detectStory: text => passageMatcher?.detect(text) ?? null })
/** Recent finals that reached no other matcher, for an allusion split across two. */
let allusionFinals: { text: string; at: number }[] = []
/** Bumped on every reset, so a search that was under way knows it is stale. */
let storyEpoch = 0

function resetStoryMemory() {
  passageMatcher?.reset()
  allusionFinals = []
  storyEpoch++
}

/** Vectors and the two small models ship beside the app; without them allusions are off. */
async function loadSemanticMatcher() {
  const roots = [process.resourcesPath, path.join(process.cwd(), 'electron', 'data', 'passages'), path.join(process.cwd(), 'data')].filter(Boolean)
  const vectors = roots.map(root => path.join(root, 'bsb-vectors.bin')).find(file => fs.existsSync(file))
  const model = (name: string) => roots.map(root => path.join(root, 'models', name)).find(dir => fs.existsSync(path.join(dir, 'model_quantized.onnx')))
  const sentenceModel = model('all-MiniLM-L6-v2')
  if (!vectors || !sentenceModel) { console.log('ℹ️ Allusion matching off: vectors or sentence model not installed'); return }
  try {
    const matcher = new SemanticMatcher()
    if (!matcher.loadVectors(vectors)) { console.warn('⚠️ Allusion vectors do not match the passage corpus. Run npm run passages:vectors.'); return }
    matcher.setEmbedder(await loadEmbedder(sentenceModel))
    // The judge is optional: without it the automatic path keeps its stricter thresholds.
    const judgeModel = model('ms-marco-MiniLM-L-6-v2')
    const judge = judgeModel ? await loadJudge(judgeModel).catch(() => null) : null
    allusionFinder.install(matcher, judge)
    console.log(`🧭 Allusion matching ready${judge ? '' : ' (judge model not installed)'}`)
  } catch (error) {
    console.warn('⚠️ Allusion matching unavailable:', error)
  }
}

/**
 * Last resort on a final: nothing was named, quoted or retold in the Bible's
 * own words. A passage is staged only when the judge says the sentence is
 * about it, and only if nothing else reached the preview while it was thinking.
 */
function suggestAllusion(text: string) {
  if (!allusionFinder.meaning) return
  const now = Date.now()
  allusionFinals = [...allusionFinals.filter(final => now - final.at < 12_000), { text, at: now }].slice(-4)
  const words = text.split(/\s+/).filter(Boolean)
  const heard = words.length >= 8 ? text : allusionFinals.map(final => final.text).join(' ').split(/\s+/).slice(-25).join(' ')
  const revision = previewRevision
  const epoch = storyEpoch
  void allusionFinder.suggest(heard, now).then((best) => {
    if (!best || previewRevision !== revision || storyEpoch !== epoch) return
    stageRecognizedPassage({
      book: best.book, chapter: best.chapter, verse: best.verse,
      endVerse: best.endVerse > best.verse ? best.endVerse : null,
      source: 'passage', passageId: best.passageId, evidence: best.evidence
    }, heard)
  }).catch(() => undefined)
}
let pendingRecognition: ScriptureRecognition | undefined
let provisionalRecognition: { candidate: RecognitionCandidate; recognition: ScriptureRecognition } | null = null

function withdrawProvisionalRecognition(): void {
  if (!provisionalRecognition) return
  const { candidate, recognition } = provisionalRecognition
  provisionalRecognition = null
  suggestionTracker.withdraw(recognition.suggestionId)
  if (currentPreviewData?.recognition?.suggestionId === recognition.suggestionId) {
    currentPreviewData = null
    verseDelivery.preview = null
    previewRevision++
    session.exitReadingMode()
  }
  broadcastToWindows('on-recognition-withdrawn', { suggestionId: recognition.suggestionId,
    book: candidate.book, chapter: candidate.chapter, verse: candidate.verse, endVerse: candidate.endVerse })
  broadcastState()
}

const session = new ScriptureSession((display: any) => {
  if (!db) return
  const displayVersion = display.version || getSetting('displayVersion') || 'KJV'
  const reference = `${display.book} ${display.chapter}:${display.verseStart}-${display.verseEnd}`
  let preview
  try {
    preview = readVersePreview(db, reference, displayVersion)
  } catch (e) {
    console.error('❌ DB error:', e)
    return
  }
  if (!preview) return
  const detection = verseDelivery.stage({
    ...preview,
    confidence: lastResolverConfidence,
    ...(pendingRecognition ? { recognition: pendingRecognition, source: pendingRecognition.source } : {}),
    // Pass range metadata
    rangeEnd: display.rangeEnd,
    chunkSize: display.chunkSize
  })
  currentPreviewData = detection
  previewRevision++
  // Only a LIVE push lifts a CLEAR. This used to run for previews too, so a
  // reference the engine merely HEARD un-cleared the projector — the verse
  // itself stayed off, but the operator's blank screen came back on. The
  // session only ever emits previews (isPreview is hardcoded true there), so
  // in practice this branch is dormant and pushPreviewToLive is the lifter.
  if (!detection.isPreview) screen.onContentPushed()
  emitVerseDetected(detection)
  const refStr = detection.endVerse
    ? `${detection.book} ${detection.chapter}:${detection.verse}-${detection.endVerse}`
    : `${detection.book} ${detection.chapter}:${detection.verse}`
  const cloudVerseId = pushDetectedVerse(
    refStr,
    'ml',
    0.7,
    !detection.isPreview
  )
  if (cloudVerseId) {
    detection.cloudId = cloudVerseId
    currentPreviewData.cloudId = cloudVerseId
  }
  if (!detection.isPreview) {
    displayTimingManager.onVerseDisplayed(detection.text)
  }
  session.setCurrentVerseText(detection.text)
  // --- agentic layer (added post-recovery) ---
  lastDisplayedRef = {
    book: detection.book,
    chapter: detection.chapter,
    verse: detection.verse,
    displayedAt: Date.now()
  }
  intentEngine.onReferenceDetected()
  if (detection.isPreview && detection.text && lastResolverConfidence !== undefined) {
    const preacherId = activePreacherId()
    // Ranked candidates: the primary plus ASR-confusion alternates, quote
    // matches and context. Feeds the clash rule, the operator prompt and
    // the congregation poll.
    const candidates = buildCandidates(
      {
        book: detection.book,
        chapter: detection.chapter,
        verse: detection.verse,
        endVerse: detection.endVerse,
        confidence: lastResolverConfidence
      },
      {
        verseExists,
        recentRefs: lastDisplayedRef ? [{ book: lastDisplayedRef.book, chapter: lastDisplayedRef.chapter }] : [],
        quoteCandidates: lastQuoteCandidates,
        seasonalBoost: getSetting('seasonalEnabled')
          ? (b) => Math.round((seasonalBoost(b, detection.chapter, new Date()) - 1) * 100)
          : undefined,
        heardText: lastHeardText
      }
    )
    lastQuoteCandidates = []
    lastCandidates = candidates
    emitEngineEvent('on-candidates', { ref: refStr, candidates })
    if (getSetting('companionPollsEnabled')) {
      polls.maybeOpen(candidates, {
        minTop: getSetting('companionPollMinTop'),
        maxTop: getSetting('companionPollMaxTop'),
        minSecond: getSetting('companionPollMinSecond'),
        ttlMs: getSetting('companionPollTtlMs'),
        cooldownMs: getSetting('companionPollCooldownMs')
      })
    }
    const decision = autoMode.decide(preacherId, candidates, {
      manualOnly: true,
      graceWindow: !!getSetting('graceWindowEnabled'),
      clashMarginPts: getSetting('clashMarginPts')
    })
    if (decision.action === 'arm-grace') {
      // Hold as preview; reading provides a hint for the operator.
      intentEngine.armGraceWindow(refStr, detection.text)
    }
    // 'hold-clash' and 'preview': stays on preview; UI shows the candidates.
  }
  broadcastState()
})

function stageVerseReference(reference: string, version = getSetting('displayVersion') || 'KJV'): boolean {
  if (!db) return false
  try {
    const preview = readVersePreview(db, reference, version)
    if (!preview) return false
    if (recentReview && recentReview.preacherId === activePreacherId() && Date.now() - recentReview.ts < 30_000 &&
        recentReview.ref !== `${preview.book} ${preview.chapter}:${preview.verse}`) {
      ledger?.markOperatorChange(recentReview.preacherId, recentReview.id)
    }
    session.onReferenceDetected({
      book: preview.book, chapter: preview.chapter, verse: preview.verse,
      rangeEnd: preview.endVerse, version
    })
    return true
  } catch (error) {
    console.error('Could not load selected verse:', error)
    return false
  }
}

function startASR(deviceLabel?: string) {
  if (soundCheck.active) { emitASRStatus('Finish the sound check before starting a service.'); return }
  if (isListening) return
  withdrawProvisionalRecognition()
  getQuoteMatcher().reset()
  resetStoryMemory()
  suggestionTracker.reset()
  lastNamedPassage = null
  /* The practice sermon stands in for a microphone, and is not a service. */
  activeASR = deviceLabel === PRACTICE_SERMON_DEVICE ? practiceSermonProvider : resolveASRProvider(getSetting('asrProvider'))
  setRehearsal(activeASR.id === 'practice')
  console.log(`🎤 Starting ASR (${activeASR.id})...`, deviceLabel ? `(device: ${deviceLabel})` : '(default device)')
  // Both of these BEFORE start(), never after. A provider that cannot run at
  // all — no Deepgram key, or no whisper binary, which is every Windows PC —
  // reports its error synchronously, from inside start(). Setting the status
  // and the guard afterwards overwrote that error with "Connecting..." and
  // re-armed the guard the error handler had just released: the pill sat on
  // "connecting" forever and the button went dead.
  isListening = true
  emitASRStatus('Connecting...')
  activeASR.start(
    // onText callback
    (rawText, isFinal, display, wordTimings) => {
      // Per-preacher vocabulary fixes proper nouns before anything reads the text.
      lastRawHeardText = rawText
      let text = rawText
      const vocabPid = activePreacherId()
      if (vocabPid) {
        text = teachTranscript(vocabPid, rawText)
      }
      lastHeardText = text
      console.log(`📝 ${isFinal ? 'Final' : 'Partial'}: ${text}`)
      emitTranscript(text)
      emitTranscriptLine(display ?? text, isFinal)
      heardWindow.note(text, isFinal)
      if (isFinal) allusionFinder.names.note(text)
      // Detection always watches final speech, independently of optional AI tools.
      if (isFinal && transitionDetector) {
        const speakers = wordTimings?.map(w => w.speaker).filter((s): s is number => s !== undefined) ?? []
        const speaker = speakers.length && new Set(speakers).size === 1 ? speakers[0] : undefined
        transitionDetector.processTranscript(text, speaker)
        serviceAgent?.processTranscript(text, true)
      }
      if (isFinal) {
        const segType = transitionDetector?.getCurrentSegment().type ?? 'unknown'
        pushTranscriptChunk(text, true, segType, wordTimings)
      }
      const words = text.toLowerCase().split(/\s+/).filter(Boolean)
      if (isFinal) {
        recentTranscriptBuffer.push(...words)
        if (recentTranscriptBuffer.length > 30) {
          recentTranscriptBuffer = recentTranscriptBuffer.slice(-30)
        }
      }
      // Intent engine sees everything — it tracks what the preacher is DOING.
      intentEngine.process(text)
      // The partial already advanced this utterance. Consume its final
      // before the other navigation engine can advance it a second time.
      if (isFinal && navFiredOnPartial) {
        navFiredOnPartial = false
        if (session.isUnambiguousNav(text)) {
          withdrawProvisionalRecognition()
          discardPartialReference()
          getQuoteMatcher().clearBuffer()
          resetStoryMemory()
          return
        }
      }
      // Natural voice commands consume their chunk entirely (a version
      // switch must not also get parsed for verse references).
      if (isFinal && voiceCommands && preacherCommandsEnabled()) {
        if (voiceCommands.process(text)) {
          withdrawProvisionalRecognition()
          discardPartialReference()
          getQuoteMatcher().clearBuffer()
          resetStoryMemory()
          return
        }
      }
      session.processTranscript(text)
      if (getSetting('agentEnabled')) {
        displayTimingManager.onTranscript(text, isFinal)
        if (isFinal && transitionDetector) {
          mediaMatcher.processTranscript(
            text,
            transitionDetector.getCurrentSegment().type
          )
        }
      }
      if (slowPath) {
        slowPath.enqueue({
          text,
          timestamp: Date.now(),
          isFinal,
          segment: transitionDetector?.getCurrentSegment().type ?? 'unknown'
        })
      }
      const quoteMatcher = getQuoteMatcher()
      quoteMatcher.updateTranscript(text, isFinal)
      if (isFinal) {
        handleASRText(text)
      } else {
        // "next verse" moves the screen as it is spoken. One shot per
        // utterance: the partials that follow are the same sentence still
        // growing, and its final is swallowed in handleASRText.
        if (!navFiredOnPartial && session.isUnambiguousNav(text) && handleSessionCommand(text)) {
          navFiredOnPartial = true
          return
        }
        handleASRText(text, false)
      }
    },
    // onError callback
    (error) => {
      console.error('❌ ASR error:', error)
      emitASRStatus('Error: ' + error.message)
      // Release the guard below, or a connection that failed on open would
      // wedge the button: isListening stayed true, so every later Start
      // returned immediately and only Stop could clear it.
      isListening = false
      withdrawProvisionalRecognition()
      getQuoteMatcher().reset()
      resetStoryMemory()
      suggestionTracker.reset()
      activeASR = null
    },
    deviceLabel,
    // onStatus callback — model download progress, and the provider's own
    // 'Listening...' once it is really capturing.
    (message) => emitASRStatus(message)
  )
  // The status pill is left to the provider from here: it is the only thing
  // that knows whether audio is actually flowing.
}

function stopASR() {
  transitionDetector?.sermonStart.suspend()
  if (!isListening) return
  ;(activeASR ?? resolveASRProvider(getSetting('asrProvider'))).stop()
  activeASR = null
  setRehearsal(false)
  isListening = false
  navFiredOnPartial = false
  withdrawProvisionalRecognition()
  getQuoteMatcher().reset()
  resetStoryMemory()
  suggestionTracker.reset()
  emitASRStatus('Stopped')
}

function handleMLVerseDetection(data: any) {
  console.log('🔍 Raw ML data:', JSON.stringify(data))
  // --- agentic layer (added post-recovery) ---
  if (preacherCommandsEnabled() && voiceCommands?.isInPrayer()) {
    console.log('🙏 Prayer mode — detection suppressed')
    return
  }
  // Learned per-preacher alias: "rome and" → Romans
  if (data.book && resolveBookId(data.book) === undefined && ledger) {
    const alias = ledger.resolveAlias(activePreacherId(), data.book)
    if (alias) {
      // Stored value may be a full ref ("Romans 8:1") or a bare book name.
      const bookOnly = alias.replace(/\s+\d+(?::\d+)?$/, '')
      console.log(`🔤 Alias resolved: "${data.book}" → ${bookOnly}`)
      data = { ...data, book: bookOnly }
    }
  }
  if (typeof data.confidence === 'number') lastResolverConfidence = data.confidence
  // Seasonal prior: in-season chapters get a small confidence boost
  if (getSetting('seasonalEnabled') && typeof data.confidence === 'number') {
    const boost = seasonalBoost(data.book, data.chapter ?? null, new Date())
    if (boost > 1) {
      data = { ...data, confidence: Math.min(1, data.confidence * boost) }
    }
  }
  // "We'll come back to that" — queue instead of display
  if (intentEngine.shouldDefer() && data.chapter) {
    const ref = `${data.book} ${data.chapter}:${data.verse || 1}`
    verseQueue.push({ ref, reason: 'deferred by preacher', ts: Date.now() })
    emitQueueUpdated(verseQueue)
    console.log(`🗂️ Queued (deferred): ${ref}`)
    return
  }
  const refString = `${data.book} ${data.chapter}:${data.verse ?? ''}`
  queueRecognitionReview(data)
  if (data.confidence < 0.85) {
    console.log('⏭️ Low confidence:', refString, data.confidence)
    return
  }
  console.log(`🎯 ML Detected: ${refString} (confidence: ${data.confidence})`)
  console.log(`   → verse from ML: ${data.verse} (type: ${typeof data.verse})`)
  if (getSetting('falsePositiveFilterEnabled') && transitionDetector) {
    const segment = transitionDetector.getCurrentSegment()
    if (falsePositiveFilter.shouldBlock(
      { book: data.book, chapter: data.chapter, verse: data.verse, confidence: data.confidence, explicitBook: data.explicitBook },
      recentTranscriptBuffer,
      segment.type
    )) {
      return
    }
  }
  if (data.book && data.chapter && data.verse && !verseExists(data.book, data.chapter, data.verse)) return
  if (!shouldEmit(detectionKey(data))) {
    console.log('⏭️ Skipping duplicate:', refString)
    return
  }
  session.onReferenceDetected({
    book: data.book,
    chapter: data.chapter,
    verse: data.verse || null,
    rangeEnd: data.rangeEnd || data.endVerse || null
  })
}

function lookupVerseText(book: string, chapter: number, verse: number, version = 'KJV'): string {
  const bookId = resolveBookId(book)
  if (db && bookId !== undefined) {
    try {
      const row = db
        .prepare(
          `SELECT verse as text FROM bible
           WHERE Book = ? AND Chapter = ? AND Versecount = ? AND Version = ?`
        )
        .get(bookId, chapter, verse, version) as { text: string } | undefined
      return row?.text || ''
    } catch {
      return ''
    }
  }
  return ''
}

let lastNamedPassage: { name: string; at: number } | null = null

/** A nav command already acted on from a partial; its final must not act again. */
let navFiredOnPartial = false

/** The session handles fast and standalone navigation as well as verse
 * jumps. Report only commands it acted on, using the same configured phrase. */
function handleSessionCommand(text: string): boolean {
  if (!preacherCommandsEnabled()) return false
  const before = session.currentVerse
  const consumed = session.onCommand(text)
  if (consumed && session.currentVerse !== before && session.currentVerse !== null) {
    const next = session.isNextCommand(text)
    const previous = session.isPreviousCommand(text)
    const phrases = next ? activeCommandConfig.navNext : previous ? activeCommandConfig.navPrevious : []
    voiceCallbacks.onCommand({
      kind: next ? 'navigate-next' : previous ? 'navigate-previous' : 'correction-verse',
      utterance: text,
      phrase: longestCommandPhrase(text, phrases) ?? text,
      ...(!next && !previous ? { value: session.currentVerse } : {}),
      ts: Date.now()
    })
  }
  return consumed
}

function handleASRText(text: string, isFinal = true) {
  if (activeCommandConfig.ignoreTails?.length) {
    text = stripIgnoreTails(text, activeCommandConfig.ignoreTails)
  }
  if (isFinal && handleSessionCommand(text)) {
    withdrawProvisionalRecognition()
    discardPartialReference()
    getQuoteMatcher().clearBuffer()
    resetStoryMemory()
    return
  }
  const before = previewRevision
  const completeReference = sendTranscript(text, isFinal)
  if (previewRevision !== before || completeReference) {
    // A complete spoken reference wins over older words in the quote buffer.
    getQuoteMatcher().clearBuffer()
    resetStoryMemory()
    suggestionTracker.reset()
    withdrawProvisionalRecognition()
    return
  }
  // A quote within a named passage is more precise than its title. Keep an
  // interim Psalm 23:1 when "the Lord is my shepherd" becomes final rather
  // than withdrawing it and replacing it with the whole named psalm.
  const named = isFinal ? findNamedPassage(text) : null
  const quoteResults = quotesForNamedPassage(getQuoteMatcher().findAllQuotedVerses(), named)
  // A genuinely new named passage still beats unrelated older context.
  // Even a repeated title consumes its chunk instead of reviving a story.
  if (named && quoteResults.length === 0) {
    withdrawProvisionalRecognition()
    if (!(lastNamedPassage?.name === named.name && Date.now() - lastNamedPassage.at < 60_000)) {
      const accepted = stageRecognizedPassage({
        book: named.book, chapter: named.chapter, verse: named.verse,
        endVerse: named.end > named.verse ? named.end : null,
        source: 'named', evidence: [named.name]
      }, text)
      if (accepted) lastNamedPassage = { name: named.name, at: Date.now() }
    }
    getQuoteMatcher().clearBuffer()
    resetStoryMemory()
    passageMatcher?.updateTranscript(text, true)
    return
  }
  const passage = passageMatcher?.updateTranscript(text, isFinal)
  if (preacherCommandsEnabled() && voiceCommands?.isInPrayer()) {
    withdrawProvisionalRecognition()
    return
  }
  // The tracker owns duplicate suppression across quote/story refinements.
  // Retain the strongest current quotation even when it was already suggested.
  if (quoteResults.length > 0) {
    const best = quoteResults[0]
    const bestBook = best.ref.split(' ').slice(0, -1).join(' ')
    lastQuoteCandidates = candidatesFromQuotes(quoteResults.slice(0, 4))
    const accepted = stageRecognizedPassage({
      book: bestBook, chapter: best.chapter, verse: best.verse, source: 'quote', evidence: [text],
      ...(passage?.book === bestBook && passage.chapter === best.chapter ? { passageId: passage.passageId } : {})
    }, text, best.confidence, isFinal)
    if (accepted) {
      let queued = false
      // Do not leave runner-up references in the persistent queue from an
      // interim hypothesis that may subsequently be withdrawn.
      for (const alternative of isFinal ? quoteResults.slice(1, 4) : []) {
        if (!verseQueue.some(q => q.ref === alternative.ref)) {
          verseQueue.push({ ref: alternative.ref, reason: 'possible quote match', ts: Date.now() })
          queued = true
        }
      }
      if (queued) emitQueueUpdated(verseQueue)
      return
    }
    lastQuoteCandidates = []
  }
  if (passage && stageRecognizedPassage({ ...passage, source: 'passage' }, text, undefined, isFinal)) return
  withdrawProvisionalRecognition()
  if (isFinal) suggestAllusion(text)
}

function stageRecognizedPassage(candidate: RecognitionCandidate, heard: string, strength?: number, isFinal = true): boolean {
  if (!db || !verseExists(candidate.book, candidate.chapter, candidate.verse)) return false
  if (candidate.endVerse && !verseExists(candidate.book, candidate.chapter, candidate.endVerse)) return false
  // A reference existing in another translation is not enough: only accept a
  // suggestion when the entire requested passage can actually be previewed.
  const version = getSetting('displayVersion') || 'KJV'
  const reference = `${candidate.book} ${candidate.chapter}:${candidate.verse}-${candidate.endVerse ?? candidate.verse}`
  if (!readVersePreview(db, reference, version)) return false
  if (getSetting('falsePositiveFilterEnabled') && transitionDetector && falsePositiveFilter.shouldBlock(
    { ...candidate, confidence: strength },
    [...recentTranscriptBuffer, ...heard.toLowerCase().split(/\s+/)].slice(-60),
    transitionDetector.getCurrentSegment().type
  )) return false
  if (provisionalRecognition) {
    const previous = provisionalRecognition.candidate
    const broadens = previous.book === candidate.book && previous.chapter === candidate.chapter &&
      candidate.verse <= previous.verse && (candidate.endVerse ?? candidate.verse) >= (previous.endVerse ?? previous.verse) &&
      (candidate.endVerse ?? candidate.verse) - candidate.verse > (previous.endVerse ?? previous.verse) - previous.verse
    if (broadens) withdrawProvisionalRecognition()
  }
  const recognition = suggestionTracker.accept(candidate)
  if (!recognition) {
    if (isFinal) provisionalRecognition = null // The final confirms the preview.
    return true
  }
  if (provisionalRecognition && provisionalRecognition.recognition.suggestionId !== recognition.suggestionId) {
    withdrawProvisionalRecognition()
  }
  if (candidate.source !== 'quote') lastQuoteCandidates = []
  lastResolverConfidence = strength
  pendingRecognition = recognition
  try {
    queueRecognitionReview(candidate, heard)
    session.onReferenceDetected({ ...candidate, rangeEnd: candidate.endVerse, version })
    // An early match must not advance to the following verse when the same
    // unfinished quotation arrives again with its last few words attached.
    session.exitReadingMode()
    provisionalRecognition = isFinal ? null : { candidate, recognition }
  } finally {
    pendingRecognition = undefined
  }
  return true
}

let mainWindow: BrowserWindow | null = null

const outputWindows: Record<string, BrowserWindow | null> = {
  main: null,
  alternate: null,
  third: null
}

/** Output ids whose window is open right now. */
function openOutputIds(): string[] {
  return Object.keys(outputWindows).filter((id) => {
    const win = outputWindows[id]
    return !!win && !win.isDestroyed()
  })
}

/**
 * The dashboard's outputs card and the Settings display map draw what
 * `get-outputs-status` answers. This tells them to ask again: a display came
 * or went, an output window opened or closed, or a job or a display choice
 * changed. Without it they would show the room as it was when they mounted.
 */
function notifyOutputsChanged(): void {
  broadcastToWindows('on-outputs-changed', null)
}

/** Where this output belongs right now, per the operator's choice and what
 *  is actually plugged in. Read fresh every time: displays come and go, and
 *  so does the setting. */
function placementFor(id: string) {
  return placeOutput(
    id,
    electronScreen.getAllDisplays(),
    electronScreen.getPrimaryDisplay().id,
    getSetting('outputDisplays') as Partial<Record<string, number | 'none'>>
  )
}

/**
 * Put an already-open output where it now belongs.
 *
 * Choosing a screen in Settings used to do nothing at all while the
 * projector was open: the placement was read only inside the constructor,
 * and nothing in the app ever moved a window afterwards. So the operator
 * picked "Display 2", watched the picture stay where it was, and reasonably
 * concluded the setting was broken.
 *
 * Fullscreen has to come off before a move and go back on after — a
 * fullscreen window on macOS owns its Space and ignores setBounds, which is
 * the failure that looks like the move "half worked".
 */
function moveOutputToItsDisplay(id: string): boolean {
  const win = outputWindows[id]
  if (!win || win.isDestroyed()) return false
  const placement = placementFor(id)
  if (placement.disabled) {
    win.close()
    return true
  }
  moveOutputWindow(win, placement, electronScreen.getPrimaryDisplay())
  console.log(
    `🖥️ Output "${id}" moved → ${placement.display ? `display ${placement.display.id}${placement.fullscreen ? ', fullscreen' : ''}` : 'windowed on primary'}`
  )
  return true
}

function createOutputWindow(id: string, title: string) {
  if (placementFor(id).disabled) return
  if (outputWindows[id]) {
    // Already open: honour whatever screen it is meant to be on now, rather
    // than only raising it. Pressing the projector button again is how an
    // operator asks for exactly this.
    moveOutputToItsDisplay(id)
    outputWindows[id]?.focus()
    return
  }
  // The projector gets the external screen. See output/displays.ts.
  const placement = placementFor(id)
  const onDisplay = placement.display?.bounds
  const win = new BrowserWindow({
    ...(onDisplay
      ? { x: onDisplay.x, y: onDisplay.y, width: onDisplay.width, height: onDisplay.height }
      : { width: 1280, height: 720 }),
    fullscreen: placement.fullscreen,
    title,
    transparent: true,
    frame: false,
    // Frameless window
    hasShadow: false,
    backgroundColor: '#00000000',
    // Transparent background
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // Nobody ever clicks inside the projector window, so Chromium's
      // "a user gesture is needed before sound" rule would leave every
      // video silent there, permanently.
      autoplayPolicy: 'no-user-gesture-required',
      // Keeps painting and timing while covered or shared (see the switches
      // at the top of this file).
      backgroundThrottling: false
    }
  })
  console.log(
    `🖥️ Output "${id}" → ${placement.display ? `display ${placement.display.id} (${onDisplay!.width}×${onDisplay!.height})${placement.fullscreen ? ', fullscreen' : ''}` : 'windowed on primary'}`
  )
  const query = `?outputId=${id}`
  if (isDev) {
    win.loadURL(`http://localhost:5173/output.html${query}`)
  } else {
    win.loadFile(path.join(__dirname, '../dist/output.html'), {
      search: query
    })
  }
  win.on('closed', () => {
    outputWindows[id] = null
    notifyOutputsChanged()
  })
  outputWindows[id] = win
  notifyOutputsChanged()
}

function createWindow() {
  const { workArea } = electronScreen.getDisplayNearestPoint(electronScreen.getCursorScreenPoint())
  const width = Math.min(1400, workArea.width)
  const height = Math.min(900, workArea.height)
  mainWindow = new BrowserWindow({
    width,
    height,
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    backgroundColor: '#050505',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // The operator is often in another app mid-service (Zoom, a browser):
      // the catches' clocks and the phone remote run in this window.
      backgroundThrottling: false
    }
  })
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

let designWindow: BrowserWindow | null = null

function createDesignWindow() {
  designWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Design Sandbox',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  if (isDev) {
    designWindow.loadURL('http://localhost:5173/design.html')
  } else {
    designWindow.loadFile(path.join(__dirname, '../dist/design.html'))
  }
  designWindow.on('closed', () => {
    designWindow = null
  })
}

ipcMain.on('open-output', (_event, outputId) => {
  const role = roleFor(String(outputId), getSetting('outputRoles') as Record<string, unknown>)
  createOutputWindow(outputId, ROLE_TITLES[role])
})

/* -------- screen state, output roles, message alerts (BUILD-MAP 2.10–2.11) -------- */

ipcMain.handle('screen-state-set', (_event, state: string) => {
  if (isScreenState(state)) screen.set(state)
  return screen.get()
})
ipcMain.handle('screen-state-get', () => screen.get())
ipcMain.handle('output-role-get', (_event, outputId: string) =>
  roleFor(String(outputId), getSetting('outputRoles') as Record<string, unknown>)
)
ipcMain.handle(
  'alert-show',
  (
    _event,
    {
      text,
      target,
      durationSec,
      values
    }: { text: string; target?: AlertTarget; durationSec?: number | null; values?: Record<string, string> }
  ) => {
    const seconds = durationSec === null ? null : durationSec ?? getSetting('alertDefaultSeconds')
    // Templates are filled at trigger time, so '{clock}' and '{timer:x}' show
    // the values as they were when the operator pressed Show.
    const filled = fillTokens(String(text ?? ''), tokenContext(values))
    return alerts.show(filled, { target, durationSec: seconds })
  }
)

/** Which holes a saved message still has, so the Live panel can prompt. */
ipcMain.handle('alert-inspect', (_event, text: string) => {
  const ctx = tokenContext()
  return {
    slots: parseTokens(String(text ?? '')),
    unfilled: hasUnfilledTokens(String(text ?? ''), ctx),
    preview: fillTokens(String(text ?? ''), ctx)
  }
})

/* -------- service timers (BUILD-MAP 2.16) -------- */

ipcMain.handle('timers-list', () => timers.snapshot())
ipcMain.handle('timers-create', (_event, input) => {
  const created = timers.create(input)
  if (created) persistTimers()
  return created
})
ipcMain.handle('timers-update', (_event, { id, patch }) => {
  const updated = timers.update(String(id), patch)
  if (updated) persistTimers()
  return updated
})
ipcMain.handle('timers-remove', (_event, id: string) => {
  const removed = timers.remove(String(id))
  if (removed) persistTimers()
  return removed
})
ipcMain.handle('timers-start', (_event, id: string) => timers.start(String(id)))
ipcMain.handle('timers-pause', (_event, id: string) => timers.pause(String(id)))
ipcMain.handle('timers-reset', (_event, id: string) => timers.reset(String(id)))
ipcMain.handle('alert-dismiss', () => alerts.dismiss())
ipcMain.handle('alert-current', () => alerts.current())

/* -------- keyword search over the Bible text (BUILD-MAP 2.12) -------- */

ipcMain.handle('bible-keyword-search', (_event, { query, version, limit }: { query: string; version?: string; limit?: number }) => {
  if (!db) return []
  try {
    return searchBible(db, String(query ?? ''), { version: version || getSetting('displayVersion') || 'KJV', limit })
  } catch (error) {
    console.error('Bible keyword search failed:', error)
    return []
  }
})

ipcMain.on('process-text', (_event, text) => {
  if (!text) return
  console.log('📥 Manual input:', text)
  manualReferenceInput = true
  try { sendTranscript(text, true) } finally { manualReferenceInput = false }
  emitTranscript(text)
  /*
   * Manual input is speech the operator typed instead of said, so it
   * belongs on the transcript surfaces like any other sentence. Without
   * this it drove detection perfectly and left the preacher transcript, the
   * bottom strip and the sermon notes blank — the one path where the app
   * caught a verse and could not show what had been said to catch it.
   */
  emitTranscriptLine(text, true)
  heardWindow.note(text, true)
  allusionFinder.names.note(text)
})

/*
 * Starting to listen IS starting the service, as far as the outside world is
 * concerned.
 *
 * Everything that reaches a phone — transcript chunks, detected verses,
 * segments — is keyed on `activeServiceId`, and every one of those functions
 * opens with `if (!activeServiceId) return`. So with no service row the app
 * transcribes perfectly, drives the projector perfectly, and posts NOTHING:
 * the companion page says "no live service yet today" through an entire
 * sermon. The only thing that ever created that row was a button in the
 * Cloud tab that an operator has no reason to press and no way to guess at.
 *
 * Pressing Start Listening is the operator saying the service has begun.
 * That is the signal, so it is the one used, and the cloud half stops being
 * a separate ritual nobody performs.
 *
 * Fire-and-forget on purpose: the microphone must not wait on the network.
 * If this fails the service runs exactly as it did before — locally correct,
 * publicly silent — and says so in the log rather than blocking the start.
 */
/** Why the last attempt to open the cloud service failed — shown on the companion card. */
let cloudServiceError: string | null = null

async function ensureCloudService(): Promise<void> {
  if (publicSharingPaused) return
  if (!isCloudConfigured()) return
  if (getActiveServiceId()) return
  try {
    /* No sermon title: there is no setting holding one, and the page reads
       fine without it. The operator can name the service in the Cloud tab. */
    const res = await serializeService(async () => {
      if (publicSharingPaused || getActiveServiceId()) return {success:true,serviceId:getActiveServiceId()}
      return startService({ preacherId: activePreacherId() || null })
    })
    if (res.success && res.serviceId) {
      cloudServiceError = null
      console.log(`☁️  Service opened for the companion page: ${res.serviceId}`)
    } else if (!res.success) {
      cloudServiceError = res.error ?? 'could not open the service'
      console.error(`☁️  Could not open the cloud service — the phone page will stay empty: ${res.error}`)
    }
  } catch (e: any) {
    cloudServiceError = e?.message ?? 'could not open the service'
    console.error('☁️  Could not open the cloud service:', e?.message)
  }
}

ipcMain.on('start-listening', (_event, deviceLabel) => {
  if (soundCheck.active) return
  console.log('▶️ Start listening requested', deviceLabel ? `(device: ${deviceLabel})` : '')
  startASR(deviceLabel)
  if (deviceLabel !== PRACTICE_SERMON_DEVICE) void ensureCloudService()
})

/* The operator stepped the live reading to another page: every output follows. */
ipcMain.on('set-live-slide', (_event, index: unknown) => {
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 999) return
  broadcastToWindows('on-live-slide', index)
})

ipcMain.on('stop-listening', () => {
  console.log('⏹️ Stop listening requested')
  stopASR()
  /* Deliberately NOT ending the cloud service. An operator stops and starts
     listening several times in one service — between songs, over a
     testimony, whenever the room gets loud — and ending the service on the
     first stop would take the page down mid-sermon and orphan every chunk
     that followed. The service ends when the operator ends it, or with the
     app. */
})

ipcMain.on('push-to-live', (_event, reference?: string, version?: string) => {
  if (reference !== undefined && (typeof reference !== 'string' || !stageVerseReference(reference, version))) return
  pushPreviewToLive('operator')
})

/* -------- 2026-09 engine additions: IPC -------- */

// Auto mode (item 16): operator switch, gated by eligibility; clash resolution.
ipcMain.handle('auto-mode-set', (_event, { preacherId, enabled }) => {
  const pid = preacherId || activePreacherId()
  if (!pid || !ledger) return { success: false, error: 'no preacher' }
  if (enabled) return { success: false, enabled: false, error: 'Live scripture requires an operator press' }
  const ok = ledger.setAutoModeEnabled(pid, !!enabled)
  broadcastState()
  return { success: ok, enabled: ledger.isAutoModeEnabled(pid), eligible: ledger.stats(pid).autoModeEligible }
})
ipcMain.handle('auto-mode-get-candidates', () => ({
  candidates: lastCandidates,
  clash: autoMode.hasPendingClash() ? autoMode.pendingClash() : null
}))
ipcMain.handle('auto-mode-resolve-clash', (_event, index: number) => {
  const chosen = autoMode.resolveClash(index)
  if (!chosen) return { success: false }
  session.onReferenceDetected({
    book: chosen.book,
    chapter: chosen.chapter,
    verse: chosen.verse,
    rangeEnd: chosen.endVerse ?? null
  })
  pushPreviewToLive('operator picked from clash')
  return { success: true, chosen }
})
ipcMain.handle('auto-mode-dismiss-clash', () => {
  autoMode.dismissClash()
  return { success: true }
})
ipcMain.on('operator-reversal', (_event, kind) => noteOperatorReversal(kind))

// Voice command log + "How they say it" (item 17).
ipcMain.handle('command-log-recent', (_event, { preacherId, limit }) =>
  commandLog?.recent(preacherId || activePreacherId(), limit ?? 50) ?? []
)
ipcMain.handle('command-log-false-positives', (_event, preacherId?: string) =>
  commandLog?.falsePositives(preacherId || activePreacherId()) ?? []
)
ipcMain.handle('command-log-suppress', (_event, { preacherId, utterance }) => {
  commandLog?.suppress(preacherId || activePreacherId(), utterance)
  return { success: true }
})
ipcMain.handle('command-log-teach', (_event, { preacherId, utterance, kind }) => {
  const phrase = commandLog?.teach(preacherId || activePreacherId(), utterance, kind) ?? null
  if (ledger) applyLanguageAndConfig()
  return { success: phrase !== null, phrase }
})
ipcMain.handle('get-preacher-command-config', (_event, preacherId?: string) =>
  loadPreacherCommandConfig(app.getPath('userData'), preacherId || activePreacherId())
)
ipcMain.handle('save-preacher-command-config', (_event, { preacherId, config }) => {
  savePreacherCommandConfig(app.getPath('userData'), preacherId || activePreacherId(), config)
  if (ledger) applyLanguageAndConfig()
  return { success: true }
})

// Per-preacher vocabulary (item 18).
ipcMain.handle('vocabulary-get', (_event, preacherId?: string) =>
  vocabulary?.get(preacherId || activePreacherId()) ?? { terms: [] }
)
ipcMain.handle('vocabulary-set', (_event, { preacherId, terms }) => {
  const pid = preacherId || activePreacherId()
  if (pid) { teachingFor(pid); teachings().patch(pid, { vocabulary: terms }) }
  vocabulary?.set(preacherId || activePreacherId(), terms)
  if (ledger) applyLanguageAndConfig()
  return { success: true }
})

// Remote control pairing (item 22).
ipcMain.handle('remote-generate-code', () => pairing?.generateCode() ?? null)
ipcMain.handle('remote-current-code', () => pairing?.currentCode() ?? null)
ipcMain.handle('remote-list-devices', () => pairing?.listDevices() ?? [])
ipcMain.handle('remote-connected', () => connectedDevices())
ipcMain.handle('remote-revoke', (_event, deviceId: string) => {
  pairing?.revoke(deviceId)
  return { success: true }
})
ipcMain.handle('remote-revoke-all', () => {
  pairing?.revokeAll()
  return { success: true }
})

// Companion: share link, viewers, polls, inbound relay frames (items 7, 9, 10).
ipcMain.handle('companion-share-link', () => ({
  url: shareLink(getSetting('publicWebUrl'), getSetting('accountSlug')),
  mode: parseShareMode(getSetting('companionShareMode')),
  streamUrl: getSetting('streamUrl')
}))
ipcMain.handle('companion-viewer-snapshot', () => viewerStats.snapshot())
ipcMain.handle('companion-poll-current', () => polls.current())
ipcMain.handle('companion-poll-close', (_event, { pollId, index }) => polls.close(pollId, index, 'operator'))
/** Relay → laptop. The relay (or a local test client) forwards raw frames here. */
export function handleCompanionFrame(raw: string, remoteIp: string): void {
  const msg = parseCompanionMessage(raw)
  if (!msg) return
  if (msg.type === 'hello') {
    if (parseShareMode(getSetting('companionShareMode')) === 'wifi-only') {
      viewerStats.connect(msg.viewerId, remoteIp)
      if (!viewerStats.isInVenue(msg.viewerId)) {
        viewerStats.disconnect(msg.viewerId)
        return
      }
    } else {
      viewerStats.connect(msg.viewerId, remoteIp)
    }
    const snap = viewerStats.snapshot()
    emitEngineEvent('on-viewer-count', snap)
    broadcastToClients({ type: 'viewer-count', ...snap })
  } else if (msg.type === 'bye') {
    viewerStats.disconnect(msg.viewerId)
    emitEngineEvent('on-viewer-count', viewerStats.snapshot())
  } else if (msg.type === 'vote') {
    const w = viewerStats.isInVenue(msg.viewerId) ? VOTE_WEIGHT_IN_VENUE : VOTE_WEIGHT_REMOTE
    if (polls.vote(msg.pollId, msg.viewerId, msg.candidateIndex, w)) {
      emitEngineEvent('on-poll-tally', { pollId: msg.pollId, tally: polls.tally(msg.pollId) })
    }
  }
}
ipcMain.on('companion-frame', (_event, { raw, ip }) => handleCompanionFrame(raw, ip || '127.0.0.1'))

// Command palette search (item 6) — registry + local lexical index.
ipcMain.handle('search-query', async (_event, { query, limit }) => searchIndex.search(query, { limit: limit ?? 8 }))

// Library folders (item 12).
ipcMain.handle('folders-list', (_event, { libraryId, itemIds }) => {
  const idx = folderIndex(libraryId)
  if (Array.isArray(itemIds)) idx.strip(itemIds)
  return { folders: idx.listFolders(), stats: idx.stats(itemIds ?? []) }
})
ipcMain.handle('folders-create', (_event, { libraryId, name }) => folderIndex(libraryId).createFolder(name))
ipcMain.handle('folders-rename', (_event, { libraryId, id, name }) => folderIndex(libraryId).renameFolder(id, name))
ipcMain.handle('folders-color', (_event, { libraryId, id, color }) => folderIndex(libraryId).setColor(id, color))
ipcMain.handle('folders-delete', (_event, { libraryId, id }) => folderIndex(libraryId).deleteFolder(id))
ipcMain.handle('folders-move-item', (_event, { libraryId, itemId, folderId }) =>
  folderIndex(libraryId).moveItem(itemId, folderId ?? null)
)
ipcMain.handle('folders-reorder', (_event, { libraryId, ids }) => folderIndex(libraryId).reorderFolders(ids))
ipcMain.handle('folders-of-item', (_event, { libraryId, itemId }) => folderIndex(libraryId).folderOf(itemId))

// Scripture → background preset (stock backgrounds, still-to-do list).
ipcMain.handle('preset-for-reference', (_event, { book, chapter, verse }) =>
  presetForReference({ book, chapter, verse }, getSetting('seasonalEnabled') ? seasonalThemeId(new Date()) : undefined)
)

// Song import (item 23): ChordPro / plain text / OpenLyrics → sections.
//
// Import is deliberately two steps. Parsing returns songs and writes nothing,
// so the UI can show the duplicate review before anything lands in the
// library; 'songs-import-commit' is the step that writes. A church dropping
// forty files from SongSelect gets to look before it leaps.
ipcMain.handle('songs-import-text', (_event, { text, filename }) => parseSong(text, filename))
ipcMain.handle('songs-import-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Songs', extensions: ['cho', 'chopro', 'crd', 'txt', 'xml'] }]
  })
  if (result.canceled) return { success: false, canceled: true }
  // Per file, not per batch: a folder of exports usually contains one file
  // saved wrong (binary, truncated, half a gigabyte of something else). That
  // file names itself in `errors` and the other thirty-nine still import —
  // and an unreadable file never takes the main process down with it.
  const parsed: ImportedSong[] = []
  const errors: { file: string; error: string }[] = []
  for (const fp of result.filePaths) {
    const file = path.basename(fp)
    try {
      parsed.push(parseSong(fs.readFileSync(fp, 'utf-8'), file))
    } catch (err) {
      errors.push({ file, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return { success: true, songs: parsed, errors }
})
ipcMain.handle('songs-import-commit', (_event, { songs: parsed }) => songStore().importMany(parsed ?? []))

// Song library CRUD (item 1.11) — <userData>/songs.json, seeded with
// public-domain hymns on first run.
ipcMain.handle('songs-list', () => songStore().list())
// Null when the file read cleanly. Anything else is a songs.json the store
// could not parse: it has gone read-only rather than overwrite the church's
// library with an empty one, and the operator has to be told that before
// they conclude their songs are simply gone and start re-importing.
ipcMain.handle('songs-problem', () => songStore().problem)
ipcMain.handle('songs-get', (_event, { id }) => songStore().get(id))
ipcMain.handle('songs-add', (_event, { song }) => songStore().add(song))
// The store throws on a missing id or an empty title; across IPC that would
// reach the renderer as an unhandled rejection with a mangled message, so it
// becomes a null the caller can branch on instead.
ipcMain.handle('songs-update', (_event, { id, patch }) => {
  try {
    return songStore().update(id, patch)
  } catch {
    return null
  }
})
ipcMain.handle('songs-remove', (_event, { id }) => songStore().remove(id))
// Online lyric sources (LRCLIB search, YouTube captions) — electron/songs/lyricsIpc.ts
registerLyricsIpc(ipcMain)

// Evals (item 25): export ledger corrections as anonymised fixtures.
ipcMain.handle('evals-export-fixtures', async () => {
  const out = path.join(app.getPath('userData'), 'eval-fixtures.jsonl')
  const n = await exportFixturesFromLedger(path.join(app.getPath('userData'), 'preacher-ledgers'), out, { anonymise: true })
  return { success: true, file: out, count: n }
})

/* -------- agentic layer IPC (added post-recovery) -------- */

ipcMain.handle('get-preacher-stats', (_event, preacherId?: string) => {
  if (!ledger) return []
  const ids = preacherId ? [preacherId] : ledger.listPreacherIds()
  const active = activePreacherId()
  if (active && !ids.includes(active)) ids.push(active)
  return ids.map((id) => {
    const profile = loadProfile(id)
    const stats = ledger!.stats(id)
    return { ...stats, name: stats.name || profile?.name || id }
  })
})

ipcMain.handle('get-review-items', () => {
  return ledger?.getReviewItems() ?? []
})

ipcMain.handle(
  'resolve-review-item',
  (_event, { id, resolution, amendedTo }) => {
    if (!['confirmed', 'rejected', 'amended', 'skipped'].includes(resolution)) throw new Error('Choose a review answer.')
    if (resolution === 'amended' && (!amendedTo || !verseExists(amendedTo.book, amendedTo.chapter, amendedTo.verse ?? 1))) throw new Error('Choose an existing Bible reference.')
    if (!ledger?.resolveReviewItem(null, id, resolution, amendedTo)) throw new Error('This example was already reviewed or is no longer available.')
    return { success: true }
  }
)

function requirePreacher(id: string) {
  if (typeof id !== 'string' || !id || !loadProfile(id)) throw new Error('Choose a saved preacher profile.')
  if (!ledger) throw new Error('The speech engine is not available in this window.')
}
ipcMain.handle('preacher-learning-get', (_event, id: string) => {
  requirePreacher(id)
  const profile = loadProfile(id)!
  const history = profile.sermonHistory
  const books = new Map<string, number>()
  for (const item of profile.favoriteVerses) {
    const book = item.ref.replace(/\s+\d.*$/, '')
    books.set(book, (books.get(book) ?? 0) + item.frequency)
  }
  return {
    ...teachingFor(id), stats: ledger!.stats(id),
    gates: { trust: getSetting('autoModeMinTrust'), samples: getSetting('autoModeMinSamples'), services: getSetting('autoModeMinServices') },
    reviews: ledger!.getReviewItems(id), history: ledger!.history(id), legacySamples: ledger!.legacySamples(id), serviceOpen: ledger!.hasOpenService(id),
    habits: { avgSermonMin: history.length ? Math.round(history.reduce((n, s) => n + s.durationMinutes, 0) / history.length) : null,
      mostQuoted: profile.favoriteVerses[0]?.ref ?? null, topBooks: [...books].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([b]) => b), lastPreached: history.at(-1)?.date ?? null },
    recent: history.slice(-5).reverse().map((s) => ({ date: s.date, verses: s.versesUsed.length, minutes: s.durationMinutes, accuracy: null })),
  }
})
ipcMain.handle('preacher-learning-save', (_event, { preacherId, patch }) => {
  requirePreacher(preacherId)
  teachingFor(preacherId)
  const result = teachings().patch(preacherId, patch)
  if (preacherId === activePreacherId()) applyLanguageAndConfig()
  return result
})
ipcMain.handle('preacher-review-missed', (_event, { preacherId, heard }) => {
  requirePreacher(preacherId)
  const text = typeof heard === 'string' ? heard.trim() : ''
  if (!text || text.length > 1200) throw new Error('Enter what was said, up to 1,200 characters.')
  return ledger!.addReviewItem({ preacherId, kind: 'miss', reason: 'missed', ts: Date.now(), heard: text, proposed: null })
})
ipcMain.handle('preacher-use-offline', () => {
  if (isListening || soundCheck.active) throw new Error('Stop listening before changing the speech engine.')
  setSetting('asrProvider', 'whisper-local')
  return { success: true }
})
ipcMain.handle('preacher-sound-check-start', (event, { preacherId, promptIndex, deviceLabel }) => {
  requirePreacher(preacherId)
  if (isListening) throw new Error('Stop service listening before starting a sound check.')
  if (soundCheck.active) throw new Error('A sound check is already running.')
  if (!Number.isInteger(promptIndex)) throw new Error('Choose a sound-check reference.')
  soundCheckOwner = event.sender.id
  const result = soundCheck.start(preacherId, promptIndex, typeof deviceLabel === 'string' ? deviceLabel : undefined)
  const owner = event.sender.id
  event.sender.once('destroyed', () => { if (soundCheckOwner === owner) { soundCheck.stop(); soundCheckOwner = null } })
  return result
})
ipcMain.handle('preacher-sound-check-state', (event) => event.sender.id === soundCheckOwner ? soundCheck.snapshot() : null)
ipcMain.handle('preacher-sound-check-stop', (event, sessionId: string) => event.sender.id === soundCheckOwner && soundCheck.snapshot()?.sessionId === sessionId ? soundCheck.stop() : null)
ipcMain.on('mic-capture-error', (_event, message) => {
  if (soundCheck.active) soundCheck.fail(typeof message === 'string' ? message : 'Microphone capture failed.')
  else { stopASR(); emitASRStatus(`Error: ${message}`) }
})

ipcMain.handle('get-verse-queue', () => verseQueue)

ipcMain.handle('show-queued-verse', (_event, ref: string) => {
  if (typeof ref !== 'string' || !stageVerseReference(ref)) return { success: false }
  const idx = verseQueue.findIndex((q) => q.ref === ref)
  if (idx >= 0) verseQueue.splice(idx, 1)
  emitQueueUpdated(verseQueue)
  return { success: true }
})

/**
 * The operator asks "what was that?". Unlike the auto path this never
 * abstains: every matcher is tried on the last words spoken and the nearest
 * four come back for a person to choose from. Nothing is staged here.
 */
ipcMain.handle('find-heard-scripture', async (_event, payload: { text?: string }) => {
  // No text given means "what was just said": words older than the window
  // have expired, so a press long after the sentence finds nothing.
  const words = (typeof payload?.text === 'string' ? payload.text : heardWindow.recent()).split(/\s+/).filter(Boolean).slice(-25)
  const version = getSetting('displayVersion') || 'KJV'
  const matches: { reference: string; title: string; text: string; version: string; evidence: string[]; kind: string }[] = []
  for (const hit of await allusionFinder.find(words)) {
    const reference = `${hit.book} ${hit.chapter}:${hit.verse}${hit.endVerse > hit.verse ? `-${hit.endVerse}` : ''}`
    // Only what the selected translation can actually show.
    const preview = db ? readVersePreview(db, reference, version) : null
    if (preview) matches.push({ reference, title: hit.title, text: preview.text, version, evidence: hit.evidence, kind: hit.kind })
  }
  return { heard: words.join(' '), meaning: allusionFinder.meaning, matches }
})

ipcMain.handle('set-display-version', (_event, version: string) => {
  setSetting('displayVersion', version)
  console.log(`📖 Display translation → ${version}`)
  reEmitCurrentVerseInVersion(version)
  return { success: true }
})

ipcMain.handle('get-seasonal-theme', () => seasonalThemeId(new Date()))

ipcMain.handle('get-available-languages', () => availableLanguages())

ipcMain.handle('get-voice-command-config', () => ({
  merged: activeCommandConfig,
  user: loadUserCommandConfig(app.getPath('userData')),
  filePath: userCommandFilePath(app.getPath('userData'))
}))

ipcMain.handle('save-voice-command-config', (_event, userConfig) => {
  saveUserCommandConfig(app.getPath('userData'), userConfig ?? {})
  if (ledger) applyLanguageAndConfig()
  return { success: true }
})

/* -------- window-mic capture (no SoX dependency) -------- */

ipcMain.on('audio-chunk', (_event, chunk: ArrayBuffer) => {
  feedAudioChunk(Buffer.from(chunk))
})

ipcMain.on('audio-level', (_event, level: number) => {
  emitAudioLevel(level)
})

ipcMain.handle('get-audio-capture-capabilities', () => ({ deviceAudio: process.platform === 'win32' }))

ipcMain.handle('request-mic-permission', async () => {
  if (process.platform !== 'darwin') return { granted: true }
  try {
    const status = systemPreferences.getMediaAccessStatus('microphone')
    if (status === 'granted') return { granted: true }
    const granted = await systemPreferences.askForMediaAccess('microphone')
    return { granted }
  } catch (e: any) {
    return { granted: false, error: e?.message }
  }
})

/* -------- media display on the output windows -------- */

/*
 * Non-verse content on the projector — songs, today. Remembered here so an
 * output window opened mid-service can ask what is up, and cleared whenever a
 * verse or a picture takes the wall so nothing lingers behind them. One
 * thing is live at a time; the output windows draw whichever arrived last.
 */
let currentLiveContent: LiveContent | null = null

ipcMain.handle('push-live-content', (_event, content: LiveContent) => {
  if (!content || typeof content !== 'object' || (content.kind !== 'song' && content.kind !== 'slide')) return { success: false }
  currentLiveContent = content
  verseDelivery.clearLive()
  console.log(`🎵 Live: ${content.kind === 'song' ? `${content.title} — ${content.label}` : content.title}`)
  screen.onContentPushed()
  broadcastToWindows('on-live-content', content)
  return { success: true }
})

ipcMain.handle('get-live-content', () => currentLiveContent)
// One read prevents a new output mixing a previous verse with a newer song.
ipcMain.handle('get-output-content', () => ({ verse: verseDelivery.live, content: currentLiveContent }))

ipcMain.handle('show-media', (_event, imagePath: string, kind?: 'photo' | 'video') => {
  currentLiveContent = null
  verseDelivery.clearLive()
  // Trust the extension over the caller: a row dragged in before `kind`
  // existed carries none, and a video sent down the image path shows nothing.
  const isVideo = kind === 'video' || /\.(mp4|m4v|mov|webm)$/i.test(imagePath)
  console.log(`${isVideo ? '🎬' : '🖼️'} Showing media on output: ${path.basename(imagePath)}`)
  screen.onContentPushed()
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('on-show-media', imagePath, isVideo ? 'video' : 'photo')
  })
  return { success: true }
})

// Play / pause / restart / volume for a video on the wall. Broadcast like the
// media itself; the output windows decide what it means for them.
ipcMain.handle('media-control', (_event, action: { type: 'play' | 'pause' | 'toggle' | 'restart' | 'volume' | 'loop'; value?: number | boolean }) => {
  if (!action || typeof action.type !== 'string') return { success: false }
  broadcastToWindows('on-media-control', action)
  return { success: true }
})

ipcMain.handle('clear-media', () => {
  currentLiveContent = null
  verseDelivery.clearLive()
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('on-show-clean-background')
  })
  return { success: true }
})

// Companion QR — rendered as media on every open output so congregants can
// scan straight from the projector. URL comes from Settings (web url + slug).
/*
 * The companion code as SVG, for drawing inside the app.
 *
 * Vector rather than the PNG the projector path writes: the tile renders it
 * at whatever size the layout gives it and at whatever the display's pixel
 * ratio is, with no temp file to write, find stale, or clean up. About 1.5KB
 * of markup, so it crosses IPC as a string.
 *
 * Returns null rather than an error when there is no link yet — a tile with
 * nothing to encode is a normal state before a church has signed in, not a
 * failure worth a red note.
 */
ipcMain.handle('get-qr-svg', async (_event, size?: number) => {
  const url = shareLink(String(getSetting('publicWebUrl') ?? ''), String(getSetting('accountSlug') ?? ''))
  if (!url) return { success: true, url: null, svg: null }
  try {
    const { toString: qrToString } = await import('qrcode')
    const svg = await qrToString(url, {
      type: 'svg',
      margin: 1,
      width: typeof size === 'number' && size > 0 ? size : 256,
      color: { dark: '#e5f3f2', light: '#0e1413' }
    })
    return { success: true, url, svg }
  } catch (e: any) {
    return { success: false, error: e?.message }
  }
})

ipcMain.handle('qr-background', async (_event, action: string) => {
  if (action === 'clear') { setSetting('qrBackgroundPath',''); return {success:true,name:null} }
  if (action === 'choose') {
    const result=await dialog.showOpenDialog({title:'Choose congregation QR background',properties:['openFile'],filters:[{name:'Images',extensions:['png','jpg','jpeg','webp']}]})
    if (result.canceled || !result.filePaths[0]) return {success:false,canceled:true}
    const source=result.filePaths[0]
    if (fs.statSync(source).size>12*1024*1024) return {success:false,error:'Choose an image smaller than 12 MB.'}
    const target=path.join(app.getPath('userData'),'congregation-qr-background'+path.extname(source).toLowerCase())
    if(path.resolve(source)!==path.resolve(target)) fs.copyFileSync(source,target)
    setSetting('qrBackgroundPath',target)
  }
  const file=String(getSetting('qrBackgroundPath') || '')
  return {success:true,name:file ? path.basename(file) : null}
})

ipcMain.handle('show-qr', async () => {
  try {
    const base = String(getSetting('publicWebUrl') ?? '').replace(/\/+$/, '')
    const slug = String(getSetting('accountSlug') ?? '')
    if (!base || !slug) {
      return { success: false, error: 'set public web url and account slug in Settings first' }
    }
    const url = `${base}/live/${slug}`
    const { toString: qrToString } = await import('qrcode')
    // margin 0: the card draws its own quiet zone, and the library's would
    // sit inside that as a second, visible border.
    const qrSvg = await qrToString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
    const file = path.join(app.getPath('temp'), 'trilorah-companion-qr.svg')
    const backgroundPath=String(getSetting('qrBackgroundPath') || '')
    let backgroundDataUrl: string | undefined
    if (backgroundPath && fs.existsSync(backgroundPath) && fs.statSync(backgroundPath).size<=12*1024*1024) {
      backgroundDataUrl=`data:${getMimeType(backgroundPath)};base64,${fs.readFileSync(backgroundPath).toString('base64')}`
    }
    fs.writeFileSync(
      file,
      buildQrCard({
        qrSvg,
        backgroundDataUrl,
        caption: String(getSetting('qrCompanionCaption') ?? '').trim() || 'Follow along on your phone',
        url,
        churchName: String(getSetting('churchName') ?? '')
      })
    )
    console.log(`📱 Companion QR on outputs → ${url}`)
    currentLiveContent = null
    verseDelivery.clearLive()
    // Someone pressed "show the code": it goes up even over black or logo.
    // (An automatic push lifts only clear — see onContentPushed.)
    screen.set('live')
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send('on-show-media', file, 'photo')
    })
    return { success: true, url }
  } catch (e: any) {
    return { success: false, error: e?.message }
  }
})

ipcMain.handle('get-notes-provider-status', async () => {
  const provider = resolveNotesProvider(getSetting('notesProvider'))
  return { id: provider.id, status: await provider.status() }
})

// Bible database health — surfaced in the UI so a missing/broken DB is a
// visible red banner instead of silent reference-only displays.
ipcMain.handle('get-db-status', () => {
  if (!db) return { connected: false }
  try {
    const count = (db.prepare('SELECT COUNT(*) as count FROM bible').get() as { count: number }).count
    return { connected: true, verses: count }
  } catch (e: any) {
    return { connected: false, error: e?.message }
  }
})

ipcMain.handle('get-chapter', (_event, { bookId, chapter, version }) => {
  if (!db) return { success: false, error: 'Database not connected' }
  const ver = version || 'KJV'
  try {
    const verses = db
      .prepare(
        `
      SELECT Versecount as verse, verse as text
      FROM bible
      WHERE Book = ? AND Chapter = ? AND Version = ?
      ORDER BY Versecount
    `
      )
      .all(bookId, chapter, ver) as { verse: number; text: string }[]
    const bookName = bookNames[bookId] || `Book ${bookId}`
    return {
      success: true,
      data: verses.map((row) => ({
        id: row.verse,
        ref: `${bookName} ${chapter}:${row.verse}`,
        text: row.text,
        version: ver
      }))
    }
  } catch (error) {
    console.error('SQL Error:', error)
    return { success: false, error: 'Database error' }
  }
})

ipcMain.handle('search-verse', (_event, { book, chapter, verse, version }) => {
  if (!db) return { success: false, error: 'Database not connected' }
  const bookId = resolveBookId(book)
  if (bookId === undefined) {
    return { success: false, error: 'Book not found' }
  }
  const ver = version || 'KJV'
  try {
    const row = db
      .prepare(
        `
      SELECT verse as text FROM bible
      WHERE Book = ? AND Chapter = ? AND Versecount = ? AND Version = ?
    `
      )
      .get(bookId, chapter, verse, ver) as { text: string } | undefined
    return {
      success: !!row,
      data: row ? { text: row.text, version: ver } : null
    }
  } catch (error) {
    console.error('SQL Error:', error)
    return { success: false, error: 'Database error' }
  }
})

// Themes: native file picker for the output background. The image is copied
// into userData so the theme survives the original file moving or a USB
// stick being unplugged.
ipcMain.handle('pick-background-image', async () => {
  if (!mainWindow) return { success: false, error: 'No window' }
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Background Image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true }
  }
  try {
    const src = result.filePaths[0]
    const dir = path.join(app.getPath('userData'), 'backgrounds')
    fs.mkdirSync(dir, { recursive: true })
    const dest = path.join(dir, `bg-${Date.now()}${path.extname(src).toLowerCase()}`)
    fs.copyFileSync(src, dest)
    const posix = dest.split(path.sep).join('/')
    const url = `file://${posix}`
    // The setting keeps file:// (every existing install holds that); `src` is
    // what a window can actually draw. See shared/mediaUrl.ts.
    const displaySrc = `local-media://file${posix.startsWith('/') ? '' : '/'}${posix}`
    setSetting('defaultBackgroundUrl', url)
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send('on-theme-changed')
    })
    return { success: true, url, src: displaySrc }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'could not copy image' }
  }
})

// Pick any media file (image or video), save locally to userData/media, and return accessible URL
ipcMain.handle('pick-media-file', async () => {
  if (!mainWindow) return { success: false, error: 'No window' }
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Photo or Video',
    filters: [
      { name: 'Media Files', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'mov', 'webm'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
      { name: 'Videos', extensions: ['mp4', 'mov', 'webm'] }
    ],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true }
  }
  try {
    const src = result.filePaths[0]
    const dir = path.join(app.getPath('userData'), 'media')
    fs.mkdirSync(dir, { recursive: true })
    const ext = path.extname(src).toLowerCase()
    const isVideo = ['.mp4', '.mov', '.webm'].includes(ext)
    const dest = path.join(dir, `media-${Date.now()}${ext}`)
    fs.copyFileSync(src, dest)
    const posix = dest.split(path.sep).join('/')
    const url = `file://${posix}`
    const displaySrc = `local-media://file${posix.startsWith('/') ? '' : '/'}${posix}`
    const name = path.basename(src, ext)
    return {
      success: true,
      url,
      src: displaySrc,
      kind: isVideo ? 'video' : 'photo',
      name
    }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'could not copy media file' }
  }
})

// Real display status for connections tile
ipcMain.handle('get-displays-status', () => {
  const all = electronScreen.getAllDisplays()
  const primary = electronScreen.getPrimaryDisplay()
  const externals = all.filter((d) => d.id !== primary.id)
  return {
    totalDisplays: all.length,
    hasExternal: externals.length > 0,
    primary: { id: primary.id, bounds: primary.bounds },
    externals: externals.map((e) => ({ id: e.id, bounds: e.bounds }))
  }
})

// What the outputs card and the Settings display map draw: the displays that
// are really connected, where each output is or will open, and which are open.
ipcMain.handle('get-outputs-status', () =>
  describeOutputs({
    displays: electronScreen.getAllDisplays(),
    primaryId: electronScreen.getPrimaryDisplay().id,
    roleOverrides: getSetting('outputRoles') as Record<string, unknown>,
    displayOverrides: getSetting('outputDisplays') as Partial<Record<string, number | 'none'>>,
    openIds: openOutputIds(),
    screenState: screen.get(),
    platform: process.platform
  })
)

// Stock backgrounds: search a free library (Pixabay now, Pexels when keyed)
// and keep a copy of whatever is picked next to the native picker's copies.
ipcMain.handle('get-stock-providers', () => stockProviders())

ipcMain.handle('search-stock', async (_event, params) => {
  try {
    return { success: true, ...(await searchStock(params)) }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'search failed' }
  }
})

ipcMain.handle('download-stock', async (_event, { item, apply }) => {
  try {
    const { url, src } = await downloadStock(item)
    if (apply) {
      setSetting('defaultBackgroundUrl', url)
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) win.webContents.send('on-theme-changed')
      })
    }
    return { success: true, url, src }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'could not download' }
  }
})

ipcMain.handle('import-presentation', async () => {
  if (!mainWindow) return { success: false, error: 'No window' }
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Presentation',
    filters: [
      { name: 'PowerPoint', extensions: ['pptx', 'ppt', 'odp'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: 'Cancelled' }
  }
  const filePath = result.filePaths[0]
  const fileName = path.basename(filePath, path.extname(filePath))
  const presentationsDir = path.join(app.getPath('userData'), 'presentations')
  const outputDir = path.join(presentationsDir, `${fileName}-${Date.now()}`)
  try {
    console.log(`📊 Converting presentation: ${filePath}`)
    const slides = await convertPptxToImages(filePath, outputDir)
    if (slides.length === 0) {
      return {
        success: false,
        error: 'No slide images were produced from this PPTX. Check LibreOffice and the file format.'
      }
    }
    console.log(`✅ Converted ${slides.length} slides`)
    processSlides(slides).then((ocrResults) => {
      const ocrTexts = ocrResults.map((r) => r.text)
      const keywords = [...new Set(ocrResults.flatMap((r) => r.keywords))]
      console.log(`🔍 OCR complete: ${keywords.length} keywords extracted`)
      mediaMatcher.addMedia({
        id: `pres-${Date.now()}`,
        title: fileName,
        keywords
      })
    }).catch((e) => console.error('❌ OCR processing error:', e))
    return {
      success: true,
      data: {
        title: fileName,
        slides,
        pptxPath: filePath
      }
    }
  } catch (error) {
    console.error('❌ Presentation conversion error:', error)
    const details = error instanceof Error ? error.message : 'Unknown conversion error'
    return {
      success: false,
      error: `Conversion failed: ${details}`
    }
  }
})

ipcMain.handle(
  'import-generated-presentation',
  async (_event, { title, pptxBase64 }) => {
    if (!pptxBase64 || typeof pptxBase64 !== 'string') {
      return { success: false, error: 'Missing presentation data' }
    }
    const normalizedTitle = typeof title === 'string' && title.trim() ? title.trim() : 'Quick Slides'
    const safeTitle = normalizedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'quick-slides'
    const stamp = Date.now()
    const generatedDir = path.join(app.getPath('userData'), 'presentations')
    const pptxPath = path.join(generatedDir, `${safeTitle}-${stamp}.pptx`)
    const outputDir = path.join(generatedDir, `${safeTitle}-${stamp}`)
    try {
      if (!fs.existsSync(generatedDir)) {
        fs.mkdirSync(generatedDir, { recursive: true })
      }
      fs.writeFileSync(pptxPath, Buffer.from(pptxBase64, 'base64'))
      console.log(`📊 Converting generated presentation: ${pptxPath}`)
      const slides = await convertPptxToImages(pptxPath, outputDir)
      if (slides.length === 0) {
        return {
          success: false,
          error: 'Generated PPTX produced no slide images. Check LibreOffice setup.'
        }
      }
      console.log(`✅ Converted ${slides.length} generated slides`)
      processSlides(slides).then((ocrResults) => {
        const keywords = [...new Set(ocrResults.flatMap((r) => r.keywords))]
        console.log(`🔍 OCR complete (generated): ${keywords.length} keywords extracted`)
        mediaMatcher.addMedia({
          id: `gen-pres-${stamp}`,
          title: normalizedTitle,
          keywords
        })
      }).catch((e) => console.error('❌ OCR processing error (generated):', e))
      return {
        success: true,
        data: {
          title: normalizedTitle,
          slides,
          pptxPath
        }
      }
    } catch (error) {
      console.error('❌ Generated presentation conversion error:', error)
      const details = error instanceof Error ? error.message : 'Unknown conversion error'
      return {
        success: false,
        error: `Quick slide generation failed: ${details}`
      }
    }
  }
)

ipcMain.handle(
  'delete-presentation',
  async (_event, { slides, sourcePptx }) => {
    try {
      const presentationsDir = path.join(app.getPath('userData'), 'presentations')
      for (const slide of slides) {
        try {
          if (fs.existsSync(slide)) fs.unlinkSync(slide)
        } catch (e) {
          console.warn('Could not delete slide:', slide, e)
        }
      }
      if (slides.length > 0) {
        const slideDir = path.dirname(slides[0])
        try {
          if (fs.existsSync(slideDir) && slideDir.startsWith(presentationsDir)) {
            fs.rmSync(slideDir, { recursive: true, force: true })
          }
        } catch (e) {
          console.warn('Could not remove slide directory:', slideDir, e)
        }
      }
      if (sourcePptx && sourcePptx.startsWith(presentationsDir)) {
        try {
          if (fs.existsSync(sourcePptx)) fs.unlinkSync(sourcePptx)
        } catch (e) {
          console.warn('Could not delete source PPTX:', sourcePptx, e)
        }
      }
      return { success: true }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ delete-presentation error:', error)
      return { success: false, error: msg }
    }
  }
)

ipcMain.handle('save-presentations', async (_event, presentations) => {
  try {
    const filePath = path.join(app.getPath('userData'), 'presentations.json')
    fs.writeFileSync(filePath, JSON.stringify(presentations, null, 2), 'utf-8')
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ save-presentations error:', error)
    return { success: false, error: msg }
  }
})

ipcMain.handle('load-presentations', async () => {
  try {
    const filePath = path.join(app.getPath('userData'), 'presentations.json')
    if (!fs.existsSync(filePath)) return []
    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('❌ load-presentations error:', error)
    return []
  }
})

// The sandbox's FULLSCREEN button. The HTML fullscreen API is not reliable
// inside an Electron window (the request can be refused with no gesture the
// page can see), so the window itself is asked instead. Returns the new state.
ipcMain.handle('window-toggle-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || win.isDestroyed()) return false
  const next = !win.isFullScreen()
  win.setFullScreen(next)
  return next
})

ipcMain.handle('get-available-versions', () => {
  if (!db) return ['KJV']
  try {
    const rows = db.prepare('SELECT DISTINCT Version FROM bible ORDER BY Version').all() as { Version: string }[]
    return rows.map((r) => r.Version)
  } catch {
    return ['KJV']
  }
})

let worshipTimeoutHandle: NodeJS.Timeout | null = null

ipcMain.on('set-current-song-lyrics', (_event, lyrics) => {
  if (typeof lyrics === 'string') transitionDetector?.sermonStart.setLyrics(lyrics)
  if (worshipTimeoutHandle) clearTimeout(worshipTimeoutHandle)
  worshipTimeoutHandle = setTimeout(() => {
    // Blanking every output thirty seconds into worship, unannounced, is
    // exactly the kind of surprise a pilot church reports as "the screen
    // went off by itself". Opt-in.
    if (!getSetting('autoScreenActions')) return
    if (transitionDetector?.getCurrentSegment().type === 'worship') {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed())
          win.webContents.send('on-show-clean-background')
      })
    }
  }, 30000)
})

ipcMain.on('set-service-schedule', (_event, schedule, persist = true) => {
  if (!Array.isArray(schedule)) return
  const previous = transitionDetector?.schedule ?? []
  const counts = new Map<string, number>()
  const entries: ScheduleEntry[] = schedule.map(
    (s: string | ScheduleEntry) => {
      const item = typeof s === 'string' ? { type: s } : s
      const occurrence = counts.get(item.type) ?? 0
      counts.set(item.type, occurrence + 1)
      return { ...previous.filter(p => p.type === item.type)[occurrence], ...item }
    }
  )
  if (transitionDetector) {
    transitionDetector.setSchedule(entries)
  }
  if (persist) setSetting('serviceSchedule', entries)
  console.log(`📋 Service schedule updated: ${entries.length} entries`)
})

ipcMain.handle('get-sermon-transcript', () => {
  return serviceAgent ? serviceAgent.getSermonText() : ''
})

ipcMain.handle('get-sermon-start', () => transitionDetector?.sermonStart.getState() ?? null)
ipcMain.handle('respond-sermon-start', (event, action, requestId) => {
  if (event.sender !== mainWindow?.webContents) throw new Error('Use the desktop control surface or paired remote.')
  if (!transitionDetector) throw new Error('The sermon detector is not ready yet.')
  if (!['start', 'confirm', 'not-yet', 'end'].includes(action)) throw new Error('Invalid sermon action')
  return transitionDetector.respondToSermonStart(action, requestId)
})

ipcMain.handle('get-service-log', () => {
  return serviceAgent ? serviceAgent.getServiceLog() : []
})

ipcMain.handle('save-service-summary', async () => {
  if (serviceAgent) {
    postServiceSummary.importEvents(serviceAgent.getServiceLog())
  }
  const filePath = await postServiceSummary.save()
  return { success: true, path: filePath }
})

ipcMain.handle('generate-sermon-notes', async () => {
  const transcript = serviceAgent ? serviceAgent.getSermonText() : ''
  // Honors the notesProvider setting (cloud | local); local falls back to
  // cloud until the on-device model integration graduates.
  const provider = resolveNotesProvider(getSetting('notesProvider'))
  const notes = await provider.generate(transcript)
  triCurrentNotes = notes
  return notes
})

ipcMain.handle('export-sermon-notes-pdf', async (_event, notes) => {
  if (!mainWindow) return { success: false, error: 'No window' }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Sermon Notes as PDF',
    defaultPath: `${notes.title || 'sermon-notes'}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (result.canceled || !result.filePath) return { success: false }
  await exportSermonNotesPdf(notes, result.filePath)
  return { success: true, path: result.filePath }
})

ipcMain.handle('export-sermon-notes-md', async (_event, notes) => {
  if (!mainWindow) return { success: false, error: 'No window' }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Sermon Notes as Markdown',
    defaultPath: `${notes.title || 'sermon-notes'}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (result.canceled || !result.filePath) return { success: false }
  exportSermonNotesMarkdown(notes, result.filePath)
  return { success: true, path: result.filePath }
})

ipcMain.handle('get-settings', () => getAllSettings())
ipcMain.handle('get-setting', (_event, key) => getSetting(key))
const THEME_KEYS = new Set([
  'scriptureFontPreset',
  'defaultFontSize',
  'defaultFontFamily',
  'defaultFontWeight',
  'defaultTextColor',
  'overlayOpacity',
  'defaultBackgroundUrl',
  'backgroundBlur',
  'backgroundFit',
  'backgroundPosition',
  'colorMode',
  // Output roles / layouts / logo repaint the same way (BUILD-MAP 2.11).
  'churchLogoUrl',
  'churchName',
  'streamLayout',
  'stageShowClock',
  'stageShowNext',
  'outputRoles',
  // Passage layout (BUILD-MAP 2.18) — the output re-derives all of these from
  // getSettings() in loadTheme, so they only needed to be on the repaint list.
  'breakOnVerse',
  'showVerseNumbers',
  'referenceMode',
  'showTranslation',
  'maxCharsPerSlide',
  'secondaryVersion',
  // Stage monitor slots repaint the same way.
  'stageShowVerseText',
  'stageShowTimer',
  'stageShowElapsed',
  'verseLayout',
  'safeMargin',
  'textWidth',
  'textCase',
  'textSpacing',
  'textTransition',
  'textTransitionMs',
])

ipcMain.handle('set-setting', (_event, { key, value }) => {
  const previousDisplays = key === 'outputDisplays' ? getSetting('outputDisplays') : null
  setSetting(key, value)
  // Language / trust-gate changes reconfigure the live engines instantly.
  if (RECONFIGURE_KEYS.has(key) && ledger) {
    applyLanguageAndConfig()
  }
  // Theme changes repaint every output window live.
  if (THEME_KEYS.has(key)) {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send('on-theme-changed')
    })
  }
  // Choosing a screen moves the picture NOW. Saving a setting and waiting
  // for the next launch is not what "choose screen" means to an operator
  // standing in front of a congregation.
  if (key === 'outputDisplays') {
    applyDisplaySelection(previousDisplays as Partial<Record<string, number | 'none'>>, value, {
      isOpen: (id) => !!outputWindows[id] && !outputWindows[id]!.isDestroyed(),
      open: (id) => createOutputWindow(id, ROLE_TITLES[roleFor(id, getSetting('outputRoles') as Record<string, unknown>)]),
      move: (id) => { moveOutputToItsDisplay(id) },
      close: (id) => { outputWindows[id]?.close() },
    })
  }
  if (key === 'outputDisplays' || key === 'outputRoles') notifyOutputsChanged()
  return true
})

ipcMain.handle('set-sermon-plan', (_event, jsonOrPath) => {
  try {
    const plan = loadSermonPlan(jsonOrPath)
    const refs = getExpectedVerseRefs(plan)
    transitionDetector?.sermonStart.setPlan(plan.title, refs, plan.themes)
    if (serviceAgent) {
      serviceAgent.context.sermonPlanVerses = refs
    }
    console.log(`📋 Sermon plan loaded: "${plan.title}" — ${refs.length} expected verses`)
    return { success: true, title: plan.title, verseCount: refs.length }
  } catch (e: any) {
    console.error('❌ Failed to load sermon plan:', e)
    return { success: false, error: e.message }
  }
})

ipcMain.handle('set-active-preacher', (_event, preacherId) => {
  const profile = loadProfile(preacherId)
  if (!profile) {
    return { success: false, error: `Profile not found: ${preacherId}` }
  }
  if (serviceAgent) {
    serviceAgent.context.preacherFavoriteVerses = profile.favoriteVerses.map(
      (fv: any) => fv.ref
    )
  }
  const previous = activePreacherId()
  if (previous && previous !== preacherId) ledger?.endService(previous)
  recentReview = null
  lastReviewItemId = null
  setSetting('activePreacherId', preacherId)
  if (ledger) applyLanguageAndConfig()
  console.log(`👤 Active preacher set: ${profile.name} (${profile.id})`)
  return { success: true, name: profile.name }
})

ipcMain.handle('list-preacher-profiles', () => {
  return listProfiles()
})

ipcMain.handle(
  'create-preacher-profile',
  (_event, { id, name }) => {
    const profile = createProfile(id, name)
    saveProfile(profile)
    return { success: true, id: profile.id }
  }
)

ipcMain.handle('delete-preacher-profile', (_event, id) => {
  if (soundCheck.snapshot()?.preacherId === id) soundCheck.stop()
  ledger?.remove(id)
  teachings().remove(id)
  if (activePreacherId() === id) { setSetting('activePreacherId', ''); applyLanguageAndConfig() }
  return { success: deleteProfile(id) }
})

ipcMain.handle(
  'end-service',
  (_event, opts) => {
    const preacherId = getSetting('activePreacherId')
    if (opts?.preacherId && opts.preacherId !== preacherId) return { success: false, error: 'The active preacher changed. Select their profile before finishing the service.' }
    if (!serviceAgent || !preacherId) {
      return { success: false, error: 'No active service or preacher' }
    }
    if (!isListening && !ledger?.hasOpenService(preacherId)) return { success: true, profileUpdated: false }
    try {
      stopASR()
      const profile = extractAndUpdateProfile(
        serviceAgent.context,
        preacherId,
        opts?.preacherName || preacherId,
        opts?.sermonTitle
      )
      // Unreviewed examples remain unverified, saved against this service.
      if (ledger) {
        ledger.endService(preacherId)
        const pollResults = polls.results()
        const viewerRecap = viewerStats.recap()
        if (pollResults.length || viewerRecap.totalUnique) {
          console.log(`📊 Companion recap: ${pollResults.length} polls · peak ${viewerRecap.peak} viewers`)
          emitEngineEvent('on-companion-recap', { polls: pollResults, viewers: viewerRecap })
        }
        polls.reset()
        viewerStats.reset()
        console.log(
          `🎓 Trust meter: ${(ledger.stats(preacherId).trustLowerBound * 100).toFixed(1)}% (auto mode ${ledger.stats(preacherId).autoModeEligible ? 'ELIGIBLE' : 'not yet'})`
        )
      }
      console.log(`🏁 Service ended — profile updated for ${profile.name}`)
      const versesDetected = serviceAgent.context.detectedVerses.length
      serviceAgent.reset()
      recentReview = null
      lastReviewItemId = null
      return {
        success: true,
        versesDetected,
        profileUpdated: true
      }
    } catch (e: any) {
      console.error('❌ end-service error:', e)
      return { success: false, error: e.message }
    }
  }
)

/*
 * Who is signed in, and do they have a church — the slow half of
 * cloud-status. Both are network round trips to Supabase (getUser validates
 * the session with the auth server every time), and the phone remote asks
 * for cloud-status in every state poll, four times a second per phone: that
 * was two auth requests and a query each time, and a remote whose every
 * refresh waited on the internet. Identity changes only when someone signs
 * in or out, so it is cached and dropped on exactly those events; the live
 * half (service, queue) is read fresh on every call.
 */
const CLOUD_IDENTITY_TTL_MS = 60_000
let cloudIdentity: { at: number; value: Promise<{ signedIn: boolean; hasAccount: boolean; email: string | null }> } | null = null

function forgetCloudIdentity(): void {
  cloudIdentity = null
}

function readCloudIdentity() {
  if (cloudIdentity && Date.now() - cloudIdentity.at < CLOUD_IDENTITY_TTL_MS) return cloudIdentity.value
  const value = (async () => {
    const user = await getCurrentUser()
    const hasAcc = user ? await hasAccount() : false
    if (hasAcc && !getSetting('accountSlug')) {
      try {
        const account = await fetchMyAccount()
        if (account?.slug) {
          setSetting('accountSlug', account.slug)
        }
      } catch {
      }
    }
    return { signedIn: !!user, hasAccount: hasAcc, email: user?.email ?? null }
  })()
  cloudIdentity = { at: Date.now(), value }
  // A failed lookup (offline) must not be remembered for a minute.
  value.catch(() => {
    if (cloudIdentity?.value === value) cloudIdentity = null
  })
  return value
}

ipcMain.handle('cloud-status', async () => {
  if (!isCloudConfigured()) return { configured: false, signedIn: false }
  const identity = await readCloudIdentity().catch(() => ({ signedIn: false, hasAccount: false, email: null }))
  return {
    configured: true,
    ...identity,
    activeServiceId: getActiveServiceId(),
    paused: publicSharingPaused,
    serviceError: getActiveServiceId() ? null : cloudServiceError,
    queue: queueHealth()
  }
})

ipcMain.handle(
  'cloud-complete-account-setup',
  async (_event, { churchName, slug }) => {
    const result = await completeAccountSetup(churchName, slug)
    forgetCloudIdentity()
    if (result.success) {
      setSetting('accountSlug', slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
    }
    return result
  }
)

ipcMain.handle(
  'cloud-sign-in',
  async (_event, { email, password }) => {
    const result = await signIn(email, password)
    forgetCloudIdentity()
    if (result.success) {
      try {
        const account = await fetchMyAccount()
        if (account) {
          setSetting('accountSlug', account.slug)
        }
      } catch (e) {
        console.warn('Could not fetch account slug after sign-in:', e)
      }
    }
    return result
  }
)

ipcMain.handle(
  'cloud-sign-up',
  async (_event, { email, password, accountName }) => {
    forgetCloudIdentity()
    return await signUp(email, password, accountName)
  }
)

ipcMain.handle('cloud-sign-out', async () => {
  forgetCloudIdentity()
  const result = await signOut()
  forgetCloudIdentity()
  return result
})

ipcMain.handle('cloud-start-service', async (_event, opts) => {
  publicSharingPaused = false
  return serializeService(async () => getActiveServiceId() ? {success:true,serviceId:getActiveServiceId()} : startService(opts ?? {}))
})

ipcMain.handle('cloud-end-service', async () => {
  publicSharingPaused = true
  return serializeService(() => endService())
})

ipcMain.handle('cloud-mark-verse-pushed', (_event, verseId) => {
  markVersePushed(verseId)
  return { success: true }
})

ipcMain.handle('cloud-upsert-notes', (_event, notes) => {
  upsertNotes(notes)
  return { success: true }
})

ipcMain.handle('cloud-sync-giving', async (_event, methods) => {
  await syncGivingMethods(methods)
  return { success: true }
})

ipcMain.handle('cloud-generate-link-code', async () => {
  return await generateLinkCode()
})

ipcMain.handle('cloud-redeem-link-code', async (_event, code) => {
  forgetCloudIdentity()
  return await redeemLinkCode(code)
})

ipcMain.handle('cloud-fetch-my-account', async () => {
  return await fetchMyAccount()
})

ipcMain.handle('cloud-fetch-pastors', async () => {
  return await fetchPastors()
})

ipcMain.handle('cloud-fetch-campuses', async () => {
  return await fetchCampuses()
})

ipcMain.handle('cloud-fetch-recent-services', async () => {
  return await fetchRecentServices()
})

ipcMain.handle('cloud-fetch-recent-notes', async () => {
  return await fetchRecentNotes()
})

ipcMain.handle('cloud-fetch-audience-sessions', async () => {
  return await fetchAudienceSessions()
})

ipcMain.handle('cloud-run-retention-cleanup', async () => {
  return await runRetentionCleanup()
})

ipcMain.handle('cloud-verify-password', async (_event, password) => {
  return await verifyPassword(password)
})

ipcMain.handle('cloud-sign-out-all-devices', async () => {
  return await signOutAllDevices()
})

ipcMain.handle('obs-connect', async () => {
  const cfg = {
    host: getSetting('obsHost'),
    port: getSetting('obsPort'),
    password: getSetting('obsPassword')
  }
  try {
    const client = getOBSClient(cfg)
    await client.connect()
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('obs-disconnect', async () => {
  await disposeOBSClient()
  return { success: true }
})

ipcMain.handle('obs-status', async () => {
  if (!getSetting('obsEnabled')) return { enabled: false }
  const cfg = {
    host: getSetting('obsHost'),
    port: getSetting('obsPort'),
    password: getSetting('obsPassword')
  }
  try {
    const client = getOBSClient(cfg)
    const status = await client.getStatus()
    const scenes = await client.getSceneList()
    return { enabled: true, connected: true, ...status, scenes }
  } catch (e: any) {
    return { enabled: true, connected: false, error: e.message }
  }
})

ipcMain.handle('obs-set-scene', async (_event, sceneName) => {
  const cfg = {
    host: getSetting('obsHost'),
    port: getSetting('obsPort'),
    password: getSetting('obsPassword')
  }
  try {
    await getOBSClient(cfg).setSceneByName(sceneName)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle(
  'obs-set-browser-source-url',
  async (_event, { sourceName, url }) => {
    const cfg = {
      host: getSetting('obsHost'),
      port: getSetting('obsPort'),
      password: getSetting('obsPassword')
    }
    try {
      await getOBSClient(cfg).setBrowserSourceUrl(sourceName, url)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }
)

ipcMain.handle('vmix-status', async () => {
  if (!getSetting('vmixEnabled')) return { enabled: false }
  const cfg = { host: getSetting('vmixHost'), port: getSetting('vmixPort') }
  try {
    const status = await getVMixClient(cfg).getStatus()
    return { enabled: true, ...status }
  } catch (e: any) {
    return { enabled: true, reachable: false, error: e.message }
  }
})

ipcMain.handle('vmix-set-active', async (_event, input) => {
  const cfg = { host: getSetting('vmixHost'), port: getSetting('vmixPort') }
  try {
    await getVMixClient(cfg).setActiveInput(input)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle(
  'vmix-overlay',
  async (_event, { channel, input, action }) => {
    const cfg = { host: getSetting('vmixHost'), port: getSetting('vmixPort') }
    try {
      const client = getVMixClient(cfg)
      if (action === 'in' && input !== undefined) await client.overlayInputIn(channel, input)
      else await client.overlayInputOut(channel)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }
)

ipcMain.handle(
  'vmix-set-title-text',
  async (_event, { input, selectedName, value }) => {
    const cfg = { host: getSetting('vmixHost'), port: getSetting('vmixPort') }
    try {
      await getVMixClient(cfg).setTitleText(input, selectedName, value)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }
)

ipcMain.handle('import-schedule-image', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Import Service Schedule',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff'] }]
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true }
  }
  try {
    const parsed = await importScheduleFromImage(result.filePaths[0])
    return {
      canceled: false,
      success: true,
      entries: parsed.entries,
      rows: parsed.rows,
      unmatchedLines: parsed.unmatchedLines,
      rawText: parsed.rawText
    }
  } catch (e: any) {
    return { canceled: false, success: false, error: e.message }
  }
})

ipcMain.handle('schedule-suggestion', () => {
  try {
    const suggestion = suggestSchedule()
    return { success: true, suggestion }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('apply-schedule-suggestion', () => {
  try {
    const suggestion = suggestSchedule()
    if (!suggestion) {
      return { success: false, error: 'Not enough service history yet (need at least 3 services).' }
    }
    const entries = suggestionToEntries(suggestion)
    setSetting('serviceSchedule', entries)
    return { success: true, entries }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('read-image-data-url', (_event, imagePath) => {
  if (!imagePath || typeof imagePath !== 'string') return null
  try {
    // Both URL forms the app stores resolve to the same file on disk.
    const normalizedPath = imagePath.startsWith('file://')
      ? decodeURI(imagePath.replace(/^file:\/+/, '/'))
      : imagePath.startsWith('local-media://')
        ? decodeURIComponent(new URL(imagePath).pathname)
        : imagePath
    if (!fs.existsSync(normalizedPath)) return null
    const mimeType = getMimeType(normalizedPath)
    const bytes = fs.readFileSync(normalizedPath)
    return `data:${mimeType};base64,${bytes.toString('base64')}`
  } catch (error) {
    console.error('❌ read-image-data-url error:', error)
    return null
  }
})

ipcMain.handle('ocr-process-image', async (_event, imagePath) => {
  if (!imagePath || typeof imagePath !== 'string') {
    return { success: false, error: 'Invalid image path' }
  }
  const normalizedPath = imagePath.startsWith('file://') ? decodeURI(imagePath.replace(/^file:\/+/, '/')) : imagePath
  if (!fs.existsSync(normalizedPath)) {
    console.error(`❌ OCR skipped — file not found: ${normalizedPath}`)
    return { success: false, error: 'File not found' }
  }
  try {
    const { extractTextFromImage, extractKeywords } = await import('./media/ocrProcessor')
    const text = await extractTextFromImage(normalizedPath)
    const keywords = extractKeywords(text)
    if (keywords.length > 0) {
      mediaMatcher.addMedia({
        id: `media-${Date.now()}`,
        title: path.basename(normalizedPath, path.extname(normalizedPath)),
        keywords
      })
      console.log(`🔍 OCR (media image): ${keywords.length} keywords from ${path.basename(normalizedPath)}`)
    }
    return { success: true, text, keywords }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'OCR error'
    console.error('❌ ocr-process-image error:', error)
    return { success: false, error: msg }
  }
})

ipcMain.handle('ocr-process-images', async (_event, imagePaths) => {
  if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
    return { success: false, error: 'No image paths provided' }
  }
  try {
    const validPaths = imagePaths.map((p) => p.startsWith('file://') ? decodeURI(p.replace(/^file:\/+/, '/')) : p).filter((p) => {
      if (!fs.existsSync(p)) {
        console.error(`❌ OCR skipped — file not found: ${p}`)
        return false
      }
      return true
    })
    if (validPaths.length === 0) {
      return { success: false, error: 'No valid image files found' }
    }
    const ocrResults = await processSlides(validPaths)
    const allKeywords = [...new Set(ocrResults.flatMap((r) => r.keywords))]
    if (allKeywords.length > 0) {
      mediaMatcher.addMedia({
        id: `batch-${Date.now()}`,
        title: `Media batch (${validPaths.length} images)`,
        keywords: allKeywords
      })
      console.log(`🔍 OCR batch: ${allKeywords.length} keywords from ${validPaths.length} images`)
    }
    return { success: true, results: ocrResults }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'OCR batch error'
    console.error('❌ ocr-process-images error:', error)
    return { success: false, error: msg }
  }
})

/**
 * Nothing navigates away from the app. Ever.
 *
 * A dropped file is the reason this exists. Chromium's default handling of a
 * file dropped on a page is to NAVIGATE to it, so an operator who drags a
 * .cho off a memory stick and releases it an inch outside the Songs panel —
 * over the sidebar, the header, the Live tab — replaces the entire operator
 * UI with the raw text of that file. window.api is gone, there is no back
 * button in a frameless window, and the service is blind until somebody
 * force-quits. Mid-service that is the worst failure in the product.
 *
 * The renderer's own drop handlers cover the region they know about; this
 * covers everywhere else, including the output windows on the projector.
 * Opening a link in a real browser still works — see setWindowOpenHandler.
 */
function guardNavigation(contents: Electron.WebContents): void {
  const allowed = (url: string): boolean => {
    try {
      const u = new URL(url)
      // Dev server and packaged files only. A file:// URL is precisely the
      // dropped-file case, and is allowed only for the app's own pages,
      // which is what loadFile() itself produces.
      if (u.protocol === 'http:' || u.protocol === 'https:') return isDev && u.hostname === 'localhost'
      if (u.protocol === 'file:') return u.pathname.endsWith('.html')
      return false
    } catch {
      return false
    }
  }
  const block = (e: Electron.Event, url: string) => {
    if (!allowed(url)) e.preventDefault()
  }
  contents.on('will-navigate', block)
  contents.on('will-frame-navigate', (e) => block(e, e.url))
  // A link that genuinely wants a browser gets one; nothing opens a new
  // Electron window with our preload in it.
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:$/.test(safeProtocol(url))) void shell.openExternal(url)
    return { action: 'deny' }
  })
}

function safeProtocol(url: string): string {
  try {
    return new URL(url).protocol
  } catch {
    return ''
  }
}

app.on('web-contents-created', (_event, contents) => guardNavigation(contents))

/**
 * Follow the hardware.
 *
 * A projector unplugged mid-service leaves its window stranded on a display
 * that no longer exists — Electron parks it somewhere arbitrary, usually
 * half off the laptop screen. Plugging one back in should equally put the
 * picture back where it belongs without the operator touching anything.
 * Debounced because macOS emits several of these while a display wakes.
 */
let displayShuffleTimer: NodeJS.Timeout | null = null
function onDisplaysChanged(): void {
  if (displayShuffleTimer) clearTimeout(displayShuffleTimer)
  displayShuffleTimer = setTimeout(() => {
    displayShuffleTimer = null
    const open = Object.keys(outputWindows).filter((id) => outputWindows[id])
    if (open.length > 0) {
      console.log(`🖥️ Displays changed — replacing ${open.length} output window(s)`)
      for (const id of open) moveOutputToItsDisplay(id)
    }
    // The dashboard and Settings list the displays too, open outputs or not.
    notifyOutputsChanged()
  }, 700)
}

let triCurrentNotes: unknown = null
registerTriPackages({
  window: () => mainWindow,
  settings: () => getAllSettings(),
  replaceSettings: values => { getStore().store = values as ReturnType<typeof getAllSettings> },
  songs: () => {
    const store = songStore()
    if (store.problem) throw new Error(store.problem)
    return store.list()
  },
  records: () => {
    const transcript = serviceAgent?.getSermonText()
    return [
      ...(transcript ? [{ id: 'current-transcript', label: 'Current sermon transcript', data: { kind: 'transcript', text: transcript } }] : []),
      ...(triCurrentNotes ? [{ id: 'current-notes', label: 'Current sermon notes', data: { kind: 'notes', value: triCurrentNotes } }] : []),
    ]
  },
  imported: snapshot => {
    if (snapshot.categories.songs?.length) songs = null
    for (const key of Object.keys(libraryFolders)) delete libraryFolders[key]
    for (const item of snapshot.categories.tools ?? []) {
      for (const definition of item.data?.timers ?? []) timers.create(definition)
    }
    if (snapshot.categories.tools?.some(item => item.data?.timers?.length)) persistTimers()
    if (snapshot.categories.service?.length) {
      const run = getSetting('operatorRunV1')
      const segments = Array.isArray(run) ? run : run?.segments ?? []
      const entries = segments.map(segment => ({ type: segment.type })) as ScheduleEntry[]
      setSetting('serviceSchedule', entries)
      transitionDetector?.setSchedule(entries)
    }
    mainWindow?.webContents.send('tri-libraries-updated')
  },
})

app.whenReady().then(() => {
  electronScreen.on('display-added', onDisplaysChanged)
  electronScreen.on('display-removed', onDisplaysChanged)
  electronScreen.on('display-metrics-changed', onDisplaysChanged)

  // Chromium asks the app before handing a renderer the microphone, and with
  // no handler installed it denies — silently, and only in production, because
  // a file:// origin is opaque where the dev server's http://localhost is not.
  // That asymmetry is why this went unnoticed: the picker still filled (device
  // enumeration needs no permission) while capture never started. The macOS
  // TCC prompt in 'request-mic-permission' is a different gate entirely and
  // granting it cannot substitute for this one.
  electronSession.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(permission === 'media' || (permission === 'display-capture' && wc === mainWindow?.webContents))
  })
  electronSession.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media')
  // Windows loopback captures the computer's sound. Only the operator window
  // may request it; screen video is required by Chromium but is never consumed.
  electronSession.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    if (process.platform !== 'win32' || request.frame !== mainWindow?.webContents.mainFrame || !request.audioRequested) {
      callback({})
      return
    }
    void desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
      .then((sources) => callback(sources[0] ? { video: sources[0], audio: 'loopback' } : {}))
      .catch(() => callback({}))
  })

  // Serves files under userData to every window. Registered before the
  // design-mode branch so the sandbox can show a downloaded background too.
  protocol.handle('local-media', async (request) => {
    try {
      const requestUrl = new URL(request.url)
      const requestedPath = decodeURIComponent(requestUrl.pathname)
      const filePath = process.platform === 'win32' && /^\/[a-zA-Z]:\//.test(requestedPath) ? requestedPath.slice(1) : requestedPath
      if (!filePath || !fs.existsSync(filePath)) {
        return new Response('Not found', { status: 404 })
      }
      const mimeType = getMimeType(filePath)
      const size = fs.statSync(filePath).size
      /*
       * Streamed, and Range-aware. This used to readFileSync the whole file
       * into one Response, which is fine for a 300 KB background and hopeless
       * for a video: a 400 MB clip became 400 MB of main-process memory per
       * window, and with no Range support Chromium could neither seek nor —
       * for an .mp4 whose index sits at the END of the file — start playing
       * at all. A <video> asks for byte ranges; answer them.
       */
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '')
      // allow-origin: the app draws a video's first frame to a canvas for its
      // thumbnail, and a canvas fed from another origin without this is tainted.
      const common = { 'content-type': mimeType, 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=31536000', 'access-control-allow-origin': '*' }
      if (range && size > 0) {
        const suffix = range[1] === '' && range[2] !== ''
        const start = suffix ? Math.max(0, size - Number(range[2])) : Number(range[1] || 0)
        const end = suffix || range[2] === '' ? size - 1 : Math.min(size - 1, Number(range[2]))
        if (start > end || start >= size) {
          return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
        }
        const body = Readable.toWeb(fs.createReadStream(filePath, { start, end })) as unknown as ReadableStream
        return new Response(body, {
          status: 206,
          headers: { ...common, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) }
        })
      }
      const body = Readable.toWeb(fs.createReadStream(filePath)) as unknown as ReadableStream
      return new Response(body, { status: 200, headers: { ...common, 'content-length': String(size) } })
    } catch (error) {
      console.error('❌ local-media protocol error:', error)
      return new Response('Bad request', { status: 400 })
    }
  })

  if (process.env.DESIGN_MODE === '1') {
    console.log('🎨 Design sandbox mode — main app and services skipped')
    const dbPath = findDatabase()
    if (dbPath) {
      try {
        setDb(new Database(dbPath))
        const count = db!.prepare('SELECT COUNT(*) as count FROM bible').get() as { count: number }
        console.log(`✅ Database connected (design mode) - ${count.count} verses`)
      } catch (e) {
        console.error('❌ Database error (design mode):', e)
      }
    }
    createDesignWindow()
    return
  }
  const dbPath = findDatabase()
  if (dbPath) {
    try {
      setDb(new Database(dbPath))
      const count = db!.prepare('SELECT COUNT(*) as count FROM bible').get() as { count: number }
      console.log(`✅ Database connected - ${count.count} verses`)
    } catch (e) {
      console.error('❌ Database error:', e)
    }
  } else {
    console.error('❌ bible.db not found! Please copy bible.db to the project root or run `npm run bible:build`')
  }
  console.log('🧠 Connecting to ML resolver...')
  connectML(handleMLVerseDetection)
  initAliasLogger()
  /* -------- agentic layer init (added post-recovery) -------- */
  setBareBookGate(() => intentEngine.allowBareBook())
  ledger = new CorrectionLedger(
    path.join(app.getPath('userData'), 'preacher-ledgers'),
    Date.now,
    {},
    {
      onAutoModeDisabled: (pid) => {
        emitEngineEvent('on-auto-mode-event', { type: 'auto-disabled', preacherId: pid })
        broadcastState()
      }
    }
  )
  commandLog = new CommandLog(app.getPath('userData'), Date.now, { userDataDir: app.getPath('userData') })
  vocabulary = new VocabularyStore(app.getPath('userData'))
  pairing = new PairingStore(app.getPath('userData'))
  restoreTimers()
  setInterval(() => polls.expireStale(), 5000)
  applyLanguageAndConfig()
  console.log('🗣️ Voice commands + intent engine + correction ledger ready')
  const quoteMatcher = getQuoteMatcher()
  quoteMatcher.loadIndex()
  passageMatcher = new PassageMatcher()
  void loadSemanticMatcher()
  displayTimingManager.setAutoDisplayTimeout(getSetting('autoDisplayTimeout'))
  displayTimingManager.setDismissCallback(() => {
    dismissLiveVerse()
  })
  mediaMatcher.onSuggestion((result) => {
    emitMediaSuggestion(result)
  })
  transitionDetector = new TransitionDetector(state => {
    // Private controls only: never send a preacher's question to the congregation.
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('on-sermon-start', state)
  })
  const schedule = getSetting('serviceSchedule')
  if (schedule) {
    const entries: ScheduleEntry[] = schedule.map(
      (s: string | ScheduleEntry) => typeof s === 'string' ? { type: s } : s
    )
    transitionDetector.setSchedule(entries)
  }
  transitionDetector.onSegmentChanged((segment, previous) => {
    emitSegmentChanged({
      type: segment.type,
      startedAt: segment.startedAt,
      confidence: segment.confidence,
      previous: previous?.type
    })
    pushSegment(segment.type, segment.confidence)
    if (segment.type === 'sermon') {
      const entry = transitionDetector?.getScheduleEntry('sermon')
      if (entry?.preacherId && serviceAgent) {
        const profile = loadProfile(entry.preacherId)
        if (profile) {
          serviceAgent.context.preacherFavoriteVerses = profile.favoriteVerses.map((fv: any) => fv.ref)
          setSetting('activePreacherId', entry.preacherId)
          console.log(
            `👤 Auto-loaded preacher profile for sermon: ${profile.name}`
          )
        } else {
          console.warn(
            `⚠️ Schedule references preacher "${entry.preacherId}" but no profile found`
          )
        }
      }
    }
  })
  serviceAgent = new ServiceAgent(
    transitionDetector,
    falsePositiveFilter,
    displayTimingManager,
    mediaMatcher
  )
  serviceAgent.setEnabled(getSetting('agentEnabled'))
  if (getSetting('slowPathEnabled')) {
    const toolRegistry = new ToolRegistry()
    toolRegistry.register(createTransitionDetectorTool(transitionDetector))
    toolRegistry.register(createFalsePositiveFilterTool(falsePositiveFilter))
    toolRegistry.register(createDisplayTimingTool(displayTimingManager))
    toolRegistry.register(createQuoteMatcherTool(getQuoteMatcher()))
    toolRegistry.register(createSermonPlanTool())
    toolRegistry.register(createContextQueryTool(serviceAgent.context))
    const llmProvider = new LLMFallback()
    const reasoningLoop = new ReasoningLoop({
      llmProvider,
      toolRegistry,
      context: serviceAgent.context
    })
    const notesBuilder = new IncrementalNotesBuilder((snapshot) => {
      triCurrentNotes = snapshot
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('on-notes-updated', snapshot)
      }
    })
    slowPath = new SlowPathOrchestrator(
      reasoningLoop,
      {
        onAdjustment: (adj) => {
          if (adj.target === 'displayTiming' && adj.action === 'setTimeout') {
            displayTimingManager.setAutoDisplayTimeout(adj.value)
          }
          console.log(`🧠 FastPath adjustment: ${adj.target}.${adj.action} = ${adj.value}`)
        },
        onDetection: (verse) => {
          // Contextual matches are suggestions. Validate against the installed
          // Bible and keep them out of the live/automatic delivery path.
          if (!isListening || !Number.isFinite(verse.confidence) || verse.confidence < 0.9 || verse.confidence > 1 || !db) return
          const segment = transitionDetector?.getCurrentSegment().type
          if (segment === 'prayer' || segment === 'worship' || segment === 'announcements') return
          const preview = readVersePreview(db, verse.ref, getSetting('displayVersion') || 'KJV')
          if (!preview || !shouldEmit(`implicit:${verse.ref}`)) return
          // Reuse the same suggestion identity as local passage recognition.
          // A model's own confidence is not a measured accuracy percentage.
          if (stageRecognizedPassage({
            book: preview.book, chapter: preview.chapter, verse: preview.verse,
            endVerse: preview.endVerse, source: 'passage',
          }, '')) serviceAgent!.context.addDetection(verse)
        },
        onNotesUpdate: (update) => {
          notesBuilder.processUpdate(update)
        }
      },
      getSetting('batchIntervalMs')
    )
    slowPath.start()
    console.log('🧠 Slow-path reasoning loop initialized')
  }
  createWindow()
  // SANDBOX=1 opens the component gallery *beside* the running app, both
  // served by the same Vite instance — edit a component once and watch it
  // hot-reload in the sheet and on the real screen at the same time.
  // (DESIGN_MODE=1 above is the other mode: gallery only, engine skipped.)
  if (process.env.SANDBOX === '1') createDesignWindow()
  if (getSetting('remoteControlEnabled') && pairing) {
    const toRenderer = (command: string, value?: unknown) =>
      mainWindow?.webContents.send('on-external-command', value === undefined ? { command } : { command, value })
    const remoteHandlers: RemoteHandlers = {
      startListening: () => startASR(),
      stopListening: () => stopASR(),
      clearScreen: () => {
        screen.set('clear')
        toRenderer('clear-screen')
      },
      // One-button remotes: pressing BLACK / LOGO again restores the screen.
      blackScreen: () => screen.toggle('black'),
      showLogo: () => screen.toggle('logo'),
      showAlert: (text, opts) => {
        const target = opts.target as AlertTarget | undefined
        const seconds = opts.durationSec === null ? null : opts.durationSec ?? getSetting('alertDefaultSeconds')
        // A Stream Deck button carries a template too, so fill it the same way.
        alerts.show(fillTokens(text, tokenContext()), { target, durationSec: seconds })
      },
      dismissAlert: () => alerts.dismiss(),
      pushPreview: () => pushPreviewToLive('remote'),
      approvePending: () => pushPreviewToLive('remote'),
      dismissPending: () => {
        dismissLiveVerse()
        intentEngine.onDisplayCleared()
        toRenderer('dismiss-pending')
      },
      nextVerse: () => {
        session.exitReadingMode()
        session.advance()
      },
      previousVerse: () => {
        session.exitReadingMode()
        session.goBack()
      },
      setAutoMode: (enabled) => {
        const pid = activePreacherId()
        if (!enabled && pid && ledger) ledger.setAutoModeEnabled(pid, false)
        broadcastState()
      },
      typeReference: (ref) => {
        stageVerseReference(ref)
        emitTranscript(ref)
      },
      setMode: (mode) => toRenderer('set-mode', mode),
      getState: () => remoteState()
    }
    startWebSocketServer(remoteHandlers, pairing, 8081)
  }
  initCloudSync()
  console.log('🚀 AI Preacher Assistant ready')
  console.log("💡 Click 'Start' to begin voice recognition")
  if (process.env.DEEPGRAM_API_KEY) {
    console.log('✅ Deepgram API key configured (cloud ASR available)')
  } else {
    console.log('🎤 No Deepgram key — using free local Whisper transcription')
  }
})

app.on('window-all-closed', () => {
  if (process.env.DESIGN_MODE !== '1') {
    stopASR()
    disconnectML()
    stopWebSocketServer()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (process.env.DESIGN_MODE === '1') {
      createDesignWindow()
    } else {
      createWindow()
      if (process.env.SANDBOX === '1') createDesignWindow()
    }
  }
})

app.on('before-quit', () => {
  mobileServer?.stop()
  alerts.dispose()
  timers.dispose()
  if (process.env.DESIGN_MODE === '1') return
  if (serviceAgent) {
    postServiceSummary.importEvents(serviceAgent.getServiceLog())
    postServiceSummary.save().catch(() => {
    })
  }
  stopASR()
  disconnectML()
  stopWebSocketServer()
})
