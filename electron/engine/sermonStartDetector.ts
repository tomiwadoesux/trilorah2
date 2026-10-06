import type { SermonStartAction, SermonStartState } from '../../shared/sermonStart'

const normalize = (text: string) => text.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const WINDOW_MS = 90_000
interface Sample { text: string; at: number; teaching: boolean; speaker?: number }

/** Evidence proposes a start; only an explicit response starts the session.
 * Thresholds are conservative heuristics, not calibrated probabilities. */
export class SermonStartDetector {
  private state: SermonStartState = { status: 'watching', requestId: 0, candidateAt: null, startedAt: null, confirmedAt: null, evidence: [] }
  private samples: Sample[] = []
  private cooldownUntil = 0
  private plan: string[] = []
  private lyrics = ''
  private songHeardAt = 0
  private askedAt = 0
  constructor(private now = Date.now, private changed: (state: SermonStartState) => void = () => {}) {}

  getState(): SermonStartState {
    if (this.state.status === 'confirmation' && this.now() - this.askedAt > WINDOW_MS) {
      this.cooldownUntil = this.now() + 60_000
      this.clear()
    }
    return { ...this.state, evidence: [...this.state.evidence] }
  }

  setPlan(title: string, refs: string[], themes: string[] = []) {
    this.plan = [title === 'Untitled' ? '' : title, ...refs, ...themes].map(normalize).filter(s => s.split(' ').length >= 2)
  }
  setLyrics(lyrics: string) { this.lyrics = normalize(lyrics) }
  suspend() { if (this.state.status !== 'active') this.clear() }

  private publish(patch: Partial<SermonStartState>) {
    this.state = { ...this.state, ...patch }
    this.changed({ ...this.state, evidence: [...this.state.evidence] })
  }
  private clear() {
    this.samples = []
    this.publish({ status: 'watching', candidateAt: null, evidence: [], requestId: this.state.requestId + 1 })
  }
  reset() {
    this.cooldownUntil = 0
    this.plan = []
    this.lyrics = ''
    this.songHeardAt = 0
    this.clear()
    this.publish({ startedAt: null, confirmedAt: null })
  }

  respond(action: SermonStartAction, requestId?: number): SermonStartState {
    const state = this.getState()
    if (action === 'confirm' || action === 'not-yet') {
      if (state.status !== 'confirmation' || requestId !== state.requestId) throw new Error('This sermon prompt has changed. Check the current prompt.')
    }
    if (action === 'start' || action === 'confirm') {
      if (state.status !== 'active') this.publish({ status: 'active', startedAt: action === 'confirm' ? state.candidateAt : this.now(), confirmedAt: this.now(), requestId: state.requestId + 1 })
    } else if (action === 'not-yet' || action === 'end') {
      this.cooldownUntil = this.now() + 60_000
      this.clear()
      this.publish({ startedAt: null, confirmedAt: null })
    } else throw new Error('Unknown sermon action')
    return this.getState()
  }

  process(text: string, context: { sermonNext: boolean; speaker?: number }) {
    this.getState()
    const now = this.now()
    if (this.state.status === 'active' || now < this.cooldownUntil) return
    const clean = normalize(text)
    if (!clean) return
    // Known lyrics and explicit non-sermon activities outweigh an opening phrase.
    const sung = clean.split(' ').length >= 5 && this.lyrics.includes(clean)
    if (sung) this.songHeardAt = now
    if (sung || /\b(let us pray|lets pray|father we|dear heavenly father|announcements|tithes and offerings|prepare your offering|give online)\b/.test(clean)) {
      this.clear()
      return
    }
    const teaching = /\b(this (means|teaches|shows|tells)|what (does|do) .{1,60} mean|notice (how|what|that)|we (learn|see) (that|here|how)|in (this|that) passage|the point is|apply this|in our lives|jesus (is|was) (teaching|saying)|paul (is|was) (teaching|saying|writing))\b/.test(clean)
    this.samples = this.samples.filter(s => now - s.at < WINDOW_MS)
    this.samples.push({ text: clean, at: now, teaching, speaker: context.speaker })
    if (this.samples.length > 60) this.samples.shift()
    const joined = this.samples.map(s => s.text).join(' ')
    const opening = /\b(my message today|todays message|the title of my (message|sermon)|i want to preach|open your bibles|turn with me to|lets go to the word)\b/.test(joined)
    const handoff = /\b(welcome (our|the) (pastor|preacher)|receive (our|the) (pastor|preacher)|bring (us |you )?the word|hand over to|hear (from|the message from))\b/.test(joined)
    const planMatch = this.plan.some(p => (` ${joined} `).includes(` ${p} `))
    const teachers = this.samples.filter(s => s.teaching)
    const sustained = teachers.length >= 3 && now - teachers[0].at >= 12_000 && joined.split(' ').length >= 65
    const speakers = this.samples.map(s => s.speaker).filter((s): s is number => s !== undefined)
    const stableSpeaker = speakers.length >= 3 && new Set(speakers.slice(-3)).size === 1
    const changedSpeaker = stableSpeaker && speakers.some(s => s !== speakers.at(-1))
    const evidence = [
      context.sermonNext && 'Sermon is next in the service plan',
      handoff && 'A handoff to the preacher was heard',
      opening && 'A message or opening passage was introduced',
      planMatch && 'Speech matches the sermon plan',
      this.songHeardAt > 0 && now - this.songHeardAt < WINDOW_MS && 'Known song lyrics gave way to speech',
      changedSpeaker && 'A new speaker is continuing',
      sustained && 'Teaching continued across several transcript passages',
    ].filter((s): s is string => !!s)
    const supported = opening || handoff || planMatch || context.sermonNext || changedSpeaker
    const status = sustained && supported && evidence.length >= 2 ? 'confirmation' : evidence.length ? 'approaching' : 'watching'
    const openingSample = this.samples.find(s => /\b(my message today|todays message|the title of my|i want to preach|open your bibles|turn with me to)\b/.test(s.text))
    const candidateAt = openingSample?.at ?? teachers[0]?.at ?? this.samples[0].at
    // Hold a question while fresh evidence remains; a negative cue or silence cancels it.
    if (this.state.status === 'confirmation') return
    if (status !== this.state.status || evidence.join('|') !== this.state.evidence.join('|')) {
      if (status === 'confirmation') this.askedAt = now
      this.publish({ status, evidence, candidateAt, requestId: status === 'confirmation' ? this.state.requestId + 1 : this.state.requestId })
    }
  }
}
