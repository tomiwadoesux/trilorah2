import type { ServiceContext } from '../engine/serviceContext'
import type { TransitionDetector } from '../engine/transitionDetector'
import type { FalsePositiveFilter } from '../engine/falsePositiveFilter'
import type { DisplayTimingManager } from '../engine/displayTimingManager'
import type { QuoteMatcher } from '../engine/quoteMatcher'

export interface ToolParameter {
  name: string
  type: string
  description: string
  required: boolean
}

/** An adjustment the slow path pushes back down to the fast path. */
export interface FastPathAdjustment {
  target: string
  action: string
  value: any
}

export interface ToolResult {
  success: boolean
  data?: any
  error?: string
  fastPathAdjustments?: FastPathAdjustment[]
}

export interface Tool {
  name: string
  description: string
  type: 'read' | 'write'
  parameters: ToolParameter[]
  execute(params: Record<string, any>, ctx: ServiceContext): Promise<ToolResult>
}

/** A tool invocation parsed from the LLM's response. */
export interface ToolCall {
  toolName: string
  params: Record<string, any>
}

export interface ToolExecutionResult {
  toolName: string
  result: ToolResult
}

export class ToolRegistry {
  tools: Map<string, Tool>

  constructor() {
    this.tools = new Map()
  }

  register(tool: Tool) {
    if (this.tools.has(tool.name)) {
      console.warn(`⚠️ ToolRegistry: overwriting tool "${tool.name}"`)
    }
    this.tools.set(tool.name, tool)
  }

  get(name: string) {
    return this.tools.get(name)
  }

  getAll() {
    return [...this.tools.values()]
  }

  getReadTools() {
    return this.getAll().filter((t) => t.type === 'read')
  }

  getWriteTools() {
    return this.getAll().filter((t) => t.type === 'write')
  }

  /**
   * Generate a formatted tool description string for inclusion in LLM prompts.
   * Kept compact to fit within Llama 3.1 8B's context window.
   */
  getToolDescriptions() {
    return this.getAll()
      .map((t) => {
        const params = t.parameters
          .map((p) => `${p.name}${p.required ? '' : '?'}: ${p.type}`)
          .join(', ')
        return `- ${t.name}(${params}): ${t.description}`
      })
      .join('\n')
  }
}

export function createTransitionDetectorTool(detector: TransitionDetector): Tool {
  return {
    name: 'get_current_segment',
    description:
      'Get the current service segment (worship, sermon, announcements, etc.) and its confidence',
    type: 'read',
    parameters: [],
    async execute(_params, _ctx) {
      const segment = detector.getCurrentSegment()
      return {
        success: true,
        data: {
          type: segment.type,
          confidence: segment.confidence,
          startedAt: segment.startedAt
        }
      }
    }
  }
}

export function createFalsePositiveFilterTool(filter: FalsePositiveFilter): Tool {
  return {
    name: 'check_false_positive',
    description:
      "Check if a scripture detection is a false positive based on context (e.g., 'Job well done' is not the book of Job)",
    type: 'read',
    parameters: [
      { name: 'book', type: 'string', description: 'Bible book name', required: true },
      { name: 'chapter', type: 'number', description: 'Chapter number', required: true },
      { name: 'verse', type: 'number', description: 'Verse number', required: false },
      { name: 'confidence', type: 'number', description: 'Detection confidence 0-1', required: false }
    ],
    async execute(params, ctx) {
      const recentWords = ctx.getRecentText(30).split(/\s+/).filter(Boolean)
      const blocked = filter.shouldBlock(
        {
          book: params.book,
          chapter: params.chapter,
          verse: params.verse ?? null,
          confidence: params.confidence
        },
        recentWords,
        ctx.currentSegment
      )
      return {
        success: true,
        data: { blocked, segment: ctx.currentSegment }
      }
    }
  }
}

const MIN_TIMEOUT = 5
const MAX_TIMEOUT = 60

