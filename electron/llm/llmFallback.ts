import { getSetting } from '../data/settings'
import type { ServiceContext } from '../engine/serviceContext'
import type { ToolCall, ToolExecutionResult, ToolRegistry } from './toolRegistry'
import type { VerseDetection } from '../../shared/types'

export interface CompletionOptions {
  maxTokens?: number
  temperature?: number
}

export class LLMFallback {
  lastCallTime: number
  minInterval: number
  enabled: boolean

  constructor() {
    this.lastCallTime = 0
    this.minInterval = 3e4
    this.enabled = true
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  isAvailable(): boolean {
    if (!this.enabled) return false
    const hfToken = process.env.HF_API_TOKEN || getSetting('hfToken')
    if (!hfToken) return false
    return Date.now() - this.lastCallTime >= this.minInterval
  }

  /**
   * General-purpose text completion.
   * Used by the reasoning loop for tool-call reasoning.
   */
  async complete(prompt: string, options?: CompletionOptions): Promise<string | null> {
    if (!this.enabled) return null
    const now = Date.now()
    if (now - this.lastCallTime < this.minInterval) return null
    const hfToken = process.env.HF_API_TOKEN || getSetting('hfToken')
    if (!hfToken) return null
    this.lastCallTime = now
    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3.1-8B-Instruct',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: options?.maxTokens ?? 500,
              temperature: options?.temperature ?? 0.2,
              return_full_text: false
            }
          })
        }
      )
      if (!response.ok) return null
      const data: any = await response.json()
      return Array.isArray(data) && data[0]?.generated_text ? data[0].generated_text.trim() : null
    } catch {
      return null
    }
  }

  /**
   * Disambiguate a scripture reference using LLM.
   * Returns null if rate-limited, unavailable, or disabled.
   */
  async disambiguate(
    transcript: string,
    candidates: Array<{ ref: string; confidence: number }>
  ): Promise<VerseDetection | null> {
    if (!this.enabled) return null
    const now = Date.now()
    if (now - this.lastCallTime < this.minInterval) {
      return null
    }
    const hfToken = process.env.HF_API_TOKEN || getSetting('hfToken')
    if (!hfToken) {
      console.error('❌ No HuggingFace token found. Set HF_API_TOKEN in .env.local or add it in Settings.')
      return null
    }
    this.lastCallTime = now
    const candidateList = candidates
      .map((c) => `- ${c.ref} (confidence: ${c.confidence.toFixed(2)})`)
      .join('\n')
    const prompt = `Given this spoken text from a sermon: "${transcript}"

The following Bible verse candidates were detected:
${candidateList}

Which verse is the preacher most likely referring to? Reply with ONLY the verse reference (e.g. "John 3:16"), nothing else.`
    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3.1-8B-Instruct',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 50,
              temperature: 0.1,
              return_full_text: false
            }
          })
        }
      )
      if (!response.ok) return null
      const data: any = await response.json()
      const text = Array.isArray(data) && data[0]?.generated_text ? data[0].generated_text.trim() : ''
      const match = text.match(
        /(\d?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(\d+):(\d+)/
      )
      if (!match) return null
      return {
        book: match[1].trim(),
        chapter: parseInt(match[2]),
        verse: parseInt(match[3]),
        confidence: 0.85
      }
    } catch {
      return null
    }
  }

  /**
   * Resolve a loose/vague scripture reference like "that verse about love"
   */
  async resolveLooseReference(transcript: string): Promise<VerseDetection | null> {
    if (!this.enabled) return null
    const now = Date.now()
    if (now - this.lastCallTime < this.minInterval) {
      return null
    }
    const hfToken = process.env.HF_API_TOKEN || getSetting('hfToken')
    if (!hfToken) {
      console.error('❌ No HuggingFace token found. Set HF_API_TOKEN in .env.local or add it in Settings.')
      return null
    }
    this.lastCallTime = now
    const prompt = `A preacher said: "${transcript}"

This seems to reference a Bible verse indirectly. What is the most likely Bible verse being referenced? Reply with ONLY the verse reference (e.g. "1 Corinthians 13:4"), nothing else.`
    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3.1-8B-Instruct',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 50,
              temperature: 0.1,
              return_full_text: false
            }
          })
        }
      )
      if (!response.ok) return null
      const data: any = await response.json()
      const text = Array.isArray(data) && data[0]?.generated_text ? data[0].generated_text.trim() : ''
      const match = text.match(
        /(\d?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(\d+):(\d+)/
      )
      if (!match) return null
      return {
        book: match[1].trim(),
        chapter: parseInt(match[2]),
        verse: parseInt(match[3]),
        confidence: 0.7
      }
    } catch {
      return null
    }
  }
}

export async function executeTools(
  calls: ToolCall[],
  registry: ToolRegistry,
  context: ServiceContext
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = []
  const batches = partitionCalls(calls, registry)
  for (const batch of batches) {
    if (batch.type === 'read') {
      const batchResults = await Promise.all(
        batch.calls.map(async (call): Promise<ToolExecutionResult> => {
          const tool = registry.get(call.toolName)
          if (!tool) {
            return {
              toolName: call.toolName,
              result: {
                success: false,
                error: `Unknown tool: ${call.toolName}`
              }
            }
          }
          try {
            const result = await tool.execute(call.params, context)
            return { toolName: call.toolName, result }
          } catch (e) {
            return {
              toolName: call.toolName,
              result: {
                success: false,
                error: e instanceof Error ? e.message : String(e)
              }
            }
          }
        })
      )
      results.push(...batchResults)
    } else {
      for (const call of batch.calls) {
        const tool = registry.get(call.toolName)
        if (!tool) {
          results.push({
            toolName: call.toolName,
            result: { success: false, error: `Unknown tool: ${call.toolName}` }
          })
          continue
        }
        try {
          const result = await tool.execute(call.params, context)
          results.push({ toolName: call.toolName, result })
        } catch (e) {
          results.push({
            toolName: call.toolName,
            result: {
              success: false,
              error: e instanceof Error ? e.message : String(e)
            }
          })
        }
      }
    }
  }
  return results
}

function partitionCalls(
  calls: ToolCall[],
  registry: ToolRegistry
): Array<{ type: 'read' | 'write'; calls: ToolCall[] }> {
  const batches: Array<{ type: 'read' | 'write'; calls: ToolCall[] }> = []
  for (const call of calls) {
    const tool = registry.get(call.toolName)
    const type = tool?.type ?? 'write'
    const lastBatch = batches[batches.length - 1]
    if (lastBatch && lastBatch.type === type && type === 'read') {
      lastBatch.calls.push(call)
    } else {
      batches.push({ type, calls: [call] })
    }
  }
  return batches
}
