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
import { startPracticeSermon, stopPracticeSermon } from './practiceSermon'

export type ASRProviderId = 'deepgram' | 'whisper-local' | 'practice'

import type { WordTiming } from '../../shared/wordTimings'

export interface ASRProvider {
  id: ASRProviderId
  start: (
    /* `display` is the recogniser's own casing and punctuation, when it has
       any. The engine matches on lowercase; a person reading the transcript
       wants the sentence. */
    /* `words` carries per-word timings when the recogniser supplies them —
       Deepgram does, whisper-local does not. The companion page needs them to
       highlight the word being spoken rather than fading a paragraph. */
    onText: (text: string, isFinal: boolean, display?: string, words?: WordTiming[] | null) => void,
    onError?: (error: Error) => void,
    deviceLabel?: string,
    onStatus?: (message: string) => void
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

/** Not a recogniser: the scripted practice sermon (see practiceSermon.ts),
    chosen by picking PRACTICE_SERMON_DEVICE as the audio input. */
export const practiceSermonProvider: ASRProvider = {
  id: 'practice',
  start: startPracticeSermon,
  stop: stopPracticeSermon
}

export function resolveASRProvider(requested: string | undefined): ASRProvider {
  if (requested === 'deepgram') {
    if (process.env.DEEPGRAM_API_KEY) return deepgramProvider
    console.log('🎤 Deepgram selected but no key — using local Whisper')
    return whisperProvider
  }
  // Cloud speech is explicit opt-in, even when a key is bundled/configured.
  if (requested !== 'whisper-local' && requested !== undefined && requested !== '') {
    console.warn(`⚠️ Unknown asrProvider "${requested}" — using local Whisper`)
  }
  return whisperProvider
}
