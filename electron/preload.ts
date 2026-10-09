import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { SongPatch } from '../shared/types'
import type { LiveContent } from '../shared/liveContent'
import type { ImportedSong } from './songs/import'
import type { RecognitionWithdrawal } from '../shared/recognitionWithdrawal'
import type { TriApi } from '../shared/triBridge'
import { operationNotice, operationNoticeKey } from '../shared/notificationOperations'
import type { ServiceNotice } from '../shared/serviceNotice'

const noticeListeners = new Set<(notice: ServiceNotice) => void>()
const pendingNotices: ServiceNotice[] = []
const operationGeneration = new Map<string, number>()
function publishNotice(notice: ServiceNotice) {
  if (!noticeListeners.size) { pendingNotices.push(notice); if (pendingNotices.length > 100) pendingNotices.shift() }
  for (const listener of noticeListeners) {
    try { listener(notice) } catch { /* A UI listener cannot turn a successful operation into a failure. */ }
  }
}
async function invokeObserved(channel: string, ...args: any[]): Promise<any> {
  const key = operationNoticeKey(channel, args)
  const generation = (operationGeneration.get(key) ?? 0) + 1
  operationGeneration.set(key, generation)
  try {
    const result = await ipcRenderer.invoke(channel, ...args)
    const notice = operationNotice(channel, result, false, args)
    if (notice && generation === operationGeneration.get(key)) publishNotice(notice)
    return result
  } catch (error) {
    const notice = operationNotice(channel, error, true, args)
    if (notice && generation === operationGeneration.get(key)) publishNotice(notice)
    throw error
  }
}

const triApi: TriApi = {
  triCatalog: state => invokeObserved('tri-catalog', state),
  triSave: request => invokeObserved('tri-save', request),
  triInspect: recentPath => invokeObserved('tri-inspect', recentPath),
  triInspectForeign: () => invokeObserved('tri-inspect-foreign'),
  triAnswerForeign: request => invokeObserved('tri-answer-foreign', request),
  triDiscardPreview: token => invokeObserved('tri-discard-preview', token),
  triImport: request => invokeObserved('tri-import', request),
  triRecent: () => invokeObserved('tri-recent'),
  triStatus: () => invokeObserved('tri-status'),
  triNew: () => invokeObserved('tri-new'),
  onTriOpenRequested: callback => {
    const handler = () => callback()
    ipcRenderer.on('tri-open-requested', handler)
    return () => ipcRenderer.removeListener('tri-open-requested', handler)
  },
}

