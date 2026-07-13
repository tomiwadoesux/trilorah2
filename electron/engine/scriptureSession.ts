import type { VerseDisplayPayload } from '../../shared/types'

/** A resolved scripture reference arriving from the ML resolver / quote matcher. */
export interface ReferenceInput {
  book?: string | null
  chapter?: number | null
  verse?: number | null
  rangeEnd?: number | null
}

export class ScriptureSession {
  emitDisplay: (display: VerseDisplayPayload) => void
  book: string | null
  chapter: number | null
  startVerse: number | null
  endVerse: number | null
  currentVerse: number | null
  readingMode: boolean
  CHUNK_SIZE: number
  CHAPTER_WAIT_MS: number
  COMMAND_DEBOUNCE_MS: number
  VERSE_LOCKOUT_MS: number
  chapterTimer: NodeJS.Timeout | null
  lastCommandTime: number
  lastVerseDisplayTime: number
  currentVerseText: string
  matchedWordsCount: number
  verseWords: string[]

  constructor(emitDisplay: (display: VerseDisplayPayload) => void) {
    this.emitDisplay = emitDisplay
    this.book = null
    this.chapter = null
    this.startVerse = null
    this.endVerse = null
    this.currentVerse = null
    this.readingMode = false
    this.CHUNK_SIZE = 3
    this.CHAPTER_WAIT_MS = 3000
    this.COMMAND_DEBOUNCE_MS = 800
    this.VERSE_LOCKOUT_MS = 7000
    this.chapterTimer = null
    this.lastCommandTime = 0
    this.lastVerseDisplayTime = 0
    this.currentVerseText = ''
    this.matchedWordsCount = 0
    this.verseWords = []
  }

  /* ---------------- GETTERS & SETTERS ---------------- */

  getState() {
    return {
      book: this.book,
      chapter: this.chapter,
      startVerse: this.startVerse,
      endVerse: this.endVerse,
      currentVerse: this.currentVerse,
      isRange: this.startVerse !== this.endVerse,
      canAdvance: this.canAdvance(),
      canGoBack: this.canGoBack(),
      readingMode: this.readingMode
    }
  }

  // Called by main.ts after resolving DB text
  setCurrentVerseText(text: string) {
    this.currentVerseText = text.toLowerCase().replace(/[^\w\s]/g, '')
    this.verseWords = this.currentVerseText.split(/\s+/).filter((w) => w.length > 0)
    this.matchedWordsCount = 0
    console.log(
      `📝 Tracking verse text: "${this.verseWords.slice(0, 5).join(' ')}..." (${this.verseWords.length} words)`
    )
  }

  canAdvance(): boolean {
    if (!this.currentVerse) return false
    return true
  }

  canGoBack(): boolean {
    if (!this.currentVerse) return false
    return this.currentVerse > 1
  }

  /* ---------------- TRANSCRIPT PROCESSING (AUTO-ADVANCE) ---------------- */

  processTranscript(text: string) {
    if (!this.readingMode || this.verseWords.length === 0) return
    const input = text.toLowerCase().replace(/[^\w\s]/g, '')
    input.split(/\s+/).filter((w) => w.length > 0)
    const last3VerseWords = this.verseWords.slice(-3).join(' ')
    if (input.includes(last3VerseWords)) {
      console.log('✨ Auto-Advance: Matched end of verse!')
      this.advance()
      this.verseWords = []
      return
    }
  }

  /* ---------------- RESET ---------------- */

  reset() {
    this.clearTimers()
    this.book = null
    this.chapter = null
    this.startVerse = null
    this.endVerse = null
    this.currentVerse = null
    this.readingMode = false
    this.lastVerseDisplayTime = 0
    this.currentVerseText = ''
    this.matchedWordsCount = 0
  }

  clearTimers() {
    if (this.chapterTimer) {
      clearTimeout(this.chapterTimer)
      this.chapterTimer = null
    }
  }

  /**
   * Cancel the pending "default to verse 1" timer
   * Called when we detect a verse (even if skipped as duplicate)
   */
  cancelVerseTimer() {
    if (this.chapterTimer) {
      console.log('⏱️❌ Verse timer cancelled (verse was detected)')
      clearTimeout(this.chapterTimer)
      this.chapterTimer = null
    }
  }

  exitReadingMode() {
    this.readingMode = false
  }

  /* ---------------- INPUT FROM RESOLVER ---------------- */

  onReferenceDetected(ref: ReferenceInput) {
    console.log('📥 Session received:', JSON.stringify(ref))
    if (ref.book && !ref.chapter && !ref.verse) {
      console.log(
        `📚 Book-only detected: "${ref.book}" - waiting for chapter/verse`
      )
      this.book = ref.book
      return
    }
    if (!ref.chapter && !this.chapter) {
      console.log(`⏭️ Ignored: No chapter context established`)
      return
    }
    const isBareUpdate = !ref.book && ref.verse
    if (this.readingMode && isBareUpdate) {
      console.log(`🔒 Reading Mode: Ignored bare verse ${ref.verse} update`)
      return
    }
    if (ref.book && ref.book !== this.book) {
      this.reset()
      this.book = ref.book
    }
    if (ref.chapter && ref.chapter !== this.chapter) {
      this.chapter = ref.chapter
      this.startVerse = null
      this.endVerse = null
      this.currentVerse = null
      this.exitReadingMode()
      if (ref.verse) {
        console.log(`⚡ Fast path: ${this.book} ${ref.chapter}:${ref.verse}`)
      } else {
        this.waitForVerseOrDefault()
        return
      }
    }
    if (ref.verse && ref.rangeEnd && ref.rangeEnd > ref.verse) {
      this.clearTimers()
      this.startVerse = ref.verse
      this.endVerse = ref.rangeEnd
      this.currentVerse = ref.verse
      this.emitRange(ref.verse, ref.rangeEnd)
      return
    }
    if (ref.verse) {
      this.clearTimers()
      this.startVerse = ref.verse
      this.endVerse = ref.verse
      this.currentVerse = ref.verse
      this.emitSingleVerse(ref.verse)
    }
  }

