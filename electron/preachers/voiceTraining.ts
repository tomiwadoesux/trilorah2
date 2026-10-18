import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { SpokenReferenceResolver } from '../engine/referenceResolver'
import { parseSpokenNumber } from '../../shared/spokenNumbers'
import {
  answersPrompt,
  promptFor,
  refLabel,
  type BookAlias,
  type TrainingEngine,
  type TrainingPrompt,
  type TrainingSessionRecord,
  type TrainingState,
  type TrainingStepResult,
} from '../../shared/preacherLearning'

/*
 * Voice training — the preacher reads a round of references, and every book
 * name the speech engine gets wrong becomes a saved fix.
 *
 * The old sound check read three fixed references through the offline
 * engine and saved nothing: a mishearing ended with "type it into the
 * teaching page yourself". This does the typing. When "Philippians 4:13"
 * comes back as "fill a pians chapter four verse thirteen", the words before
 * the numbers are the misheard book name; if saving them as a fix makes the
 * same words resolve to the right verse, the fix is saved and the preacher
 * says it once more to prove it.
 *
 * It listens through whichever engine the operator picks — the one Sunday
 * uses, ideally, because Deepgram and the offline engine mishear different
 * words and a fix learned on one may never fire on the other.
 *
 * Nothing here touches a service, the trust meter or the correction ledger:
 * practice is not a service. No audio is kept, only the words.
 */

type Ref = { book: string; chapter: number; verse: number | null }

export interface TrainingSpeech {
  start(onText: (text: string, isFinal: boolean) => void, onError: (e: Error) => void, device?: string, onStatus?: (s: string) => void): void
  stop(): void
}

export interface TrainingDeps {
  /** The engine that will listen, and which one it really is (Deepgram falls back to offline with no key). */
  speech: (engine: TrainingEngine) => { engine: TrainingEngine; speech: TrainingSpeech }
  /** The live pipeline's text clean-up for this preacher, optionally with extra fixes on top. */
  transform: (preacherId: string, text: string, extra?: BookAlias[]) => string
  learn: (preacherId: string, alias: { heard: string; means: string }) => void
  forget: (preacherId: string, heard: string) => void
  save: (preacherId: string, record: TrainingSessionRecord) => void
}

/* How long to wait after the last words before judging a try. The offline
   engine hears in ~5 s chunks, so a reference can straddle two of them. */
const SETTLE_MS: Record<TrainingEngine, number> = { 'whisper-local': 6500, deepgram: 2200 }
const RESULT_MS = 1700
/* A missed reference stays up a little longer; the screen's drain bar uses the same numbers. */
const MISSED_EXTRA_MS = 600
const MAX_FAILS = 3

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean)

/* Words that start a phrase but are never the start of a book name — "turn
   to", "the book of", "a" — so a fix is not saved as "to fill a pians". */
const LEAD = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'at', 'from', 'and', 'for', 'on', 'unto', 'into', 'with', 'by',
  'turn', 'go', 'open', 'read', 'book', 'says', 'say', 'said', 'let', 'lets', 'us', 'we', 'me', 'my', 'our',
  'is', 'it', 'its', 'that', 'this', 'now', 'so', 'okay', 'ok', 'well', 'uh', 'um', 'ah', 'oh', 'chapter', 'verse',
])

function isNumberAt(ws: string[], i: number): boolean {
  return /^\d+$/.test(ws[i]) || !!parseSpokenNumber(ws, i)
}

/**
 * The misheard book name in a try, as a fix that is proven to work.
 *
 * Candidates are the last one to four words before the numbers start,
 * longest first. A candidate is kept only if (a) it does not already name a
 * book on its own — "john" heard for "1 John" is a dropped "first", and
 * saving john → 1 John would break every John — and (b) adding it as a fix
 * makes the whole try resolve to exactly the prompted verse.
 */
