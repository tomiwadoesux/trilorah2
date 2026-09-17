/**
 * Message tokens (BUILD-MAP 2.17).
 *
 * The alerts in alerts.ts are plain strings, but the messages a church
 * actually keeps around are half-written: "Parent of child {child} to the
 * nursery", "Service starts in {timer:countdown}". The operator saves the
 * sentence once and fills the hole at trigger time, the same way ProPresenter
 * Messages work. This module is only the text layer — parsing the holes,
 * filling them, and telling the Live UI whether anything is still missing.
 *
 * Two decisions worth remembering. First, anything that does not parse as a
 * token is left verbatim, so "we meet at {the church}" survives a round trip
 * untouched instead of turning into an error the operator has to debug at
 * 10:29 on a Sunday. Second, fill is single pass: a value the operator typed
 * is never scanned for tokens of its own, because operator input reaching the
 * projector through a second expansion pass is an injection vector, and a
 * countdown that quietly redraws itself from a name field is worse than a
 * literal brace on screen.
 *
 * Pure: no Electron, no fs, clock injected via TokenContext.now.
 */

export interface TokenContext {
  /** Wall clock, injected so tests are deterministic. */
  now: number
  /** Timer id or name -> already-formatted display string, e.g. { countdown: '4:07' }. */
  timers?: Record<string, string>
  /** Operator-filled values for custom tokens, keyed by token name. */
  values?: Record<string, string>
  /** Church/venue constants: name, room, etc. */
  constants?: Record<string, string>
}

export interface TokenSlot {
  name: string
  kind: 'clock' | 'timer' | 'custom'
  /** Exactly the source text this slot came from, braces included. */
  raw: string
  /** For {timer:x}, the part after the colon. Undefined otherwise. */
  arg?: string
}

/**
 * One pass over the template. `{{` is consumed as an escaped literal brace so
 * it can never open a token, everything else is matched against the token
 * shape, and a `{` that fails to match is emitted as ordinary text.
 */
const TOKEN_RE = /\{\{|\{([a-zA-Z0-9_-]+)(?::([a-zA-Z0-9_-]+))?\}/g

/** Character used in place of `{{` in the rendered output. */
const LITERAL_BRACE = '{'

/**
 * Every token occurrence, in source order. Duplicates are returned once each
 * — the caller decides whether to dedupe. The operator UI wants one input per
 * distinct name, but a highlighter wants every occurrence, and only the caller
 * knows which it is.
 */
export function parseTokens(template: string): TokenSlot[] {
  const slots: TokenSlot[] = []
  for (const m of matches(template)) {
    if (m.slot) slots.push(m.slot)
  }
  return slots
}

/**
 * Render the template. Unresolved tokens are left exactly as written rather
 * than blanked: a projector showing "Service starts in {timer:countdown}" is
 * embarrassing but self-explanatory, whereas "Service starts in " reads as a
 * finished sentence and nobody notices the timer never got wired up.
 */
export function fillTokens(template: string, ctx: TokenContext): string {
  let out = ''
  for (const m of matches(template)) {
    out += m.slot ? resolve(m.slot, ctx) ?? m.slot.raw : m.text
  }
  return out
}

/** True when at least one token would render as itself — ask the operator first. */
export function hasUnfilledTokens(template: string, ctx: TokenContext): boolean {
  return parseTokens(template).some((slot) => resolve(slot, ctx) === null)
}

/** Human label for the operator UI, e.g. "Timer: countdown" or "Child". */
export function describeToken(slot: TokenSlot): string {
  if (slot.kind === 'clock') return 'Current time'
  if (slot.kind === 'timer') return `Timer: ${slot.arg ?? slot.name}`
  return humanize(slot.name)
}

/**
 * Resolved text, or null when the slot has no value. Null is deliberately
 * distinct from '' so an operator can legitimately fill a token with an empty
 * string without the UI insisting it is still missing.
 */
function resolve(slot: TokenSlot, ctx: TokenContext): string | null {
  if (slot.kind === 'clock') return formatClock(ctx.now)
  if (slot.kind === 'timer') return ctx.timers?.[slot.arg ?? slot.name] ?? null
  return ctx.values?.[slot.name] ?? ctx.constants?.[slot.name] ?? null
}

/** '10:32 AM' — local, no seconds, because the screen only needs the minute. */
export function formatClock(now: number): string {
  const d = new Date(now)
  const h24 = d.getHours()
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${h12}:${mm} ${h24 < 12 ? 'AM' : 'PM'}`
}

/** 'child_name' / 'child-name' -> 'Child name'. */
function humanize(name: string): string {
  const words = name.replace(/[_-]+/g, ' ').trim()
  return words ? words[0].toUpperCase() + words.slice(1) : name
}

interface Piece {
  /** Literal text to emit as-is (empty when this piece is a token). */
  text: string
  /** The token, when this piece is one. */
  slot?: TokenSlot
}

/**
 * Split the template into literal text and token slots. Shared by parse and
 * fill so the two can never disagree about what counts as a token — the bug
 * where the UI prompts for a hole the renderer does not fill is the one that
 * would actually hurt on stage.
 */
function* matches(template: string): Generator<Piece> {
  TOKEN_RE.lastIndex = 0
  let last = 0
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(template)) !== null) {
    if (m.index > last) yield { text: template.slice(last, m.index) }
    last = m.index + m[0].length
    if (m[0] === '{{') {
      yield { text: LITERAL_BRACE }
      continue
    }
    const name = m[1]
    const arg = m[2]
    const kind: TokenSlot['kind'] = arg ? 'timer' : name === 'clock' ? 'clock' : 'custom'
    // Only `timer` takes an argument; {foo:bar} is not a token we understand,
    // so it goes through as text rather than becoming a silent mystery slot.
    if (arg && name !== 'timer') {
      yield { text: m[0] }
      continue
    }
    yield { text: '', slot: arg ? { name, kind, raw: m[0], arg } : { name, kind, raw: m[0] } }
  }
  if (last < template.length) yield { text: template.slice(last) }
}