  /* ---------------- CHAPTER DEFAULT (VERSE 1) ---------------- */

  waitForVerseOrDefault() {
    this.clearTimers()
    this.chapterTimer = setTimeout(() => {
      if (!this.book || !this.chapter) return
      console.log(
        `⏱️ No verse after ${this.CHAPTER_WAIT_MS}ms - defaulting to verse 1`
      )
      this.startVerse = 1
      this.endVerse = 1
      this.currentVerse = 1
      this.emitSingleVerse(1)
    }, this.CHAPTER_WAIT_MS)
    console.log(
      `📑 Chapter detected: ${this.book} ${this.chapter} (waiting ${this.CHAPTER_WAIT_MS}ms for verse...)`
    )
  }

  /* ---------------- COMMANDS FROM ASR ---------------- */

  onCommand(text: string): boolean {
    const t = text.toLowerCase()
    const now = Date.now()
    if (now - this.lastCommandTime < this.COMMAND_DEBOUNCE_MS) {
      return false
    }
    if (this.isNextCommand(t)) {
      this.lastCommandTime = now
      this.exitReadingMode()
      this.advance()
      return true
    }
    if (this.isPreviousCommand(t)) {
      this.lastCommandTime = now
      this.exitReadingMode()
      this.goBack()
      return true
    }
    const verseMatch = t.match(/\bverse\s+(\d+)\b/)
    if (verseMatch) {
      this.lastCommandTime = now
      if (this.book && this.chapter) {
        const verse = parseInt(verseMatch[1], 10)
        this.exitReadingMode()
        this.jumpToVerse(verse)
        return true
      }
    }
    return false
  }

  isNextCommand(text: string): boolean {
    return [
      'next verse',
      'next',
      'continue',
      'go on',
      'keep going',
      'move on'
    ].some((cmd) => text.includes(cmd))
  }

  isPreviousCommand(text: string): boolean {
    return [
      'previous verse',
      'previous',
      'go back',
      'back',
      'last verse',
      'before'
    ].some((cmd) => text.includes(cmd))
  }

  /* ---------------- CORRECTIONS (added post-recovery) ---------------- */

  /**
   * Preacher correction ("I said verse thirty-four"): a HIGH-PRIORITY
   * interrupt. Deliberately bypasses COMMAND_DEBOUNCE_MS and any lockout —
   * corrections arrive seconds after the wrong verse displays, exactly when
   * debounce windows would swallow them.
   */
  applyVerseCorrection(verse: number): boolean {
    if (!this.book || !this.chapter) return false
    console.log(`✏️ Correction applied: ${this.book} ${this.chapter}:${verse}`)
    this.clearTimers()
    this.exitReadingMode()
    this.startVerse = verse
    this.endVerse = verse
    this.currentVerse = verse
    this.emitSingleVerse(verse)
    return true
  }

  /** Chapter correction ("I said chapter five") — keeps the book, resets to the corrected chapter. */
  applyChapterCorrection(chapter: number): boolean {
    if (!this.book) return false
    console.log(`✏️ Correction applied: ${this.book} chapter ${chapter}`)
    this.clearTimers()
    this.exitReadingMode()
    this.chapter = chapter
    this.startVerse = 1
    this.endVerse = 1
    this.currentVerse = 1
    this.emitSingleVerse(1)
    return true
  }

  /* ---------------- ADVANCE/BACK LOGIC ---------------- */

  advance() {
    if (!this.book || !this.chapter || this.currentVerse === null) return
    this.currentVerse += 1
    this.startVerse = this.currentVerse
    this.endVerse = this.currentVerse
    console.log(`⏭️ Advancing to verse ${this.currentVerse}`)
    this.emitSingleVerse(this.currentVerse)
  }

  goBack() {
    if (!this.book || !this.chapter || this.currentVerse === null) return
    if (this.currentVerse <= 1) return
    this.currentVerse -= 1
    this.startVerse = this.currentVerse
    this.endVerse = this.currentVerse
    this.emitSingleVerse(this.currentVerse)
  }

  jumpToVerse(verse: number) {
    if (!this.book || !this.chapter) return
    this.clearTimers()
    this.startVerse = verse
    this.endVerse = verse
    this.currentVerse = verse
    this.emitSingleVerse(verse)
  }

  /* ---------------- DISPLAY ---------------- */

  emitSingleVerse(verse: number) {
    if (!this.book || !this.chapter) return
    this.readingMode = true
    this.lastVerseDisplayTime = Date.now()
    console.log(`📖 Preview: ${this.book} ${this.chapter}:${verse}`)
    this.emitDisplay({
      book: this.book,
      chapter: this.chapter,
      verseStart: verse,
      verseEnd: verse,
      rangeEnd: this.endVerse ?? undefined,
      chunkSize: this.CHUNK_SIZE,
      isPreview: true
    })
  }

  emitRange(start: number, end: number) {
    if (!this.book || !this.chapter) return
    this.readingMode = true
    this.lastVerseDisplayTime = Date.now()
    console.log(`📖 Preview: ${this.book} ${this.chapter}:${start}-${end}`)
    this.emitDisplay({
      book: this.book,
      chapter: this.chapter,
      verseStart: start,
      verseEnd: end,
      rangeEnd: this.endVerse ?? undefined,
      chunkSize: this.CHUNK_SIZE,
      isPreview: true
    })
  }
}
