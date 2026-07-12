"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  // Fetch a chapter by book ID and chapter number (optionally with version)
  getChapter: (bookId, chapter, version) => electron.ipcRenderer.invoke("get-chapter", { bookId, chapter, version }),
  // Get available Bible versions
  getAvailableVersions: () => electron.ipcRenderer.invoke("get-available-versions"),
  // Search for a specific verse
  searchVerse: (book, chapter, verse, version) => electron.ipcRenderer.invoke("search-verse", { book, chapter, verse, version }),
  // Listener for audio transcript updates (the "Matrix" stream)
  onTranscriptUpdate: (callback) => {
    const subscription = (_event, text) => callback(text);
    electron.ipcRenderer.on("on-transcript-update", subscription);
    return () => electron.ipcRenderer.removeListener("on-transcript-update", subscription);
  },
  // Listener for AI verse PREVIEW events (goes to preview first)
  onVersePreview: (callback) => {
    const subscription = (_event, data) => callback(data);
    electron.ipcRenderer.on("on-verse-preview", subscription);
    return () => electron.ipcRenderer.removeListener("on-verse-preview", subscription);
  },
  // Listener for AI verse detection events (goes directly to live)
  onVerseDetected: (callback) => {
    const subscription = (_event, data) => callback(data);
    electron.ipcRenderer.on("on-verse-detected", subscription);
    return () => electron.ipcRenderer.removeListener("on-verse-detected", subscription);
  },
  // Listener for real-time audio levels (dB)
  onAudioLevel: (callback) => {
    const subscription = (_event, level) => callback(level);
    electron.ipcRenderer.on("on-audio-level", subscription);
    return () => electron.ipcRenderer.removeListener("on-audio-level", subscription);
  },
  // Audio Control
  startListening: (deviceLabel) => electron.ipcRenderer.send("start-listening", deviceLabel),
  stopListening: () => electron.ipcRenderer.send("stop-listening"),
  // Send transcription text to the brain for processing
  sendText: (text) => electron.ipcRenderer.send("process-text", text),
  // Push preview to live
  pushToLive: () => electron.ipcRenderer.send("push-to-live"),
  // Import presentation (PPTX → images)
  importPresentation: () => electron.ipcRenderer.invoke("import-presentation"),
  // Import generated presentation (PPTX bytes → images)
  importGeneratedPresentation: (payload) => electron.ipcRenderer.invoke("import-generated-presentation", payload),
  // Presentation persistence & cleanup
  deletePresentation: (payload) => electron.ipcRenderer.invoke("delete-presentation", payload),
  savePresentations: (presentations) => electron.ipcRenderer.invoke("save-presentations", presentations),
  loadPresentations: () => electron.ipcRenderer.invoke("load-presentations"),
  // Output Windows
  openOutput: (outputId) => electron.ipcRenderer.send("open-output", outputId),
  // Local image helper
  readImageDataUrl: (imagePath) => electron.ipcRenderer.invoke("read-image-data-url", imagePath),
  // OCR — run text extraction on image(s) for media matching
  ocrProcessImage: (imagePath) => electron.ipcRenderer.invoke("ocr-process-image", imagePath),
  ocrProcessImages: (imagePaths) => electron.ipcRenderer.invoke("ocr-process-images", imagePaths),
  // Sermon Transcript & Notes
  getSermonTranscript: () => electron.ipcRenderer.invoke("get-sermon-transcript"),
  getServiceLog: () => electron.ipcRenderer.invoke("get-service-log"),
  saveServiceSummary: () => electron.ipcRenderer.invoke("save-service-summary"),
  generateSermonNotes: () => electron.ipcRenderer.invoke("generate-sermon-notes"),
  exportSermonNotesPdf: (notes) => electron.ipcRenderer.invoke("export-sermon-notes-pdf", notes),
  exportSermonNotesMd: (notes) => electron.ipcRenderer.invoke("export-sermon-notes-md", notes),
  // Settings
  getSettings: () => electron.ipcRenderer.invoke("get-settings"),
  getSetting: (key) => electron.ipcRenderer.invoke("get-setting", key),
  setSetting: (key, value) => electron.ipcRenderer.invoke("set-setting", { key, value }),
  // Service Agent
  setServiceSchedule: (schedule) => electron.ipcRenderer.send("set-service-schedule", schedule),
  setCurrentSongLyrics: (lyrics) => electron.ipcRenderer.send("set-current-song-lyrics", lyrics),
  onShowCleanBackground: (callback) => {
    const subscription = () => callback();
    electron.ipcRenderer.on("on-show-clean-background", subscription);
    return () => electron.ipcRenderer.removeListener("on-show-clean-background", subscription);
  },
  onSegmentChanged: (callback) => {
    const subscription = (_event, data) => callback(data);
    electron.ipcRenderer.on("on-segment-changed", subscription);
    return () => electron.ipcRenderer.removeListener("on-segment-changed", subscription);
  },
  onMediaSuggestion: (callback) => {
    const subscription = (_event, data) => callback(data);
    electron.ipcRenderer.on("on-media-suggestion", subscription);
    return () => electron.ipcRenderer.removeListener("on-media-suggestion", subscription);
  },
  onVerseAutoDismiss: (callback) => {
    const subscription = () => callback();
    electron.ipcRenderer.on("on-verse-auto-dismiss", subscription);
    return () => electron.ipcRenderer.removeListener("on-verse-auto-dismiss", subscription);
  },
  // Sermon Plan & Preacher Profiles
  setSermonPlan: (jsonOrPath) => electron.ipcRenderer.invoke("set-sermon-plan", jsonOrPath),
  setActivePreacher: (preacherId) => electron.ipcRenderer.invoke("set-active-preacher", preacherId),
  listPreacherProfiles: () => electron.ipcRenderer.invoke("list-preacher-profiles"),
  createPreacherProfile: (id, name) => electron.ipcRenderer.invoke("create-preacher-profile", { id, name }),
  deletePreacherProfile: (id) => electron.ipcRenderer.invoke("delete-preacher-profile", id),
  endService: (opts) => electron.ipcRenderer.invoke("end-service", opts),
  // Live notes updates from reasoning loop
  onNotesUpdated: (callback) => {
    const subscription = (_event, data) => callback(data);
    electron.ipcRenderer.on("on-notes-updated", subscription);
    return () => electron.ipcRenderer.removeListener("on-notes-updated", subscription);
  },
  // Webhooks / External API listener
  onExternalCommand: (callback) => {
    const subscription = (_event, data) => callback(data);
    electron.ipcRenderer.on("on-external-command", subscription);
    return () => electron.ipcRenderer.removeListener("on-external-command", subscription);
  },
  // Streaming — OBS Studio
  obsConnect: () => electron.ipcRenderer.invoke("obs-connect"),
  obsDisconnect: () => electron.ipcRenderer.invoke("obs-disconnect"),
  obsStatus: () => electron.ipcRenderer.invoke("obs-status"),
  obsSetScene: (sceneName) => electron.ipcRenderer.invoke("obs-set-scene", sceneName),
  obsSetBrowserSourceUrl: (sourceName, url) => electron.ipcRenderer.invoke("obs-set-browser-source-url", { sourceName, url }),
  // Streaming — vMix
  vmixStatus: () => electron.ipcRenderer.invoke("vmix-status"),
  vmixSetActive: (input) => electron.ipcRenderer.invoke("vmix-set-active", input),
  vmixOverlay: (channel, action, input) => electron.ipcRenderer.invoke("vmix-overlay", { channel, action, input }),
  vmixSetTitleText: (input, selectedName, value) => electron.ipcRenderer.invoke("vmix-set-title-text", {
    input,
    selectedName,
    value
  }),
  // OCR schedule import + smart schedule learning
  importScheduleImage: () => electron.ipcRenderer.invoke("import-schedule-image"),
  scheduleSuggestion: () => electron.ipcRenderer.invoke("schedule-suggestion"),
  applyScheduleSuggestion: () => electron.ipcRenderer.invoke("apply-schedule-suggestion"),
  // Cloud (Supabase) — auth + service lifecycle + multi-campus
  cloudStatus: () => electron.ipcRenderer.invoke("cloud-status"),
  cloudSignIn: (email, password) => electron.ipcRenderer.invoke("cloud-sign-in", { email, password }),
  cloudSignUp: (email, password, accountName) => electron.ipcRenderer.invoke("cloud-sign-up", { email, password, accountName }),
  cloudSignOut: () => electron.ipcRenderer.invoke("cloud-sign-out"),
  cloudStartService: (opts) => electron.ipcRenderer.invoke("cloud-start-service", opts),
  cloudEndService: () => electron.ipcRenderer.invoke("cloud-end-service"),
  cloudMarkVersePushed: (verseId) => electron.ipcRenderer.invoke("cloud-mark-verse-pushed", verseId),
  cloudUpsertNotes: (notes) => electron.ipcRenderer.invoke("cloud-upsert-notes", notes),
  cloudSyncGiving: (methods) => electron.ipcRenderer.invoke("cloud-sync-giving", methods),
  cloudGenerateLinkCode: () => electron.ipcRenderer.invoke("cloud-generate-link-code"),
  cloudRedeemLinkCode: (code) => electron.ipcRenderer.invoke("cloud-redeem-link-code", code),
  cloudCompleteAccountSetup: (churchName, slug) => electron.ipcRenderer.invoke("cloud-complete-account-setup", { churchName, slug }),
  cloudFetchMyAccount: () => electron.ipcRenderer.invoke("cloud-fetch-my-account"),
  cloudFetchPastors: () => electron.ipcRenderer.invoke("cloud-fetch-pastors"),
  cloudFetchCampuses: () => electron.ipcRenderer.invoke("cloud-fetch-campuses"),
  cloudFetchRecentServices: () => electron.ipcRenderer.invoke("cloud-fetch-recent-services"),
  cloudFetchRecentNotes: () => electron.ipcRenderer.invoke("cloud-fetch-recent-notes"),
  cloudFetchAudienceSessions: () => electron.ipcRenderer.invoke("cloud-fetch-audience-sessions"),
  cloudRunRetentionCleanup: () => electron.ipcRenderer.invoke("cloud-run-retention-cleanup"),
  cloudVerifyPassword: (password) => electron.ipcRenderer.invoke("cloud-verify-password", password),
  cloudSignOutAllDevices: () => electron.ipcRenderer.invoke("cloud-sign-out-all-devices")
});
