import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './timerapp/timerapp.css'
import { TimerControl } from './timerapp/TimerControl'
import { TimerScreen } from './timerapp/TimerScreen'

/*
 * Trilorah Stage Timer's one page, worn two ways: the control window by
 * default, and with #screen in the URL (electron/timerapp/main.ts
 * openTimerScreen) the full-screen face itself.
 */

document.documentElement.dataset.theme = 'dark'

const isScreen = window.location.hash === '#screen'

const rootEl = document.getElementById('root')
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>{isScreen ? <TimerScreen /> : <TimerControl />}</StrictMode>,
  )
}
