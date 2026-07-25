import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Fetch a chapter by book ID and chapter number (optionally with version)
  getChapter: (bookId: number, chapter: number, version?: string) =>
    ipcRenderer.invoke('get-chapter', { bookId, chapter, version }),

  // Get available Bible versions
  getAvailableVersions: () => ipcRenderer.invoke('get-available-versions'),

  // Search for a specific verse
  searchVerse: (book: string, chapter: number, verse: number, version?: string) =>
    ipcRenderer.invoke('search-verse', { book, chapter, verse, version }),

  // Listener for audio transcript updates (the "Matrix" stream)
  onTranscriptUpdate: (callback: (text: string) => void) => {
    const subscription = (_event: IpcRendererEvent, text: string) => callback(text)
    ipcRenderer.on('on-transcript-update', subscription)
    return () => ipcRenderer.removeListener('on-transcript-update', subscription)
  },

  // Listener for AI verse PREVIEW events (goes to preview first)
  onVersePreview: (callback: (data: any) => void) => {
    const subscription = (_event: IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('on-verse-preview', subscription)
    return () => ipcRenderer.removeListener('on-verse-preview', subscription)
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
  pushToLive: () => ipcRenderer.send('push-to-live'),

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
  getPreacherStats: (preacherId?: string) =>
    ipcRenderer.invoke('get-preacher-stats', preacherId),
  // End-of-service review ritual
  getReviewItems: () => ipcRenderer.invoke('get-review-items'),
  resolveReviewItem: (
    id: string,
    resolution: 'confirmed' | 'rejected' | 'amended',
    amendedTo?: { book: string; chapter: number; verse: number | null }
  ) => ipcRenderer.invoke('resolve-review-item', { id, resolution, amendedTo }),
  // Mentioned-but-not-displayed queue
  getVerseQueue: () => ipcRenderer.invoke('get-verse-queue'),
  showQueuedVerse: (ref: string) => ipcRenderer.invoke('show-queued-verse', ref),
  // Translation control (also reachable by the preacher's voice)
  setDisplayVersion: (version: string) =>
    ipcRenderer.invoke('set-display-version', version),
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

  // Media display on outputs + theme repaint
  showMedia: (imagePath: string) => ipcRenderer.invoke('show-media', imagePath),
  clearMedia: () => ipcRenderer.invoke('clear-media'),
  showQr: () => ipcRenderer.invoke('show-qr'),
  onShowMedia: (callback: (imagePath: string) => void) => {
    const subscription = (_event: IpcRendererEvent, p: string) => callback(p)
    ipcRenderer.on('on-show-media', subscription)
    return () => ipcRenderer.removeListener('on-show-media', subscription)
  },
  onThemeChanged: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on('on-theme-changed', subscription)
    return () => ipcRenderer.removeListener('on-theme-changed', subscription)
  }
})
