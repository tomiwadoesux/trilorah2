import { useEffect, useRef, useState, type ReactNode } from 'react'

/*
 * The stage clock's face — the same screen the main app's HDMI timer output
 * draws (src/output.css .role-timer), sized in container units so the exact
 * same face is the control window's preview and the full-screen display.
 *
 * Name top-left, room clock top-right, one big number in the phase colour
 * with its glow, "OF 45:00" under it, overtime and extra-time badges — and,
 * when Trilorah on the network hears the preacher name a scripture, the
 * reference on one line above the bottom bar, gone again a few seconds
 * later (shared/stageLink.ts STAGE_REFERENCE_HOLD_MS).
 *
 * In the control window the number is also the input: click it and type,
 * microwave style (digits shift in from the right). Read-only while the
 * clock runs — the number showing then is the truth on the preacher's
 * screen, and a stray keypress must not be able to move it.
 */

const TIMER_FONT = "'Orbitron', 'Share Tech Mono', monospace"
const SCREEN_MONO = "'Share Tech Mono', 'Orbitron', monospace"
const RED = '#ef4444'

export function Face({
  name,
  display,
  target,
  color,
  over,
  extraLabel,
  idle,
  stateLabel,
  reference,
  footerRight,
  editing = false,
  onBeginEdit,
  onKey,
  onCommit,
  neighbors,
  onStep,
  className,
  style,
}: {
  name: string
  /** The big number, already formatted. */
  display: string
  /** Length of the phase being counted ("45:00"), or null. */
  target: string | null
  color: string
  over: boolean
  extraLabel: string | null
  /** No timer yet: the caption reads as standby. */
  idle: boolean
  stateLabel: string | null
  /** A scripture the preacher just named, or null. */
  reference: string | null
  footerRight?: ReactNode
  editing?: boolean
  onBeginEdit?: () => void
  onKey?: (e: React.KeyboardEvent) => void
  onCommit?: () => void
  /** While editing: the values one step up and down, drawn like a picker wheel. */
  neighbors?: { above: string; below: string } | null
  /** While editing: step the value (wheel, or the drawn neighbours). */
  onStep?: (delta: 1 | -1) => void
  className?: string
  style?: React.CSSProperties
}) {
  const digitsRef = useRef<HTMLDivElement | null>(null)
  const clock = useRoomClock()
  const editable = !!onBeginEdit

  useEffect(() => {
    if (editing) digitsRef.current?.focus()
  }, [editing])

  return (
    <div
      className={className}
      style={{
        containerType: 'size',
        display: 'flex',
        overflow: 'hidden',
        borderRadius: 6,
        background: '#080808',
        color: '#fff',
        userSelect: 'none',
        boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.07)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', minWidth: 0, flex: 1, flexDirection: 'column', justifyContent: 'space-between', padding: '5cqh 6cqw' }}>
        {/* Top bar: the timer's name, and the room clock. */}
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: SCREEN_MONO, fontWeight: 700, textTransform: 'uppercase',
              fontSize: 'max(9px, 2.6cqw)', letterSpacing: '0.15em', color: 'rgb(255 255 255 / 0.7)',
            }}
          >
            {name}
          </span>
          <span
            style={{
              flexShrink: 0, fontFamily: SCREEN_MONO, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
              fontSize: 'max(10px, 3cqw)', letterSpacing: '0.08em', color: 'rgb(255 255 255 / 0.9)',
            }}
          >
            {clock}
          </span>
        </div>

        {/* Centre: the number. */}
        <div style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          {over && target && (
            <div
              style={{
                fontFamily: SCREEN_MONO, fontWeight: 700, textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums',
                fontSize: 'max(9px, 3.8cqw)', letterSpacing: '0.1em', color: 'rgb(255 255 255 / 0.45)', marginBottom: '1.5cqh',
              }}
            >
              target: {target}
            </div>
          )}
          <div
            ref={digitsRef}
            role={editable ? 'group' : undefined}
            tabIndex={editable ? 0 : undefined}
            aria-label={editing ? 'Timer duration — type digits to set' : `Timer ${display}`}
            onKeyDown={onKey}
            onClick={(e) => {
              if (!editable) return
              e.stopPropagation()
              if (!editing) onBeginEdit?.()
            }}
            onBlur={() => {
              if (editing) onCommit?.()
            }}
            onWheel={(e) => {
              /* The clock as a wheel: scroll up for more time, down for less. */
              if (editing && onStep) onStep(e.deltaY < 0 ? 1 : -1)
            }}
            style={{ cursor: editable ? (editing ? 'text' : 'pointer') : 'default', padding: '0 1.5cqw', outline: 'none' }}
          >
            {/* Editing wears a different face: the number goes ghost-white
                with a text blinker — "you can type now" — and the values one
                minute either side sit above and below like a picker wheel,
                each a click or a scroll away. */}
            {editing && neighbors && (
              <span
                onMouseDown={(e) => {
                  e.preventDefault() // keep focus on the digits
                  onStep?.(1)
                }}
                style={{
                  display: 'block', fontFamily: TIMER_FONT, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
                  fontSize: 'min(6cqw, 11cqh)', lineHeight: 1.1, letterSpacing: '0.04em',
                  color: 'rgb(255 255 255 / 0.22)', cursor: 'pointer', userSelect: 'none',
                }}
              >
                {neighbors.above}
              </span>
            )}
            <span
              style={{
                display: 'block', fontFamily: TIMER_FONT, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
                fontSize: 'min(18cqw, 34cqh)', lineHeight: 0.9, letterSpacing: '0.04em',
                color: editing ? 'rgb(255 255 255 / 0.15)' : over ? RED : color,
                textShadow: editing ? 'none' : over ? `0 0 1.8cqw ${RED}99` : `0 0 1.6cqw ${color}60`,
                transition: 'color 400ms ease, text-shadow 400ms ease',
              }}
            >
              {display}
              {editing && (
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block', width: '0.06em', height: '0.78em',
                    marginLeft: '0.06em', verticalAlign: 'baseline',
                    background: 'rgb(255 255 255 / 0.85)',
                    animation: 'tt-blink 1s steps(1) infinite',
                  }}
                />
              )}
            </span>
            {editing && neighbors && (
              <span
                onMouseDown={(e) => {
                  e.preventDefault()
                  onStep?.(-1)
                }}
                style={{
                  display: 'block', fontFamily: TIMER_FONT, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
                  fontSize: 'min(6cqw, 11cqh)', lineHeight: 1.1, letterSpacing: '0.04em',
                  color: 'rgb(255 255 255 / 0.22)', cursor: 'pointer', userSelect: 'none',
                }}
              >
                {neighbors.below}
              </span>
            )}
          </div>
          {over ? (
            <div
              style={{
                fontWeight: 800, textTransform: 'uppercase', fontSize: 'max(8px, 2.2cqw)', letterSpacing: '0.25em',
                color: RED, background: 'rgb(239 68 68 / 0.15)', border: '1px solid rgb(239 68 68 / 0.4)',
                borderRadius: 999, padding: '0.6cqh 2.5cqw', marginTop: '2.5cqh',
              }}
            >
              overtime exceeded
            </div>
          ) : idle ? (
            <div
              style={{
                fontFamily: SCREEN_MONO, fontWeight: 700, textTransform: 'uppercase',
                fontSize: 'max(8px, 2.5cqw)', letterSpacing: '0.25em', color: 'rgb(255 255 255 / 0.45)', marginTop: '2cqh',
              }}
            >
              standby · service ready
            </div>
          ) : (
            target && (
              <div
                style={{
                  fontFamily: SCREEN_MONO, fontWeight: 700, textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums',
                  fontSize: 'max(8px, 2.5cqw)', letterSpacing: '0.1em', color: 'rgb(255 255 255 / 0.45)', marginTop: '2cqh',
                }}
              >
                of {target}
              </div>
            )
          )}
          {extraLabel && (
            <div
              style={{
                fontWeight: 700, textTransform: 'uppercase', fontSize: 'max(8px, 2cqw)', letterSpacing: '0.15em',
                color: '#34d399', background: 'rgb(16 185 129 / 0.15)', border: '1px solid rgb(16 185 129 / 0.35)',
                borderRadius: 999, padding: '0.4cqh 1.8cqw', marginTop: '2cqh',
              }}
            >
              {extraLabel}
            </div>
          )}
        </div>

        {/* The scripture the preacher just named, while it lasts. Kept in the
            flow above the bottom bar so it never covers the number. */}
        <div
          aria-live="polite"
          style={{
            width: '100%', textAlign: 'center', minHeight: 'max(12px, 4.4cqw)',
            fontFamily: SCREEN_MONO, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            fontSize: 'max(11px, 3.6cqw)', letterSpacing: '0.12em', textTransform: 'uppercase',
            color: '#f5d97b', textShadow: '0 0 1.2cqw rgb(245 217 123 / 0.45)',
            opacity: reference ? 1 : 0,
            transition: 'opacity 500ms ease',
          }}
        >
          {reference ?? ' '}
        </div>

        {/* Bottom bar: what this is, and what the clock is doing. */}
        <div
          style={{
            display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 'max(8px, 1.8cqw)', color: 'rgb(255 255 255 / 0.4)',
          }}
        >
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 'max(8px, 2cqw)', color: 'rgb(255 255 255 / 0.65)' }}>
            STAGE TIMER
          </span>
          {footerRight ??
            (stateLabel && (
              <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em' }}>{stateLabel}</span>
            ))}
        </div>
      </div>
    </div>
  )
}

/** The room clock the screen shows top-right, ticking. */
function useRoomClock(): string {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
