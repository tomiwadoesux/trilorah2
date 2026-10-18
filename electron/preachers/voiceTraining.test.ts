import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VoiceTraining, TrainingLog, inferBookAlias, detectIn } from './voiceTraining'
import { applyBookAliases } from './teaching'
import { promptFor, bookStandings, nextTrainingBooks, TRAINING_ORDER, type BookAlias, type TrainingSessionRecord } from '../../shared/preacherLearning'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function setup({ ready = true } = {}) {
  let text!: (s: string, final: boolean) => void
  let error!: (e: Error) => void
  let report!: (s: string) => void
  let aliases: BookAlias[] = []
  const saved: TrainingSessionRecord[] = []
  const speech = { start: vi.fn((onText, onError, _device, status) => { text = onText; error = onError; report = status; if (ready) status('Listening...') }), stop: vi.fn() }
  const deps = {
    speech: vi.fn((engine) => ({ engine, speech })),
    transform: (_pid: string, s: string, extra: BookAlias[] = []) => applyBookAliases(s, [...aliases, ...extra]),
    learn: vi.fn((_pid: string, a: { heard: string; means: string }) => { aliases = [{ ...a, source: 'learned', hits: 0 }, ...aliases] }),
    forget: vi.fn((_pid: string, heard: string) => { aliases = aliases.filter((a) => a.heard !== heard) }),
    save: vi.fn((_pid: string, r: TrainingSessionRecord) => { saved.push(r) }),
  }
  const training = new VoiceTraining(deps)
  return {
    training, speech, deps, saved,
    aliases: () => aliases,
    say: (s: string) => text(s, true),
    hearing: (s: string) => text(s, false),
    fail: (s: string) => error(new Error(s)),
    status: (s: string) => report(s),
    settle: () => vi.advanceTimersByTime(2300),
  }
}

describe('inferring a misheard book name', () => {
  const resolveWith = (text: string, extra: BookAlias[]) => detectIn(applyBookAliases(text, extra))
  const alone = (phrase: string) => detectIn(`${phrase} chapter one verse one`)?.book ?? null

  it('takes the words before the numbers, without the lead-in', () => {
    const prompt = promptFor('Philippians')!
    expect(inferBookAlias('turn to fill a pians chapter four verse thirteen', prompt, resolveWith, alone))
      .toEqual({ heard: 'fill a pians', means: 'Philippians' })
  })

  it('never turns a real book into another one', () => {
    const prompt = promptFor('1 John')!
    expect(inferBookAlias('john four eight', prompt, resolveWith, alone)).toBeNull()
  })

  it('needs numbers to anchor the phrase', () => {
    expect(inferBookAlias('fill a pians', promptFor('Philippians')!, resolveWith, alone)).toBeNull()
  })
})

