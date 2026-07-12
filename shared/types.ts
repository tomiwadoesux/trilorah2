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
export interface VerseDetection {
  book: string
  chapter: number
  verse: number | null
  endVerse?: number | null
  confidence?: number
  source?: string
  isPreview?: boolean
  version?: string
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
  kind: 'detection' | 'correction' | 'quote' | 'segment'
  heard: string
  proposed: { book: string; chapter: number; verse: number | null } | null
  resolution?: 'confirmed' | 'rejected' | 'amended'
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
