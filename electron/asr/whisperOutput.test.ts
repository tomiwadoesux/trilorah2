import { describe, it, expect } from 'vitest'
import { cleanWhisperStdout, whisperArgs } from './whisperOutput'

describe('cleanWhisperStdout — only what was said', () => {
  it('joins segments into one line', () => {
    expect(cleanWhisperStdout(' Turn with me to Romans.\n Chapter eight.\n')).toBe('Turn with me to Romans. Chapter eight.')
  })
  it('drops the annotations whisper writes when nobody is speaking', () => {
    for (const noise of ['[BLANK_AUDIO]', ' [ Silence ]', '(music)', '[Music]', '(applause)', '[MUSIC PLAYING]', '♪ ♪']) {
      expect(cleanWhisperStdout(noise)).toBe('')
    }
  })
  it('drops a sound description it has never seen before', () => {
    // Found by running the real binary on a system sound.
    expect(cleanWhisperStdout('\n (birds chirping)\n')).toBe('')
    expect(cleanWhisperStdout(' [wind blowing]')).toBe('')
    expect(cleanWhisperStdout(' Amen.\n (door closes)\n Let us pray.')).toBe('Amen. Let us pray.')
  })
  it('keeps the words around an annotation', () => {
    expect(cleanWhisperStdout(' Amen. [BLANK_AUDIO] Let us pray.')).toBe('Amen. Let us pray.')
  })
  it('keeps ordinary brackets that are not annotations', () => {
    expect(cleanWhisperStdout(' He said (and I believe it) that grace is enough.')).toBe(
      'He said (and I believe it) that grace is enough.'
    )
  })
  it('strips a timestamp prefix if one is ever present', () => {
    expect(cleanWhisperStdout('[00:00:00.000 --> 00:00:05.000]   John three sixteen.')).toBe('John three sixteen.')
  })
  it('handles Windows line endings', () => {
    expect(cleanWhisperStdout(' one\r\n two\r\n')).toBe('one two')
  })
  it('answers empty for empty', () => {
    expect(cleanWhisperStdout('')).toBe('')
    expect(cleanWhisperStdout('\n\n  \n')).toBe('')
  })
})

describe('whisperArgs', () => {
  it('asks for text only, in the right language', () => {
    expect(whisperArgs({ modelPath: 'm.bin', wavPath: 'c.wav', language: 'en', threads: 4 })).toEqual([
      '-nt', '-l', 'en', '-t', '4', '-m', 'm.bin', '-f', 'c.wav'
    ])
  })
})
