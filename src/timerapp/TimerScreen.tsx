import { useEffect, useState } from 'react'
import { Face } from './Face'
import { faceState, useStageReference, useTimers } from './useTimers'

/*
 * The full-screen face itself, on whichever display the operator chose.
 * Everything here is read-only: the control window owns every decision, and
 * Esc (electron/timerapp/main.ts) is the only thing this window answers to.
 */
export function TimerScreen() {
  const { activeTimer, takenAt } = useTimers()
  const reference = useStageReference()
  const state = faceState(activeTimer, takenAt.current, 0)
  const clock = useBigClock()

  return (
    <Face
      name={activeTimer?.name ?? 'SANCTUARY TIMER'}
      display={activeTimer ? state.display : clock}
      target={state.target}
      color={state.color}
      over={state.over}
      pastCap={state.pastCap}
      cappedMs={state.ms}
      extraLabel={state.extraLabel}
      idle={!activeTimer}
      stateLabel={activeTimer?.state ?? null}
      reference={reference}
      className="screen-face"
      style={{ width: '100vw', height: '100vh', borderRadius: 0, boxShadow: 'none' }}
    />
  )
}

/** With no timer, the face is the room clock — as the main app's HDMI timer. */
function useBigClock(): string {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
