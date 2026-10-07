import { PRACTICE_SERMON, type SermonLine } from '../../shared/practiceSermon'

/** About 136 words a minute: a preacher reading steadily. */
export const MS_PER_WORD = 440

type OnText = (text: string, isFinal: boolean, display?: string) => void

let timer: ReturnType<typeof setTimeout> | null = null
let playing = false

/**
 * The practice sermon (shared/practiceSermon.ts), heard the way a recogniser
 * hears speech: each line grows word by word as partial results, then
 * arrives once more as a final — so the resolver's partial handling, the
 * rolling transcript and song search are all exercised as they are live.
 * Each line's note goes out as a status as the line starts. At the end of
 * the script it falls silent and leaves the engine listening.
 *
 * No microphone is opened: the real providers ask the app window for audio,
 * and this one never does.
 */
export function startPracticeSermon(
  onText: OnText,
  _onError?: (error: Error) => void,
  _deviceLabel?: string,
  onStatus?: (message: string) => void,
  script: SermonLine[] = PRACTICE_SERMON,
  msPerWord = MS_PER_WORD,
): void {
  stopPracticeSermon()
  playing = true
  onStatus?.('Listening — practice sermon, no microphone')
  let line = 0
  const later = (fn: () => void, ms: number) => {
    timer = setTimeout(() => { if (playing) fn() }, ms)
  }
  const speak = (words: string[], heard: number) => {
    if (heard <= words.length) {
      onText(words.slice(0, heard).join(' '), false)
      later(() => speak(words, heard + 1), msPerWord)
      return
    }
    const { say } = script[line]
    onText(say, true, say)
    line += 1
    nextLine()
  }
  const nextLine = () => {
    if (line >= script.length) {
      onStatus?.('Listening — practice sermon finished: press stop listening')
      return
    }
    const { pause, say, note } = script[line]
    later(() => {
      onStatus?.(`Listening — practice · ${note}`)
      speak(say.split(/\s+/).filter(Boolean), 1)
    }, pause)
  }
  nextLine()
}

export function stopPracticeSermon(): void {
  playing = false
  if (timer) clearTimeout(timer)
  timer = null
}
