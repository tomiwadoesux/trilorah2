import type { ServiceContext } from '../engine/serviceContext'
import type { ToolCall, ToolExecutionResult } from './toolRegistry'

export const MAX_ITERATIONS = 3

export const SYSTEM_PROMPT = `You are the reasoning engine for a live church service assistant. You analyze sermon transcript in real-time to help detect Bible verse references and manage the display.

Your job:
1. Analyze the recent transcript to understand what the preacher is saying
2. Use tools to check context, detect implicit verse references, and adjust display behavior
3. Only call tools when you have a specific reason — do not call tools speculatively
4. An implicit verse needs distinctive evidence: at least two specific details or relationships from the passage in the speaker's actual words. Broad themes such as love, faith, blessing, fear, or hope are insufficient.
5. Do not treat lyrics, prayers, announcements, generic encouragement, or your own tool observations as scripture evidence. A paraphrase need not share exact words, but must preserve the passage's specific meaning. If multiple unrelated passages fit, return no_action.
6. Suggest only when confidence is at least 0.9. Give the exact supporting transcript phrases and explain the passage connection. These are operator suggestions, never permission to go live.

Available actions:
- Check if the preacher is implicitly referencing a verse (paraphrasing, "that verse about...")
- Check the sermon plan for expected verses
- Adjust display timing if the preacher is dwelling on a verse or moving quickly
- Query context for recent detections and service state

Respond with tool calls in this format:
<tool_call name="tool_name">{"param": "value"}</tool_call>

Or if no action is needed, respond with:
<no_action>Brief explanation of why no action is needed</no_action>

If you detect an implicit verse reference, respond with:
<verse_detection ref="Book Chapter:Verse" confidence="0.7">Reason for detection</verse_detection>

Keep responses brief. You are rate-limited — make each call count.`

/** A verse detection extracted from the LLM's reasoning response. */
export interface ImplicitVerseDetection {
  ref: string
  book: string
  chapter: number
  verse: number
  timestamp: number
  source: string
  confidence: number
}

export function buildPrompt(
  context: ServiceContext,
  toolDescriptions: string,
  transcriptBatch: string,
  observations: string
): string {
  const contextSummary = context.buildContextSummary()
  let prompt = `${SYSTEM_PROMPT}

## Tools
${toolDescriptions}

## Current Service State
${contextSummary}

## New Transcript (last batch)
"${transcriptBatch}"`
  if (observations) {
    prompt += `

## Previous Observations
${observations}`
  }
  prompt += `

Analyze the transcript and decide what actions to take:`
  return prompt
}

export function parseToolCalls(response: string): ToolCall[] {
  const calls: ToolCall[] = []
  const regex = /<tool_call name="([^"]+)">([\s\S]*?)<\/tool_call>/g
  let match
  while ((match = regex.exec(response)) !== null) {
    try {
      const params = JSON.parse(match[2].trim())
      calls.push({ toolName: match[1], params })
    } catch {
      console.warn(`⚠️ ReasoningLoop: failed to parse tool call params for ${match[1]}`)
    }
  }
  return calls
}

export function parseVerseDetections(response: string): ImplicitVerseDetection[] {
  const detections: ImplicitVerseDetection[] = []
  const regex = /<verse_detection ref="([^"]+)" confidence="([^"]+)">([\s\S]*?)<\/verse_detection>/g
  let match
  while ((match = regex.exec(response)) !== null) {
    const ref = match[1]
    const confidence = parseFloat(match[2])
    const refParts = ref.match(/^(.+?)\s+(\d+):(\d+)/)
    if (refParts) {
      detections.push({
        ref,
        book: refParts[1],
        chapter: parseInt(refParts[2]),
        verse: parseInt(refParts[3]),
        timestamp: Date.now(),
        source: 'implicit',
        confidence: isNaN(confidence) ? 0.7 : confidence
      })
    }
  }
  return detections
}

export function formatObservations(results: ToolExecutionResult[]): string {
  return results
    .map(
      (r) =>
        `${r.toolName}: ${r.result.success ? JSON.stringify(r.result.data) : `ERROR: ${r.result.error}`}`
    )
    .join('\n')
}
