import { app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { SegmentType } from '../../shared/types'

/** One entry in the post-service event log (mirrors the ServiceAgent log shape). */
export interface SummaryEvent {
  type: string
  timestamp: number
  data?: any
}

export class PostServiceSummary {
  events: SummaryEvent[]
  startTime: number

  constructor() {
    this.events = []
    this.startTime = Date.now()
  }

  logEvent(type: string, data?: any) {
    this.events.push({
      type,
      timestamp: Date.now(),
      data
    })
  }

  /**
   * Import events from the ServiceAgent's log
   */
  importEvents(events: SummaryEvent[]) {
    this.events = [...events]
  }

  /**
   * Generate a structured summary of the service
   */
  generateSummary() {
    const endTime = Date.now()
    const duration = (endTime - this.startTime) / 60000
    const segments: { type: SegmentType; startedAt: number; duration: number }[] = []
    let lastSegmentStart = this.startTime
    let lastSegmentType: SegmentType = 'unknown'
    for (const event of this.events) {
      if (event.type === 'segment-change') {
        if (lastSegmentType !== 'unknown') {
          segments.push({
            type: lastSegmentType,
            startedAt: lastSegmentStart,
            duration: (event.timestamp - lastSegmentStart) / 60000
          })
        }
        lastSegmentType = event.data?.to || 'unknown'
        lastSegmentStart = event.timestamp
      }
    }
    if (lastSegmentType !== 'unknown') {
      segments.push({
        type: lastSegmentType,
        startedAt: lastSegmentStart,
        duration: (endTime - lastSegmentStart) / 60000
      })
    }
    const scriptures = this.events.filter(
      (e) => e.type === 'scripture-detected' || e.type === 'quote-detected' || e.type === 'manual-verse'
    ).map((e) => ({
      ref: e.data?.ref || '',
      timestamp: e.timestamp,
      source: e.type.includes('quote') ? 'quote' : e.type.includes('manual') ? 'manual' : 'ml'
    }))
    const songs = this.events.filter((e) => e.type === 'song-played').map((e) => ({
      title: e.data?.title || '',
      timestamp: e.timestamp
    }))
    const media = this.events.filter((e) => e.type === 'media-displayed').map((e) => ({
      title: e.data?.title || '',
      timestamp: e.timestamp
    }))
    const sermonSegments = segments.filter((s) => s.type === 'sermon')
    const sermonDuration = sermonSegments.reduce(
      (sum, s) => sum + s.duration,
      0
    )
    return {
      date: new Date().toISOString().split('T')[0],
      startTime: this.startTime,
      endTime,
      duration,
      segments,
      scriptures,
      songs,
      media,
      stats: {
        totalScriptures: scriptures.length,
        totalSongs: songs.length,
        sermonDuration,
        totalSegments: segments.length
      }
    }
  }

  /**
   * Save the service summary to disk
   */
  async save(): Promise<string> {
    const summary = this.generateSummary()
    const logsDir = path.join(app.getPath('userData'), 'service-logs')
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true })
    }
    const filename = `service-${summary.date}-${Date.now()}.json`
    const filePath = path.join(logsDir, filename)
    fs.writeFileSync(filePath, JSON.stringify(summary, null, 2), 'utf-8')
    console.log(`📋 Service log saved: ${filePath}`)
    return filePath
  }

  /**
   * Reset for a new service
   */
  reset() {
    this.events = []
    this.startTime = Date.now()
  }
}
