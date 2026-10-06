/**
 * Cross-cutting domain types shared by the Electron engine and (by shape)
 * the renderer. Modules may declare narrower local types; anything that
 * crosses an IPC boundary or a module seam should live here.
 */

export type SegmentType =
  | 'pre-service'
  | 'worship'
  | 'announcements'
  | 'offering'
  | 'sermon'
  | 'altar-call'
  | 'closing'
  | 'prayer'
  | string

export interface ScheduleEntry {
  type: SegmentType
  title?: string
  time?: string
  notes?: string
}

/** A detected scripture reference flowing through the engine. */
export interface ScriptureRecognition {
  suggestionId: string
  source: 'quote' | 'passage' | 'named'
  evidence: string[]
}

export interface VerseDetection {
  book: string
  chapter: number
  verse: number | null
  endVerse?: number | null
  confidence?: number
  source?: string
  isPreview?: boolean
  version?: string
  explicitBook?: boolean
  recognition?: ScriptureRecognition
}

/** Payload ScriptureSession emits toward the display layer. */
export interface VerseDisplayPayload {
  book: string | null
  chapter: number | null
  verseStart: number
  verseEnd: number
  rangeEnd?: number
  chunkSize: number
  isPreview: boolean
  version?: string
}

export interface TranscriptChunk {
  text: string
  ts: number
  isFinal?: boolean
}

export interface SermonNotePoint {
  title: string
  scriptures?: string[]
  content?: string
}

export interface SermonNotes {
  title?: string
  theme?: string
  points?: SermonNotePoint[]
  definitions?: { term: string; definition: string }[]
  applications?: string[]
  quotes?: string[]
  [key: string]: unknown
}

/** One uncertain moment queued for the end-of-service operator review. */
export interface ReviewItem {
  id: string
  ts: number
  kind: 'detection' | 'correction' | 'quote' | 'segment' | 'miss'
  preacherId?: string
  serviceId?: string
  reason?: 'detected' | 'operator-change' | 'missed'
  heard: string
  proposed: { book: string; chapter: number; verse: number | null } | null
  resolution?: 'confirmed' | 'rejected' | 'amended' | 'skipped'
  amendedTo?: { book: string; chapter: number; verse: number | null }
}

/** Per-preacher adaptation state surfaced to the UI. */
export interface PreacherStats {
  id: string
  name: string
  samples: number
  services: number
  precision: number
  /** Wilson lower bound on precision — the number the auto-mode gate uses. */
  trustLowerBound: number
  autoModeEligible: boolean
  /** Training thermostat: mature profiles stop prompting for corrections. */
  mature: boolean
  correctionsLastService: number
  /** Operator's per-preacher auto-mode switch (only honoured when eligible). */
  autoModeEnabled?: boolean
  /** Services completed since the profile matured; 0 when not mature. */
  servicesSinceMature?: number
}

/** Natural-language commands recognized from the preacher's own speech. */
export type VoiceCommandKind =
  | 'correction-verse'
  | 'correction-chapter'
  | 'navigate-next'
  | 'navigate-previous'
  | 'display-dismiss'
  | 'display-hold'
  | 'version-switch'
  | 'prayer-start'
  | 'prayer-end'

export interface VoiceCommandEvent {
  kind: VoiceCommandKind
  /** The transcript fragment that triggered the command. */
  utterance: string
  /** The accepted instruction inside that fragment, for inline transcript marks. */
  phrase?: string
  /** e.g. corrected verse number, or version code like "KJV". */
  value?: string | number
  ts: number
}

export type ASRStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'error'
  | 'stopped'

/* ------------------------------------------------------------------ */
/* Songs                                                               */
/* ------------------------------------------------------------------ */

/**
 * One block of a song — the unit that goes on a slide.
 *
 * Identical to the parser's own SongSection by design: the importers in
 * electron/songs/import.ts produce this shape and the store keeps it
 * untouched, so a song that survives a round trip through disk still
 * matches the file the church imported line for line.
 */
export interface SongSection {
  label: string
  lines: string[]
}

/**
 * Where a song in the library came from, which is really a question about
 * who is allowed to delete it and whether it may come back.
 *
 * 'imported' — the church's own file (SongSelect, OpenLyrics, plain text).
 * 'seed'     — a public-domain hymn we shipped so the library is not empty
 *              on first run. Deleting one is permanent: the seeder records
 *              the deletion and never re-adds it (see electron/songs/seed.ts).
 * 'manual'   — typed into the app by hand.
 */
export type SongOrigin = 'imported' | 'seed' | 'manual'

/**
 * A song as the library stores it.
 *
 * This is the one canonical shape, and it has to reconcile three that grew
 * separately: the parser's ImportedSong (authors[], ccliNumber, sections),
 * the old Songs screen's flat `lyrics` string, and the design prototype's
 * `author` + `verses[]`. It stays close to ImportedSong — that is the shape
 * with real data behind it — and adds only identity and provenance. The
 * renderer flattens to whatever it needs to draw; nothing flattens on the
 * way in, because the section labels are what make a slide a slide.
 */
export interface Song {
  id: string
  title: string
  /** Every credited author, in file order. The UI that wants one joins them. */
  authors?: string[]
  /** CCLI song number, when the source file carried one. */
  ccliNumber?: string
  copyright?: string
  sections: SongSection[]
  createdAt: number
  updatedAt: number
  origin: SongOrigin
  /**
   * Stable key for a seeded hymn (e.g. 'amazing-grace'), so a deletion can be
   * remembered across restarts even though the row itself is gone. Only set
   * when origin is 'seed'.
   */
  seedKey?: string
}

/** The fields a caller may change on an existing song. */
export type SongPatch = Partial<Pick<Song, 'title' | 'authors' | 'ccliNumber' | 'copyright' | 'sections'>>

/**
 * One title that arrived more than once in an import.
 *
 * Imports never drop or overwrite: a church that exports the same song twice
 * from SongSelect gets both copies and this report, so a human decides which
 * one is the good one. `ids` lists every song in the library now sharing the
 * normalised title, existing rows included.
 */
export interface SongDuplicate {
  title: string
  ids: string[]
}

export interface SongImportResult {
  imported: Song[]
  duplicates: SongDuplicate[]
}
