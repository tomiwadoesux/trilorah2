/** How much nearer a passage counts for being in the chapter being preached. */
const BOOST = 0.1
const FRESH_MS = 40 * 60_000

/**
 * What the sermon is in.
 *
 * If the last verses put on the wall were Genesis 22, "he got up early and
 * saddled the donkey" is Abraham, not Balaam. Chapters the OPERATOR put live
 * count, and only those: a guess of the engine's must not become evidence
 * for its next guess. The three most recent are kept and they go stale.
 *
 * The boost only reorders candidates. It never makes the automatic path
 * more willing to speak.
 */
export class SermonContext {
  private live: { book: string; chapter: number; at: number }[] = []

  noteLive(book: string, chapter: number, now = Date.now()): void {
    this.live = [{ book, chapter, at: now }, ...this.live.filter(c => c.book !== book || c.chapter !== chapter)].slice(0, 3)
  }

  boost(book: string, chapter: number, now = Date.now()): number {
    return this.live.some(c => now - c.at <= FRESH_MS && c.book === book && Math.abs(c.chapter - chapter) <= 1) ? BOOST : 0
  }

  reset(): void { this.live = [] }
}
