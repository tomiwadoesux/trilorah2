// `session` is already the ScriptureSession instance in this file, so Electron's
// comes in aliased rather than renaming an engine object used throughout.
import { app, BrowserWindow, dialog, ipcMain, protocol, screen as electronScreen, session as electronSession, shell, systemPreferences } from 'electron'
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
// In-process TS resolver — drop-in replacement for the lost Python ml/ service
import {
  connectML,
  disconnectML,
  sendTranscript,
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
import { CommandLog } from './preachers/commandLog'
import { VocabularyStore, applyVocabulary, deepgramKeywords } from './preachers/vocabulary'
import { exportFixturesFromLedger } from './preachers/evalExport'
import { setDeepgramKeywords } from './asr/deepgram'
import { PairingStore } from './integrations/pairing'
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
import { placeOutput } from './output/displays'
import type { LiveContent } from '../shared/liveContent'
import { searchBible } from './data/bibleSearch'
import { emitEngineEvent } from './emitters'
import { resolveASRProvider, type ASRProvider } from './asr/provider'
// (startDeepgram/stopDeepgram now flow through the provider abstraction)
import { VoiceCommandEngine, type VoiceCommandCallbacks } from './engine/voiceCommands'
import { IntentEngine } from './engine/intentEngine'
import { CorrectionLedger } from './preachers/correctionLedger'
import { seasonalBoost, seasonalThemeId } from './engine/seasonalPriors'
import { resolveNotesProvider } from './llm/notesProvider'
import { ScriptureSession } from './engine/scriptureSession'
import { getAllSettings, getSetting, setSetting } from './data/settings'
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
  return 'application/octet-stream'
}

const isDev = process.env.NODE_ENV === 'development'

// TRI_DEBUG_PORT=9222 lets a script attach over CDP (screenshots, driving the
// sandbox from the terminal). Dev-only affordance; nothing reads it in prod.
if (process.env.TRI_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.TRI_DEBUG_PORT)
}

let transitionDetector: TransitionDetector | null = null
const falsePositiveFilter = new FalsePositiveFilter()
const displayTimingManager = new DisplayTimingManager()
const mediaMatcher = new MediaMatcher()
let recentTranscriptBuffer: string[] = []
let serviceAgent: ServiceAgent | null = null
let slowPath: SlowPathOrchestrator | null = null
const postServiceSummary = new PostServiceSummary()

let currentPreviewData: any = null

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