export function inferBookAlias(
  heard: string,
  prompt: TrainingPrompt,
  resolveWith: (text: string, extra: BookAlias[]) => Ref | null,
  bookAlone: (phrase: string) => string | null,
): { heard: string; means: string } | null {
  const ws = words(heard)
  let cue = -1
  for (let i = 1; i < ws.length; i++) {
    if (ws[i] === 'chapter' || isNumberAt(ws, i)) { cue = i; break }
  }
  if (cue < 1) return null
  const before = ws.slice(0, cue)
  for (let n = Math.min(4, before.length); n >= 1; n--) {
    const phrase = before.slice(-n)
    if (LEAD.has(phrase[0]) || phrase.every((w) => LEAD.has(w)) || phrase.some((w) => /\d/.test(w))) continue
    const candidate = phrase.join(' ')
    if (candidate.length < 3 || bookAlone(candidate)) continue
    const fix: BookAlias = { heard: candidate, means: prompt.book, source: 'learned', hits: 0 }
    const ref = resolveWith(heard, [fix])
    if (ref && answersPrompt(prompt, ref)) return { heard: candidate, means: prompt.book }
  }
  return null
}

/** Every reference the resolver finds in a piece of text; the prompt's own wins. */
export function detectIn(text: string, prompt?: TrainingPrompt): Ref | null {
  const found: Ref[] = []
  const resolver = new SpokenReferenceResolver((d) => {
    if (d.book && d.chapter) found.push({ book: d.book, chapter: d.chapter, verse: d.verse ?? null })
  }, { bareBookGate: () => false })
  resolver.process(text, true)
  return (prompt && found.find((r) => answersPrompt(prompt, r))) || found.at(-1) || null
}

export class VoiceTraining {
  private state: TrainingState | null = null
  private speech: TrainingSpeech | null = null
  private generation = 0
  private settle: ReturnType<typeof setTimeout> | undefined
  private advance: ReturnType<typeof setTimeout> | undefined
  /** When the result on screen moves on by itself. */
  private resultEnds = 0
  private fails = 0
  private tries: string[] = []
  private started = ''

  constructor(private deps: TrainingDeps) {}

  get active() {
    const s = this.state?.status
    return s === 'starting' || s === 'listening' || s === 'result'
  }

  snapshot(): TrainingState | null {
    return this.state ? structuredClone(this.state) : null
  }

  start(preacherId: string, engine: TrainingEngine, books: string[], device?: string): TrainingState {
    if (this.active) throw new Error('Finish the current training first.')
    const prompts = books.map(promptFor).filter((p): p is TrainingPrompt => !!p)
    if (!prompts.length) throw new Error('Choose at least one book to practise.')
    const run = ++this.generation
    const chosen = this.deps.speech(engine)
    this.speech = chosen.speech
    this.fails = 0
    this.tries = []
    this.started = new Date().toISOString().slice(0, 10)
    this.state = {
      sessionId: randomUUID(), preacherId, engine: chosen.engine, status: 'starting',
      message: 'Getting the microphone ready…', index: 0, prompts, results: [], attempt: 1,
      live: '', heard: '', detected: null, verdict: null, learned: null,
    }
    const current = () => run === this.generation && this.active
    chosen.speech.start(
      (text, isFinal) => { if (current()) this.hear(text, isFinal) },
      (error) => { if (current()) this.fail(error.message) },
      device,
      (message) => {
        if (!current() || this.state!.status !== 'starting') return
        if (/^listening/i.test(message)) this.listen('Read the reference aloud, the way you would in a sermon.')
        else this.state!.message = message
      },
    )
    return this.snapshot()!
  }

  /** Move on without an answer. An unproven fix goes with it. Before the
   *  microphone or model is ready this only moves to the next reference:
   *  the round keeps saying it is getting ready until it can really hear. */
  skip(): TrainingState | null {
    if (!this.active || !this.state) return this.snapshot()
    if (this.state.status === 'result') { this.next(); return this.snapshot() }
    this.dropUnproven()
    this.record('skipped')
    this.next()
    return this.snapshot()
  }

  /** Clear this try and listen again. */
  again(): TrainingState | null {
    if (this.state?.status === 'listening') {
      clearTimeout(this.settle)
      this.state.heard = ''
      this.state.live = ''
      this.state.message = 'Listening — read it once more.'
    }
    return this.snapshot()
  }

