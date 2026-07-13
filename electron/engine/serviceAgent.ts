import type { VerseDetection } from '../../shared/types'
import type { TransitionDetector } from './transitionDetector'
import type { FalsePositiveFilter } from './falsePositiveFilter'
import type { DisplayTimingManager } from './displayTimingManager'
import type { MediaMatcher } from '../media/mediaMatcher'
import { ServiceContext } from './serviceContext'

/** One final sermon transcript chunk with the scriptures detected alongside it. */
export interface SermonTranscriptEntry {
  text: string
  timestamp: number
  detectedScriptures: string[]
}

/** One entry in the service event log. */
export interface ServiceLogEvent {
  type: string
  timestamp: number
  data?: any
}

export class ServiceAgent {
  enabled: boolean
  sermonTranscript: SermonTranscriptEntry[]
  serviceLog: ServiceLogEvent[]
  recentWords: string[]
  transitionDetector: TransitionDetector
  falsePositiveFilter: FalsePositiveFilter
  displayTimingManager: DisplayTimingManager
  mediaMatcher: MediaMatcher
  context: ServiceContext

  constructor(
    transitionDetector: TransitionDetector,
    falsePositiveFilter: FalsePositiveFilter,
    displayTimingManager: DisplayTimingManager,
    mediaMatcher: MediaMatcher
  ) {
    this.enabled = true
    this.sermonTranscript = []
    this.serviceLog = []
    this.recentWords = []
    this.transitionDetector = transitionDetector
    this.falsePositiveFilter = falsePositiveFilter
    this.displayTimingManager = displayTimingManager
    this.mediaMatcher = mediaMatcher
    this.context = new ServiceContext()
    this.transitionDetector.onSegmentChanged((segment, previous) => {
      this.serviceLog.push({
        type: 'segment-change',
        timestamp: Date.now(),
        data: { from: previous?.type, to: segment.type }
      })
    })
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  /**
   * Main entry point — call with every transcript chunk
   */
  processTranscript(text: string, isFinal: boolean) {
    if (!this.enabled) return
    const words = text.toLowerCase().split(/\s+/).filter(Boolean)
    this.recentWords.push(...words)
    if (this.recentWords.length > 30) {
      this.recentWords = this.recentWords.slice(-30)
    }
    const segment = this.transitionDetector.getCurrentSegment()
    this.context.addTranscript(text, isFinal, segment.type)
    this.transitionDetector.processTranscript(text)
    this.displayTimingManager.onTranscript(text, isFinal)
    this.mediaMatcher.processTranscript(text, segment.type)
    if (segment.type === 'sermon' && isFinal) {
      this.sermonTranscript.push({
        text,
        timestamp: Date.now(),
        detectedScriptures: []
      })
    }
  }

  /**
   * Check if a scripture detection should be blocked
   */
  shouldBlockDetection(detection: VerseDetection): boolean {
    if (!this.enabled) return false
    const segment = this.transitionDetector.getCurrentSegment()
    return this.falsePositiveFilter.shouldBlock(
      detection,
      this.recentWords,
      segment.type
    )
  }

  /**
   * Get accumulated sermon transcript
   */
  getSermonTranscript(): SermonTranscriptEntry[] {
    return [...this.sermonTranscript]
  }

  /**
   * Get the full raw sermon text
   */
  getSermonText(): string {
    return this.sermonTranscript.map((e) => e.text).join(' ')
  }

  /**
   * Mark a scripture as detected during sermon (for notes generation)
   */
  markScriptureDetected(ref: string) {
    const last = this.sermonTranscript[this.sermonTranscript.length - 1]
    if (last) {
      last.detectedScriptures.push(ref)
    }
  }

  /**
   * Get the full service event log
   */
  getServiceLog(): ServiceLogEvent[] {
    return [...this.serviceLog]
  }

  /**
   * Add a custom event to the service log
   */
  logEvent(type: string, data?: any) {
    this.serviceLog.push({ type, timestamp: Date.now(), data })
  }

  /**
   * Reset state for a new service
   */
  reset() {
    this.sermonTranscript = []
    this.serviceLog = []
    this.recentWords = []
    this.mediaMatcher.reset()
    this.context.reset()
  }
}
