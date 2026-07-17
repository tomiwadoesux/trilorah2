import { app, BrowserWindow, dialog, ipcMain, protocol, systemPreferences } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import dotenv from 'dotenv'
import {
  shouldEmit,
  emitVerseDetected,
  emitTranscript,
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
  type CommandPhraseConfig
} from './engine/commandConfig'
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
import { initAliasLogger } from './data/aliasLogger'
import { convertPptxToImages } from './media/pptxConverter'
import { startWebSocketServer, stopWebSocketServer } from './integrations/websocketServer'
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
import { findDatabase, db, setDb, bookIdMap, bookNames } from './data/bibleDb'
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

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

function getMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.gif') return 'image/gif'
  return 'application/octet-stream'
}

const isDev = process.env.NODE_ENV === 'development'

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
const intentEngine = new IntentEngine({
  onStateChange: (state) => emitIntentState(state),
  onReadingStarted: () => {
    // The telepathic moment: the preacher started reading the armed verse.
    // Auto mode pushes it live; otherwise the state change is the UI hint.
    const preacherId = getSetting('activePreacherId')
    if (preacherId && ledger?.stats(preacherId).autoModeEligible) {
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
  activeCommandConfig = config

  // 3. Engines pick up the config.
  voiceCommands = new VoiceCommandEngine(voiceCallbacks, {
    config,
    numberParser: makePackNumberParser(pack),
    substringMode: substring
  })
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
    if (inPrayer) emitVerseAutoDismiss()
  },
  onCommand: (event) => emitVoiceCommand(event)
}

/** Preview → live, from the operator button, auto mode, or grace window. */
function pushPreviewToLive(via: string): void {
  if (!currentPreviewData) return
  console.log(
    `🔴 Pushing to LIVE (${via}):`,
    `${currentPreviewData.book} ${currentPreviewData.chapter}:${currentPreviewData.verse}`
  )
  emitVerseDetected({ ...currentPreviewData, isPreview: false })
  displayTimingManager.onVerseDisplayed(currentPreviewData.text)
  intentEngine.disarmGraceWindow()
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
  const bookId = bookIdMap[currentPreviewData.book]
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
    emitVerseDetected(currentPreviewData)
    emitVersionChanged(version)
  } catch (e) {
    console.error('❌ Version re-emit failed:', e)
  }
}

const session = new ScriptureSession((display: any) => {
  const bookId = bookIdMap[display.book]
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
    const autoEligible = preacherId ? ledger?.stats(preacherId).autoModeEligible : false
    if (getSetting('graceWindowEnabled')) {
      // Hold as preview; goes live the moment the preacher starts reading.
      intentEngine.armGraceWindow(refStr, detection.text)
    } else if (autoEligible) {
      pushPreviewToLive('auto mode')
    }
  }
})

let isListening = false

function startASR(deviceLabel?: string) {
  if (isListening) return
  activeASR = resolveASRProvider(getSetting('asrProvider'))
  console.log(`🎤 Starting ASR (${activeASR.id})...`, deviceLabel ? `(device: ${deviceLabel})` : '(default device)')
  emitASRStatus('Connecting...')
  activeASR.start(
    // onText callback
    (text, isFinal) => {
      console.log(`📝 ${isFinal ? 'Final' : 'Partial'}: ${text}`)
      emitTranscript(text)
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
        sendTranscript(text, false)
      }
    },
    // onError callback
    (error) => {
      console.error('❌ ASR error:', error)
      emitASRStatus('Error: ' + error.message)
    },
    deviceLabel
  )
  isListening = true
  emitASRStatus('Listening...')
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
  if (data.book && bookIdMap[data.book] === undefined && ledger) {
    const alias = ledger.resolveAlias(activePreacherId(), data.book)
    if (alias) {
      // Stored value may be a full ref ("Romans 8:1") or a bare book name.
      const bookOnly = alias.replace(/\s+\d+(?::\d+)?$/, '')
      console.log(`🔤 Alias resolved: "${data.book}" → ${bookOnly}`)
      data = { ...data, book: bookOnly }
    }
  }
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
  const bookId = bookIdMap[book]
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

function handleASRText(text: string) {
  if (session.onCommand(text)) {
    return
  }
  sendTranscript(text, true)
  if (voiceCommands?.isInPrayer()) return // 🙏 no quote detection during prayer
  const quoteMatcher = getQuoteMatcher()
  const quoteResults = quoteMatcher.tryDetectQuotes()
  if (quoteResults.length > 0) {
    const best = quoteResults[0]
    const bestBook = best.ref.split(' ').slice(0, -1).join(' ')
    console.log(
      `📜 Quote match: ${best.ref} (+${quoteResults.length - 1} candidates)`
    )
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
    for (const alt of quoteResults.slice(1, 6)) {
      const altBook = alt.ref.split(' ').slice(0, -1).join(' ')
      const altText = lookupVerseText(altBook, alt.chapter, alt.verse)
      emitVerseDetected({
        book: altBook,
        chapter: alt.chapter,
        verse: alt.verse,
        text: altText,
        isPreview: false
        // Goes to pending queue
      })
    }
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
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
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
  const titles: Record<string, string> = {
    main: 'Main Display Output',
    alternate: 'Livestream Output',
    third: 'Stage Confidence Monitor'
  }
  createOutputWindow(outputId, titles[outputId] || 'Display Output')
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

ipcMain.handle('show-media', (_event, imagePath: string) => {
  console.log(`🖼️ Showing media on output: ${path.basename(imagePath)}`)
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('on-show-media', imagePath)
  })
  return { success: true }
})

ipcMain.handle('clear-media', () => {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('on-show-clean-background')
  })
  return { success: true }
})

ipcMain.handle('get-notes-provider-status', async () => {
  const provider = resolveNotesProvider(getSetting('notesProvider'))
  return { id: provider.id, status: await provider.status() }
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
  const bookId = bookIdMap[book] ?? bookIdMap[book.toLowerCase()]
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
  'colorMode'
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
    const normalizedPath = imagePath.startsWith('file://') ? decodeURI(imagePath.replace(/^file:\/+/, '/')) : imagePath
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

app.whenReady().then(() => {
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
  const dbPath = findDatabase()
  if (dbPath) {
    try {
      setDb(new Database(dbPath))
      const count = db!.prepare('SELECT COUNT(*) as count FROM bible').get() as { count: number }
      console.log(`✅ Database connected - ${count.count} verses`)
    } catch (e) {
      console.error('❌ Database error:', e)
    }
  }
  console.log('🧠 Connecting to ML resolver...')
  connectML(handleMLVerseDetection)
  initAliasLogger()
  /* -------- agentic layer init (added post-recovery) -------- */
  setBareBookGate(() => intentEngine.allowBareBook())
  ledger = new CorrectionLedger(path.join(app.getPath('userData'), 'preacher-ledgers'))
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
  if (mainWindow) startWebSocketServer(mainWindow)
  initCloudSync()
  console.log('🚀 AI Preacher Assistant ready')
  console.log("💡 Click 'Start' to begin voice recognition")
  if (process.env.DEEPGRAM_API_KEY) {
    console.log('✅ Deepgram API key configured')
  } else {
    console.warn('⚠️ DEEPGRAM_API_KEY not set - add to .env.local')
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
    }
  }
})

app.on('before-quit', () => {
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
