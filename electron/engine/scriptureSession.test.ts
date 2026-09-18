import { describe, it, expect } from 'vitest'
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
