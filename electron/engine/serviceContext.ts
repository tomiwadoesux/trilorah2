import type { SegmentType } from '../../shared/types'

const MAX_RECENT_CHUNKS = 80
const COMPACT_THRESHOLD = 60

/** One transcript chunk retained in the rolling context window. */
export interface ContextTranscriptChunk {
  text: string
  timestamp: number
  isFinal: boolean
  segment: SegmentType
}

/** A verse detection recorded into the service context. */
export interface DetectedVerse {
  ref: string
  [key: string]: any
}

export class ServiceContext {
  currentSegment: SegmentType
  activeVerseRef: string | null
  recentTranscript: ContextTranscriptChunk[]
  compactedSummary: string
  detectedVerses: DetectedVerse[]
  segmentHistory: { type: SegmentType; startedAt: number }[]
  sermonPlanVerses: string[]
  preacherFavoriteVerses: string[]
  serviceStartTime: number

  constructor() {
    this.currentSegment = 'unknown'
    this.activeVerseRef = null
    this.recentTranscript = []
    this.compactedSummary = ''
    this.detectedVerses = []
    this.segmentHistory = []
    this.sermonPlanVerses = []
    this.preacherFavoriteVerses = []
    this.serviceStartTime = Date.now()
  }

  /**
   * Add a transcript chunk from ASR
   */
  addTranscript(text: string, isFinal: boolean, segment: SegmentType) {
    this.recentTranscript.push({
      text,
      timestamp: Date.now(),
      isFinal,
      segment
    })
    if (segment !== this.currentSegment) {
      this.currentSegment = segment
      this.segmentHistory.push({ type: segment, startedAt: Date.now() })
    }
    if (this.recentTranscript.length > MAX_RECENT_CHUNKS) {
      this.compact()
    }
  }

  /**
   * Record a detected verse (from any source)
   */
  addDetection(verse: DetectedVerse) {
    this.detectedVerses.push(verse)
    this.activeVerseRef = verse.ref
  }

  /**
   * Get the last N words from recent transcript
   */
  getRecentText(wordCount: number): string {
    const allWords: string[] = []
    for (let i = this.recentTranscript.length - 1; i >= 0; i--) {
      const words = this.recentTranscript[i].text.split(/\s+/).filter(Boolean)
      allWords.unshift(...words)
      if (allWords.length >= wordCount) break
    }
    return allWords.slice(-wordCount).join(' ')
  }

  /**
   * Get all sermon-segment transcript text (for notes generation)
   */
  getFullSermonText(): string {
    const sermonChunks = this.recentTranscript.filter(
      (c) => c.segment === 'sermon' && c.isFinal
    )
    const recentSermonText = sermonChunks.map((c) => c.text).join(' ')
    if (this.compactedSummary) {
      return this.compactedSummary + ' ' + recentSermonText
    }
    return recentSermonText
  }

  /**
   * Build a concise context summary for the LLM reasoning loop.
   * Must fit in ~1000 tokens to leave room for tools and reasoning.
   */
  buildContextSummary(): string {
    const lines: string[] = []
    lines.push(`Segment: ${this.currentSegment}`)
    if (this.activeVerseRef) {
      lines.push(`Active verse: ${this.activeVerseRef}`)
    }
    const recentVerses = this.detectedVerses.slice(-5)
    if (recentVerses.length > 0) {
      lines.push(
        `Recent detections: ${recentVerses.map((v) => v.ref).join(', ')}`
      )
    }
    if (this.sermonPlanVerses.length > 0) {
      const remaining = this.sermonPlanVerses.filter(
        (ref) => !this.detectedVerses.some((v) => v.ref === ref)
      )
      if (remaining.length > 0) {
        lines.push(`Expected from plan (not yet seen): ${remaining.join(', ')}`)
      }
    }
    const recentText = this.getRecentText(50)
    if (recentText) {
      lines.push(`Recent transcript: "${recentText}"`)
    }
    if (this.compactedSummary) {
      const truncated = this.compactedSummary.length > 200 ? this.compactedSummary.slice(-200) + '...' : this.compactedSummary
      lines.push(`Earlier context: ${truncated}`)
    }
    return lines.join('\n')
  }

  /**
   * Compress older transcript chunks into the compacted summary.
   * Keeps the most recent chunks at full fidelity.
   */
  compact() {
    if (this.recentTranscript.length <= COMPACT_THRESHOLD) return
    const toCompact = this.recentTranscript.splice(
      0,
      this.recentTranscript.length - COMPACT_THRESHOLD
    )
    const compactedText = toCompact.filter((c) => c.isFinal).map((c) => c.text).join(' ')
    if (compactedText) {
      this.compactedSummary = this.compactedSummary ? this.compactedSummary + ' ' + compactedText : compactedText
    }
    console.log(
      `📦 ServiceContext compacted: ${toCompact.length} chunks → summary (${this.compactedSummary.length} chars), ${this.recentTranscript.length} recent chunks retained`
    )
  }

  /**
   * Reset for a new service
   */
  reset() {
    this.currentSegment = 'unknown'
    this.activeVerseRef = null
    this.recentTranscript = []
    this.compactedSummary = ''
    this.detectedVerses = []
    this.segmentHistory = []
    this.sermonPlanVerses = []
    this.preacherFavoriteVerses = []
    this.serviceStartTime = Date.now()
  }
}
