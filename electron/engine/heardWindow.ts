/**
 * The last words spoken, with the time each arrived.
 *
 * "Find scripture" asks what was JUST said. The transcript on screen keeps
 * its last lines for as long as nobody speaks, so a press minutes later would
 * search the same sentence and return the same passages. Here words expire.
 */
export class HeardWindow {
  private finals: { text: string; at: number }[] = []
  private partial: { text: string; at: number } | null = null

  note(text: string, isFinal: boolean, now = Date.now()): void {
    const said = text.trim()
    if (!said) return
    if (!isFinal) { this.partial = { text: said, at: now }; return }
    this.partial = null
    this.finals = [...this.finals, { text: said, at: now }].slice(-12)
  }

  /** Up to `maxWords` of what was said within `maxAgeMs`, oldest first. */
  recent(now = Date.now(), maxAgeMs = 45_000, maxWords = 25): string {
    const fresh = this.finals.filter(line => now - line.at <= maxAgeMs).map(line => line.text)
    if (this.partial && now - this.partial.at <= maxAgeMs) fresh.push(this.partial.text)
    return fresh.join(' ').split(/\s+/).filter(Boolean).slice(-maxWords).join(' ')
  }

  /** Search the latest utterance; only carry an immediately preceding fragment.
   * A topic from half a minute ago must not replace what the operator just heard. */
  forSearch(now = Date.now()): string {
    const finals = this.finals.filter(line => now - line.at <= 45_000)
    const partial = this.partial && now - this.partial.at <= 45_000 ? this.partial : null
    const latest = partial ?? finals.at(-1)
    if (!latest) return ''
    const previous = partial ? finals.at(-1) : finals.at(-2)
    const carry = latest.text.split(/\s+/).length < 8 && previous && latest.at - previous.at <= 6_000
    return (carry ? `${previous.text} ${latest.text}` : latest.text).split(/\s+/).slice(-60).join(' ')
  }

  reset(): void { this.finals = []; this.partial = null }
}
