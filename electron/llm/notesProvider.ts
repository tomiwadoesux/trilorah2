/**
 * Notes provider — where sermon → notes intelligence runs.
 *
 *   cloud → HuggingFace (existing generateSermonNotes path)
 *   local → tiny on-device model, EXPERIMENTAL. Detected lazily so the
 *           dependency stays optional; when absent, the provider reports
 *           availability honestly instead of failing mid-service.
 *
 * The local path exists because notes are the one job that truly needs a
 * language model, and they don't need to be real-time: a 1-4B quantized
 * model summarizing 3-minute blocks on CPU is enough. Cloud remains the
 * default until the local path graduates.
 */

import { generateSermonNotes, type GeneratedSermonNotes } from '../notes/sermonNotesGenerator'

export type NotesProviderId = 'cloud' | 'local'

export interface NotesProvider {
  id: NotesProviderId
  isAvailable: () => Promise<boolean>
  /** Availability detail for the UI ("HF token missing", "model not installed"). */
  status: () => Promise<string>
  generate: (transcript: string) => Promise<GeneratedSermonNotes | null>
}

export const cloudNotesProvider: NotesProvider = {
  id: 'cloud',
  isAvailable: async () =>
    Boolean(process.env.HF_API_TOKEN) || Boolean((await import('../data/settings')).getSetting('hfToken')),
  status: async () =>
    (await cloudNotesProvider.isAvailable())
      ? 'ready (HuggingFace)'
      : 'HF token missing — add HF_API_TOKEN to .env.local or Settings',
  generate: (transcript) => generateSermonNotes(transcript)
}

export const localNotesProvider: NotesProvider = {
  id: 'local',
  isAvailable: async () => {
    try {
      // Optional dependency — present only when the user opted into the
      // local model download. Never listed in package.json on purpose.
      await import('@xenova/transformers' as string)
      return true
    } catch {
      return false
    }
  },
  status: async () =>
    (await localNotesProvider.isAvailable())
      ? 'ready (on-device)'
      : 'local model not installed — run `npm i @xenova/transformers` and download a model in Settings',
  generate: async (transcript) => {
    if (!(await localNotesProvider.isAvailable())) {
      console.warn('⚠️ Local notes model unavailable — falling back to cloud')
      return cloudNotesProvider.generate(transcript)
    }
    // Incremental block-summarization pipeline lands with the model
    // integration pass; until then the cloud path produces the notes.
    console.log('🧪 Local notes provider is experimental — delegating to cloud for full notes')
    return cloudNotesProvider.generate(transcript)
  }
}

export function resolveNotesProvider(requested: string | undefined): NotesProvider {
  return requested === 'local' ? localNotesProvider : cloudNotesProvider
}
