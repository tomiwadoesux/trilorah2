import { describe, it, expect, vi, afterEach } from 'vitest'
vi.mock('./deepgram', () => ({ startDeepgram: vi.fn(), stopDeepgram: vi.fn() }))
vi.mock('./whisperLocal', () => ({ startWhisperLocal: vi.fn(), stopWhisperLocal: vi.fn(), findWhisperModel: vi.fn() }))
import { resolveASRProvider } from './provider'

afterEach(() => vi.unstubAllEnvs())
describe('speech cost selection', () => {
  it('stays local by default even if cloud credentials exist', () => {
    vi.stubEnv('DEEPGRAM_API_KEY', 'test-key-not-a-credential')
    for (const selection of [undefined, '', 'whisper-local', 'unknown']) expect(resolveASRProvider(selection).id).toBe('whisper-local')
    expect(resolveASRProvider('deepgram').id).toBe('deepgram')
  })
  it('never requires a cloud key for offline speech', () => {
    vi.stubEnv('DEEPGRAM_API_KEY', '')
    expect(resolveASRProvider('deepgram').id).toBe('whisper-local')
  })
})
