import { describe, expect, it, vi } from 'vitest'
import type { RecognitionWithdrawal } from '../shared/recognitionWithdrawal'

const electron = vi.hoisted(() => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { on: vi.fn(), removeListener: vi.fn(), send: vi.fn(), invoke: vi.fn() },
}))
vi.mock('electron', () => electron)
import './preload'

describe('recognition withdrawal preload bridge', () => {
  it('forwards the exact suggestion identity in order and releases its listener', () => {
    const api = electron.contextBridge.exposeInMainWorld.mock.calls[0][1] as {
      onRecognitionWithdrawn(callback: (payload: RecognitionWithdrawal) => void): () => void
    }
    const received: RecognitionWithdrawal[] = []
    const unsubscribe = api.onRecognitionWithdrawn(payload => received.push(payload))
    const [channel, listener] = electron.ipcRenderer.on.mock.calls.at(-1)!
    expect(channel).toBe('on-recognition-withdrawn')
    const first = { suggestionId: 'recognition-1', book: 'John', chapter: 3, verse: 16 }
    const second = { suggestionId: 'recognition-2', book: '1 Samuel', chapter: 17, verse: 38, endVerse: 58 }
    listener({}, first)
    listener({}, second)
    expect(received).toEqual([first, second])
    unsubscribe()
    expect(electron.ipcRenderer.removeListener).toHaveBeenCalledWith('on-recognition-withdrawn', listener)
  })
})
