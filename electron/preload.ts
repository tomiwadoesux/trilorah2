import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { SongPatch } from '../shared/types'
import type { LiveContent } from '../shared/liveContent'
import type { ImportedSong } from './songs/import'
import type { RecognitionWithdrawal } from '../shared/recognitionWithdrawal'
import type { TriApi } from '../shared/triBridge'

const triApi: TriApi = {
  triCatalog: state => ipcRenderer.invoke('tri-catalog', state),
  triSave: request => ipcRenderer.invoke('tri-save', request),
  triInspect: recentPath => ipcRenderer.invoke('tri-inspect', recentPath),
  triImport: request => ipcRenderer.invoke('tri-import', request),
  triRecent: () => ipcRenderer.invoke('tri-recent'),
  triStatus: () => ipcRenderer.invoke('tri-status'),
  triNew: () => ipcRenderer.invoke('tri-new'),
  onTriOpenRequested: callback => {
    const handler = () => callback()
    ipcRenderer.on('tri-open-requested', handler)
    return () => ipcRenderer.removeListener('tri-open-requested', handler)
  },
}

contextBridge.exposeInMainWorld('api', {
  ...triApi,
  qrBackground: (action: 'status'|'choose'|'clear') => ipcRenderer.invoke('qr-background',action),
  mobileStatus: () => ipcRenderer.invoke('mobile-status'),
  mobileCode: (generate = false) => ipcRenderer.invoke('mobile-code', generate),
  mobileRevoke: (id: string) => ipcRenderer.invoke('mobile-revoke', id),
  mobileThumbnail: (imagePath: string) => ipcRenderer.invoke('mobile-thumbnail', imagePath),
  mobileEnable: (enabled: boolean) => ipcRenderer.invoke('mobile-enable', enabled),
  mobileApprove: (id: string, allow: boolean) => ipcRenderer.invoke('mobile-approve', id, allow),
  mobileQr: (url: string) => ipcRenderer.invoke('mobile-qr', url),
  mobileVerse: (reference: string, version: string, live: boolean) => ipcRenderer.invoke('mobile-verse', reference, version, live),
  onMobileRequest: (callback: (request: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, request: any) => callback(request)
    ipcRenderer.on('mobile-request', handler)
    return () => ipcRenderer.removeListener('mobile-request', handler)
  },
  mobileReply: (reply: any) => ipcRenderer.send('mobile-reply', reply),
  // Fetch a chapter by book ID and chapter number (optionally with version)
  getChapter: (bookId: number, chapter: number, version?: string) =>
    ipcRenderer.invoke('get-chapter', { bookId, chapter, version }),

  // Get available Bible versions
  getAvailableVersions: () => ipcRenderer.invoke('get-available-versions'),
  // The same list with names, online/bundled, and NKJV/NIV greyed with the reason until a YouVersion key unlocks them
  getBibleVersions: () => ipcRenderer.invoke('get-bible-versions'),
  // A passage's verses in one read, gaps and all (the projector and its second line)
  getVerseRange: (book: string | number, chapter: number, start: number, end: number, version?: string) =>
    ipcRenderer.invoke('get-verse-range', { book, chapter, start, end, version }),
  toggleWindowFullscreen: () => ipcRenderer.invoke('window-toggle-fullscreen') as Promise<boolean>,

  // Bible database health (drives the missing-DB banner)
  getDbStatus: () => ipcRenderer.invoke('get-db-status'),

  // Search for a specific verse
  searchVerse: (book: string, chapter: number, verse: number, version?: string) =>
    ipcRenderer.invoke('search-verse', { book, chapter, verse, version }),

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
  importPresentation: () => ipcRenderer.invoke('import-presentation'),

  // Import generated presentation (PPTX bytes → images)
  importGeneratedPresentation: (payload: any) =>
    ipcRenderer.invoke('import-generated-presentation', payload),

  // Presentation persistence & cleanup
  deletePresentation: (payload: any) => ipcRenderer.invoke('delete-presentation', payload),
  savePresentations: (presentations: any) => ipcRenderer.invoke('save-presentations', presentations),
  loadPresentations: () => ipcRenderer.invoke('load-presentations'),

  // Output Windows
  openOutput: (outputId: string) => ipcRenderer.send('open-output', outputId),

  // Local image helper
  readImageDataUrl: (imagePath: string) => ipcRenderer.invoke('read-image-data-url', imagePath),

  // OCR — run text extraction on image(s) for media matching
  ocrProcessImage: (imagePath: string) => ipcRenderer.invoke('ocr-process-image', imagePath),
  ocrProcessImages: (imagePaths: string[]) => ipcRenderer.invoke('ocr-process-images', imagePaths),

  // Sermon Transcript & Notes
  getSermonTranscript: () => ipcRenderer.invoke('get-sermon-transcript'),
  getSermonStart: () => ipcRenderer.invoke('get-sermon-start'),
  respondSermonStart: (action: string, requestId?: number) => ipcRenderer.invoke('respond-sermon-start', action, requestId),
  onSermonStart: (callback: (state: import('../shared/sermonStart').SermonStartState) => void) => {
    const subscription = (_event: IpcRendererEvent, state: import('../shared/sermonStart').SermonStartState) => callback(state)
    ipcRenderer.on('on-sermon-start', subscription)
    return () => ipcRenderer.removeListener('on-sermon-start', subscription)
  },
  getServiceLog: () => ipcRenderer.invoke('get-service-log'),
  saveServiceSummary: () => ipcRenderer.invoke('save-service-summary'),
  generateSermonNotes: () => ipcRenderer.invoke('generate-sermon-notes'),
  exportSermonNotesPdf: (notes: any) => ipcRenderer.invoke('export-sermon-notes-pdf', notes),
  exportSermonNotesMd: (notes: any) => ipcRenderer.invoke('export-sermon-notes-md', notes),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getSetting: (key: string) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key: string, value: any) => ipcRenderer.invoke('set-setting', { key, value }),

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
  setSermonPlan: (jsonOrPath: string) => ipcRenderer.invoke('set-sermon-plan', jsonOrPath),
  setActivePreacher: (preacherId: string) => ipcRenderer.invoke('set-active-preacher', preacherId),
  listPreacherProfiles: () => ipcRenderer.invoke('list-preacher-profiles'),
  createPreacherProfile: (id: string, name: string) =>
    ipcRenderer.invoke('create-preacher-profile', { id, name }),
  deletePreacherProfile: (id: string) => ipcRenderer.invoke('delete-preacher-profile', id),
  endService: (opts?: any) => ipcRenderer.invoke('end-service', opts),

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
  obsConnect: () => ipcRenderer.invoke('obs-connect'),
  obsDisconnect: () => ipcRenderer.invoke('obs-disconnect'),
  obsStatus: () => ipcRenderer.invoke('obs-status'),
  obsSetScene: (sceneName: string) => ipcRenderer.invoke('obs-set-scene', sceneName),
  obsSetBrowserSourceUrl: (sourceName: string, url: string) =>
    ipcRenderer.invoke('obs-set-browser-source-url', { sourceName, url }),

  // Streaming — vMix
  vmixStatus: () => ipcRenderer.invoke('vmix-status'),
  vmixSetActive: (input: any) => ipcRenderer.invoke('vmix-set-active', input),
  vmixOverlay: (channel: any, action: any, input?: any) =>
    ipcRenderer.invoke('vmix-overlay', { channel, action, input }),
  vmixSetTitleText: (input: any, selectedName: string, value: string) =>
    ipcRenderer.invoke('vmix-set-title-text', {
      input,
      selectedName,
      value
    }),

  // OCR schedule import + smart schedule learning
  importScheduleImage: () => ipcRenderer.invoke('import-schedule-image'),
  scheduleSuggestion: () => ipcRenderer.invoke('schedule-suggestion'),
  applyScheduleSuggestion: () => ipcRenderer.invoke('apply-schedule-suggestion'),

  // Cloud (Supabase) — auth + service lifecycle + multi-campus
  cloudStatus: () => ipcRenderer.invoke('cloud-status'),
  cloudSignIn: (email: string, password: string) =>
    ipcRenderer.invoke('cloud-sign-in', { email, password }),
  cloudSignUp: (email: string, password: string, accountName: string) =>
    ipcRenderer.invoke('cloud-sign-up', { email, password, accountName }),
  cloudSignOut: () => ipcRenderer.invoke('cloud-sign-out'),
  cloudStartService: (opts?: any) => ipcRenderer.invoke('cloud-start-service', opts),
  cloudEndService: () => ipcRenderer.invoke('cloud-end-service'),
  cloudMarkVersePushed: (verseId: string) => ipcRenderer.invoke('cloud-mark-verse-pushed', verseId),
  cloudUpsertNotes: (notes: any) => ipcRenderer.invoke('cloud-upsert-notes', notes),
  cloudSyncGiving: (methods: any) => ipcRenderer.invoke('cloud-sync-giving', methods),
  cloudGenerateLinkCode: () => ipcRenderer.invoke('cloud-generate-link-code'),
  cloudRedeemLinkCode: (code: string) => ipcRenderer.invoke('cloud-redeem-link-code', code),
  cloudCompleteAccountSetup: (churchName: string, slug: string) =>
    ipcRenderer.invoke('cloud-complete-account-setup', { churchName, slug }),
  cloudFetchMyAccount: () => ipcRenderer.invoke('cloud-fetch-my-account'),
  cloudFetchPastors: () => ipcRenderer.invoke('cloud-fetch-pastors'),
  cloudFetchCampuses: () => ipcRenderer.invoke('cloud-fetch-campuses'),
  cloudFetchRecentServices: () => ipcRenderer.invoke('cloud-fetch-recent-services'),
  cloudFetchRecentNotes: () => ipcRenderer.invoke('cloud-fetch-recent-notes'),
  cloudFetchAudienceSessions: () => ipcRenderer.invoke('cloud-fetch-audience-sessions'),
  cloudRunRetentionCleanup: () => ipcRenderer.invoke('cloud-run-retention-cleanup'),
  cloudVerifyPassword: (password: string) => ipcRenderer.invoke('cloud-verify-password', password),
  cloudSignOutAllDevices: () => ipcRenderer.invoke('cloud-sign-out-all-devices'),

  /* -------- agentic layer (added post-recovery) -------- */

  // Per-preacher trust meter / auto-mode stats
  getPreacherLearning: (preacherId: string) => ipcRenderer.invoke('preacher-learning-get', preacherId),
  savePreacherLearning: (preacherId: string, patch: unknown) => ipcRenderer.invoke('preacher-learning-save', { preacherId, patch }),
  addMissedReference: (preacherId: string, heard: string) => ipcRenderer.invoke('preacher-review-missed', { preacherId, heard }),
  useOfflineSpeech: () => ipcRenderer.invoke('preacher-use-offline'),
  startPreacherSoundCheck: (preacherId: string, promptIndex: number, deviceLabel?: string) => ipcRenderer.invoke('preacher-sound-check-start', { preacherId, promptIndex, deviceLabel }),
  getPreacherSoundCheck: () => ipcRenderer.invoke('preacher-sound-check-state'),
  stopPreacherSoundCheck: (sessionId: string) => ipcRenderer.invoke('preacher-sound-check-stop', sessionId),
  reportMicCaptureError: (message: string) => ipcRenderer.send('mic-capture-error', message),
  getPreacherStats: (preacherId?: string) =>
    ipcRenderer.invoke('get-preacher-stats', preacherId),
  // End-of-service review ritual
  getReviewItems: () => ipcRenderer.invoke('get-review-items'),
  resolveReviewItem: (
    id: string,
    resolution: 'confirmed' | 'rejected' | 'amended' | 'skipped',
    amendedTo?: { book: string; chapter: number; verse: number | null }
  ) => ipcRenderer.invoke('resolve-review-item', { id, resolution, amendedTo }),
  // Mentioned-but-not-displayed queue
  getVerseQueue: () => ipcRenderer.invoke('get-verse-queue'),
  showQueuedVerse: (ref: string) => ipcRenderer.invoke('show-queued-verse', ref),
  // Operator asks which passage the last words spoken point to
  findHeardScripture: (text?: string) => ipcRenderer.invoke('find-heard-scripture', { text }),
  // Translation control (also reachable by the preacher's voice)
  setDisplayVersion: (version: string) =>
    ipcRenderer.invoke('set-display-version', version),
  // This service's Bible (LIVE's dropdown) — never saved over the church's default
  setSessionVersion: (version: string | null) => ipcRenderer.invoke('set-session-version', version),
  getSessionVersion: () => ipcRenderer.invoke('get-session-version'),
  getSeasonalTheme: () => ipcRenderer.invoke('get-seasonal-theme'),
  getNotesProviderStatus: () => ipcRenderer.invoke('get-notes-provider-status'),

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
  getAvailableLanguages: () => ipcRenderer.invoke('get-available-languages'),
  getVoiceCommandConfig: () => ipcRenderer.invoke('get-voice-command-config'),
  saveVoiceCommandConfig: (userConfig: any) =>
    ipcRenderer.invoke('save-voice-command-config', userConfig),

  // Window-mic capture (used when SoX isn't installed)
  requestMicPermission: () => ipcRenderer.invoke('request-mic-permission'),
  getAudioCaptureCapabilities: () => ipcRenderer.invoke('get-audio-capture-capabilities'),
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
  phoneMicStart: () => ipcRenderer.invoke('phone-mic-start'),
  phoneMicStop: () => ipcRenderer.invoke('phone-mic-stop'),
  phoneMicApprove: (allow: boolean) => ipcRenderer.invoke('phone-mic-approve', allow),
  phoneMicStatus: () => ipcRenderer.invoke('phone-mic-status'),
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
  pickBackgroundImage: () => ipcRenderer.invoke('pick-background-image'),
  pickMediaFile: () => ipcRenderer.invoke('pick-media-file'),
  // Many at once: the dialog names them, then the renderer imports them one
  // call at a time so it can say how far along it is (main.ts, mediaImport.ts).
  pickMediaPaths: () => ipcRenderer.invoke('pick-media-paths'),
  importMediaFiles: (paths: string[]) => ipcRenderer.invoke('import-media-files', paths),
  saveClipPoster: (id: string, dataUrl: string) => ipcRenderer.invoke('save-clip-poster', id, dataUrl),
  // A file dropped from Finder → its path. File.path is gone since Electron
  // 32; this is its documented replacement, and only a preload can call it.
  pathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return ''
    }
  },
  getDisplaysStatus: () => ipcRenderer.invoke('get-displays-status'),
  // The connected displays and where each output goes — the outputs card
  // and Settings draw this. Asked again whenever on-outputs-changed fires.
  getOutputsStatus: () => ipcRenderer.invoke('get-outputs-status'),
  onOutputsChanged: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on('on-outputs-changed', subscription)
    return () => ipcRenderer.removeListener('on-outputs-changed', subscription)
  },
  // Stock backgrounds (Pixabay / Pexels), searched from the media tab
  getStockProviders: () => ipcRenderer.invoke('get-stock-providers'),
  searchStock: (params: any) => ipcRenderer.invoke('search-stock', params),
  downloadStock: (payload: any) => ipcRenderer.invoke('download-stock', payload),

  // Media display on outputs + theme repaint
  showMedia: (imagePath: string, kind?: 'photo' | 'video') => ipcRenderer.invoke('show-media', imagePath, kind),
  mediaControl: (action: { type: string; value?: number | boolean }) => ipcRenderer.invoke('media-control', action),
  onMediaControl: (callback: (action: { type: string; value?: number | boolean }) => void) => {
    const subscription = (_event: IpcRendererEvent, a: { type: string; value?: number | boolean }) => callback(a)
    ipcRenderer.on('on-media-control', subscription)
    return () => ipcRenderer.removeListener('on-media-control', subscription)
  },
  // Words on the projector that are not a verse (songs/slides). See shared/liveContent.ts.
  pushLiveContent: (content: LiveContent) => ipcRenderer.invoke('push-live-content', content),
  getLiveContent: () => ipcRenderer.invoke('get-live-content'),
  getOutputContent: () => ipcRenderer.invoke('get-output-content'),
  onLiveContent: (callback: (content: LiveContent) => void) => {
    const subscription = (_event: IpcRendererEvent, c: LiveContent) => callback(c)
    ipcRenderer.on('on-live-content', subscription)
    return () => ipcRenderer.removeListener('on-live-content', subscription)
  },
  clearMedia: () => ipcRenderer.invoke('clear-media'),
  showQr: () => ipcRenderer.invoke('show-qr'),
  getQrSvg: (size?: number) => ipcRenderer.invoke('get-qr-svg', size),
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
  listTimers: () => ipcRenderer.invoke('timers-list'),
  createTimer: (input: any) => ipcRenderer.invoke('timers-create', input),
  updateTimer: (id: string, patch: any) => ipcRenderer.invoke('timers-update', { id, patch }),
  removeTimer: (id: string) => ipcRenderer.invoke('timers-remove', id),
  startTimer: (id: string) => ipcRenderer.invoke('timers-start', id),
  pauseTimer: (id: string) => ipcRenderer.invoke('timers-pause', id),
  resetTimer: (id: string) => ipcRenderer.invoke('timers-reset', id),
  onTimers: (callback: (timers: any[]) => void) => {
    const subscription = (_event: IpcRendererEvent, t: any[]) => callback(t)
    ipcRenderer.on('on-timers', subscription)
    return () => ipcRenderer.removeListener('on-timers', subscription)
  },
  // What holes a saved message still has, plus a filled preview.
  inspectAlert: (text: string) => ipcRenderer.invoke('alert-inspect', text),

  /* -------- 2026-09-08 outputs, alerts, keyword search (BUILD-MAP 2.10–2.13) -------- */
  // Screen state: 'live' | 'clear' | 'black' | 'logo' on every output.
  setScreenState: (state: string) => ipcRenderer.invoke('screen-state-set', state),
  getScreenState: () => ipcRenderer.invoke('screen-state-get'),
  onScreenState: (callback: (state: string) => void) => {
    const subscription = (_event: IpcRendererEvent, s: string) => callback(s)
    ipcRenderer.on('on-screen-state', subscription)
    return () => ipcRenderer.removeListener('on-screen-state', subscription)
  },
  // Which role this output window plays (answered per-window by main).
  getOutputRole: (outputId: string) => ipcRenderer.invoke('output-role-get', outputId),
  // Message alerts.
  showAlert: (
    text: string,
    opts?: { target?: string; durationSec?: number | null; values?: Record<string, string> }
  ) => ipcRenderer.invoke('alert-show', { text, ...(opts ?? {}) }),
  dismissAlert: () => ipcRenderer.invoke('alert-dismiss'),
  getAlert: () => ipcRenderer.invoke('alert-current'),
  onAlert: (callback: (alert: any | null) => void) => {
    const subscription = (_event: IpcRendererEvent, a: any) => callback(a)
    ipcRenderer.on('on-alert', subscription)
    return () => ipcRenderer.removeListener('on-alert', subscription)
  },
  // Keyword search over the Bible text ("rejoice always" → Phil 4:4).
  searchBibleText: (query: string, opts?: { version?: string; limit?: number }) =>
    ipcRenderer.invoke('bible-keyword-search', { query, ...(opts ?? {}) }),

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
    ipcRenderer.invoke('auto-mode-set', { preacherId, enabled }),
  getCandidates: () => ipcRenderer.invoke('auto-mode-get-candidates'),
  resolveClash: (index: number) => ipcRenderer.invoke('auto-mode-resolve-clash', index),
  dismissClash: () => ipcRenderer.invoke('auto-mode-dismiss-clash'),
  noteOperatorReversal: (kind: string) => ipcRenderer.send('operator-reversal', kind),
  // Voice command log + per-preacher phrases (item 17)
  getCommandLog: (preacherId?: string, limit?: number) =>
    ipcRenderer.invoke('command-log-recent', { preacherId, limit }),
  getCommandFalsePositives: (preacherId?: string) =>
    ipcRenderer.invoke('command-log-false-positives', preacherId),
  suppressCommandUtterance: (preacherId: string | null, utterance: string) =>
    ipcRenderer.invoke('command-log-suppress', { preacherId, utterance }),
  teachCommandPhrase: (preacherId: string | null, utterance: string, kind: string) =>
    ipcRenderer.invoke('command-log-teach', { preacherId, utterance, kind }),
  getPreacherCommandConfig: (preacherId?: string) =>
    ipcRenderer.invoke('get-preacher-command-config', preacherId),
  savePreacherCommandConfig: (preacherId: string | null, config: any) =>
    ipcRenderer.invoke('save-preacher-command-config', { preacherId, config }),
  // Vocabulary (item 18)
  getVocabulary: (preacherId?: string) => ipcRenderer.invoke('vocabulary-get', preacherId),
  setVocabulary: (preacherId: string | null, terms: string[]) =>
    ipcRenderer.invoke('vocabulary-set', { preacherId, terms }),
  // Remote control pairing (item 22)
  remoteGenerateCode: () => ipcRenderer.invoke('remote-generate-code'),
  remoteCurrentCode: () => ipcRenderer.invoke('remote-current-code'),
  remoteListDevices: () => ipcRenderer.invoke('remote-list-devices'),
  remoteConnected: () => ipcRenderer.invoke('remote-connected'),
  remoteRevoke: (deviceId: string) => ipcRenderer.invoke('remote-revoke', deviceId),
  remoteRevokeAll: () => ipcRenderer.invoke('remote-revoke-all'),
  // Companion (items 7, 9, 10)
  getCompanionShareLink: () => ipcRenderer.invoke('companion-share-link'),
  getViewerSnapshot: () => ipcRenderer.invoke('companion-viewer-snapshot'),
  getCurrentPoll: () => ipcRenderer.invoke('companion-poll-current'),
  closePoll: (pollId: string, index: number | null) =>
    ipcRenderer.invoke('companion-poll-close', { pollId, index }),
  sendCompanionFrame: (raw: string, ip?: string) => ipcRenderer.send('companion-frame', { raw, ip }),
  // Command palette search (item 6)
  searchCommands: (query: string, limit?: number) =>
    ipcRenderer.invoke('search-query', { query, limit }),
  // Library folders (item 12)
  folders: {
    list: (libraryId: string, itemIds?: string[]) =>
      ipcRenderer.invoke('folders-list', { libraryId, itemIds }),
    create: (libraryId: string, name: string) => ipcRenderer.invoke('folders-create', { libraryId, name }),
    rename: (libraryId: string, id: string, name: string) =>
      ipcRenderer.invoke('folders-rename', { libraryId, id, name }),
    setColor: (libraryId: string, id: string, color: string) =>
      ipcRenderer.invoke('folders-color', { libraryId, id, color }),
    remove: (libraryId: string, id: string) => ipcRenderer.invoke('folders-delete', { libraryId, id }),
    moveItem: (libraryId: string, itemId: string, folderId: string | null) =>
      ipcRenderer.invoke('folders-move-item', { libraryId, itemId, folderId }),
    reorder: (libraryId: string, ids: string[]) => ipcRenderer.invoke('folders-reorder', { libraryId, ids }),
    of: (libraryId: string, itemId: string) => ipcRenderer.invoke('folders-of-item', { libraryId, itemId })
  },
  // Scripture → background preset
  presetForReference: (book: string, chapter?: number, verse?: number) =>
    ipcRenderer.invoke('preset-for-reference', { book, chapter, verse }),
  // Song import (item 23) — parse only, nothing is written
  importSongText: (text: string, filename?: string) =>
    ipcRenderer.invoke('songs-import-text', { text, filename }),
  importSongFiles: () => ipcRenderer.invoke('songs-import-file'),
  // Song library (item 1.11). `importCommit` is the second half of import:
  // parse first, let the operator review the duplicates, then commit.
  songs: {
    list: () => ipcRenderer.invoke('songs-list'),
    problem: () => ipcRenderer.invoke('songs-problem'),
    get: (id: string) => ipcRenderer.invoke('songs-get', { id }),
    add: (song: ImportedSong) => ipcRenderer.invoke('songs-add', { song }),
    update: (id: string, patch: SongPatch) => ipcRenderer.invoke('songs-update', { id, patch }),
    remove: (id: string) => ipcRenderer.invoke('songs-remove', { id }),
    importText: (text: string, filename?: string) =>
      ipcRenderer.invoke('songs-import-text', { text, filename }),
    importFiles: () => ipcRenderer.invoke('songs-import-file'),
    importCommit: (songs: ImportedSong[]) => ipcRenderer.invoke('songs-import-commit', { songs }),
    // Online sources. All three resolve to `{ ok }` results and never reject.
    discoverChristianSongs: (query: string) => ipcRenderer.invoke('songs-discover', { query }),
    searchLyrics: (query: string) => ipcRenderer.invoke('lyrics-search', { query }),
    getLyrics: (id: number) => ipcRenderer.invoke('lyrics-get', { id }),
    lyricsPreview: (title: string, artist: string, opts?: { retry?: boolean }) =>
      ipcRenderer.invoke('lyrics-preview', { title, artist, retry: !!opts?.retry }),
    youtubeCaptions: (url: string) => ipcRenderer.invoke('youtube-captions', { url })
  },
  // Evals (item 25)
  exportEvalFixtures: () => ipcRenderer.invoke('evals-export-fixtures')
})
