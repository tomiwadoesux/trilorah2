import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MS_PER_WORD, startPracticeSermon, stopPracticeSermon } from './practiceSermon'
import { PRACTICE_SERMON, PRACTICE_SERMON_DEVICE } from '../../shared/practiceSermon'
import { practiceSermonProvider, resolveASRProvider } from './provider'

describe('the practice sermon', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { stopPracticeSermon(); vi.useRealTimers() })

  const script = [
    { pause: 100, say: 'turn to John three sixteen', note: 'one verse' },
    { pause: 100, say: 'amen', note: 'the end' },
  ]

  it('is heard word by word, then as a final, with each line announced', () => {
    const heard: string[] = []
    const status: string[] = []
    startPracticeSermon((text, isFinal) => heard.push(`${isFinal ? 'final' : 'partial'}: ${text}`), undefined, undefined, (m) => status.push(m), script, 10)
    vi.advanceTimersByTime(10_000)
    expect(heard).toEqual([
      'partial: turn',
      'partial: turn to',
      'partial: turn to John',
      'partial: turn to John three',
      'partial: turn to John three sixteen',
      'final: turn to John three sixteen',
      'partial: amen',
      'final: amen',
    ])
    expect(status[0]).toMatch(/^Listening/)
    expect(status).toContain('Listening — practice · one verse')
    expect(status.at(-1)).toMatch(/finished/)
  })

  it('stops mid-sentence when listening stops', () => {
    const heard: string[] = []
    startPracticeSermon((text) => heard.push(text), undefined, undefined, undefined, script, 10)
    vi.advanceTimersByTime(125)
    stopPracticeSermon()
    const sofar = heard.length
    vi.advanceTimersByTime(10_000)
    expect(heard.length).toBe(sofar)
    expect(sofar).toBeGreaterThan(0)
  })

  it('is about three minutes long, and only ever chosen as an audio input', () => {
    const words = PRACTICE_SERMON.reduce((n, l) => n + l.say.split(/\s+/).length + 1, 0)
    const ms = PRACTICE_SERMON.reduce((n, l) => n + l.pause, 0) + words * MS_PER_WORD
    expect(ms).toBeGreaterThan(150_000)
    expect(ms).toBeLessThan(240_000)
    expect(practiceSermonProvider.id).toBe('practice')
    for (const setting of ['deepgram', 'whisper-local', PRACTICE_SERMON_DEVICE]) expect(resolveASRProvider(setting).id).not.toBe('practice')
  })
})
