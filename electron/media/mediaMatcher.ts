import type { SegmentType } from '../../shared/types'

/** A registered media item that can be suggested during announcements. */
export interface MediaItem {
  id: string
  title: string
  keywords: string[]
  tags?: string[]
}

/** A match surfaced to the operator. */
export interface MediaSuggestion {
  mediaId: string
  title: string
  confidence: number
}

export class MediaMatcher {
  items: MediaItem[]
  recentWords: string[]
  lastSuggestionId: string | null
  lastSuggestionTime: number
  listeners: ((suggestion: MediaSuggestion) => void)[]

  constructor() {
    this.items = []
    this.recentWords = []
    this.lastSuggestionId = null
    this.lastSuggestionTime = 0
    this.listeners = []
  }

  /**
   * Register media items with their keywords for matching
   */
  registerMedia(items: MediaItem[]) {
    this.items = items
    console.log(`📎 MediaMatcher: ${items.length} items registered`)
  }

  /**
   * Add a single media item
   */
  addMedia(item: MediaItem) {
    this.items.push(item)
  }

  /**
   * Remove a media item by ID
   */
  removeMedia(id: string) {
    this.items = this.items.filter((item) => item.id !== id)
  }

  onSuggestion(callback: (suggestion: MediaSuggestion) => void) {
    this.listeners.push(callback)
  }

  /**
   * Process transcript text and look for media matches.
   * Only active during announcements segment.
   */
  processTranscript(text: string, segment: SegmentType) {
    if (segment !== 'announcements') return
    const words = text.toLowerCase().split(/\s+/).filter(Boolean)
    this.recentWords.push(...words)
    if (this.recentWords.length > 15) {
      this.recentWords = this.recentWords.slice(-15)
    }
    const windowText = this.recentWords.join(' ')
    let bestMatch: MediaSuggestion | null = null
    for (const item of this.items) {
      let matchCount = 0
      const totalKeywords = item.keywords.length + (item.tags?.length ?? 0)
      if (totalKeywords === 0) continue
      for (const keyword of item.keywords) {
        if (windowText.includes(keyword.toLowerCase())) {
          matchCount++
        }
      }
      if (item.tags) {
        for (const tag of item.tags) {
          if (windowText.includes(tag.toLowerCase())) {
            matchCount++
          }
        }
      }
      if (matchCount === 0) continue
      const confidence = matchCount / totalKeywords
      if (confidence > 0.3 && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = {
          mediaId: item.id,
          title: item.title,
          confidence
        }
      }
    }
    if (bestMatch) {
      const now = Date.now()
      if (bestMatch.mediaId === this.lastSuggestionId && now - this.lastSuggestionTime < 10000) {
        return
      }
      this.lastSuggestionId = bestMatch.mediaId
      this.lastSuggestionTime = now
      console.log(
        `📎 Media suggestion: ${bestMatch.title} (confidence: ${bestMatch.confidence.toFixed(2)})`
      )
      for (const cb of this.listeners) {
        cb(bestMatch)
      }
    }
  }

  /**
   * Clear state
   */
  reset() {
    this.recentWords = []
    this.lastSuggestionId = null
  }
}
