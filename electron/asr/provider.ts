/**
 * ASR provider selection — the free-tier switch.
 *
 *   deepgram      → cloud, sub-second streaming (needs DEEPGRAM_API_KEY)
 *   whisper-local → whisper.cpp on-device, ~5s chunks, free forever
 *
 * Selection honors the `asrProvider` setting but degrades sensibly:
 * asked for Deepgram without a key → try local; asked for local without a
 * model → clear error, never a silent no-op.
 */

import { startDeepgram, stopDeepgram } from './deepgram'
import { startWhisperLocal, stopWhisperLocal, findWhisperModel } from './whisperLocal'

export type ASRProviderId = 'deepgram' | 'whisper-local'

export interface ASRProvider {
  id: ASRProviderId
  start: (
    onText: (text: string, isFinal: boolean) => void,
    onError?: (error: Error) => void,
    deviceLabel?: string
  ) => void
  stop: () => void
}

const deepgramProvider: ASRProvider = {
  id: 'deepgram',
  start: startDeepgram,
  stop: stopDeepgram
}

const whisperProvider: ASRProvider = {
  id: 'whisper-local',
  start: startWhisperLocal,
  stop: stopWhisperLocal
}

export function resolveASRProvider(requested: string | undefined): ASRProvider {
  if (requested === 'whisper-local') return whisperProvider
  if (requested === 'deepgram' || requested === undefined || requested === '') {
    if (process.env.DEEPGRAM_API_KEY) return deepgramProvider
    if (findWhisperModel()) {
      console.log('🎤 No Deepgram key — falling back to local Whisper')
      return whisperProvider
    }
    return deepgramProvider // will surface its own missing-key error
  }
  console.warn(`⚠️ Unknown asrProvider "${requested}" — using Deepgram`)
  return deepgramProvider
}
