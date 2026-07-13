import type { TranscriptChunk } from '../../shared/types'
import type { ServiceContext } from '../engine/serviceContext'
import type { FastPathAdjustment, ToolRegistry } from './toolRegistry'
import { executeTools, type LLMFallback } from './llmFallback'
import {
  MAX_ITERATIONS,
  buildPrompt,
  parseToolCalls,
  parseVerseDetections,
  formatObservations,
  type ImplicitVerseDetection
} from './reasoningPrompts'

/** An incremental sermon-notes update dispatched to the notes builder. */
export interface NotesUpdate {
  type: string
  content: string
}

export interface ReasoningResult {
  adjustments: FastPathAdjustment[]
  detections: ImplicitVerseDetection[]
  notesUpdate: NotesUpdate | null
  iterationsUsed: number
}

export interface ReasoningLoopConfig {
  llmProvider: LLMFallback
  toolRegistry: ToolRegistry
  context: ServiceContext
}

export class ReasoningLoop {
  llm: LLMFallback
  registry: ToolRegistry
  context: ServiceContext

  constructor(config: ReasoningLoopConfig) {
    this.llm = config.llmProvider
    this.registry = config.toolRegistry
    this.context = config.context
  }

  /**
   * Process a batch of transcript chunks through the reasoning loop.
   * Returns adjustments and detections for the slow path orchestrator.
   */
  async process(chunks: Array<Pick<TranscriptChunk, 'text'>>): Promise<ReasoningResult> {
    const result: ReasoningResult = {
      adjustments: [],
      detections: [],
      notesUpdate: null,
      iterationsUsed: 0
    }
    if (!this.llm.isAvailable()) {
      return result
    }
    const transcriptBatch = chunks.map((c) => c.text).join(' ')
    if (!transcriptBatch.trim()) return result
    const toolDescriptions = this.registry.getToolDescriptions()
    let observations = ''
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      result.iterationsUsed = i + 1
      const prompt = buildPrompt(
        this.context,
        toolDescriptions,
        transcriptBatch,
        observations
      )
      console.log(`🧠 ReasoningLoop iteration ${i + 1}/${MAX_ITERATIONS}`)
      const response = await this.llm.complete(prompt, {
        maxTokens: 400,
        temperature: 0.2
      })
      if (!response) {
        console.log('🧠 ReasoningLoop: LLM returned null, stopping')
        break
      }
      const verseDetections = parseVerseDetections(response)
      if (verseDetections.length > 0) {
        result.detections.push(...verseDetections)
        for (const v of verseDetections) {
          this.context.addDetection(v)
        }
      }
      const toolCalls = parseToolCalls(response)
      if (toolCalls.length === 0) {
        console.log(`🧠 ReasoningLoop: done after ${i + 1} iteration(s)`)
        break
      }
      const toolResults = await executeTools(
        toolCalls,
        this.registry,
        this.context
      )
      for (const tr of toolResults) {
        if (tr.result.fastPathAdjustments) {
          result.adjustments.push(...tr.result.fastPathAdjustments)
        }
      }
      observations = formatObservations(toolResults)
    }
    return result
  }
}