describe('voice training', () => {
  it('counts a reference caught first time and moves on', () => {
    const { training, say } = setup()
    training.start('p1', 'deepgram', ['Philippians', 'Romans'])
    say('philippians four thirteen')
    expect(training.snapshot()).toMatchObject({ status: 'result', verdict: 'caught', detected: 'Philippians 4:13' })
    vi.advanceTimersByTime(2000)
    expect(training.snapshot()).toMatchObject({ status: 'listening', index: 1, attempt: 1 })
    expect(training.snapshot()!.results[0]).toMatchObject({ book: 'Philippians', outcome: 'caught' })
  })

  it('learns a misheard book name and proves it on the retry', () => {
    const { training, say, settle, deps, aliases } = setup()
    training.start('p1', 'deepgram', ['Philippians'])
    say('fill a pians chapter four verse thirteen')
    settle()
    expect(deps.learn).toHaveBeenCalledWith('p1', { heard: 'fill a pians', means: 'Philippians' })
    expect(training.snapshot()).toMatchObject({ status: 'listening', verdict: 'learned', attempt: 2, learned: { heard: 'fill a pians' } })
    say('fill a pians chapter four verse thirteen')
    expect(training.snapshot()!.results[0]).toMatchObject({ outcome: 'learned', learned: 'fill a pians' })
    vi.advanceTimersByTime(2000)
    expect(training.snapshot()!.status).toBe('finished')
    expect(aliases().map((a) => a.heard)).toEqual(['fill a pians'])
  })

  it('waits for a reference split across two pieces of speech', () => {
    const { training, say } = setup()
    training.start('p1', 'deepgram', ['Philippians'])
    say('philippians chapter four')
    vi.advanceTimersByTime(1000)
    say('verse thirteen')
    expect(training.snapshot()!.results[0]?.outcome).toBe('caught')
  })

  it('says when only the numbers were wrong, and saves no fix', () => {
    const { training, say, settle, deps } = setup()
    training.start('p1', 'deepgram', ['Philippians'])
    say('philippians four thirty')
    settle()
    expect(training.snapshot()).toMatchObject({ verdict: 'numbers', detected: 'Philippians 4:30', status: 'listening' })
    expect(deps.learn).not.toHaveBeenCalled()
  })

  it('marks a book missed after three failed tries', () => {
    const { training, say, settle } = setup()
    training.start('p1', 'deepgram', ['1 John', 'Romans'])
    for (let i = 0; i < 3; i++) { say('john four eight'); settle() }
    expect(training.snapshot()).toMatchObject({ status: 'result', verdict: 'other-book' })
    expect(training.snapshot()!.results[0]).toMatchObject({ book: '1 John', outcome: 'missed' })
    vi.advanceTimersByTime(3000)
    expect(training.snapshot()).toMatchObject({ index: 1, status: 'listening' })
  })

  it('reads one-chapter books either way', () => {
    const { training, say } = setup()
    training.start('p1', 'deepgram', ['Jude'])
    say('jude twenty four')
    expect(training.snapshot()!.results[0]?.outcome).toBe('caught')
  })

  it('undo takes the fix back out', () => {
    const { training, say, settle, deps, aliases } = setup()
    training.start('p1', 'deepgram', ['Philippians'])
    say('fill a pians chapter four verse thirteen')
    settle()
    training.undo()
    expect(deps.forget).toHaveBeenCalledWith('p1', 'fill a pians')
    expect(aliases()).toEqual([])
    expect(training.snapshot()!.learned).toBeNull()
  })

  it('undoing a proven fix during the result marks the book to practise again', () => {
    const { training, say, settle, aliases } = setup()
    training.start('p1', 'deepgram', ['Philippians', 'Romans'])
    say('fill a pians chapter four verse thirteen')
    settle()
    say('fill a pians chapter four verse thirteen')
    expect(training.snapshot()).toMatchObject({ status: 'result', verdict: 'learned' })
    vi.advanceTimersByTime(1000)
    training.undo()
    expect(aliases()).toEqual([])
    expect(training.snapshot()).toMatchObject({ status: 'result', learned: null, verdict: null })
    expect(training.snapshot()!.results[0]).toMatchObject({ book: 'Philippians', outcome: 'missed' })
    expect(training.snapshot()!.results[0].learned).toBeUndefined()
    // A missed result stays up a little longer, counted from when it first showed.
    vi.advanceTimersByTime(1000)
    expect(training.snapshot()).toMatchObject({ status: 'result', index: 0 })
    vi.advanceTimersByTime(400)
    expect(training.snapshot()).toMatchObject({ status: 'listening', index: 1 })
  })

  it('skipping before the microphone is ready keeps the round getting ready', () => {
    const { training, status, say } = setup({ ready: false })
    training.start('p1', 'whisper-local', ['Philippians', 'Romans'])
    status('Downloading the speech model… 42%')
    training.skip()
    expect(training.snapshot()).toMatchObject({ status: 'starting', index: 1, message: 'Downloading the speech model… 42%' })
    expect(training.snapshot()!.results[0]).toMatchObject({ book: 'Philippians', outcome: 'skipped' })
    status('Downloading the speech model… 60%')
    expect(training.snapshot()).toMatchObject({ status: 'starting', message: 'Downloading the speech model… 60%' })
    status('Listening...')
    expect(training.snapshot()).toMatchObject({ status: 'listening', index: 1 })
    say('romans eight twenty eight')
    expect(training.snapshot()!.results[1]).toMatchObject({ book: 'Romans', outcome: 'caught' })
  })

  it('skipping the last reference before the microphone is ready ends the round', () => {
    const { training } = setup({ ready: false })
    training.start('p1', 'whisper-local', ['Philippians'])
    training.skip()
    expect(training.snapshot()).toMatchObject({ status: 'finished', index: 0 })
  })

  it('stopping early keeps finished results, drops an unproven fix and releases the mic', () => {
    const { training, say, settle, saved, speech, aliases } = setup()
    training.start('p1', 'deepgram', ['Romans', 'Philippians'])
    say('romans eight twenty eight')
    vi.advanceTimersByTime(2000)
    say('fill a pians chapter four verse thirteen')
    settle()
    training.stop()
    expect(aliases()).toEqual([])
    expect(speech.stop).toHaveBeenCalledOnce()
    expect(saved).toHaveLength(1)
    expect(saved[0].results.map((r) => r.outcome)).toEqual(['caught'])
  })

  it('shows interim words, refuses overlap and surfaces mic errors', () => {
    const { training, hearing, fail } = setup()
    training.start('p1', 'whisper-local', ['Romans'])
    hearing('romans eight')
    expect(training.snapshot()!.live).toBe('romans eight')
    expect(() => training.start('p2', 'deepgram', ['Romans'])).toThrow('Finish')
    fail('Microphone permission denied')
    expect(training.snapshot()).toMatchObject({ status: 'error', message: 'Microphone permission denied' })
  })
})