  /** Take back the fix saved for this reference. */
  undo(): TrainingState | null {
    const s = this.state
    if (!s?.learned) return this.snapshot()
    this.deps.forget(s.preacherId, s.learned.heard)
    const last = s.results.at(-1)
    if (s.status === 'result' && last?.learned === s.learned.heard) {
      /* The try was only caught because of the fix, so without it the book
         still trips the engine up: it stays on the list to practise. */
      last.outcome = 'missed'
      delete last.learned
      s.message = `Removed the fix for “${s.learned.heard}”. ${this.prompt.book} is marked to practise again.`
      this.resultEnds += MISSED_EXTRA_MS
      clearTimeout(this.advance)
      this.advance = setTimeout(() => this.next(), Math.max(0, this.resultEnds - Date.now()))
    } else s.message = `Removed the fix for “${s.learned.heard}”.`
    s.learned = null
    if (s.verdict === 'learned') s.verdict = null
    return this.snapshot()
  }

  stop(): TrainingState | null {
    if (!this.active) return this.snapshot()
    if (this.state!.status !== 'result') this.dropUnproven()
    this.finish('Training stopped. What was learned so far is saved.')
    return this.snapshot()
  }

  fail(message: string) {
    if (!this.state) return
    this.finish(message)
    this.state.status = 'error'
  }

  /* ---------------------------------------------------------------- */

  private get prompt() { return this.state!.prompts[this.state!.index] }

  private listen(message: string) {
    const s = this.state!
    s.status = 'listening'
    s.message = message
    s.heard = ''
    s.live = ''
  }

  private hear(text: string, isFinal: boolean) {
    const s = this.state!
    if (s.status === 'starting') this.listen('Read the reference aloud, the way you would in a sermon.')
    if (s.status !== 'listening') return
    if (!isFinal) { s.live = text; return }
    s.live = ''
    s.heard = `${s.heard} ${text}`.trim().slice(-600)
    const ref = detectIn(this.deps.transform(s.preacherId, s.heard), this.prompt)
    if (ref && answersPrompt(this.prompt, ref)) { this.succeed(ref); return }
    clearTimeout(this.settle)
    this.settle = setTimeout(() => this.judge(), SETTLE_MS[s.engine])
  }

  private succeed(ref: Ref) {
    const s = this.state!
    clearTimeout(this.settle)
    s.detected = refLabel(ref)
    this.tries.push(s.heard)
    const outcome = s.learned ? 'learned' : this.fails === 0 ? 'caught' : 'retry'
    s.verdict = s.learned ? 'learned' : 'caught'
    s.message = outcome === 'learned' ? 'Caught it with the new fix.' : outcome === 'caught' ? `Caught ${this.prompt.say}.` : `Caught ${this.prompt.say} that time.`
    this.record(outcome)
    s.status = 'result'
    this.resultEnds = Date.now() + RESULT_MS
    this.advance = setTimeout(() => this.next(), RESULT_MS)
  }

  private judge() {
    const s = this.state!
    if (s.status !== 'listening' || !s.heard) return
    const prompt = this.prompt
    const ref = detectIn(this.deps.transform(s.preacherId, s.heard), prompt)
    if (ref && answersPrompt(prompt, ref)) { this.succeed(ref); return }
    this.tries.push(s.heard)
    this.fails++
    s.detected = ref ? refLabel(ref) : null
    s.attempt++

    let learned: { heard: string; means: string } | null = null
    if (ref?.book !== prompt.book) {
      learned = inferBookAlias(
        s.heard, prompt,
        (text, extra) => detectIn(this.deps.transform(s.preacherId, text, extra), prompt),
        (phrase) => detectIn(`${phrase} chapter one verse one`)?.book ?? null,
      )
      if (learned && learned.heard !== s.learned?.heard) {
        try {
          this.dropUnproven()
          this.deps.learn(s.preacherId, learned)
        } catch {
          learned = null
        }
      } else if (learned) learned = null
    }

    if (learned) {
      s.learned = learned
      s.verdict = 'learned'
      this.listen(`Learned: “${learned.heard}” means ${learned.means}. Say it once more to check.`)
      return
    }
    s.verdict = ref?.book === prompt.book ? 'numbers' : ref ? 'other-book' : 'nothing'
    if (this.fails >= MAX_FAILS + (s.learned ? 1 : 0)) {
      this.dropUnproven()
      s.message = `Couldn’t catch ${prompt.book} after ${this.fails} tries. It’s marked to practise again.`
      this.record('missed')
      s.status = 'result'
      this.resultEnds = Date.now() + RESULT_MS + MISSED_EXTRA_MS
      this.advance = setTimeout(() => this.next(), RESULT_MS + MISSED_EXTRA_MS)
      return
    }
    const verdict = s.verdict
    this.listen(
      verdict === 'numbers' ? `Heard the book, but the numbers came out as ${s.detected}. Try once more, a little slower.`
        : verdict === 'other-book' ? `Heard ${s.detected}. Try once more and say the book name clearly.`
          : 'Didn’t catch a reference. Try once more.',
    )
    s.verdict = verdict
  }