function restoreTimers(): void {
  const saved = getSetting('timers')
  if (!Array.isArray(saved)) return
  for (const t of saved) {
    if (t && typeof t === 'object') timers.create(t as never)
  }
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
let lastResolverConfidence = 0.85
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
  const pid = activePreacherId()
  return {
    listening: isListening,
    pendingRef: currentPreviewData?.isPreview ? ref : null,
    liveRef: currentPreviewData && !currentPreviewData.isPreview ? ref : null,
    autoMode: pid ? !!ledger?.isAutoModeEnabled(pid) : false,
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
    // The telepathic moment: the preacher started reading the armed verse.
    // Auto mode pushes it live; otherwise the state change is the UI hint.
    const preacherId = getSetting('activePreacherId')
    if (preacherId && autoMode.shouldAutoPushOnReadingStarted(preacherId)) {
      pushPreviewToLive('auto (reading started)')
    }
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
  if (pid) config = mergeCommandConfigs(config, loadPreacherCommandConfig(app.getPath('userData'), pid))
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
    setDeepgramKeywords(pid ? deepgramKeywords(vocabulary.get(pid).terms) : [])
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
    const wasLive = Boolean(currentPreviewData && !currentPreviewData.isPreview)
    const heard = lastDisplayedRef
      ? `${lastDisplayedRef.book} ${lastDisplayedRef.chapter}:${lastDisplayedRef.verse}`
      : ''
    const corrected = lastDisplayedRef
      ? `${lastDisplayedRef.book} ${lastDisplayedRef.chapter}:${verse}`
      : String(verse)
    if (pid && ledger) {
      if (lastReviewItemId && lastDisplayedRef) {
        ledger.resolveReviewItem(pid, lastReviewItemId, 'amended', {
          book: lastDisplayedRef.book,
          chapter: lastDisplayedRef.chapter,
          verse
        })
        lastReviewItemId = null
      } else {
        ledger.recordDetection(pid, false)
        ledger.recordCorrection(pid, heard, corrected, 'voice')
      }
    }
    if (session.applyVerseCorrection(verse) && wasLive) {
      pushPreviewToLive('correction')
    }
  },
  onChapterCorrection: (chapter) => {
    const pid = activePreacherId()
    const wasLive = Boolean(currentPreviewData && !currentPreviewData.isPreview)
    if (pid && ledger && lastDisplayedRef) {
      ledger.recordDetection(pid, false)
      ledger.recordCorrection(
        pid,
        `${lastDisplayedRef.book} ${lastDisplayedRef.chapter}`,
        `${lastDisplayedRef.book} ${chapter}`,
        'voice'
      )
    }
    if (session.applyChapterCorrection(chapter) && wasLive) {
      pushPreviewToLive('correction')
    }
  },
  onDismiss: () => {
    emitVerseAutoDismiss()
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
    if (inPrayer && getSetting('autoScreenActions')) emitVerseAutoDismiss()
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

/** Preview → live, from the operator button, auto mode, or grace window. */
function pushPreviewToLive(via: string): void {
  if (!currentPreviewData) return
  console.log(
    `🔴 Pushing to LIVE (${via}):`,
    `${currentPreviewData.book} ${currentPreviewData.chapter}:${currentPreviewData.verse}`
  )
  currentLiveContent = null
  screen.onContentPushed()
  emitVerseDetected({ ...currentPreviewData, isPreview: false })
  displayTimingManager.onVerseDisplayed(currentPreviewData.text)
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
  // Every live verse becomes a review item; unresolved ones auto-confirm at
  // end-of-service (silence = the operator saw it and left it up).
  if (ledger) {
    const item = ledger.addReviewItem({
      ts: Date.now(),
      kind: 'detection',
      heard: recentTranscriptBuffer.slice(-12).join(' '),
      proposed: {
        book: currentPreviewData.book,
        chapter: currentPreviewData.chapter,
        verse: currentPreviewData.verse
      }
    })
    lastReviewItemId = item.id
  }
}

/** Re-render the current verse in a different translation (voice or UI). */
function reEmitCurrentVerseInVersion(version: string): void {
  if (!currentPreviewData || !db) return
  const bookId = resolveBookId(currentPreviewData.book)
  if (bookId === undefined) return
  try {
    const verses: { verse: number; text: string }[] = []
    const start = currentPreviewData.verse
    const end = currentPreviewData.endVerse ?? currentPreviewData.verse
    for (let v = start; v <= end; v++) {
      const row = db
        .prepare(
          `SELECT verse as text FROM bible
           WHERE Book = ? AND Chapter = ? AND Versecount = ? AND Version = ?`
        )
        .get(bookId, currentPreviewData.chapter, v, version) as { text: string } | undefined
      verses.push({ verse: v, text: row?.text || `Verse ${v} not found` })
    }
    currentPreviewData = {
      ...currentPreviewData,
      text: verses.map((v) => v.text).join(' '),
      verses,
      version
    }
    // Switching translation re-renders what is already up; it is not a push,
    // so it must not lift a CLEAR. A spoken "switch to NIV" used to un-clear
    // the screen through here.
    if (!currentPreviewData.isPreview) screen.onContentPushed()
    emitVerseDetected(currentPreviewData)
    emitVersionChanged(version)
  } catch (e) {
    console.error('❌ Version re-emit failed:', e)
  }
}

const session = new ScriptureSession((display: any) => {
  const bookId = resolveBookId(display.book)
  const displayVersion = getSetting('displayVersion') || 'KJV'
  const verses: { verse: number; text: string }[] = []
  if (db && bookId !== undefined) {
    try {
      for (let v = display.verseStart; v <= display.verseEnd; v++) {
        const row = db
          .prepare(
            `SELECT verse as text FROM bible
             WHERE Book = ? AND Chapter = ? AND Versecount = ? AND Version = ?`
          )
          .get(bookId, display.chapter, v, displayVersion) as { text: string } | undefined
        verses.push({
          verse: v,
          text: row?.text || `Verse ${v} not found`
        })
      }
    } catch (e) {
      console.error('❌ DB error:', e)
    }
  }
  const detection: any = {
    book: display.book,
    chapter: display.chapter,
    verse: display.verseStart,
    endVerse: display.verseEnd !== display.verseStart ? display.verseEnd : undefined,
    text: verses.map((v) => v.text).join(' '),
    verses,
    isRange: display.verseEnd !== display.verseStart,
    isPreview: display.isPreview,
    version: displayVersion,
    // Pass range metadata
    rangeEnd: display.rangeEnd,
    chunkSize: display.chunkSize
  }
  currentPreviewData = detection
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
  if (cloudVerseId) detection.cloudId = cloudVerseId
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
  if (detection.isPreview && detection.text) {
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
      graceWindow: !!getSetting('graceWindowEnabled'),
      clashMarginPts: getSetting('clashMarginPts')
    })
    if (decision.action === 'arm-grace') {
      // Hold as preview; goes live the moment the preacher starts reading.
      intentEngine.armGraceWindow(refStr, detection.text)
    } else if (decision.action === 'auto-push') {
      pushPreviewToLive('auto mode')
    }
    // 'hold-clash' and 'preview': stays on preview; UI shows the candidates.
  }
  broadcastState()
})

