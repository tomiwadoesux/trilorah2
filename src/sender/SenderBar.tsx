import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Select, SegmentedControl, cx } from '../ui';
import { listAudioInputs, onDeviceChange } from '../lib/audioDevices';
import { DEVICE_AND_MIC, networkSoundComputer, type SenderChannels } from '../../shared/audioInput';
import { startSenderCapture, type SenderCapture } from './senderCapture';

/*
 * Sender mode's window: this computer sends one sound to another Trilorah.
 *
 * Modelled on vMix Desktop Capture's little bar — open it and it sends; it
 * says how many computers are taking the sound. Ours also says which sound,
 * which side of it, and shows the level, because the usual Sunday mistake is
 * sending the wrong input or the silent side of a two-input box.
 */

const MUTED = 'rgb(229 243 242 / 0.55)';
const SIDES: { id: SenderChannels; label: string }[] = [
  { id: 'both', label: 'both' },
  { id: 'left', label: 'left only' },
  { id: 'right', label: 'right only' },
];
/* Trilorah Sender, the separate small app, can open with the computer. The
   main app's sender mode has no such choice, so the row stays out there. */
type Opens = 'login' | 'opened';
const OPENS: { id: Opens; label: string }[] = [
  { id: 'login', label: 'with this computer' },
  { id: 'opened', label: 'only when opened' },
];

type Phase = 'starting' | 'sending' | 'stopped';
/** Why sending stopped. A missing input is retried by itself when it comes back. */
type StopReason = 'input' | 'other';

const ON_WINDOWS = typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent);
/** How long nobody has to pick the sound up before the firewall hint shows. */
const HINT_AFTER_MS = 30_000;

function stopReasonFor(error: unknown): StopReason {
  if (error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'OverconstrainedError' || error.name === 'NotReadableError')) return 'input';
  return error instanceof Error && /not connected/i.test(error.message) ? 'input' : 'other';
}

function Meter({ db, side }: { db: number; side: string }) {
  const fill = Math.max(0, Math.min(1, (db + 60) / 60));
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 text-[length:var(--tri-size-xs)] uppercase" style={{ color: MUTED }}>{side}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-[2px] bg-white/[0.08]">
        <div
          className="h-full rounded-[2px] transition-[width] duration-100"
          style={{ width: `${fill * 100}%`, background: db > -6 ? 'var(--tri-accent-yellow)' : 'rgb(var(--tri-go-2))' }}
        />
      </div>
    </div>
  );
}

