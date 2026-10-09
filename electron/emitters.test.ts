import { describe, expect, it, vi } from 'vitest'

const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [{ isDestroyed: () => false, webContents: { send } }] } }))
import { emitTranscript, emitTranscriptLine } from './emitters'

describe('transcript display capitalization', () => {
  it('formats displayed names while leaving the raw transcript event intact', () => {
    const text = 'jesus spoke of god and the holy spirit; elohim is faithful'
    emitTranscriptLine(text, true)
    expect(send).toHaveBeenCalledWith('on-transcript-line', { text: 'Jesus spoke of God and the Holy Spirit; Elohim is faithful', isFinal: true })
    emitTranscript(text)
    expect(send).toHaveBeenCalledWith('on-transcript-update', text)
  })
})