export function createDisplayTimingTool(manager: DisplayTimingManager): Tool {
  return {
    name: 'adjust_display_timing',
    description:
      'Adjust how long a verse stays on screen before auto-dismiss (seconds). Use when the preacher is dwelling on a passage (increase) or moving quickly (decrease).',
    type: 'write',
    parameters: [
      {
        name: 'timeout',
        type: 'number',
        description: 'Auto-dismiss timeout in seconds (5-60)',
        required: true
      }
    ],
    async execute(params, _ctx) {
      const raw = params.timeout
      const clamped = Math.max(MIN_TIMEOUT, Math.min(MAX_TIMEOUT, raw))
      manager.setAutoDisplayTimeout(clamped)
      return {
        success: true,
        data: { timeout: clamped },
        fastPathAdjustments: [
          {
            target: 'displayTiming',
            action: 'setTimeout',
            value: clamped
          }
        ]
      }
    }
  }
}

export function createQuoteMatcherTool(matcher: QuoteMatcher): Tool {
  return {
    name: 'get_quote_candidates',
    description:
      'Get Bible verse candidates detected by word-matching against the rolling transcript buffer',
    type: 'read',
    parameters: [],
    async execute(_params, _ctx) {
      const candidates = matcher.findAllQuotedVerses()
      return {
        success: true,
        data: {
          count: candidates.length,
          candidates: candidates.slice(0, 5).map((c) => ({
            ref: c.ref,
            confidence: c.confidence,
            matchedWords: c.matchedWords
          }))
        }
      }
    }
  }
}

export function createSermonPlanTool(): Tool {
  return {
    name: 'check_sermon_plan',
    description:
      'Check if a Bible reference is in the pre-loaded sermon plan. Returns match status and context from the plan.',
    type: 'read',
    parameters: [
      {
        name: 'ref',
        type: 'string',
        description: 'Verse reference to check (e.g., "Romans 8:28")',
        required: true
      }
    ],
    async execute(params, ctx) {
      const ref = params.ref
      const planVerses = ctx.sermonPlanVerses
      if (planVerses.length === 0) {
        return {
          success: true,
          data: { hasPlan: false, inPlan: false }
        }
      }
      const exactMatch = planVerses.some(
        (v) => v.toLowerCase() === ref.toLowerCase()
      )
      const refParts = ref.match(/^(.+?)\s+(\d+)/)
      let chapterMatch = false
      if (refParts) {
        const [, book, chapter] = refParts
        chapterMatch = planVerses.some((v) => {
          const vParts = v.match(/^(.+?)\s+(\d+)/)
          return vParts && vParts[1].toLowerCase() === book.toLowerCase() && vParts[2] === chapter
        })
      }
      return {
        success: true,
        data: {
          hasPlan: true,
          inPlan: exactMatch,
          sameChapterInPlan: chapterMatch,
          planVerses
        }
      }
    }
  }
}

export function createContextQueryTool(context: ServiceContext): Tool {
  return {
    name: 'query_context',
    description:
      'Query the current service state: segment, recent detections, transcript summary, and service timeline',
    type: 'read',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'What to query: "summary", "recent_verses", "segment_history", "sermon_text"',
        required: true
      }
    ],
    async execute(params, _ctx) {
      const query = params.query
      switch (query) {
        case 'summary':
          return {
            success: true,
            data: context.buildContextSummary()
          }
        case 'recent_verses':
          return {
            success: true,
            data: context.detectedVerses.slice(-10).map((v) => ({
              ref: v.ref,
              source: v.source,
              confidence: v.confidence,
              timestamp: v.timestamp
            }))
          }
        case 'segment_history':
          return {
            success: true,
            data: context.segmentHistory.map((s) => ({
              type: s.type,
              startedAt: s.startedAt,
              duration: Date.now() - s.startedAt
            }))
          }
        case 'sermon_text':
          return {
            success: true,
            data: context.getFullSermonText().slice(-2e3)
          }
        default:
          return {
            success: false,
            error: `Unknown query: "${query}". Use: summary, recent_verses, segment_history, sermon_text`
          }
      }
    }
  }
}
