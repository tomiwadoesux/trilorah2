import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ScheduleEntry, SegmentType } from '../../shared/types'
import { SermonStartDetector } from './sermonStartDetector'
import type { SermonStartAction, SermonStartState } from '../../shared/sermonStart'

/** Enter/exit phrase lists for one segment type (loaded from transition-phrases.json). */
export interface TransitionPhrases {
  enter: string[]
  exit?: string[]
}

/** The detector's view of the current service segment. */
export interface Segment {
  type: SegmentType
  startedAt: number
  confidence: number
}

/** Schedule entries may carry extra per-segment metadata (e.g. preacherId). */
export type DetectorScheduleEntry = ScheduleEntry & { preacherId?: string }

export class TransitionDetector {
  phrases: Record<string, TransitionPhrases>
  schedule: DetectorScheduleEntry[]
  currentSegment: Segment
  listeners: ((segment: Segment, previous: Segment) => void)[]
  recentText: string[] // Rolling 50-word buffer
  readonly sermonStart: SermonStartDetector
  private scheduleIndex = -1

  constructor(onSermonStartChanged?: (state: SermonStartState) => void) {
    this.sermonStart = new SermonStartDetector(Date.now, onSermonStartChanged)
    this.phrases = {}
    this.schedule = []
    this.currentSegment = {
      type: 'unknown',
      startedAt: Date.now(),
      confidence: 0
    }
    this.listeners = []
    this.recentText = []
    this.loadPhrases()
  }

  loadPhrases() {
    try {
      const candidates = [
        path.join(__dirname, 'transition-phrases.json'),
        path.join(process.cwd(), 'electron', 'agent', 'transition-phrases.json')
      ]
      if (process.resourcesPath) {
        // Packaged: ships via electron-builder extraResources
        candidates.unshift(path.join(process.resourcesPath, 'transition-phrases.json'))
      }
      const resolvedPath = candidates.find((p) => fs.existsSync(p))
      if (resolvedPath) {
        this.phrases = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
        console.log(
          `✅ TransitionDetector loaded ${Object.keys(this.phrases).length} segment types`
        )
      } else {
        console.warn('⚠️ transition-phrases.json not found')
      }
    } catch (e) {
      console.error('❌ Failed to load transition phrases:', e)
    }
  }

  setSchedule(schedule: DetectorScheduleEntry[]) {
    const previous = this.schedule[this.scheduleIndex]
    const occurrence = this.schedule.slice(0, this.scheduleIndex + 1).filter(s => s.type === previous?.type).length
    this.schedule = schedule
    let seen = 0
    this.scheduleIndex = previous ? schedule.findIndex(s => s.type === previous.type && ++seen === occurrence) : -1
  }

  /**
   * Look up the schedule entry for a given segment type.
   * Used by callers that need to read per-segment metadata (e.g., preacherId).
   */
  getScheduleEntry(type: SegmentType): DetectorScheduleEntry | null {
    return this.schedule.find((e) => e.type === type) || null
  }

  onSegmentChanged(callback: (segment: Segment, previous: Segment) => void) {
    this.listeners.push(callback)
  }

  getCurrentSegment(): Segment {
    return { ...this.currentSegment }
  }

  processTranscript(text: string, speaker?: number) {
    this.sermonStart.process(text, { sermonNext: this.isNextInSchedule('sermon'), speaker })
    // Prayer, reading and music within a confirmed sermon do not end it.
    if (this.sermonStart.getState().status === 'active') return
    const words = text.toLowerCase().split(/\s+/).filter(Boolean)
    this.recentText.push(...words)
    if (this.recentText.length > 50) {
      this.recentText = this.recentText.slice(-50)
    }
    const joined = this.recentText.join(' ')
    const currentPhrases = this.phrases[this.currentSegment.type]
    if (currentPhrases?.exit) {
      for (const phrase of currentPhrases.exit) {
        if (joined.includes(phrase)) {
          const nextSegment = this.getNextScheduledSegment()
          if (nextSegment && nextSegment !== 'sermon') {
            this.transitionTo(nextSegment, 0.7)
            return
          }
        }
      }
    }
    let bestMatch: { type: SegmentType; confidence: number } | null = null
    for (const [segType, phraseSet] of Object.entries(this.phrases)) {
      if (segType === 'sermon') continue
      if (segType === this.currentSegment.type) continue
      for (const phrase of phraseSet.enter) {
        if (joined.includes(phrase)) {
          const isExpected = this.isNextInSchedule(segType)
          const confidence = isExpected ? 0.9 : 0.6
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = { type: segType, confidence }
          }
        }
      }
    }
    if (bestMatch && bestMatch.confidence > 0.5) {
      this.transitionTo(bestMatch.type, bestMatch.confidence)
    }
  }

  transitionTo(type: SegmentType, confidence: number) {
    if (type === 'sermon' && this.sermonStart.getState().status !== 'active') return
    if (this.sermonStart.getState().status === 'active' && type !== 'sermon') return
    if (type === this.currentSegment.type) return
    const previous = { ...this.currentSegment }
    this.currentSegment = {
      type,
      startedAt: type === 'sermon' ? this.sermonStart.getState().startedAt ?? Date.now() : Date.now(),
      confidence
    }
    this.recentText = []
    const nextIndex = this.schedule.findIndex((entry, index) => index > this.scheduleIndex && entry.type === type)
    if (nextIndex >= 0) this.scheduleIndex = nextIndex
    console.log(
      `🔄 Segment transition: ${previous.type} → ${type} (confidence: ${confidence})`
    )
    for (const cb of this.listeners) {
      cb(this.currentSegment, previous)
    }
  }

  getNextScheduledSegment(): SegmentType | null {
    if (this.schedule.length === 0) return null
    return this.schedule[this.scheduleIndex + 1]?.type ?? null
  }

  respondToSermonStart(action: SermonStartAction, requestId?: number) {
    const state = this.sermonStart.respond(action, requestId)
    if (state.status === 'active') this.transitionTo('sermon', 1)
    else if (action === 'end') this.transitionTo(this.getNextScheduledSegment() ?? 'unknown', 0)
    return state
  }

  reset() {
    this.sermonStart.reset()
    this.recentText = []
    this.scheduleIndex = -1
    this.currentSegment = { type: 'unknown', confidence: 0, startedAt: Date.now() }
  }

  isNextInSchedule(type: SegmentType): boolean {
    return this.getNextScheduledSegment() === type
  }
}