describe('where each book stands', () => {
  it('lets the newest round win, and fixes and services fill the gaps', () => {
    const sessions: TrainingSessionRecord[] = [
      { id: 'a', date: '2026-10-01', engine: 'deepgram', results: [{ book: 'Philippians', ref: 'Philippians 4:13', outcome: 'missed', heard: '' }] },
      { id: 'b', date: '2026-10-08', engine: 'deepgram', results: [
        { book: 'Philippians', ref: 'Philippians 4:13', outcome: 'learned', heard: '', learned: 'fill a pians' },
        { book: 'Habakkuk', ref: 'Habakkuk 2:2', outcome: 'missed', heard: '' },
      ] },
    ]
    const s = bookStandings(sessions, [{ heard: 'rawmeans', means: 'Romans', source: 'taught', hits: 0 }], { John: 4 })
    expect(s.Philippians.state).toBe('learned')
    expect(s.Habakkuk.state).toBe('trouble')
    expect(s.Romans).toMatchObject({ state: 'learned', fixes: ['rawmeans'] })
    expect(s.John).toMatchObject({ state: 'caught', quoted: 4 })
    expect(s.Genesis.state).toBe('unheard')
  })

  it('trains trouble first, then books never heard, hardest names first', () => {
    const s = bookStandings([{ id: 'a', date: '2026-10-01', engine: 'deepgram', results: [
      { book: 'Philippians', ref: '', outcome: 'caught', heard: '' },
      { book: 'Jude', ref: '', outcome: 'missed', heard: '' },
    ] }], [], {})
    const next = nextTrainingBooks(s)
    expect(next[0]).toBe('Jude')
    expect(next).not.toContain('Philippians')
    expect(next.slice(1, 3)).toEqual(TRAINING_ORDER.slice(1, 3))
  })
})

describe('training log', () => {
  it('keeps the newest rounds on disk', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-log-'))
    const log = new TrainingLog(dir, 2)
    for (const id of ['a', 'b', 'c']) log.add('p1', { id, date: '2026-10-01', engine: 'deepgram', results: [] })
    expect(new TrainingLog(dir).list('p1').map((s) => s.id)).toEqual(['b', 'c'])
    log.remove('p1')
    expect(log.list('p1')).toEqual([])
  })
})
