import type { FastPathAdjustment } from './toolRegistry'
import type { ImplicitVerseDetection } from './reasoningPrompts'
import type { NotesUpdate, ReasoningLoop } from './reasoningLoop'

/** The exact payload main.ts enqueues from the ASR fan-out. */
export interface SlowPathChunk {
  text: string
  timestamp: number
  isFinal: boolean
  segment: string
}

export interface SlowPathCallbacks {
  onAdjustment: (adj: FastPathAdjustment) => void
  onDetection: (verse: ImplicitVerseDetection) => void
  onNotesUpdate?: (update: NotesUpdate) => void
}

export class SlowPathOrchestrator {
  reasoningLoop: ReasoningLoop
  callbacks: SlowPathCallbacks
  queue: SlowPathChunk[]
  timer: ReturnType<typeof setInterval> | null
  isProcessing: boolean
  batchIntervalMs: number

  constructor(
    reasoningLoop: ReasoningLoop,
    callbacks: SlowPathCallbacks,
    batchIntervalMs = 3e3
  ) {
    this.reasoningLoop = reasoningLoop
    this.callbacks = callbacks
    this.queue = []
    this.timer = null
    this.isProcessing = false
    this.batchIntervalMs = batchIntervalMs
  }

  /**
   * Called for every transcript chunk (same stream as the fast path).
   */
  enqueue(chunk: SlowPathChunk) {
    // Interim hypotheses replace themselves; they are not repeated evidence.
    if (!chunk.isFinal || !chunk.text.trim()) return
    this.queue.push(chunk)
    if (this.queue.length > 40) this.queue.shift()
  }

  /**
   * Start the periodic processing timer.
   */
  start() {
    if (this.timer) return
    console.log(
      `🧠 SlowPath: started (batch interval: ${this.batchIntervalMs}ms)`
    )
    this.timer = setInterval(() => {
      void this.flush()
    }, this.batchIntervalMs)
  }

  /**
   * Stop processing and clear the queue.
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.queue = []
    this.isProcessing = false
    console.log('🧠 SlowPath: stopped')
  }

  /**
   * Update the batch interval (e.g., from settings).
   */
  setBatchInterval(ms: number) {
    this.batchIntervalMs = ms
    if (this.timer) {
      this.stop()
      this.start()
    }
  }

  /**
   * Flush the queue and run the reasoning loop on accumulated chunks.
   * Skips if already processing (prevents overlapping LLM calls).
   */
  async flush() {
    if (this.isProcessing || this.queue.length === 0) return
    const batch = this.queue.splice(0)
    this.isProcessing = true
    try {
      const result = await this.reasoningLoop.process(batch)
      for (const adj of result.adjustments) {
        this.callbacks.onAdjustment(adj)
      }
      for (const verse of result.detections) {
        console.log(
          `🧠 SlowPath detected: ${verse.ref} (confidence: ${verse.confidence}, source: ${verse.source})`
        )
        this.callbacks.onDetection(verse)
      }
      if (result.notesUpdate && this.callbacks.onNotesUpdate) {
        this.callbacks.onNotesUpdate(result.notesUpdate)
      }
      if (result.iterationsUsed > 0) {
        console.log(
          `🧠 SlowPath batch complete: ${result.iterationsUsed} iteration(s), ${result.adjustments.length} adjustment(s), ${result.detections.length} detection(s)`
        )
      }
    } catch (e) {
      console.error('🧠 SlowPath error:', e)
    } finally {
      this.isProcessing = false
    }
  }
}
