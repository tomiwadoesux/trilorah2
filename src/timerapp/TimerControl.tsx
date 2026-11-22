import { useEffect, useRef, useState } from 'react'
import { formatTimerDisplay } from '../../shared/timerDisplay'
import { Face } from './Face'
import { digitsToSeconds, popDigit, pushDigit, secondsToDigits } from './digits'
import { faceState, useStageReference, useTimers } from './useTimers'
import type { DisplayInfo, LinkState } from './types'

/*
 * The control window: the dashboard's Service Timers panel, standing alone.
 *
 * Face up top (click the number, type microwave-style), transport under it,
 * the extra-time grants, then the two decisions this app exists for — which
 * screen the face shows on, and whether the scriptures the preacher names
 * (relayed by Trilorah on this network) appear there.
 */

const DEFAULT_DURATION_SEC = 45 * 60
const EXTRA_MINUTES_OPTIONS = [3, 5, 7]

export function TimerControl() {
  const api = window.timerApi
  const { timers, activeTimer, takenAt } = useTimers()
  const reference = useStageReference()

  const [draft, setDraft] = useState(() => secondsToDigits(DEFAULT_DURATION_SEC))
  const [editing, setEditing] = useState(false)
  const beforeEdit = useRef(draft)
  const [name, setName] = useState('Sermon')
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [screenOpen, setScreenOpen] = useState(false)
  const [chosenDisplay, setChosenDisplay] = useState<number | null>(null)
  const [link, setLink] = useState<LinkState>({ connected: false, name: '' })
  const [showVerses, setShowVerses] = useState(true)
  const [lastHeard, setLastHeard] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2500)
  }

  /* Last week's duration and name, back on the face. */
  useEffect(() => {
    if (!api) return
    void api.getSettings().then((s) => {
      if (s.durationSec && s.durationSec > 0) setDraft(secondsToDigits(s.durationSec))
      if (s.timerName) setName(s.timerName)
      setShowVerses(s.showVerses !== false)
      if (typeof s.displayId === 'number') setChosenDisplay(s.displayId)
    }).catch(() => undefined)
  }, [api])

  useEffect(() => {
    if (!api) return
    void api.listDisplays().then(setDisplays).catch(() => undefined)
    void api.screenState().then((s) => setScreenOpen(s.open)).catch(() => undefined)
    void api.linkState().then(setLink).catch(() => undefined)
    const offs = [
      api.onDisplays(setDisplays),
      api.onScreenState((s) => setScreenOpen(s.open)),
      api.onLink(setLink),
      api.onStageReference(({ ref }) => setLastHeard(ref)),
    ]
    return () => offs.forEach((off) => off())
  }, [api])

  const running = activeTimer?.state === 'running'

  /* A running clock owns the face; editing closes rather than lying. */
  useEffect(() => {
    if (running && editing) setEditing(false)
  }, [running, editing])

  const beginEdit = () => {
    if (running) return
    beforeEdit.current = draft
    setEditing(true)
  }
  const commitEdit = () => {
    setEditing(false)
    const sec = digitsToSeconds(draft)
    if (sec > 0) void api?.setSetting('durationSec', sec)
  }
  const cancelEdit = () => {
    setDraft(beforeEdit.current)
    setEditing(false)
  }

  /* The clock as a wheel: one step is a whole minute, seconds dropped — a
     scroller is for finding 40 or 50, not 40:37. Never below one minute. */
  const stepMinutes = (delta: 1 | -1) => {
    const minutes = Math.floor(digitsToSeconds(draft) / 60)
    const next = Math.max(1, Math.min(99 * 60 + 59, minutes + delta))
    setDraft(secondsToDigits(next * 60))
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (!editing) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        beginEdit()
      }
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      stepMinutes(e.key === 'ArrowUp' ? 1 : -1)
      return
    }
    if (e.key >= '0' && e.key <= '9' && e.key.length === 1) {
      e.preventDefault()
      setDraft(pushDigit(draft, e.key))
      return
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      setDraft(popDigit(draft))
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (e.key === 'Enter') e.preventDefault()
      commitEdit()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  /* Start whatever is on the face, reusing the one stopped countdown. */
  const handleStartFace = async () => {
    if (!api) return
    const sec = digitsToSeconds(draft)
    if (sec <= 0) {
      showToast('Set a time first')
      return
    }
    const timerName = name.trim() || 'Sermon'
    void api.setSetting('timerName', timerName)
    void api.setSetting('durationSec', sec)
    const existing = timers.find((t) => t.kind === 'countdown' && t.state !== 'running')
    if (existing) {
      await api.resetTimer(existing.id)
      await api.updateTimer(existing.id, { name: timerName, durationSec: sec, extraSec: 0, overrun: true })
      await api.startTimer(existing.id)
    } else {
      const created = await api.createTimer({ name: timerName, kind: 'countdown', durationSec: sec, overrun: true })
      if (created?.id) await api.startTimer(created.id)
    }
    showToast(`${formatTimerDisplay(sec * 1000)} running`)
  }

  const handleRemove = () => {
    for (const t of timers) void api?.removeTimer(t.id)
    setDraft(secondsToDigits(DEFAULT_DURATION_SEC))
    setEditing(false)
    showToast('Timer cleared — back to 45:00')
  }

  /* Grace only ever moves extraSec — never the duration (see the note in
     TimersTile.tsx handleAddMinutes: growing the duration repaints a red
     last minute green). */
  const handleAddMinutes = async (extraMinutes: number) => {
    if (!activeTimer || !api) return
    const granted = (activeTimer.extraSec ?? 0) + extraMinutes * 60
    await api.updateTimer(activeTimer.id, { extraSec: granted, overrun: true })
    showToast(`+${extraMinutes} min for ${activeTimer.name} — shown on the stage screen`)
  }

  /* The picker wheel's neighbours: one minute more above, one less below. */
  const draftMinutes = Math.floor(digitsToSeconds(draft) / 60)
  const neighbors = editing
    ? {
        above: formatTimerDisplay(Math.min(99 * 60 + 59, draftMinutes + 1) * 60_000),
        below: formatTimerDisplay(Math.max(1, draftMinutes - 1) * 60_000),
      }
    : null

  const showingDraft = !activeTimer || (activeTimer.state !== 'running' && editing)
  const state = faceState(activeTimer, takenAt.current, digitsToSeconds(draft) * 1000)
  const faceDisplay = formatTimerDisplay(showingDraft ? digitsToSeconds(draft) * 1000 : state.ms)
  const faceOver = !showingDraft && state.over
  const faceColor = showingDraft ? '#22c55e' : state.color
  const faceTarget = !showingDraft && activeTimer ? state.target : null

  const chooseDisplay = async (d: DisplayInfo) => {
    setChosenDisplay(d.id)
    await api?.openScreen(d.id)
    void api?.listDisplays().then(setDisplays).catch(() => undefined)
  }

  const toggleShowVerses = (on: boolean) => {
    setShowVerses(on)
    void api?.setSetting('showVerses', on)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 20, height: '100%', overflowY: 'auto' }}>
      {toast && (
        <div
          style={{
            position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
            background: 'rgb(30 30 30 / 0.95)', border: '1px solid rgb(255 255 255 / 0.12)',
            borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600,
          }}
        >
          {toast}
        </div>
      )}

      {/* The face. No name field — the one decision the face asks for is the
          time, and the clock itself is the input (owner, 2026-11-22). */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <Face
          name={activeTimer?.name ?? name}
          display={faceDisplay}
          target={faceTarget}
          color={faceColor}
          over={faceOver}
          extraLabel={state.extraLabel}
          idle={!activeTimer}
          stateLabel={activeTimer?.state ?? null}
          reference={reference}
          editing={editing}
          onBeginEdit={beginEdit}
          onKey={handleKey}
          onCommit={commitEdit}
          neighbors={neighbors}
          onStep={stepMinutes}
          style={{ width: '100%', aspectRatio: '16 / 9' }}
        />

        <span className="tt-muted">
          {running
            ? activeTimer?.inExtension
              ? 'counting down the extra time'
              : 'counting down'
            : editing
              ? 'type the digits, or scroll / ↑ ↓ through the minutes · esc to undo'
              : 'click the clock to type a duration'}
        </span>

        {/* Transport */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {running ? (
            <button type="button" className="tt-button" onClick={() => activeTimer && void api?.pauseTimer(activeTimer.id)}>
              PAUSE
            </button>
          ) : (
            <button
              type="button"
              className="tt-button"
              onClick={() =>
                activeTimer && activeTimer.state === 'paused' ? void api?.startTimer(activeTimer.id) : void handleStartFace()
              }
            >
              {activeTimer && activeTimer.state === 'paused' ? 'RESUME' : 'START TIMER'}
            </button>
          )}
          <button
            type="button"
            className="tt-button quiet"
            disabled={!activeTimer}
            onClick={() => activeTimer && void api?.resetTimer(activeTimer.id)}
          >
            RESET
          </button>
          <button
            type="button"
            className="tt-button danger"
            disabled={timers.length === 0}
            title="Delete — back to the default 45:00"
            onClick={handleRemove}
          >
            DELETE
          </button>
        </div>
      </div>

      {/* Extra time */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', borderTop: '1px solid rgb(255 255 255 / 0.06)', paddingTop: 16 }}>
        <span className="tt-label">Extra time for the preacher</span>
        <p className="tt-muted" style={{ maxWidth: 380, textAlign: 'center', margin: 0 }}>
          Pressed at the end, when the agreed time is spent and he wants a few more minutes. The
          clock counts the extra time down on its own, and his screen says so.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {EXTRA_MINUTES_OPTIONS.map((min) => (
            <button
              key={min}
              type="button"
              className="tt-button quiet"
              style={{ padding: '6px 20px' }}
              title={`Give the preacher ${min} more minutes — the clock counts down again from ${min}:00`}
              onClick={() => void handleAddMinutes(min)}
            >
              +{min}
            </button>
          ))}
        </div>
      </div>

      {/* The screen it shows on */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="tt-label">Timer screen</span>
        <div className="tt-group">
          {displays.map((d) => (
            <div key={d.id} className="tt-row">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {d.label}
                  {d.primary ? ' · this screen' : ''}
                </div>
                <div className="tt-muted">{d.width}×{d.height}</div>
              </div>
              {d.showing && screenOpen ? (
                <button type="button" className="tt-button quiet" onClick={() => void api?.closeScreen()}>
                  showing · close
                </button>
              ) : (
                <button type="button" className="tt-button" onClick={() => void chooseDisplay(d)}>
                  show here
                </button>
              )}
            </div>
          ))}
          {displays.length === 0 && (
            <div className="tt-row">
              <span className="tt-muted">No screens found.</span>
            </div>
          )}
        </div>
        <p className="tt-muted" style={{ margin: 0 }}>
          The face keeps counting even when this window is covered or you are in another app.
          On the timer screen itself, Esc closes it.
          {chosenDisplay !== null && !screenOpen ? ' Your last screen is remembered.' : ''}
        </p>
      </div>

      {/* Trilorah on this network */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="tt-label">Trilorah on this network</span>
        <div className="tt-group">
          <div className="tt-row">
            <div>
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 8, height: 8, borderRadius: 999,
                    background: link.connected ? '#34d399' : 'rgb(255 255 255 / 0.25)',
                    boxShadow: link.connected ? '0 0 6px rgb(52 211 153 / 0.6)' : 'none',
                  }}
                />
                {link.connected ? `Linked to ${link.name || 'Trilorah'}` : 'Looking for Trilorah…'}
              </div>
              <div className="tt-muted">
                {link.connected
                  ? lastHeard
                    ? `last named: ${lastHeard}`
                    : 'waiting for the preacher to name a scripture'
                  : 'needs Trilorah open on this Wi-Fi with its stage timer link on (settings → external control)'}
              </div>
            </div>
          </div>
          <div className="tt-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showVerses}
                onChange={(e) => toggleShowVerses(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#34d399' }}
              />
              <span>
                <span style={{ fontWeight: 600 }}>Show scriptures the preacher names</span>
                <span className="tt-muted" style={{ display: 'block' }}>
                  the reference only — "Exodus 11:6-8" — on the timer screen for a few seconds, the
                  moment it is said
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
