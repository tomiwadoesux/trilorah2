/**
 * whisper.cpp's stdout → the words that were said.
 *
 * The app runs the whisper.cpp `main` program itself (see whisperLocal.ts)
 * rather than through the whisper-node wrapper, so what comes back is the
 * program's raw standard output. With `-nt` (no timestamps) that is the
 * transcript, one segment per line — plus the things whisper prints INTO the
 * transcript when there is nothing to transcribe: [BLANK_AUDIO], (music),
 * [ Silence ], ♪. Left in, a quiet five seconds in a service reaches the
 * resolver and the operator's screen as the word "music".
 *
 * Pure, so it is tested without a model or a binary.
 */

/** Non-speech annotations whisper emits in square brackets or parentheses. */
const NON_SPEECH = /[[(]\s*(?:blank[_ ]audio|silence|music|applause|laughter|noise|inaudible|no speech|sound|background[^\])]*|.*?playing)\s*[\])]/gi

export function cleanWhisperStdout(stdout: string): string {
  return stdout
    .split(/\r?\n/)
    // A timestamp prefix survives if -nt is ever dropped: [00:00:00.000 --> 00:00:05.000]
    .map((line) => line.replace(/^\s*\[\d\d:\d\d:\d\d\.\d+\s*-->\s*\d\d:\d\d:\d\d\.\d+\]\s*/, ''))
    // A segment that is NOTHING BUT a bracketed note is whisper describing a
    // sound — "(birds chirping)", "[wind blowing]" — and the vocabulary is
    // open-ended, so no word list catches it. A preacher's own aside sits
    // inside a sentence and is left alone by this.
    .filter((line) => !/^\s*(?:\([^()]*\)|\[[^\[\]]*\])[\s.]*$/.test(line))
    .map((line) => line.replace(NON_SPEECH, ' ').replace(/[♪♫]/g, ' '))
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim()
}

/** The arguments for one chunk. `-nt`: no timestamps, so stdout is only text. */
export function whisperArgs(opts: { modelPath: string; wavPath: string; language: string; threads: number }): string[] {
  return ['-nt', '-l', opts.language, '-t', String(opts.threads), '-m', opts.modelPath, '-f', opts.wavPath]
}

/**
 * Why the whisper program failed, in words an operator can act on.
 *
 * Node reports a failed child process as "Command failed: <the whole command
 * line>" and nothing else — which is what reached the first Windows tester:
 * a screenful of paths and no reason. The reason is in the exit code and the
 * program's stderr, so it is assembled here.
 *
 * Windows reports a crash-at-launch as an NTSTATUS in the exit code. Two are
 * worth naming because each has a different fix and neither is the user's
 * fault: a missing runtime DLL, and a CPU without the instructions the
 * prebuilt binary was compiled for.
 */
export function explainWhisperFailure(f: {
  code?: number | string | null
  signal?: string | null
  killed?: boolean
  stderr?: string
}): string {
  const code = typeof f.code === 'number' ? f.code >>> 0 : null
  if (f.killed || f.signal === 'SIGTERM') {
    return 'Offline speech took too long on this computer and was stopped. A smaller speech model (Settings → Audio & speech) or a Deepgram key will keep up.'
  }
  if (code === 0xc0000135) {
    return 'Offline speech could not start: a Windows system file it needs is missing (the Microsoft Visual C++ runtime). Reinstalling Trilorah restores it.'
  }
  if (code === 0xc000001d) {
    return "Offline speech cannot run on this computer's processor. Add a Deepgram key in Settings → Audio & speech to use online speech instead."
  }
  if (f.code === 'ENOENT') return 'The offline speech engine is missing from this install. Reinstalling Trilorah restores it.'
  const tail = (f.stderr ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-2)
    .join(' · ')
  const where = code === null ? String(f.code ?? 'unknown') : `0x${code.toString(16)}`
  return `Offline speech failed (code ${where})${tail ? `: ${tail}` : '.'}`
}