function startASR(deviceLabel?: string) {
  if (isListening) return
  activeASR = resolveASRProvider(getSetting('asrProvider'))
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
    (rawText, isFinal, display) => {
      // Per-preacher vocabulary fixes proper nouns before anything reads the text.
      let text = rawText
      const vocabPid = activePreacherId()
      if (getSetting('vocabularyEnabled') && vocabulary && vocabPid) {
        text = applyVocabulary(rawText, vocabulary.get(vocabPid).terms)
      }
      if (isFinal) lastHeardText = text
      console.log(`📝 ${isFinal ? 'Final' : 'Partial'}: ${text}`)
      emitTranscript(text)
      emitTranscriptLine(display ?? text, isFinal)
      if (isFinal) {
        const segType = transitionDetector?.getCurrentSegment().type ?? 'unknown'
        pushTranscriptChunk(text, true, segType)
      }
      const words = text.toLowerCase().split(/\s+/).filter(Boolean)
      recentTranscriptBuffer.push(...words)
      if (recentTranscriptBuffer.length > 30) {
        recentTranscriptBuffer = recentTranscriptBuffer.slice(-30)
      }
      // Intent engine sees everything — it tracks what the preacher is DOING.
      intentEngine.process(text)
      // Natural voice commands consume their chunk entirely (a version
      // switch must not also get parsed for verse references).
      if (isFinal && voiceCommands && getSetting('voiceCommandsEnabled')) {
        if (voiceCommands.process(text)) return
      }
      session.processTranscript(text)
      if (transitionDetector && getSetting('agentEnabled')) {
        transitionDetector.processTranscript(text)
      }
      if (getSetting('agentEnabled')) {
        displayTimingManager.onTranscript(text, isFinal)
        if (transitionDetector) {
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
      quoteMatcher.updateRollingWords(text)
      if (isFinal) {
        handleASRText(text)
      } else {
        // "next verse" moves the screen as it is spoken. One shot per
        // utterance: the partials that follow are the same sentence still
        // growing, and its final is swallowed in handleASRText.
        if (!navFiredOnPartial && session.isUnambiguousNav(text) && session.onCommand(text)) {
          navFiredOnPartial = true
          return
        }
        sendTranscript(text, false)
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
  if (!isListening) return
  ;(activeASR ?? resolveASRProvider(getSetting('asrProvider'))).stop()
  activeASR = null
  isListening = false
  emitASRStatus('Stopped')
}

function handleMLVerseDetection(data: any) {
  console.log('🔍 Raw ML data:', JSON.stringify(data))
  // --- agentic layer (added post-recovery) ---
  if (voiceCommands?.isInPrayer()) {
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
  const refString = `${data.book} ${data.chapter}:${data.verse || 1}`
  if (!shouldEmit(refString)) {
    console.log('⏭️ Skipping duplicate:', refString)
    if (data.verse) {
      session.cancelVerseTimer()
    }
    return
  }
  if (data.confidence < 0.85) {
    console.log('⏭️ Low confidence:', refString, data.confidence)
    return
  }
  console.log(`🎯 ML Detected: ${refString} (confidence: ${data.confidence})`)
  console.log(`   → verse from ML: ${data.verse} (type: ${typeof data.verse})`)
  if (getSetting('falsePositiveFilterEnabled') && transitionDetector) {
    const segment = transitionDetector.getCurrentSegment()
    if (falsePositiveFilter.shouldBlock(
      { book: data.book, chapter: data.chapter, verse: data.verse, confidence: data.confidence },
      recentTranscriptBuffer,
      segment.type
    )) {
      return
    }
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

function handleASRText(text: string) {
  if (activeCommandConfig.ignoreTails?.length) {
    text = stripIgnoreTails(text, activeCommandConfig.ignoreTails)
  }
  if (navFiredOnPartial) {
    navFiredOnPartial = false
    if (session.isUnambiguousNav(text)) return
  }
  if (session.onCommand(text)) {
    return
  }
  sendTranscript(text, true)
  // "bring up the Lord's Prayer" — a passage called by its heading rather
  // than its numbers. Goes to preview like any other detection. One per
  // name per minute: a preacher repeats the name while teaching from it.
  const named = findNamedPassage(text)
  if (named && !(lastNamedPassage?.name === named.name && Date.now() - lastNamedPassage.at < 60_000)) {
    lastNamedPassage = { name: named.name, at: Date.now() }
    console.log(`📖 Named passage: "${named.name}" → ${named.book} ${named.chapter}:${named.verse}-${named.end}`)
    session.onReferenceDetected({
      book: named.book,
      chapter: named.chapter,
      verse: named.verse,
      rangeEnd: named.end > named.verse ? named.end : null
    })
    return
  }
  if (voiceCommands?.isInPrayer()) return // 🙏 no quote detection during prayer
  const quoteMatcher = getQuoteMatcher()
  const quoteResults = quoteMatcher.tryDetectQuotes()
  if (quoteResults.length > 0) {
    const best = quoteResults[0]
    const bestBook = best.ref.split(' ').slice(0, -1).join(' ')
    console.log(
      `📜 Quote match: ${best.ref} (+${quoteResults.length - 1} candidates)`
    )
    lastQuoteCandidates = candidatesFromQuotes(quoteResults.slice(0, 4))
    if (getSetting('falsePositiveFilterEnabled') && transitionDetector) {
      const segment = transitionDetector.getCurrentSegment()
      if (falsePositiveFilter.shouldBlock(
        { book: bestBook, chapter: best.chapter, verse: best.verse, confidence: best.confidence },
        recentTranscriptBuffer,
        segment.type
      )) {
        return
      }
    }
    session.onReferenceDetected({
      book: bestBook,
      chapter: best.chapter,
      verse: best.verse,
      rangeEnd: null
    })
    // Runner-up quote candidates wait in the queue — never straight to live.
    for (const alt of quoteResults.slice(1, 6)) {
      const ref = alt.ref
      if (!verseQueue.some((q) => q.ref === ref)) {
        verseQueue.push({ ref, reason: 'possible quote match', ts: Date.now() })
      }
    }
    if (quoteResults.length > 1) emitQueueUpdated(verseQueue)
  }
}

let mainWindow: BrowserWindow | null = null

const outputWindows: Record<string, BrowserWindow | null> = {
  main: null,
  alternate: null,
  third: null
}

function createOutputWindow(id: string, title: string) {
  if (outputWindows[id]) {
    outputWindows[id]?.focus()
    return
  }
  // The projector gets the external screen. See output/displays.ts.
  const placement = placeOutput(
    id,
    electronScreen.getAllDisplays(),
    electronScreen.getPrimaryDisplay().id,
    getSetting('outputDisplays') as Partial<Record<string, number>>
  )
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
      contextIsolation: true
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
  })
  outputWindows[id] = win
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#050505',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
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
  sendTranscript(text, true)
  emitTranscript(text)
})

ipcMain.on('start-listening', (_event, deviceLabel) => {
  console.log('▶️ Start listening requested', deviceLabel ? `(device: ${deviceLabel})` : '')
  startASR(deviceLabel)
})

ipcMain.on('stop-listening', () => {
  console.log('⏹️ Stop listening requested')
  stopASR()
})

ipcMain.on('push-to-live', () => {
  pushPreviewToLive('operator')
})

/* -------- 2026-09 engine additions: IPC -------- */

// Auto mode (item 16): operator switch, gated by eligibility; clash resolution.
ipcMain.handle('auto-mode-set', (_event, { preacherId, enabled }) => {
  const pid = preacherId || activePreacherId()
  if (!pid || !ledger) return { success: false, error: 'no preacher' }
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
    ledger?.resolveReviewItem(activePreacherId() || null, id, resolution, amendedTo)
    return { success: true }
  }
)

ipcMain.handle('get-verse-queue', () => verseQueue)

ipcMain.handle('show-queued-verse', (_event, ref: string) => {
  const idx = verseQueue.findIndex((q) => q.ref === ref)
  if (idx >= 0) verseQueue.splice(idx, 1)
  emitQueueUpdated(verseQueue)
  // Route through the resolver like spoken text — same display path.
  sendTranscript(ref, true)
  return { success: true }
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
  console.log(`🎵 Live: ${content.kind === 'song' ? `${content.title} — ${content.label}` : content.title}`)
  screen.onContentPushed()
  broadcastToWindows('on-live-content', content)
  return { success: true }
})

ipcMain.handle('get-live-content', () => currentLiveContent)

ipcMain.handle('show-media', (_event, imagePath: string) => {
  currentLiveContent = null
  console.log(`🖼️ Showing media on output: ${path.basename(imagePath)}`)
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('on-show-media', imagePath)
  })
  return { success: true }
})

ipcMain.handle('clear-media', () => {
  currentLiveContent = null
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

ipcMain.handle('show-qr', async () => {
  try {
    const base = String(getSetting('publicWebUrl') ?? '').replace(/\/+$/, '')
    const slug = String(getSetting('accountSlug') ?? '')
    if (!base || !slug) {
      return { success: false, error: 'set public web url and account slug in Settings first' }
    }
    const url = `${base}/live/${slug}`
    const { toFile } = await import('qrcode')
    const file = path.join(app.getPath('temp'), 'trilorah-companion-qr.png')
    await toFile(file, url, { width: 800, margin: 2 })
    console.log(`📱 Companion QR on outputs → ${url}`)
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send('on-show-media', file)
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

ipcMain.on('set-service-schedule', (_event, schedule) => {
  const entries: ScheduleEntry[] = schedule.map(
    (s: string | ScheduleEntry) => typeof s === 'string' ? { type: s } : s
  )
  if (transitionDetector) {
    transitionDetector.setSchedule(entries)
  }
  setSetting('serviceSchedule', entries)
  console.log(`📋 Service schedule updated: ${entries.length} entries`)
})

ipcMain.handle('get-sermon-transcript', () => {
  return serviceAgent ? serviceAgent.getSermonText() : ''
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
  return provider.generate(transcript)
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
  'textTransition',
  'textTransitionMs',
])

ipcMain.handle('set-setting', (_event, { key, value }) => {
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
  return true
})

ipcMain.handle('set-sermon-plan', (_event, jsonOrPath) => {
  try {
    const plan = loadSermonPlan(jsonOrPath)
    const refs = getExpectedVerseRefs(plan)
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
  return { success: deleteProfile(id) }
})

ipcMain.handle(
  'end-service',
  (_event, opts) => {
    const preacherId = getSetting('activePreacherId')
    if (!serviceAgent || !preacherId) {
      return { success: false, error: 'No active service or preacher' }
    }
    try {
      const profile = extractAndUpdateProfile(
        serviceAgent.context,
        preacherId,
        opts?.preacherName || preacherId,
        opts?.sermonTitle
      )
      // Trust meter bookkeeping: unresolved review items auto-confirm
      // (the operator watched all service; silence = consent), then the
      // service record closes and feeds the training thermostat.
      if (ledger) {
        for (const item of ledger.getReviewItems()) {
          ledger.resolveReviewItem(preacherId, item.id, 'confirmed')
        }
        ledger.endService(preacherId)
        ledger.clearReview()
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
      return {
        success: true,
        versesDetected: serviceAgent.context.detectedVerses.length,
        profileUpdated: true
      }
    } catch (e: any) {
      console.error('❌ end-service error:', e)
      return { success: false, error: e.message }
    }
  }
)

ipcMain.handle('cloud-status', async () => {
  if (!isCloudConfigured()) return { configured: false, signedIn: false }
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
  return {
    configured: true,
    signedIn: !!user,
    hasAccount: hasAcc,
    email: user?.email ?? null,
    activeServiceId: getActiveServiceId()
  }
})

ipcMain.handle(
  'cloud-complete-account-setup',
  async (_event, { churchName, slug }) => {
    const result = await completeAccountSetup(churchName, slug)
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
    return await signUp(email, password, accountName)
  }
)

ipcMain.handle('cloud-sign-out', async () => {
  return await signOut()
})

ipcMain.handle('cloud-start-service', async (_event, opts) => {
  return await startService(opts ?? {})
})

ipcMain.handle('cloud-end-service', async () => {
  return await endService()
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

app.whenReady().then(() => {
  // Chromium asks the app before handing a renderer the microphone, and with
  // no handler installed it denies — silently, and only in production, because
  // a file:// origin is opaque where the dev server's http://localhost is not.
  // That asymmetry is why this went unnoticed: the picker still filled (device
  // enumeration needs no permission) while capture never started. The macOS
  // TCC prompt in 'request-mic-permission' is a different gate entirely and
  // granting it cannot substitute for this one.
  electronSession.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media')
  })
  electronSession.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media')

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
      const buffer = fs.readFileSync(filePath)
      return new Response(buffer, {
        status: 200,
        headers: {
          'content-type': mimeType,
          'cache-control': 'public, max-age=31536000'
        }
      })
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
  displayTimingManager.setAutoDisplayTimeout(getSetting('autoDisplayTimeout'))
  displayTimingManager.setDismissCallback(() => {
    emitVerseAutoDismiss()
  })
  mediaMatcher.onSuggestion((result) => {
    emitMediaSuggestion(result)
  })
  transitionDetector = new TransitionDetector()
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
          session.onReferenceDetected({
            book: verse.book,
            chapter: verse.chapter,
            verse: verse.verse,
            rangeEnd: null
          })
          serviceAgent!.context.addDetection(verse)
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
        emitVerseAutoDismiss()
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
        if (pid && ledger) ledger.setAutoModeEnabled(pid, enabled)
        broadcastState()
      },
      typeReference: (ref) => {
        sendTranscript(ref, true)
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