contextBridge.exposeInMainWorld('api', {
  ...triApi,
  getServiceNotices: () => invokeObserved('service-notices'),
  retryPublishing: () => invokeObserved('retry-publishing'),
  openMicPermissions: () => invokeObserved('open-mic-permissions'),
  reportOutputMediaFailure: (kind: 'video' | 'image', failed: boolean) => ipcRenderer.send('output-media-health', { kind, failed }),
  onServiceNotice: (callback: (notice: ServiceNotice) => void) => {
    noticeListeners.add(callback)
    for (const notice of pendingNotices.splice(0)) callback(notice)
    const handler = (_event: IpcRendererEvent, notice: ServiceNotice) => callback(notice)
    ipcRenderer.on('on-service-notice', handler)
    return () => { noticeListeners.delete(callback); ipcRenderer.removeListener('on-service-notice', handler) }
  },
  qrBackground: (action: 'status'|'choose'|'clear') => invokeObserved('qr-background',action),
  mobileStatus: () => invokeObserved('mobile-status'),
  mobileCode: (generate = false) => invokeObserved('mobile-code', generate),
  mobileRevoke: (id: string) => invokeObserved('mobile-revoke', id),
  mobileThumbnail: (imagePath: string) => invokeObserved('mobile-thumbnail', imagePath),
  mobileEnable: (enabled: boolean) => invokeObserved('mobile-enable', enabled),
  mobileApprove: (id: string, allow: boolean) => invokeObserved('mobile-approve', id, allow),
  mobileQr: (url: string) => invokeObserved('mobile-qr', url),
  mobileVerse: (reference: string, version: string, live: boolean) => invokeObserved('mobile-verse', reference, version, live),
  onMobileRequest: (callback: (request: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, request: any) => callback(request)
    ipcRenderer.on('mobile-request', handler)
    return () => ipcRenderer.removeListener('mobile-request', handler)
  },
  mobileReply: (reply: any) => ipcRenderer.send('mobile-reply', reply),
  // Fetch a chapter by book ID and chapter number (optionally with version)
  getChapter: (bookId: number, chapter: number, version?: string) =>
    invokeObserved('get-chapter', { bookId, chapter, version }),

  // Get available Bible versions
  getAvailableVersions: () => invokeObserved('get-available-versions'),
  // The same list with names, online/bundled, and NKJV/NIV greyed with the reason until a YouVersion key unlocks them
  getBibleVersions: () => invokeObserved('get-bible-versions'),
  // A passage's verses in one read, gaps and all (the projector and its second line)
  getVerseRange: (book: string | number, chapter: number, start: number, end: number, version?: string) =>
    invokeObserved('get-verse-range', { book, chapter, start, end, version }),
  toggleWindowFullscreen: () => invokeObserved('window-toggle-fullscreen') as Promise<boolean>,

  // Bible database health (drives the missing-DB banner)
  getDbStatus: () => invokeObserved('get-db-status'),

  // Search for a specific verse
  searchVerse: (book: string, chapter: number, verse: number, version?: string) =>
    invokeObserved('search-verse', { book, chapter, verse, version }),

  // Listener for audio transcript updates (the "Matrix" stream)
  onTranscriptUpdate: (callback: (text: string) => void) => {
    const subscription = (_event: IpcRendererEvent, text: string) => callback(text)
    ipcRenderer.on('on-transcript-update', subscription)
    return () => ipcRenderer.removeListener('on-transcript-update', subscription)
  },

  // The transcript as readable lines: punctuated, and marked final or not
  onTranscriptLine: (callback: (line: { text: string; isFinal: boolean }) => void) => {
    const subscription = (_event: IpcRendererEvent, line: { text: string; isFinal: boolean }) => callback(line)
    ipcRenderer.on('on-transcript-line', subscription)
    return () => ipcRenderer.removeListener('on-transcript-line', subscription)
  },

  // Listener for AI verse PREVIEW events (goes to preview first)
  onVersePreview: (callback: (data: any) => void) => {
    const subscription = (_event: IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('on-verse-preview', subscription)
    return () => ipcRenderer.removeListener('on-verse-preview', subscription)
  },

  onRecognitionWithdrawn: (callback: (data: RecognitionWithdrawal) => void) => {
    const subscription = (_event: IpcRendererEvent, data: RecognitionWithdrawal) => callback(data)
    ipcRenderer.on('on-recognition-withdrawn', subscription)
    return () => ipcRenderer.removeListener('on-recognition-withdrawn', subscription)
  },

  // Listener for AI verse detection events (goes directly to live)
  onVerseDetected: (callback: (data: any) => void) => {
    const subscription = (_event: IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('on-verse-detected', subscription)
    return () => ipcRenderer.removeListener('on-verse-detected', subscription)
  },

  // Listener for real-time audio levels (dB)
  onAudioLevel: (callback: (level: number) => void) => {
    const subscription = (_event: IpcRendererEvent, level: number) => callback(level)
    ipcRenderer.on('on-audio-level', subscription)
    return () => ipcRenderer.removeListener('on-audio-level', subscription)
  },

  // Audio Control
  startListening: (deviceLabel?: string) => ipcRenderer.send('start-listening', deviceLabel),
  stopListening: () => ipcRenderer.send('stop-listening'),

  // Send transcription text to the brain for processing
  sendText: (text: string) => ipcRenderer.send('process-text', text),

  // Push preview to live
  pushToLive: (reference?: string, version?: string) => ipcRenderer.send('push-to-live', reference, version),

  // Import presentation (PPTX → images)
  importPresentation: () => invokeObserved('import-presentation'),

  // Import generated presentation (PPTX bytes → images)
  importGeneratedPresentation: (payload: any) =>
    invokeObserved('import-generated-presentation', payload),

  // Presentation persistence & cleanup
  deletePresentation: (payload: any) => invokeObserved('delete-presentation', payload),
  savePresentations: (presentations: any) => invokeObserved('save-presentations', presentations),
  loadPresentations: () => invokeObserved('load-presentations'),

  // Output Windows
  openOutput: (outputId: string) => ipcRenderer.send('open-output', outputId),

  // Local image helper
  readImageDataUrl: (imagePath: string) => invokeObserved('read-image-data-url', imagePath),

  // OCR — run text extraction on image(s) for media matching
  ocrProcessImage: (imagePath: string) => invokeObserved('ocr-process-image', imagePath),
  ocrProcessImages: (imagePaths: string[]) => invokeObserved('ocr-process-images', imagePaths),

  // Sermon Transcript & Notes
  getSermonTranscript: () => invokeObserved('get-sermon-transcript'),
  getSermonStart: () => invokeObserved('get-sermon-start'),
  respondSermonStart: (action: string, requestId?: number) => invokeObserved('respond-sermon-start', action, requestId),
  onSermonStart: (callback: (state: import('../shared/sermonStart').SermonStartState) => void) => {
    const subscription = (_event: IpcRendererEvent, state: import('../shared/sermonStart').SermonStartState) => callback(state)
    ipcRenderer.on('on-sermon-start', subscription)
    return () => ipcRenderer.removeListener('on-sermon-start', subscription)
  },
  getServiceLog: () => invokeObserved('get-service-log'),
  saveServiceSummary: () => invokeObserved('save-service-summary'),
  generateSermonNotes: () => invokeObserved('generate-sermon-notes'),
  exportSermonNotesPdf: (notes: any) => invokeObserved('export-sermon-notes-pdf', notes),
  exportSermonNotesMd: (notes: any) => invokeObserved('export-sermon-notes-md', notes),

  // Settings
  getSettings: () => invokeObserved('get-settings'),
  getSetting: (key: string) => invokeObserved('get-setting', key),
  setSetting: (key: string, value: any) => invokeObserved('set-setting', { key, value }),

  // Service Agent
  setServiceSchedule: (schedule: any) => ipcRenderer.send('set-service-schedule', schedule),
  setRunOrderContext: (schedule: any) => ipcRenderer.send('set-service-schedule', schedule, false),
  setCurrentSongLyrics: (lyrics: string) => ipcRenderer.send('set-current-song-lyrics', lyrics),
  onShowCleanBackground: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on('on-show-clean-background', subscription)
    return () => ipcRenderer.removeListener('on-show-clean-background', subscription)
  },
  onSegmentChanged: (callback: (data: any) => void) => {
    const subscription = (_event: IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('on-segment-changed', subscription)
    return () => ipcRenderer.removeListener('on-segment-changed', subscription)
  },
  onMediaSuggestion: (callback: (data: any) => void) => {
    const subscription = (_event: IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('on-media-suggestion', subscription)
    return () => ipcRenderer.removeListener('on-media-suggestion', subscription)
  },
  onVerseAutoDismiss: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on('on-verse-auto-dismiss', subscription)
    return () => ipcRenderer.removeListener('on-verse-auto-dismiss', subscription)
  },

  // Sermon Plan & Preacher Profiles
  setSermonPlan: (jsonOrPath: string) => invokeObserved('set-sermon-plan', jsonOrPath),
  setActivePreacher: (preacherId: string) => invokeObserved('set-active-preacher', preacherId),
  listPreacherProfiles: () => invokeObserved('list-preacher-profiles'),
  createPreacherProfile: (id: string, name: string) =>
    invokeObserved('create-preacher-profile', { id, name }),
  deletePreacherProfile: (id: string) => invokeObserved('delete-preacher-profile', id),
  endService: (opts?: any) => invokeObserved('end-service', opts),

  // Live notes updates from reasoning loop
  onNotesUpdated: (callback: (data: any) => void) => {
    const subscription = (_event: IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('on-notes-updated', subscription)
    return () => ipcRenderer.removeListener('on-notes-updated', subscription)
  },

  // Webhooks / External API listener
  onExternalCommand: (callback: (data: any) => void) => {
    const subscription = (_event: IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('on-external-command', subscription)
    return () => ipcRenderer.removeListener('on-external-command', subscription)
  },
  // Which page of the live reading is showing — the operator's pager drives
  // every output window (a long range is pages of whole verses).
  setLiveSlide: (index: number) => ipcRenderer.send('set-live-slide', index),
  onLiveSlide: (callback: (index: number) => void) => {
    const subscription = (_event: IpcRendererEvent, index: number) => callback(index)
    ipcRenderer.on('on-live-slide', subscription)
    return () => ipcRenderer.removeListener('on-live-slide', subscription)
  },

  // Streaming — OBS Studio
  obsConnect: () => invokeObserved('obs-connect'),
  obsDisconnect: () => invokeObserved('obs-disconnect'),
  obsStatus: () => invokeObserved('obs-status'),
  obsSetScene: (sceneName: string) => invokeObserved('obs-set-scene', sceneName),
  obsSetBrowserSourceUrl: (sourceName: string, url: string) =>
    invokeObserved('obs-set-browser-source-url', { sourceName, url }),

  // Streaming — vMix
  vmixStatus: () => invokeObserved('vmix-status'),
  vmixSetActive: (input: any) => invokeObserved('vmix-set-active', input),
  vmixOverlay: (channel: any, action: any, input?: any) =>
    invokeObserved('vmix-overlay', { channel, action, input }),
  vmixSetTitleText: (input: any, selectedName: string, value: string) =>
    invokeObserved('vmix-set-title-text', {
      input,
      selectedName,
      value
    }),

  // OCR schedule import + smart schedule learning
  importScheduleImage: () => invokeObserved('import-schedule-image'),
  scheduleSuggestion: () => invokeObserved('schedule-suggestion'),
  applyScheduleSuggestion: () => invokeObserved('apply-schedule-suggestion'),

  // Cloud (Supabase) — auth + service lifecycle + multi-campus
  cloudStatus: () => invokeObserved('cloud-status'),
  cloudSignIn: (email: string, password: string) =>
    invokeObserved('cloud-sign-in', { email, password }),
  cloudSignUp: (email: string, password: string, accountName: string) =>
    invokeObserved('cloud-sign-up', { email, password, accountName }),
  cloudSignOut: () => invokeObserved('cloud-sign-out'),
  cloudStartService: (opts?: any) => invokeObserved('cloud-start-service', opts),
  cloudEndService: () => invokeObserved('cloud-end-service'),
  cloudMarkVersePushed: (verseId: string) => invokeObserved('cloud-mark-verse-pushed', verseId),
  cloudUpsertNotes: (notes: any) => invokeObserved('cloud-upsert-notes', notes),
  cloudSyncGiving: (methods: any) => invokeObserved('cloud-sync-giving', methods),
  cloudGenerateLinkCode: () => invokeObserved('cloud-generate-link-code'),
  cloudRedeemLinkCode: (code: string) => invokeObserved('cloud-redeem-link-code', code),
  cloudCompleteAccountSetup: (churchName: string, slug: string) =>
    invokeObserved('cloud-complete-account-setup', { churchName, slug }),
  cloudFetchMyAccount: () => invokeObserved('cloud-fetch-my-account'),
  cloudFetchPastors: () => invokeObserved('cloud-fetch-pastors'),
  cloudFetchCampuses: () => invokeObserved('cloud-fetch-campuses'),
  cloudFetchRecentServices: () => invokeObserved('cloud-fetch-recent-services'),
  cloudFetchRecentNotes: () => invokeObserved('cloud-fetch-recent-notes'),
  cloudFetchAudienceSessions: () => invokeObserved('cloud-fetch-audience-sessions'),
  cloudRunRetentionCleanup: () => invokeObserved('cloud-run-retention-cleanup'),
  cloudVerifyPassword: (password: string) => invokeObserved('cloud-verify-password', password),
  cloudSignOutAllDevices: () => invokeObserved('cloud-sign-out-all-devices'),

  /* -------- agentic layer (added post-recovery) -------- */

  // Per-preacher trust meter / auto-mode stats
  getPreacherLearning: (preacherId: string) => invokeObserved('preacher-learning-get', preacherId),
  savePreacherLearning: (preacherId: string, patch: unknown) => invokeObserved('preacher-learning-save', { preacherId, patch }),
  addMissedReference: (preacherId: string, heard: string) => invokeObserved('preacher-review-missed', { preacherId, heard }),
  useOfflineSpeech: () => invokeObserved('preacher-use-offline'),
  startPreacherSoundCheck: (preacherId: string, promptIndex: number, deviceLabel?: string) => invokeObserved('preacher-sound-check-start', { preacherId, promptIndex, deviceLabel }),
  getPreacherSoundCheck: () => invokeObserved('preacher-sound-check-state'),
  stopPreacherSoundCheck: (sessionId: string) => invokeObserved('preacher-sound-check-stop', sessionId),
  reportMicCaptureError: (message: string) => ipcRenderer.send('mic-capture-error', message),
  getPreacherStats: (preacherId?: string) =>
    invokeObserved('get-preacher-stats', preacherId),
  // End-of-service review ritual
  getReviewItems: () => invokeObserved('get-review-items'),
  resolveReviewItem: (
    id: string,
    resolution: 'confirmed' | 'rejected' | 'amended' | 'skipped',
    amendedTo?: { book: string; chapter: number; verse: number | null }
  ) => invokeObserved('resolve-review-item', { id, resolution, amendedTo }),
  // Mentioned-but-not-displayed queue
  getVerseQueue: () => invokeObserved('get-verse-queue'),
  showQueuedVerse: (ref: string) => invokeObserved('show-queued-verse', ref),
  // Operator asks which passage the last words spoken point to
  findHeardScripture: (text?: string, correctTypos = true, spoken = false) => invokeObserved('find-heard-scripture', { text, correctTypos, spoken }),
  // Translation control (also reachable by the preacher's voice)
  setDisplayVersion: (version: string) =>
    invokeObserved('set-display-version', version),
  // This service's Bible (LIVE's dropdown) — never saved over the church's default
  setSessionVersion: (version: string | null) => invokeObserved('set-session-version', version),
  getSessionVersion: () => invokeObserved('get-session-version'),
  getSeasonalTheme: () => invokeObserved('get-seasonal-theme'),
  getNotesProviderStatus: () => invokeObserved('get-notes-provider-status'),

  onVoiceCommand: (callback: (event: any) => void) => {
    const subscription = (_event: IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('on-voice-command', subscription)
    return () => ipcRenderer.removeListener('on-voice-command', subscription)
  },
  onVersionChanged: (callback: (version: string) => void) => {
    const subscription = (_event: IpcRendererEvent, v: string) => callback(v)
    ipcRenderer.on('on-version-changed', subscription)
    return () => ipcRenderer.removeListener('on-version-changed', subscription)
  },
  onQueueUpdated: (callback: (queue: any[]) => void) => {
    const subscription = (_event: IpcRendererEvent, q: any[]) => callback(q)
    ipcRenderer.on('on-queue-updated', subscription)
    return () => ipcRenderer.removeListener('on-queue-updated', subscription)
  },
  onPrayerMode: (callback: (inPrayer: boolean) => void) => {
    const subscription = (_event: IpcRendererEvent, p: boolean) => callback(p)
    ipcRenderer.on('on-prayer-mode', subscription)
    return () => ipcRenderer.removeListener('on-prayer-mode', subscription)
  },
  onIntentState: (callback: (state: string) => void) => {
    const subscription = (_event: IpcRendererEvent, s: string) => callback(s)
    ipcRenderer.on('on-intent-state', subscription)
    return () => ipcRenderer.removeListener('on-intent-state', subscription)
  },
  // The engine always emitted this; the original preload never exposed it.
  onAsrStatus: (callback: (status: string) => void) => {
    const subscription = (_event: IpcRendererEvent, s: string) => callback(s)
    ipcRenderer.on('on-asr-status', subscription)
    return () => ipcRenderer.removeListener('on-asr-status', subscription)
  },

  // Multilingual + configurable phrases
  getAvailableLanguages: () => invokeObserved('get-available-languages'),
  getVoiceCommandConfig: () => invokeObserved('get-voice-command-config'),
  saveVoiceCommandConfig: (userConfig: any) =>
    invokeObserved('save-voice-command-config', userConfig),

  // Window-mic capture (used when SoX isn't installed)
  requestMicPermission: () => invokeObserved('request-mic-permission'),
  getAudioCaptureCapabilities: () => invokeObserved('get-audio-capture-capabilities'),
  sendAudioChunk: (chunk: ArrayBuffer) => ipcRenderer.send('audio-chunk', chunk),
  sendAudioLevel: (level: number) => ipcRenderer.send('audio-level', level),
  onMicRequest: (callback: (req: { sampleRate: number; deviceLabel?: string }) => void) => {
    const subscription = (_event: IpcRendererEvent, req: any) => callback(req)
    ipcRenderer.on('on-mic-request', subscription)
    return () => ipcRenderer.removeListener('on-mic-request', subscription)
  },
  onMicStop: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on('on-mic-stop', subscription)
    return () => ipcRenderer.removeListener('on-mic-stop', subscription)
  },

  // The phone microphone (shared/phoneMic.ts): the laptop makes a code and
  // approves the phone in main; the WebRTC peer answering it lives here.
  phoneMicStart: () => invokeObserved('phone-mic-start'),
  phoneMicStop: () => invokeObserved('phone-mic-stop'),
  phoneMicApprove: (allow: boolean) => invokeObserved('phone-mic-approve', allow),
  phoneMicStatus: () => invokeObserved('phone-mic-status'),
  phoneMicSignal: (message: unknown) => ipcRenderer.send('phone-mic-signal', message),
  phoneMicPeerState: (state: 'connected' | 'failed', detail?: string) => ipcRenderer.send('phone-mic-peer-state', state, detail),
  onPhoneMicSignal: (callback: (message: any) => void) => {
    const subscription = (_event: IpcRendererEvent, message: any) => callback(message)
    ipcRenderer.on('on-phone-mic-signal', subscription)
    return () => ipcRenderer.removeListener('on-phone-mic-signal', subscription)
  },
  onPhoneMicStatus: (callback: (status: any) => void) => {
    const subscription = (_event: IpcRendererEvent, status: any) => callback(status)
    ipcRenderer.on('on-phone-mic-status', subscription)
    return () => ipcRenderer.removeListener('on-phone-mic-status', subscription)
  },

  // Themes — native background image picker (copies into userData)
  pickBackgroundImage: () => invokeObserved('pick-background-image'),
  pickMediaFile: () => invokeObserved('pick-media-file'),
  // Many at once: the dialog names them, then the renderer imports them one
  // call at a time so it can say how far along it is (main.ts, mediaImport.ts).
  pickMediaPaths: () => invokeObserved('pick-media-paths'),
  importMediaFiles: (paths: string[]) => invokeObserved('import-media-files', paths),
  saveClipPoster: (id: string, dataUrl: string) => invokeObserved('save-clip-poster', id, dataUrl),
  // A file dropped from Finder → its path. File.path is gone since Electron
  // 32; this is its documented replacement, and only a preload can call it.
  pathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return ''
    }
  },
  getDisplaysStatus: () => invokeObserved('get-displays-status'),
  // The connected displays and where each output goes — the outputs card
  // and Settings draw this. Asked again whenever on-outputs-changed fires.
  getOutputsStatus: () => invokeObserved('get-outputs-status'),
  onOutputsChanged: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on('on-outputs-changed', subscription)
    return () => ipcRenderer.removeListener('on-outputs-changed', subscription)
  },
  // Stock backgrounds (Pixabay / Pexels), searched from the media tab
  getStockProviders: () => invokeObserved('get-stock-providers'),
  searchStock: (params: any) => invokeObserved('search-stock', params),
  downloadStock: (payload: any) => invokeObserved('download-stock', payload),

  // Media display on outputs + theme repaint
  showMedia: (imagePath: string, kind?: 'photo' | 'video') => invokeObserved('show-media', imagePath, kind),
  mediaControl: (action: { type: string; value?: number | boolean }) => invokeObserved('media-control', action),
  onMediaControl: (callback: (action: { type: string; value?: number | boolean }) => void) => {
    const subscription = (_event: IpcRendererEvent, a: { type: string; value?: number | boolean }) => callback(a)
    ipcRenderer.on('on-media-control', subscription)
    return () => ipcRenderer.removeListener('on-media-control', subscription)
  },
  // Words on the projector that are not a verse (songs/slides). See shared/liveContent.ts.
  pushLiveContent: (content: LiveContent) => invokeObserved('push-live-content', content),
  getLiveContent: () => invokeObserved('get-live-content'),
  getOutputContent: () => invokeObserved('get-output-content'),
  onLiveContent: (callback: (content: LiveContent) => void) => {
    const subscription = (_event: IpcRendererEvent, c: LiveContent) => callback(c)
    ipcRenderer.on('on-live-content', subscription)
    return () => ipcRenderer.removeListener('on-live-content', subscription)
  },
  clearMedia: () => invokeObserved('clear-media'),
  showQr: () => invokeObserved('show-qr'),
  getQrSvg: (size?: number) => invokeObserved('get-qr-svg', size),
  onShowMedia: (callback: (imagePath: string, kind?: 'photo' | 'video') => void) => {
    const subscription = (_event: IpcRendererEvent, p: string, kind?: 'photo' | 'video') => callback(p, kind)
    ipcRenderer.on('on-show-media', subscription)
    return () => ipcRenderer.removeListener('on-show-media', subscription)
  },
  onThemeChanged: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on('on-theme-changed', subscription)
    return () => ipcRenderer.removeListener('on-theme-changed', subscription)
  },

  /* -------- 2026-09-09 timers + message tokens (BUILD-MAP 2.16–2.17) -------- */
  listTimers: () => invokeObserved('timers-list'),
  createTimer: (input: any) => invokeObserved('timers-create', input),
  updateTimer: (id: string, patch: any) => invokeObserved('timers-update', { id, patch }),
  removeTimer: (id: string) => invokeObserved('timers-remove', id),
  startTimer: (id: string) => invokeObserved('timers-start', id),
  pauseTimer: (id: string) => invokeObserved('timers-pause', id),
  resetTimer: (id: string) => invokeObserved('timers-reset', id),
  onTimers: (callback: (timers: any[]) => void) => {
    const subscription = (_event: IpcRendererEvent, t: any[]) => callback(t)
    ipcRenderer.on('on-timers', subscription)
    return () => ipcRenderer.removeListener('on-timers', subscription)
  },
  // What holes a saved message still has, plus a filled preview.
  inspectAlert: (text: string) => invokeObserved('alert-inspect', text),

  /* -------- 2026-09-08 outputs, alerts, keyword search (BUILD-MAP 2.10–2.13) -------- */
  // Screen state: 'live' | 'clear' | 'black' | 'logo' on every output.
  setScreenState: (state: string) => invokeObserved('screen-state-set', state),
  getScreenState: () => invokeObserved('screen-state-get'),
  onScreenState: (callback: (state: string) => void) => {
    const subscription = (_event: IpcRendererEvent, s: string) => callback(s)
    ipcRenderer.on('on-screen-state', subscription)
    return () => ipcRenderer.removeListener('on-screen-state', subscription)
  },
  // Which role this output window plays (answered per-window by main).
  getOutputRole: (outputId: string) => invokeObserved('output-role-get', outputId),
  // Message alerts.
  showAlert: (
    text: string,
    opts?: { target?: string; durationSec?: number | null; values?: Record<string, string> }
  ) => invokeObserved('alert-show', { text, ...(opts ?? {}) }),
  dismissAlert: () => invokeObserved('alert-dismiss'),
  getAlert: () => invokeObserved('alert-current'),
  onAlert: (callback: (alert: any | null) => void) => {
    const subscription = (_event: IpcRendererEvent, a: any) => callback(a)
    ipcRenderer.on('on-alert', subscription)
    return () => ipcRenderer.removeListener('on-alert', subscription)
  },
  // Keyword search over the Bible text ("rejoice always" → Phil 4:4).
  searchBibleText: (query: string, opts?: { version?: string; limit?: number }) =>
    invokeObserved('bible-keyword-search', { query, ...(opts ?? {}) }),

  /* -------- 2026-09 engine additions (see BUILD-MAP.md) -------- */
  // Generic subscription for the new engine channels:
  // 'on-auto-mode-event' | 'on-candidates' | 'on-companion-event' |
  // 'on-viewer-count' | 'on-poll-tally' | 'on-companion-recap'
  onEngineEvent: (channel: string, callback: (payload: any) => void) => {
    const subscription = (_event: IpcRendererEvent, payload: any) => callback(payload)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  },
  // Auto mode + clash (item 16)
  setAutoMode: (preacherId: string | null, enabled: boolean) =>
    invokeObserved('auto-mode-set', { preacherId, enabled }),
  getCandidates: () => invokeObserved('auto-mode-get-candidates'),
  resolveClash: (index: number) => invokeObserved('auto-mode-resolve-clash', index),
  dismissClash: () => invokeObserved('auto-mode-dismiss-clash'),
  noteOperatorReversal: (kind: string) => ipcRenderer.send('operator-reversal', kind),
  // Voice command log + per-preacher phrases (item 17)
  getCommandLog: (preacherId?: string, limit?: number) =>
    invokeObserved('command-log-recent', { preacherId, limit }),
  getCommandFalsePositives: (preacherId?: string) =>
    invokeObserved('command-log-false-positives', preacherId),
  suppressCommandUtterance: (preacherId: string | null, utterance: string) =>
    invokeObserved('command-log-suppress', { preacherId, utterance }),
  teachCommandPhrase: (preacherId: string | null, utterance: string, kind: string) =>
    invokeObserved('command-log-teach', { preacherId, utterance, kind }),
  getPreacherCommandConfig: (preacherId?: string) =>
    invokeObserved('get-preacher-command-config', preacherId),
  savePreacherCommandConfig: (preacherId: string | null, config: any) =>
    invokeObserved('save-preacher-command-config', { preacherId, config }),
  // Vocabulary (item 18)
  getVocabulary: (preacherId?: string) => invokeObserved('vocabulary-get', preacherId),
  setVocabulary: (preacherId: string | null, terms: string[]) =>
    invokeObserved('vocabulary-set', { preacherId, terms }),
  // Remote control pairing (item 22)
  remoteGenerateCode: () => invokeObserved('remote-generate-code'),
  remoteCurrentCode: () => invokeObserved('remote-current-code'),
  remoteListDevices: () => invokeObserved('remote-list-devices'),
  remoteConnected: () => invokeObserved('remote-connected'),
  remoteRevoke: (deviceId: string) => invokeObserved('remote-revoke', deviceId),
  remoteRevokeAll: () => invokeObserved('remote-revoke-all'),
  // Companion (items 7, 9, 10)
  getCompanionShareLink: () => invokeObserved('companion-share-link'),
  getViewerSnapshot: () => invokeObserved('companion-viewer-snapshot'),
  getCurrentPoll: () => invokeObserved('companion-poll-current'),
  closePoll: (pollId: string, index: number | null) =>
    invokeObserved('companion-poll-close', { pollId, index }),
  sendCompanionFrame: (raw: string, ip?: string) => ipcRenderer.send('companion-frame', { raw, ip }),
  // Command palette search (item 6)
  searchCommands: (query: string, limit?: number) =>
    invokeObserved('search-query', { query, limit }),
  // Library folders (item 12)
  folders: {
    list: (libraryId: string, itemIds?: string[]) =>
      invokeObserved('folders-list', { libraryId, itemIds }),
    create: (libraryId: string, name: string) => invokeObserved('folders-create', { libraryId, name }),
    rename: (libraryId: string, id: string, name: string) =>
      invokeObserved('folders-rename', { libraryId, id, name }),
    setColor: (libraryId: string, id: string, color: string) =>
      invokeObserved('folders-color', { libraryId, id, color }),
    remove: (libraryId: string, id: string) => invokeObserved('folders-delete', { libraryId, id }),
    moveItem: (libraryId: string, itemId: string, folderId: string | null) =>
      invokeObserved('folders-move-item', { libraryId, itemId, folderId }),
    reorder: (libraryId: string, ids: string[]) => invokeObserved('folders-reorder', { libraryId, ids }),
    of: (libraryId: string, itemId: string) => invokeObserved('folders-of-item', { libraryId, itemId })
  },
  // Scripture → background preset
  presetForReference: (book: string, chapter?: number, verse?: number) =>
    invokeObserved('preset-for-reference', { book, chapter, verse }),
  // Song import (item 23) — parse only, nothing is written
  importSongText: (text: string, filename?: string) =>
    invokeObserved('songs-import-text', { text, filename }),
  importSongFiles: () => invokeObserved('songs-import-file'),
  // Song library (item 1.11). `importCommit` is the second half of import:
  // parse first, let the operator review the duplicates, then commit.
  songs: {
    list: () => invokeObserved('songs-list'),
    problem: () => invokeObserved('songs-problem'),
    get: (id: string) => invokeObserved('songs-get', { id }),
    add: (song: ImportedSong) => invokeObserved('songs-add', { song }),
    update: (id: string, patch: SongPatch) => invokeObserved('songs-update', { id, patch }),
    remove: (id: string) => invokeObserved('songs-remove', { id }),
    importText: (text: string, filename?: string) =>
      invokeObserved('songs-import-text', { text, filename }),
    importFiles: () => invokeObserved('songs-import-file'),
    importCommit: (songs: ImportedSong[]) => invokeObserved('songs-import-commit', { songs }),
    // Online sources. All three resolve to `{ ok }` results and never reject.
    discoverChristianSongs: (query: string) => invokeObserved('songs-discover', { query }),
    searchLyrics: (query: string) => invokeObserved('lyrics-search', { query }),
    getLyrics: (id: number) => invokeObserved('lyrics-get', { id }),
    lyricsPreview: (title: string, artist: string, opts?: { retry?: boolean }) =>
      invokeObserved('lyrics-preview', { title, artist, retry: !!opts?.retry }),
    youtubeCaptions: (url: string) => invokeObserved('youtube-captions', { url })
  },
  // Evals (item 25)
  exportEvalFixtures: () => invokeObserved('evals-export-fixtures')
})
