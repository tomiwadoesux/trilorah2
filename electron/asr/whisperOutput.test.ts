import { describe, it, expect } from 'vitest'
import { cleanWhisperStdout, explainWhisperFailure, whisperArgs } from './whisperOutput'

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

describe('explainWhisperFailure — a reason, not a command line', () => {
  it('names a missing runtime DLL', () => {
    expect(explainWhisperFailure({ code: 0xc0000135 })).toMatch(/Visual C\+\+ runtime/)
    // Node hands the NTSTATUS over as a signed 32-bit number on some paths.
    expect(explainWhisperFailure({ code: 0xc0000135 | 0 })).toMatch(/Visual C\+\+ runtime/)
  })
  it('names a processor the binary cannot run on', () => {
    expect(explainWhisperFailure({ code: 0xc000001d })).toMatch(/processor/)
  })
  it('names a timeout', () => {
    expect(explainWhisperFailure({ killed: true, signal: 'SIGTERM' })).toMatch(/took too long/)
  })
  it('names a missing binary', () => {
    expect(explainWhisperFailure({ code: 'ENOENT' })).toMatch(/missing from this install/)
  })
  it('otherwise shows the code and the last thing the program said', () => {
    const msg = explainWhisperFailure({ code: 1, stderr: 'loading model\nerror: failed to open model file\n' })
    expect(msg).toContain('0x1')
    expect(msg).toContain('failed to open model file')
  })
  it('never echoes the command line', () => {
    expect(explainWhisperFailure({ code: 3 })).not.toMatch(/main\.exe|\.wav|AppData/)
  })
})