  private record(outcome: TrainingStepResult['outcome']) {
    const s = this.state!
    s.results.push({
      book: this.prompt.book,
      ref: this.prompt.say,
      outcome,
      heard: [...this.tries, s.heard].filter(Boolean).filter((t, i, all) => all.indexOf(t) === i).join(' / ').slice(-1200),
      ...(outcome === 'learned' && s.learned ? { learned: s.learned.heard } : {}),
    })
  }

  private dropUnproven() {
    const s = this.state
    if (!s?.learned) return
    this.deps.forget(s.preacherId, s.learned.heard)
    s.learned = null
  }

  private next() {
    const s = this.state
    if (!s || !this.active) return
    clearTimeout(this.advance)
    clearTimeout(this.settle)
    s.index++
    s.attempt = 1
    s.detected = null
    s.verdict = null
    s.learned = null
    this.fails = 0
    this.tries = []
    if (s.index >= s.prompts.length) {
      s.index = s.prompts.length - 1
      this.finish('Round finished.')
      return
    }
    /* Still getting the microphone or model ready: keep saying so, and let
       the engine's own "listening" switch the round on. */
    if (s.status === 'starting') { s.heard = ''; s.live = ''; return }
    this.listen('Read the reference aloud, the way you would in a sermon.')
  }

  private finish(message: string) {
    const s = this.state!
    clearTimeout(this.settle)
    clearTimeout(this.advance)
    ++this.generation
    this.speech?.stop()
    this.speech = null
    s.status = 'finished'
    s.message = message
    s.live = ''
    if (s.results.length) {
      try {
        this.deps.save(s.preacherId, { id: s.sessionId, date: this.started, engine: s.engine, results: s.results })
      } catch (error) {
        s.message = `${message} The results could not be saved: ${error instanceof Error ? error.message : 'unknown error'}.`
      }
    }
  }
}

/** Training rounds, one small file per preacher. Words only, never audio. */
export class TrainingLog {
  private cache = new Map<string, TrainingSessionRecord[]>()
  constructor(private dir: string, private keep = 40) {}
  private file(id: string) { return path.join(this.dir, `${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`) }

  list(id: string): TrainingSessionRecord[] {
    if (!this.cache.has(id)) {
      let sessions: TrainingSessionRecord[] = []
      try {
        const data = JSON.parse(fs.readFileSync(this.file(id), 'utf8'))
        if (Array.isArray(data?.sessions)) sessions = data.sessions
      } catch (error: any) {
        if (error.code !== 'ENOENT') console.warn(`⚠️ Could not read training log for ${id}:`, error.message)
      }
      this.cache.set(id, sessions)
    }
    return structuredClone(this.cache.get(id)!)
  }

  add(id: string, record: TrainingSessionRecord) {
    const sessions = [...this.list(id).filter((s) => s.id !== record.id), record].slice(-this.keep)
    fs.mkdirSync(this.dir, { recursive: true })
    const file = this.file(id)
    fs.writeFileSync(`${file}.tmp`, JSON.stringify({ sessions }, null, 2))
    fs.renameSync(`${file}.tmp`, file)
    this.cache.set(id, sessions)
  }

  remove(id: string) {
    fs.rmSync(this.file(id), { force: true })
    this.cache.delete(id)
  }
}
