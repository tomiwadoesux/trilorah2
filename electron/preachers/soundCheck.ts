import { SOUND_CHECK_PROMPTS, type SoundCheckState } from '../../shared/preacherLearning'
import { SpokenReferenceResolver } from '../engine/referenceResolver'
import { randomUUID } from 'node:crypto'

interface LocalSpeech {
  start: (onText: (text: string, final: boolean) => void, onError: (e: Error) => void, device?: string, onStatus?: (s: string) => void) => void
  stop: () => void
}

/** An isolated microphone test. No service callbacks, trust changes or network AI. */
export class SoundCheck {
  private state: SoundCheckState | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private generation = 0
  constructor(private local: LocalSpeech, private transform: (pid: string, text: string) => string) {}
  get active() { return this.state?.status === 'starting' || this.state?.status === 'listening' }
  snapshot() { return this.state ? { ...this.state } : null }
  start(preacherId: string, promptIndex: number, device?: string) {
    if (this.active) throw new Error('Finish the current sound check first.')
    const prompt = SOUND_CHECK_PROMPTS[promptIndex]
    if (!prompt) throw new Error('Choose a sound-check reference.')
    const generation = ++this.generation
    this.state = { sessionId: randomUUID(), preacherId, promptIndex, status: 'starting', message: 'Preparing offline speech…', heard: '', detected: null, matches: false }
    const resolver = new SpokenReferenceResolver((ref) => {
      if (!this.active || generation !== this.generation || !ref.chapter) return
      this.state!.detected = `${ref.book} ${ref.chapter}${ref.verse ? `:${ref.verse}` : ''}`
      this.state!.matches = ref.book === prompt.book && ref.chapter === prompt.chapter && ref.verse === prompt.verse
    }, { bareBookGate: () => false })
    this.local.start((text, final) => {
      if (!this.active || generation !== this.generation || !final) return
      this.state!.heard = `${this.state!.heard} ${text}`.trim().slice(-1200)
      resolver.process(this.transform(preacherId, text), true)
      if (this.state!.detected) this.stop()
    }, (error) => {
      if (generation !== this.generation || !this.active) return
      this.fail(error.message)
    }, device, (message) => {
      if (generation !== this.generation || !this.active) return
      this.state!.message = message
      if (message.toLowerCase().startsWith('listening')) {
        this.state!.status = 'listening'
        this.timer = setTimeout(() => this.stop(), 30_000)
      }
    })
    return this.snapshot()
  }
  fail(message: string) {
    this.stop()
    if (this.state) { this.state.status = 'error'; this.state.message = message }
  }
  stop() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    if (!this.active) return this.snapshot()
    ++this.generation
    this.local.stop()
    this.state!.status = 'finished'
    this.state!.message = this.state!.matches ? 'Reference matched. Practice does not change live-service trust.'
      : this.state!.heard ? 'Check the words below. You can retry or save a book-name correction.' : 'No speech captured. Check the microphone and try again.'
    return this.snapshot()
  }
}