export function SenderBar() {
  const [inputs, setInputs] = useState<string[]>([]);
  const [device, setDevice] = useState<string | null>(null);
  const [channels, setChannels] = useState<SenderChannels>('both');
  const [phase, setPhase] = useState<Phase>('starting');
  const [problem, setProblem] = useState('');
  const [name, setName] = useState('');
  const [connections, setConnections] = useState(0);
  const [levels, setLevels] = useState<[number, number]>([-60, -60]);
  const [waitingLong, setWaitingLong] = useState(false);
  const [opens, setOpens] = useState<Opens | null>(null);
  const capture = useRef<SenderCapture | null>(null);
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const deviceRef = useRef(device);
  deviceRef.current = device;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const reasonRef = useRef<StopReason>('other');
  const attempt = useRef(0);

  // What was being sent last time, so a restart carries on without a click.
  useEffect(() => {
    void window.api?.getSettings?.().then((s) => {
      const saved = s as unknown as { senderDeviceLabel?: string; senderChannels?: SenderChannels };
      setChannels(saved.senderChannels ?? 'both');
      setDevice(saved.senderDeviceLabel ?? '');
    }).catch(() => setDevice(''));
  }, []);

  useEffect(() => {
    void window.api?.senderOpensAtLogin?.().then((open) => setOpens(open ? 'login' : 'opened')).catch(() => undefined);
  }, []);

  useEffect(() => window.api?.onNetworkSoundStatus?.((status) => {
    if (status.name) setName(status.name);
    setConnections(status.connections);
    if (status.error) setProblem(status.error);
  }), []);

  const start = useCallback(async (label: string) => {
    const ticket = ++attempt.current;
    capture.current?.stop();
    capture.current = null;
    setPhase('starting');
    setProblem('');
    try {
      const status = await window.api?.startNetworkSound?.();
      if (status?.error) throw new Error(status.error);
      if (status?.name) setName(status.name);
      const next = await startSenderCapture({
        deviceLabel: label,
        channels: channelsRef.current,
        onLevel: (l, r) => setLevels([l, r]),
        onEnded: () => {
          if (ticket !== attempt.current) return;
          capture.current?.stop();
          capture.current = null;
          reasonRef.current = 'input';
          setPhase('stopped');
          setLevels([-60, -60]);
          setProblem(`${label || 'The sound input'} stopped. Plug it back in, or choose another sound.`);
        },
      });
      if (ticket !== attempt.current) { next.stop(); return; }
      capture.current = next;
      // A side picked while it was starting.
      next.setChannels(channelsRef.current);
      setPhase('sending');
    } catch (error) {
      if (ticket !== attempt.current) return;
      reasonRef.current = stopReasonFor(error);
      setPhase('stopped');
      setProblem(error instanceof Error ? error.message : String(error));
    }
  }, []);

  /* The input list, and the sender's own recovery: a Scarlett that dropped
     out (a USB hiccup, a driver reset) or was not found yet at boot is
     started again the moment it is back, with nobody at the desk. */
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void listAudioInputs().then((list) => {
        if (cancelled) return;
        // Computer sound plus a microphone is a mix for the speech engine; this sends one input.
        const labels = list.map((d) => d.label).filter((label) => label !== DEVICE_AND_MIC);
        setInputs(labels);
        const wantedLabel = deviceRef.current;
        const back = wantedLabel === '' ? labels.length > 0 : wantedLabel !== null && labels.includes(wantedLabel);
        if (phaseRef.current === 'stopped' && reasonRef.current === 'input' && back) void start(wantedLabel ?? '');
      });
    };
    load();
    const off = onDeviceChange(load);
    return () => { cancelled = true; off(); };
  }, [start]);

  // Nobody picking the sound up for a while is usually the network, not Trilorah.
  useEffect(() => {
    setWaitingLong(false);
    if (phase !== 'sending' || connections > 0) return;
    const timer = window.setTimeout(() => setWaitingLong(true), HINT_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [phase, connections]);

  // Start as soon as the saved choice is known, and again on every change.
  useEffect(() => {
    if (device === null) return;
    void start(device);
  }, [device, start]);

  useEffect(() => () => {
    attempt.current++;
    capture.current?.stop();
    void window.api?.stopNetworkSound?.();
  }, []);

  const chooseDevice = (label: string) => {
    void window.api?.setSetting('senderDeviceLabel', label);
    // Choosing the same input again is a restart — React would not rerun the effect for it.
    if (label === device) void start(label);
    else setDevice(label);
  };
  const chooseSide = (side: SenderChannels) => {
    setChannels(side);
    capture.current?.setChannels(side);
    void window.api?.setSetting('senderChannels', side);
  };
  const chooseOpens = (next: Opens) => {
    setOpens(next);
    // What the computer actually kept, in case it refused.
    void window.api?.setSenderOpensAtLogin?.(next === 'login').then((open) => setOpens(open ? 'login' : 'opened'));
  };

  const computer = name ? networkSoundComputer(name) : '';
  const listening = phase === 'sending' && connections > 0;
  const headline = problem && phase !== 'sending'
    ? 'Not sending'
    : phase === 'starting'
      ? 'Starting…'
      : listening
        ? connections === 1 ? 'Sending to 1 computer' : `Sending to ${connections} computers`
        : 'Ready to send';
  const dot = problem && phase !== 'sending' ? 'rgb(255 110 110)' : listening ? 'rgb(var(--tri-go-2))' : phase === 'sending' ? 'var(--tri-accent-yellow)' : 'rgb(229 243 242 / 0.3)';
  const options = [{ value: '', label: 'system default' }, ...inputs.map((label) => ({ value: label, label }))];
  if (device && !inputs.includes(device)) options.push({ value: device, label: `${device} (not connected)` });

  return (
    <div className="flex min-h-screen flex-col gap-3 bg-[#0b0b0b] p-4 text-[length:var(--tri-size)] text-[var(--tri-ink,#e5f3f2)]">
      <header className="flex items-center gap-2">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
        <h1 className="font-semibold">{headline}</h1>
        <span className="ml-auto text-[length:var(--tri-size-xs)]" style={{ color: MUTED }}>Trilorah Sender</span>
      </header>

      <div className="flex flex-col rounded-[6px] border border-white/[0.12]">
        <div className="flex items-center gap-3 px-3 py-2">
          <span className="w-12 shrink-0" style={{ color: MUTED }}>Sound</span>
          <Select
            value={device ?? ''}
            options={options}
            onChange={chooseDevice}
            preserveCase
            className="min-w-0 flex-1"
            guideId="sender-sound"
          />
        </div>
        <div className="flex items-center gap-3 border-t border-white/[0.08] px-3 py-2">
          <span className="w-12 shrink-0" style={{ color: MUTED }}>Side</span>
          <SegmentedControl size="sm" value={channels} options={SIDES} onChange={chooseSide} className="flex-1" guideId="sender-side" />
        </div>
        <div className="flex flex-col gap-1.5 border-t border-white/[0.08] px-3 py-2.5">
          <Meter db={levels[0]} side="L" />
          <Meter db={levels[1]} side="R" />
        </div>
        {opens && (
          <div className="flex items-center gap-3 border-t border-white/[0.08] px-3 py-2">
            <span className="w-12 shrink-0" style={{ color: MUTED }}>Opens</span>
            <SegmentedControl size="sm" value={opens} options={OPENS} onChange={chooseOpens} className="flex-1" />
          </div>
        )}
      </div>

      <p className={cx('text-[length:var(--tri-size-xs)] leading-relaxed')} style={{ color: problem ? 'rgb(255 150 150)' : MUTED }}>
        {problem
          ? problem
          : computer
            ? listening
              ? `The other computer is hearing this as “sound from ${computer}”.`
              : waitingLong && ON_WINDOWS
                ? `Still nobody listening. Check both computers are on the same network, that Windows calls this one a Private network, and that the firewall allows Trilorah. Then choose “sound from ${computer}” on the other computer.`
                : `On the other computer, open audio in Trilorah and choose “sound from ${computer}”. Both computers need to be on the same network.`
            : 'Getting this computer onto the network…'}
      </p>

      <footer className="mt-auto flex items-center gap-3">
        {problem && phase === 'stopped' && <Button label="try again" onClick={() => { void start(device ?? ''); }} />}
        <span className="text-[length:var(--tri-size-xs)] leading-snug" style={{ color: MUTED }}>
          Sent with{' '}
          <a href="https://ndi.video" target="_blank" rel="noreferrer" className="underline underline-offset-2">NDI®</a>
          <span className="block opacity-70">NDI® is a registered trademark of Vizrt NDI AB.</span>
        </span>
        {/* Only the main app's sender mode has an operator window to go back to. */}
        {window.api?.exitSenderMode && (
          <span className="ml-auto">
            <Button label="back to Trilorah" onClick={() => { void window.api?.exitSenderMode?.(); }} guideId="sender-exit" />
          </span>
        )}
      </footer>
    </div>
  );
}
