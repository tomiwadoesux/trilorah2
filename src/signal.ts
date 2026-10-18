/*
 * The page in the see-through window over the operator's screen. Main
 * calls window.__trilorahSignal('sweep' | 'buzz' | 'slant') and waits for
 * the promise, then hides the window again (electron/output/catchSignalOverlay.ts).
 */
import { isCatchSignal } from '../shared/catchSignal';
import { playSignal } from './lib/signalPlayer';

declare global {
  interface Window {
    __trilorahSignal?: (signal: unknown) => Promise<void>;
  }
}

const host = document.getElementById('signal') ?? document.body;

window.__trilorahSignal = (signal) => (isCatchSignal(signal) ? playSignal(host, signal) : Promise.resolve());
