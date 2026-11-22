import { describe, expect, it } from 'vitest'
import { readWatchOutput } from './inspect'

/*
 * The teaching flow asks the inspector to watch for a click. Three endings
 * must stay distinguishable: a click (or time running out) is an honest
 * answer, the operator calling it off is expected, and the watcher dying
 * is a failure the operator has to see. The Windows watcher once died on
 * launch and the Console read it as "skipped" — question two appeared
 * before anyone had clicked anything.
 */
describe('readWatchOutput: a crash is never a skip', () => {
  const click = { role: 'Button', title: 'Go Live', path: '0/3/2' }

  it('a recorded click comes back as the record', () => {
    const out = JSON.stringify({ ok: true, wanted: 1, recorded: [click], note: 'recorded' })
    expect(readWatchOutput(out, 'watching EasyWorship — click…\n  recorded: Button "Go Live"\n', 0, false)).toEqual({ recorded: [click] })
  })

  it('time running out is an honest empty answer, not an error', () => {
    const out = JSON.stringify({ ok: false, wanted: 1, recorded: [], note: 'time ran out before 1 click(s) landed in EasyWorship' })
    expect(readWatchOutput(out, '', 1, false)).toEqual({ recorded: [] })
  })

  it('a Fail body carries its message', () => {
    const out = JSON.stringify({ ok: false, error: 'no running app matches "4242" — is it open?' })
    expect(readWatchOutput(out, '', 1, false)).toEqual({ recorded: [], error: 'no running app matches "4242" — is it open?' })
  })

  it('a watcher that died before printing names the first useful stderr line', () => {
    const stderr = [
      'watching EasyWorship — click the control you want to teach (1 click(s), up to 120s)',
      'Unable to find type [W.K].',
      'At C:\\Program Files\\Trilorah\\resources\\controller\\trilorah-inspect.ps1:369 char:7',
      '+       $down = ([W.K]::GetAsyncKeyState(1) -band 0x8000) -ne 0',
      '+               ~~~~~',
      '    + CategoryInfo          : InvalidOperation: (W.K:TypeName) [], RuntimeException',
      '',
    ].join('\r\n')
    expect(readWatchOutput('', stderr, 1, false)).toEqual({ recorded: [], error: 'Unable to find type [W.K].' })
  })

  it('no output at all says it stopped before it started, with the exit code', () => {
    expect(readWatchOutput('', '', 1, false)).toEqual({ recorded: [], error: 'the watcher stopped before it started (exit 1)' })
    expect(readWatchOutput('', '', null, false).error).toBe('the watcher stopped before it started (exit ?)')
  })

  it('a cancelled watch is not an error, whatever it managed to print', () => {
    expect(readWatchOutput('', '', null, true)).toEqual({ recorded: [], cancelled: true })
    expect(readWatchOutput('', 'something broke', 1, true)).toEqual({ recorded: [], cancelled: true })
  })

  it('a long stderr reason is cut to something the panel can show', () => {
    const r = readWatchOutput('', 'x'.repeat(500), 1, false)
    expect(r.error).toHaveLength(200)
  })
})
