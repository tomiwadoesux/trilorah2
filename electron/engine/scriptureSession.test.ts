import { describe, it, expect, vi, afterEach } from 'vitest'
import { SpokenReferenceResolver } from './referenceResolver'
import { ScriptureSession } from './scriptureSession'

/**
 * Drives a session the way main.ts does: set the verse text after each
 * display, so auto-advance is tracking the verse actually on screen.
 */
function reading(book: string, chapter: number, verse: number, texts: Record<number, string>) {
  const shown: number[] = []
  const session = new ScriptureSession((d) => {
    shown.push(d.verseStart)
    // main.ts:686 does this synchronously once the verse text resolves, which
    // is precisely what re-arms auto-advance for the next verse.
    const next = texts[d.verseStart]
    if (next) session.setCurrentVerseText(next)
  })
  session.onReferenceDetected({ book, chapter, verse })
  return { session, shown }
}

describe('ScriptureSession — auto-advance fires once per verse', () => {
  const TEXTS = {
    21: 'being fully persuaded that god had power to do what he had promised',
    22: 'this is why it was credited to him as righteousness',
    23: 'the words it was credited to him were written not for him alone'
  }

  it('does not advance twice on the cumulative partials of one utterance', () => {
    // Deepgram re-sends the whole sentence as it grows. The tail that triggered
    // the advance therefore arrives again, longer — and the longer version can
    // carry the NEXT verse's tail too, skipping a verse in one breath. Here the
    // second partial ends with verse 22's last three words while verse 22 is
    // what just went up, so only the lockout can stop it.
    const r = reading('Romans', 4, 21, TEXTS)
    const before = r.shown.length
    r.session.processTranscript('being fully persuaded that god had power to do what he had promised')
    r.session.processTranscript(
      'being fully persuaded that god had power to do what he had promised ' +
        'this is why it was credited to him as righteousness'
    )
    expect(r.shown.length - before).toBe(1)
  })

  it('still advances on the next verse once the lockout has passed', () => {
    const r = reading('Romans', 4, 21, TEXTS)
    const before = r.shown.length
    r.session.processTranscript('to do what he had promised')
    expect(r.shown.length - before).toBe(1)
    // The lockout is wall-clock, so wind lastVerseDisplayTime back rather than
    // sleeping through it.
    r.session.lastAutoAdvanceTime -= r.session.VERSE_LOCKOUT_MS + 1
    r.session.processTranscript('credited to him as righteousness')
    expect(r.shown.length - before).toBe(2)
  })

  it('ignores a transcript entirely when not in reading mode', () => {
    const r = reading('Romans', 4, 21, TEXTS)
    r.session.exitReadingMode()
    const before = r.shown.length
    r.session.processTranscript('to do what he had promised')
    expect(r.shown.length).toBe(before)
  })
})

afterEach(() => vi.useRealTimers())

describe('ScriptureSession — explicit references replace old context', () => {
  it('does not intercept a different book as a bare verse command', () => {
    const shown: string[] = []
    const session = new ScriptureSession((d) => shown.push(`${d.book} ${d.chapter}:${d.verseStart}`))
    const resolver = new SpokenReferenceResolver((ref) => session.onReferenceDetected(ref))
    session.onReferenceDetected({ book: 'Romans', chapter: 6, verse: 1 })
    for (const text of ['Galatians chapter 6 verse 5', 'John chapter 3 verse 16', 'Acts chapter 2 verse 4', 'Matthew chapter 5 verse 3']) {
      if (!session.onCommand(text)) resolver.process(text, true)
    }
    expect(shown).toEqual(['Romans 6:1', 'Galatians 6:5', 'John 3:16', 'Acts 2:4', 'Matthew 5:3'])
  })

  it('clears the old chapter when a new book arrives on its own', () => {
    vi.useFakeTimers()
    const shown: string[] = []
    const session = new ScriptureSession((d) => shown.push(`${d.book} ${d.chapter}:${d.verseStart}`))
    session.onReferenceDetected({ book: 'Romans', chapter: 6, verse: 5 })
    session.onReferenceDetected({ book: 'Galatians' })
    expect(session.getState().chapter).toBeNull()
    session.onReferenceDetected({ book: 'Galatians', chapter: 6 })
    vi.advanceTimersByTime(session.CHAPTER_WAIT_MS)
    expect(shown).toEqual(['Romans 6:5', 'Galatians 6:1'])
  })

  it('accepts an explicit bare verse update while reading', () => {
    const shown: number[] = []
    const session = new ScriptureSession((d) => shown.push(d.verseStart))
    session.onReferenceDetected({ book: 'Romans', chapter: 6, verse: 5 })
    session.onReferenceDetected({ book: '', verse: 6 })
    expect(shown).toEqual([5, 6])
  })

  it('keeps standalone verse navigation available', () => {
    const shown: number[] = []
    const session = new ScriptureSession((d) => shown.push(d.verseStart))
    session.onReferenceDetected({ book: 'Romans', chapter: 6, verse: 1 })
    expect(session.onCommand('Verse 5.')).toBe(true)
    expect(shown).toEqual([1, 5])
  })
})
