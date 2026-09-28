import { describe, it, expect, vi, afterEach } from 'vitest'
import { SoundCheck } from './soundCheck'
import { applyBookAliases } from './teaching'

afterEach(() => vi.useRealTimers())

function setup() {
  let text!: (s: string, final: boolean) => void
  let error!: (e: Error) => void
  const local = { start: vi.fn((onText, onError, _device, status) => { text = onText; error = onError; status('Listening...') }), stop: vi.fn() }
  const check = new SoundCheck(local, (_pid, s) => applyBookAliases(s, [{ heard: 'rawmeans', means: 'Romans', source: 'taught', hits: 0 }]))
  return { check, local, say: (s: string) => text(s, true), fail: (s: string) => error(new Error(s)) }
}
describe('isolated offline sound check', () => {
  it('uses the local provider and evaluates the actual detected reference', () => {
    const { check, local, say } = setup()
    check.start('p1', 0, 'Pulpit mic')
    say('proverbs chapter three verse five')
    expect(check.snapshot()).toMatchObject({ matches: true, detected: 'Proverbs 3:5', status: 'finished' })
    expect(local.stop).toHaveBeenCalledOnce()
  })
  it('does not mark a different reference correct just because the prompt is known', () => {
    const { check, say } = setup()
    check.start('p1', 1)
    say('john chapter four verse eight')
    expect(check.snapshot()).toMatchObject({ matches: false, detected: 'John 4:8', status: 'finished' })
  })
  it('tests saved aliases without updating a service or trust', () => {
    const { check, say } = setup()
    check.start('p1', 2)
    say('rawmeans eight twenty eight')
    expect(check.snapshot()?.matches).toBe(true)
  })
  it('stops after 30 seconds and ignores late transcription callbacks', () => {
    vi.useFakeTimers()
    const { check, say, local } = setup()
    check.start('p1', 0)
    vi.advanceTimersByTime(30_000)
    say('proverbs three five')
    expect(local.stop).toHaveBeenCalledOnce()
    expect(check.snapshot()).toMatchObject({ status: 'finished', heard: '', matches: false })
  })
  it('surfaces microphone errors and refuses overlapping checks', () => {
    const { check, fail } = setup()
    check.start('p1', 0)
    expect(() => check.start('p2', 1)).toThrow('Finish')
    fail('Microphone permission denied')
    expect(check.snapshot()).toMatchObject({ status: 'error', message: 'Microphone permission denied' })
  })
})
