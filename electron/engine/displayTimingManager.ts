export class DisplayTimingManager {
  displayedVerseWords: string[]
  lastTranscriptTime: number
  dismissTimer: NodeJS.Timeout | null
  pauseTimer: NodeJS.Timeout | null
  onDismiss: (() => void) | null
  autoDisplayTimeout: number
  isPaused: boolean
  private autoDismissEnabled = true

  constructor() {
    this.displayedVerseWords = []
    this.lastTranscriptTime = 0
    this.dismissTimer = null
    this.pauseTimer = null
    this.onDismiss = null
    this.autoDisplayTimeout = 15
    this.isPaused = false
  }

  setDismissCallback(cb: () => void) {
    this.onDismiss = cb
  }

  setAutoDisplayTimeout(seconds: number) {
    this.autoDisplayTimeout = seconds
  }

  /**
   * Called when a new verse is displayed
   */
  onVerseDisplayed(verseText: string, autoDismiss = true) {
    this.clearTimers()
    this.autoDismissEnabled = autoDismiss
    this.displayedVerseWords = verseText.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean)
    this.resetDismissTimer()
    this.isPaused = false
  }

  /**
   * Called when verse is manually cleared
   */
  onVerseCleared() {
    this.displayedVerseWords = []
    this.clearTimers()
  }

  /**
   * Process incoming transcript text
   */
  onTranscript(text: string, _isFinal: boolean) {
    if (!this.autoDismissEnabled) return
    this.lastTranscriptTime = Date.now()
    this.isPaused = false
    if (this.pauseTimer) clearTimeout(this.pauseTimer)
    this.pauseTimer = setTimeout(() => {
      this.isPaused = true
      if (this.dismissTimer) {
        clearTimeout(this.dismissTimer)
        this.dismissTimer = null
      }
    }, 3000)
    if (this.displayedVerseWords.length === 0) return
    const transcriptWords = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean)
    const windowSize = Math.min(20, transcriptWords.length)
    const window = transcriptWords.slice(-windowSize)
    const verseWordSet = new Set(this.displayedVerseWords)
    let overlapCount = 0
    for (const word of window) {
      if (verseWordSet.has(word)) overlapCount++
    }
    const overlapRatio = windowSize > 0 ? overlapCount / windowSize : 0
    if (overlapRatio > 0.3) {
      this.resetDismissTimer()
    } else if (!this.dismissTimer) {
      // A pause cancels the countdown (a silent preacher is not "done with
      // the verse"), and nothing restarted it: one three-second breath and
      // the verse stayed up for the rest of the sermon. Speech that is no
      // longer about the verse is what starts the clock again.
      this.resetDismissTimer()
    }
  }

  /**
   * Check if currently in "hold" state (paused or overlapping)
   */
  isHolding(): boolean {
    return this.isPaused
  }

  resetDismissTimer() {
    if (!this.autoDismissEnabled) return
    if (this.dismissTimer) clearTimeout(this.dismissTimer)
    this.dismissTimer = setTimeout(() => {
      if (this.onDismiss && this.displayedVerseWords.length > 0) {
        console.log(
          `⏱️ Auto-dismissing verse after ${this.autoDisplayTimeout}s of no overlap`
        )
        this.onDismiss()
        this.displayedVerseWords = []
      }
    }, this.autoDisplayTimeout * 1000)
  }

  clearTimers() {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer)
      this.dismissTimer = null
    }
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer)
      this.pauseTimer = null
    }
  }
}
