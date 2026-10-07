import { useEffect, useState } from 'react';
import { BookIcon } from '../../ui';
import type { SermonStartAction, SermonStartState } from '../../../shared/sermonStart';

export function SermonStartControl() {
  const [state, setState] = useState<SermonStartState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const api = window.api;
    if (!api?.getSermonStart) return;
    let alive = true;
    let version = 0;
    const off = api.onSermonStart(s => { version++; if (alive) setState(s); });
    const refresh = () => {
      const before = version;
      void api.getSermonStart().then(s => { if (alive && before === version) setState(s); }).catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => { alive = false; off(); window.clearInterval(timer); };
  }, []);
  async function act(action: SermonStartAction) {
    if (busy || !window.api) return;
    setBusy(true); setError('');
    try { setState(await window.api.respondSermonStart(action, state?.requestId)); setOpen(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update the sermon. Try again.'); }
    finally { setBusy(false); }
  }
  const active = state?.status === 'active';
  const pending = state?.status === 'confirmation';
  const panel = pending || open || !!error;
  return <div className="relative flex shrink-0 items-stretch">
    <button type="button" className="tri-header-control flex items-center gap-2 px-3" disabled={!state || busy}
      aria-expanded={panel} aria-controls="sermon-start-panel"
      onClick={() => active ? setOpen(!open) : pending ? setOpen(true) : void act('start')}
      title={active ? 'Sermon is underway' : 'Mark the sermon as started now'}>
      <BookIcon size={12} className="tri-header-icon" />
      {active ? 'Sermon started' : pending ? 'Has sermon started?' : 'Start sermon'}
    </button>
    {panel && <section id="sermon-start-panel" aria-label="Sermon confirmation" className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border p-4 shadow-xl"
      style={{ background: 'var(--tri-panel, #171c1b)', borderColor: 'var(--tri-line, #ffffff25)', color: 'var(--tri-ink, #f3f5f4)' }}>
      <p role="status" className="text-sm font-medium">{active ? 'Sermon is underway' : 'Has your sermon started?'}</p>
      {!active && <><p className="mt-2 text-xs opacity-70">Trilorah heard signs that the message has begun. Please confirm.</p>
        <ul className="mt-2 list-disc pl-4 text-xs opacity-70">{state?.evidence.map(e => <li key={e}>{e}</li>)}</ul></>}
      {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
      <div className="mt-3 flex gap-3">
        {pending ? <><button type="button" disabled={busy} onClick={() => void act('confirm')} className="rounded-lg border px-3 py-2 text-sm">Yes, started</button>
          <button type="button" disabled={busy} onClick={() => void act('not-yet')} className="rounded-lg border px-3 py-2 text-sm">Not yet</button></>
          : active ? <><button type="button" disabled={busy} onClick={() => void act('end')} className="rounded-lg border px-3 py-2 text-sm">End sermon</button>
            <button type="button" onClick={() => { setOpen(false); setError(''); }} className="px-3 py-2 text-sm">Close</button></>
          : <button type="button" disabled={busy} onClick={() => void act('start')} className="rounded-lg border px-3 py-2 text-sm">Start sermon</button>}
      </div>
    </section>}
  </div>;
}
