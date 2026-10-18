import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CatchSignal } from '../../../shared/catchSignal';
import { AwayHolds, SignalGate, seesCatches, signalForCatch, signalPlace } from '../../lib/catchSignal';
import { playSignal } from '../../lib/signalPlayer';
import { useEngine } from './engine';
import { useHeardSongs } from './songs/useHeardSongs';
import './catchSignals.css';

/*
 * The signal a catch raises, for an operator who is not looking at it
 * (owner, 2026-10-17): a gold sweep when the preacher names a scripture —
 * and only then (lib/catchSignal). On the app's own edges while the
 * operator is in another tab or view; over the whole screen, through main's
 * see-through window, while they are in another app. Never on an output's
 * screen — main decides that (electron/output/signalDisplay.ts).
 *
 * The rules are lib/catchSignal, the drawing lib/signalPlayer. This also
 * keeps catches waiting while the operator is away from them, and runs the
 * listening that offers a song by itself (songs/useHeardSongs) — offered
 * quietly, without a signal. Mounted once, by the live screen.
 */
export function CatchSignals({ view, tab }: { view: string; tab: string }) {
  const engine = useEngine();
  useHeardSongs();
  const layer = useRef<HTMLDivElement>(null);
  const gate = useRef(new SignalGate());
  const where = useRef({ view, tab });
  where.current = { view, tab };

  const fire = useCallback((signal: CatchSignal) => {
    const attention = { focused: document.hasFocus(), visible: document.visibilityState === 'visible', ...where.current };
    const place = signalPlace(attention);
    if (place === 'none' || !gate.current.allow(Date.now())) return;
    const inWindow = () => {
      if (layer.current) void playSignal(layer.current, signal);
    };
    const ask = window.api?.catchSignal;
    /* A browser tab or a design sheet: no outputs to keep it off. */
    if (!ask) {
      inWindow();
      return;
    }
    /* Main lights the screen itself, or says the window's own edges may be
       lit, or says neither — when the app sits on a screen the room sees. */
    void ask(signal, place).then((answer) => { if (answer === 'window') inWindow(); }).catch(() => undefined);
  }, []);

  /* A catch arriving — not one heard again, which keeps its arrival. */
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const key = (p: { id: string; arrivedAt: number }) => `${p.id}@${p.arrivedAt}`;
    const before = seen.current;
    seen.current = new Set(engine.proposals.map(key));
    if (!before) return;
    const signal = engine.proposals
      .filter((p) => !p.missing && !before.has(key(p)))
      .map((p) => signalForCatch(p.kind, p.stepped))
      .find((s): s is CatchSignal => s !== null);
    if (signal) fire(signal);
  }, [engine.proposals, fire]);

  /* Away from the catches, they wait (lib/catchSignal AwayHolds). */
  const attention = useWindowAttention();
  const away = !seesCatches({ ...attention, view, tab });
  const holdProposal = engine.holdProposal;
  const holds = useRef<AwayHolds | null>(null);
  useEffect(() => {
    const made = new AwayHolds((id, on) => holdProposal(id, on, 'away'));
    holds.current = made;
    return () => {
      made.dispose();
      if (holds.current === made) holds.current = null;
    };
  }, [holdProposal]);
  const waiting = engine.proposals.map((p) => p.id).join('\n');
  useEffect(() => {
    holds.current?.setAway(away, waiting ? waiting.split('\n') : []);
  }, [away, waiting, holdProposal]);

  return createPortal(<div ref={layer} className="catch-signal-layer" aria-hidden="true" />, document.body);
}

/** Whether this window is in front and showing, kept current. */
function useWindowAttention() {
  const read = () => ({ focused: document.hasFocus(), visible: document.visibilityState === 'visible' });
  const [state, setState] = useState(read);
  useEffect(() => {
    const update = () => setState((prev) => {
      const next = read();
      return prev.focused === next.focused && prev.visible === next.visible ? prev : next;
    });
    /* Read once the event has settled: focus moving between the page's own
       parts also fires blur, and only the settled answer says it left. */
    const soon = () => window.setTimeout(update, 0);
    window.addEventListener('focus', soon);
    window.addEventListener('blur', soon);
    document.addEventListener('visibilitychange', soon);
    return () => {
      window.removeEventListener('focus', soon);
      window.removeEventListener('blur', soon);
      document.removeEventListener('visibilitychange', soon);
    };
  }, []);
  return state;
}
