import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useLiveStore } from '../stores/liveStore';
import {
  Button,
  EmptyState,
  EngineNote,
  LevelMeter,
  Panel,
  PanelHeader,
  Pill,
  SectionLabel,
  TextButton,
  TrustBar,
  Waveform,
  hasEngine,
} from '../components/ui';
import { formatRef, describeVoiceCommand, clockTime, pct } from '../lib/verse';
import { startPractice, stopPractice } from '../lib/practice';
import { ScriptureSearch } from '../components/ScriptureSearch';
import { listAudioInputs, onDeviceChange } from '../lib/audioDevices';

const EMPHASIS_WINDOW_MS = 3000;

const DEFAULT_ORDER: ScheduleEntry[] = [
  { type: 'pre-service' },
  { type: 'worship' },
  { type: 'announcements' },
  { type: 'offering' },
  { type: 'sermon' },
  { type: 'altar-call' },
  { type: 'closing' },
];

/* ------------------------------------------------------------------ */
/* Left — service order + preacher                                     */
/* ------------------------------------------------------------------ */

function ServiceOrderPanel() {
  const settings = useAppStore((s) => s.settings);
  const segment = useAppStore((s) => s.segment);
  const preacherName = useAppStore((s) => s.activePreacherName);
  const trust = useAppStore((s) => s.trustLowerBound);

  const schedule = settings?.serviceSchedule;
  const order = Array.isArray(schedule) && schedule.length > 0 ? schedule : DEFAULT_ORDER;
  const gate = typeof settings?.autoModeMinTrust === 'number' ? settings.autoModeMinTrust : 0.9;

  return (
    <Panel pad={false} dataTour="service-order" className="flex min-h-0 flex-col">
      <div className="border-b border-hairline px-4 py-3">
        <SectionLabel>service order</SectionLabel>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto py-1">
        {order.map((entry, i) => {
          const active = segment?.type === entry.type;
          return (
            <li
              key={`${entry.type}-${i}`}
              className={`flex items-baseline justify-between gap-x-3 border-l-2 px-4 py-2 ${
                active ? 'border-accent bg-paper font-semibold' : 'border-transparent text-neutral-500'
              }`}
            >
              <span className="text-xs uppercase tracking-widest">
                {entry.title ?? entry.type}
              </span>
              <span className="text-[10px] tabular-nums text-neutral-400">
                {active && segment ? clockTime(segment.startedAt) : entry.time ?? ''}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="space-y-2 border-t border-hairline px-4 py-3">
        <SectionLabel>preacher</SectionLabel>
        <p className="text-sm font-semibold">{preacherName ?? '—'}</p>
        {trust != null && (
          <div className="space-y-1">
            <TrustBar value={trust} gate={gate} />
            <p className="text-[10px] uppercase tracking-widest text-neutral-400">
              trust {pct(trust)} · gate {pct(gate)}
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Center — preview, transcript, manual input                          */
/* ------------------------------------------------------------------ */

function PreviewPanel() {
  const preview = useLiveStore((s) => s.preview);
  const setPreview = useLiveStore((s) => s.setPreview);
  const setLive = useLiveStore((s) => s.setLive);
  const intentState = useAppStore((s) => s.intentState);

  const push = () => {
    if (!preview) return;
    window.api?.pushToLive(formatRef(preview.detection), preview.detection.version);
    if (preview) {
      setLive(preview);
      setPreview(null);
    }
  };

  return (
    <Panel dataTour="preview" className="shrink-0">
      <PanelHeader right={<Pill active={intentState !== 'idle'}>intent · {intentState}</Pill>}>
        preview
      </PanelHeader>
      {preview ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-scripture text-3xl">{formatRef(preview.detection)}</p>
            <div className="flex items-center gap-x-4">
              <Button label="Push to live" variant="solid" big onClick={push} />
              <TextButton label="DISMISS" onClick={() => setPreview(null)} />
            </div>
          </div>
          {preview.text ? (
            <p className="font-scripture text-lg leading-relaxed text-neutral-700">{preview.text}</p>
          ) : (
            <p className="text-sm italic text-neutral-400">fetching text…</p>
          )}
        </div>
      ) : (
        <EmptyState>nothing in preview — detections land here first</EmptyState>
      )}
    </Panel>
  );
}

/**
 * The transcript panel's resting state: the one control the operator reaches
 * for first, where they are already looking.
 *
 * It lived only in the bottom bar before, which put the primary action of the
 * screen in its quietest corner. Once listening, this becomes the sound-check
 * surface — the waveform answers "is the mic actually hearing the room", which
 * a status word cannot, and it sits directly above the text it will produce.
 */
function ListenPrompt() {
  const asrStatus = useAppStore((s) => s.asrStatus);
  const asrDetail = useAppStore((s) => s.asrDetail);
  const setAsrStatus = useAppStore((s) => s.setAsrStatus);
  const setListeningSince = useAppStore((s) => s.setListeningSince);
  const audioLevel = useAppStore((s) => s.audioLevel);
  const settings = useAppStore((s) => s.settings);
  const savedDevice = typeof settings?.micDeviceLabel === 'string' ? settings.micDeviceLabel : '';
  const listening = asrStatus === 'listening' || asrStatus === 'connecting';

  const start = () => {
    window.api?.startListening(savedDevice || undefined);
    setAsrStatus('listening');
    setListeningSince(Date.now());
  };

  if (listening) {
    return (
      <div className="flex h-full flex-col justify-center gap-3 py-6">
        <Waveform db={audioLevel} />
        <p className="text-center text-xs uppercase tracking-widest text-neutral-400">
          {asrDetail || 'listening — waiting for the first words…'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-10">
      <Button label="Start listening" variant="solid" big onClick={start} />
      <p className="text-sm text-neutral-400">start listening and catches land here</p>
    </div>
  );
}

function TranscriptPanel() {
  const lines = useLiveStore((s) => s.lines);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  // A slow tick so "last 3 seconds" emphasis decays even between chunks.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Keep the newest text in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <Panel pad={false} dataTour="transcript" className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-hairline px-4 py-3">
        <SectionLabel>transcript</SectionLabel>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {lines.length === 0 ? (
          hasEngine() ? (
            <ListenPrompt />
          ) : (
            <EngineNote />
          )
        ) : (
          <p className="text-base leading-relaxed">
            {lines.map((line) => {
              const recent = now - line.ts < EMPHASIS_WINDOW_MS;
              return (
                <span key={line.id} className={recent ? 'font-medium text-ink' : 'text-neutral-400'}>
                  {line.text}{' '}
                </span>
              );
            })}
          </p>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Right — output canvas, queue, pulpit log                            */
/* ------------------------------------------------------------------ */

function OutputPanel() {
  const live = useLiveStore((s) => s.live);
  const setLive = useLiveStore((s) => s.setLive);
  const displayVersion = useLiveStore((s) => s.displayVersion);
  const version = live?.detection.version ?? displayVersion ?? 'KJV';
  const [qrShown, setQrShown] = useState(false);
  const [qrNote, setQrNote] = useState<string | null>(null);
  // Screen state mirrors main (electron/output/outputState.ts) so a Stream
  // Deck press and this panel never disagree about whether we're black.
  const [screen, setScreen] = useState<ScreenState>('live');
  useEffect(() => {
    const api = window.api;
    if (!api?.onScreenState) return;
    void api.getScreenState?.().then((s) => s && setScreen(s)).catch(() => undefined);
    return api.onScreenState((s) => setScreen(s));
  }, []);
  const toggleScreen = (target: 'black' | 'logo') => {
    void window.api?.setScreenState?.(screen === target ? 'live' : target).catch(() => undefined);
  };

  const toggleQr = async () => {
    const api = window.api;
    if (!api) return;
    try {
      if (qrShown) {
        await api.clearMedia?.();
        setQrShown(false);
        setQrNote(null);
      } else if (api.showQr) {
        const res = await api.showQr();
        setQrShown(res.success);
        setQrNote(res.success ? null : res.error ?? 'could not show QR');
      } else {
        setQrNote('QR needs the latest engine');
      }
    } catch {
      setQrNote('could not show QR');
    }
  };

  return (
    <Panel pad={false} dataTour="output" className="shrink-0">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <div className="flex items-center gap-x-2">
          <SectionLabel>live output</SectionLabel>
          {live && (
            <span className="animate-pulse-quiet text-[10px] font-bold uppercase tracking-widest text-accent">
              ● on screen
            </span>
          )}
        </div>
        <div className="flex items-center gap-x-3">
          <Pill>{version}</Pill>
          <TextButton
            label="CLEAR"
            onClick={() => {
              // Must reach the outputs, not just this panel: clear-media
              // broadcasts on-show-clean-background to every output window.
              void window.api?.clearMedia?.().catch(() => undefined);
              setLive(null);
            }}
            disabled={!live}
          />
          <TextButton
            label="BLACK"
            primary={screen === 'black'}
            onClick={() => toggleScreen('black')}
            disabled={!hasEngine()}
            title="Cut every output to black — press again to restore"
          />
          <TextButton
            label="LOGO"
            primary={screen === 'logo'}
            onClick={() => toggleScreen('logo')}
            disabled={!hasEngine()}
            title="Church logo on every output — press again to restore"
          />
        </div>
      </div>
      {/* The projector canvas — a faithful miniature of the audience screen. */}
      <div className="flex aspect-video flex-col items-center justify-center gap-y-3 bg-canvas px-6 text-center">
        {screen !== 'live' ? (
          <p className="text-xs uppercase tracking-widest text-neutral-500">
            {screen === 'black' ? 'screen is black' : screen === 'logo' ? 'showing logo' : 'output clear'}
          </p>
        ) : live ? (
          <>
            <p className="font-scripture text-sm uppercase tracking-[0.2em] text-neutral-400">
              {formatRef(live.detection)} · {version}
            </p>
            {live.text && (
              <p className="line-clamp-5 font-scripture text-lg leading-relaxed text-white">{live.text}</p>
            )}
          </>
        ) : (
          <p className="text-xs uppercase tracking-widest text-neutral-600">output clear</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline px-4 py-2.5">
        <SectionLabel>open</SectionLabel>
        <TextButton label="MAIN" onClick={() => window.api?.openOutput('main')} disabled={!hasEngine()} />
        <TextButton label="STREAM" onClick={() => window.api?.openOutput('alternate')} disabled={!hasEngine()} />
        <TextButton label="STAGE" onClick={() => window.api?.openOutput('third')} disabled={!hasEngine()} />
        <TextButton label="TIMER" onClick={() => window.api?.openOutput('timer')} disabled={!hasEngine()} />
        <span className="ml-auto flex items-baseline gap-x-3">
          <TextButton label={qrShown ? 'HIDE QR' : 'SHOW QR'} primary={qrShown} onClick={() => void toggleQr()} disabled={!hasEngine()} />
          {qrNote && <span className="text-[10px] text-neutral-400">{qrNote}</span>}
        </span>
      </div>
    </Panel>
  );
}

/**
 * Message alerts (BUILD-MAP 2.10): "parent of child 42 to the nursery".
 * Rides over the verse on every output; auto-expires; one at a time.
 */
function AlertPanel() {
  const settings = useAppStore((s) => s.settings);
  const [text, setText] = useState('');
  const [active, setActive] = useState<ScreenAlert | null>(null);
  const [, setTick] = useState(0);
  const presets = Array.isArray(settings?.alertPresets)
    ? (settings.alertPresets as unknown[]).filter((p): p is string => typeof p === 'string')
    : [];

  useEffect(() => {
    const api = window.api;
    if (!api?.onAlert) return;
    void api.getAlert?.().then((a) => setActive(a ?? null)).catch(() => undefined);
    return api.onAlert((a) => setActive(a));
  }, []);
  // Countdown repaint while an alert is up.
  useEffect(() => {
    if (!active?.expiresAt) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [active]);

  // A saved message may carry holes — '{child}', '{timer:countdown}'. We ask
  // main what is still unfilled and prompt for exactly those before showing,
  // rather than putting a literal brace on the projector.
  const [pending, setPending] = useState<{ template: string; slots: AlertTokenSlot[] } | null>(null);
  const [fills, setFills] = useState<Record<string, string>>({});

  const show = async (message: string, values?: Record<string, string>) => {
    const clean = message.trim();
    if (!clean || !window.api?.showAlert) return;
    if (!values && window.api.inspectAlert) {
      const info = await window.api.inspectAlert(clean).catch(() => null);
      const custom = (info?.slots ?? []).filter((s) => s.kind === 'custom');
      if (info?.unfilled && custom.length > 0) {
        setPending({ template: clean, slots: custom });
        setFills(Object.fromEntries(custom.map((s) => [s.name, ''])));
        return;
      }
    }
    await window.api.showAlert(clean, values ? { values } : undefined).catch(() => undefined);
    setText('');
    setPending(null);
  };
  const remaining = active?.expiresAt ? Math.max(0, Math.ceil((active.expiresAt - Date.now()) / 1000)) : null;

  return (
    <Panel dataTour="alerts">
      <PanelHeader
        right={
          active ? (
            <span className="flex items-center gap-x-3">
              <span className="text-[10px] tabular-nums uppercase tracking-widest text-accent">
                on screen{remaining != null ? ` · ${remaining}s` : ''}
              </span>
              <TextButton label="DISMISS" onClick={() => void window.api?.dismissAlert?.()} />
            </span>
          ) : null
        }
      >
        message alert
      </PanelHeader>
      <form
        className="flex items-center gap-x-3"
        onSubmit={(e) => {
          e.preventDefault();
          void show(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="a short notice for every screen — enter to show"
          maxLength={140}
          className="w-full text-sm"
          disabled={!hasEngine()}
        />
        <Button label="Show" variant="solid" onClick={() => void show(text)} disabled={!hasEngine() || !text.trim()} />
      </form>
      {pending && (
        <form
          className="mt-3 space-y-2 rounded border border-hairline p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void show(pending.template, fills);
          }}
        >
          <p className="truncate text-xs text-neutral-500">{pending.template}</p>
          {pending.slots.map((slot) => (
            <label key={slot.name} className="flex items-center gap-x-3">
              <span className="w-28 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                {slot.name}
              </span>
              <input
                autoFocus={slot === pending.slots[0]}
                value={fills[slot.name] ?? ''}
                onChange={(e) => setFills((f) => ({ ...f, [slot.name]: e.target.value }))}
                className="w-full text-sm"
              />
            </label>
          ))}
          <div className="flex items-center gap-x-4">
            <Button label="Show" variant="solid" onClick={() => void show(pending.template, fills)} />
            <TextButton label="CANCEL" onClick={() => setPending(null)} />
          </div>
        </form>
      )}
      {presets.length > 0 && !pending && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {presets.map((p) => (
            <TextButton key={p} label={p} onClick={() => void show(p)} disabled={!hasEngine()} />
          ))}
        </div>
      )}
      {active && <p className="mt-3 truncate text-sm text-neutral-500">“{active.text}”</p>}
    </Panel>
  );
}

/**
 * Service timers (BUILD-MAP 2.16): the pre-service countdown, the offering
 * clock, the sermon stopwatch on the preacher's monitor. The store lives in
 * main and only emits on mutation, so the second-by-second repaint is ours.
 */
function TimersPanel() {
  const [timers, setTimers] = useState<TimerSnapshot[]>([]);
  const [, setTick] = useState(0);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<TimerKind>('countdown');
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('5');
  const [target, setTarget] = useState('10:30');

  const refresh = () => {
    void window.api?.listTimers?.().then((t) => setTimers(t ?? [])).catch(() => undefined);
  };
  useEffect(() => {
    refresh();
    return window.api?.onTimers?.((t) => setTimers(t));
  }, []);
  // Only tick while something is actually running.
  const anyRunning = timers.some((t) => t.state === 'running');
  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => {
      setTick((n) => n + 1);
      refresh();
    }, 1000);
    return () => window.clearInterval(id);
  }, [anyRunning]);

  const create = async () => {
    const api = window.api;
    if (!api?.createTimer) return;
    const input =
      kind === 'countdown'
        ? { kind, name: name.trim(), durationSec: Math.max(1, Number.parseFloat(minutes) || 5) * 60 }
        : kind === 'to-time'
          ? { kind, name: name.trim(), targetTime: target }
          : { kind, name: name.trim() };
    await api.createTimer({ ...input, overrun: true }).catch(() => undefined);
    setAdding(false);
    setName('');
    refresh();
  };

  return (
    <Panel dataTour="timers">
      <PanelHeader
        right={<TextButton label={adding ? 'CANCEL' : 'ADD'} onClick={() => setAdding((a) => !a)} disabled={!hasEngine()} />}
      >
        timers
      </PanelHeader>

      {adding && (
        <form
          className="mb-3 flex flex-wrap items-end gap-x-4 gap-y-2 rounded border border-hairline p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <select value={kind} onChange={(e) => setKind(e.target.value as TimerKind)} className="text-sm">
            <option value="countdown">countdown</option>
            <option value="to-time">counts to a time</option>
            <option value="elapsed">stopwatch</option>
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" className="w-36 text-sm" />
          {kind === 'countdown' && (
            <label className="flex items-baseline gap-x-2">
              <input value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="decimal" className="w-14 text-sm" />
              <span className="text-[10px] uppercase tracking-widest text-neutral-400">min</span>
            </label>
          )}
          {kind === 'to-time' && (
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="10:30" className="w-20 text-sm" />
          )}
          <Button label="Create" variant="solid" onClick={() => void create()} />
        </form>
      )}

      {timers.length === 0 ? (
        <EmptyState>no timers — add a countdown for the pre-service screen</EmptyState>
      ) : (
        <ul className="divide-y divide-hairline">
          {timers.map((t) => (
            <li key={t.id} className="flex items-center gap-x-4 py-2">
              <span className={`w-24 shrink-0 font-mono text-lg tabular-nums ${t.overrunning ? 'text-red-400' : ''}`}>
                {t.display}
              </span>
              <span className="min-w-0 grow truncate text-sm text-neutral-400">{t.name}</span>
              <TextButton
                label={t.state === 'running' ? 'PAUSE' : 'START'}
                primary={t.state === 'running'}
                onClick={() =>
                  void (t.state === 'running' ? window.api?.pauseTimer?.(t.id) : window.api?.startTimer?.(t.id))?.then(refresh)
                }
              />
              <TextButton label="RESET" onClick={() => void window.api?.resetTimer?.(t.id)?.then(refresh)} />
              <TextButton label="REMOVE" onClick={() => void window.api?.removeTimer?.(t.id)?.then(refresh)} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs leading-relaxed text-neutral-500">
        Put a timer on the stage monitor in Settings, or drop one into a message with{' '}
        <code>{'{timer:name}'}</code>.
      </p>
    </Panel>
  );
}

function QueuePanel() {
  const queue = useLiveStore((s) => s.queue);

  const showNow = (ref: string) => {
    const api = window.api;
    if (!api) return;
    if (api.showQueuedVerse) void api.showQueuedVerse(ref).catch(() => api.sendText(ref));
    else api.sendText(ref);
  };

  return (
    <Panel dataTour="queue" className="shrink-0">
      <PanelHeader right={queue.length > 0 ? <Pill active>{queue.length}</Pill> : undefined}>
        mentioned, not shown
      </PanelHeader>
      {queue.length === 0 ? (
        <EmptyState>verses the preacher defers will wait here</EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {queue.map((item) => (
            <li key={`${item.ref}-${item.ts}`} className="flex items-baseline justify-between gap-x-3">
              <div className="min-w-0">
                <p className="truncate font-scripture text-base">{item.ref}</p>
                <p className="truncate text-xs text-neutral-400">{item.reason}</p>
              </div>
              <Button label="Show now" variant="solid" onClick={() => showNow(item.ref)} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function PulpitLogPanel() {
  const voiceLog = useLiveStore((s) => s.voiceLog);
  if (voiceLog.length === 0) return null;

  return (
    <Panel className="shrink-0">
      <PanelHeader>heard from the pulpit</PanelHeader>
      <ul className="space-y-1.5">
        {voiceLog.slice(0, 5).map((event, i) => (
          <li key={`${event.ts}-${i}`} className="text-xs text-neutral-500">
            <span className="font-scripture italic">“…{event.utterance}”</span>
            <span className="px-1.5">→</span>
            {describeVoiceCommand(event)}
            <span className="pl-2 text-[10px] text-neutral-400">{clockTime(event.ts)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom control strip                                                */
/* ------------------------------------------------------------------ */

/** Input device labels, refreshed on plug/unplug. Unlocks labels itself. */
function useAudioInputs(): string[] {
  const [labels, setLabels] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void listAudioInputs().then((inputs) => {
        if (!cancelled) setLabels(inputs.map((d) => d.label));
      });
    };
    load();
    const unsub = onDeviceChange(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  return labels;
}

/** Red banner when the bible database is missing — otherwise verses render
 *  as reference-only and nobody knows why. */
function DbBanner() {
  const [status, setStatus] = useState<{ connected: boolean; error?: string } | null>(null);
  useEffect(() => {
    void window.api?.getDbStatus?.().then(setStatus).catch(() => undefined);
  }, []);
  if (!status || status.connected) return null;
  return (
    <div className="shrink-0 bg-red-700 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white">
      bible database not found — verses will show without text. reinstall the app or contact support.
      {status.error ? ` (${status.error})` : ''}
    </div>
  );
}

function elapsed(since: number, now: number): string {
  const s = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function BottomBar({ onEndService }: { onEndService: () => void }) {
  const asrStatus = useAppStore((s) => s.asrStatus);
  const asrDetail = useAppStore((s) => s.asrDetail);
  const setAsrStatus = useAppStore((s) => s.setAsrStatus);
  const audioLevel = useAppStore((s) => s.audioLevel);
  const segment = useAppStore((s) => s.segment);
  const prayerMode = useAppStore((s) => s.prayerMode);
  const listeningSince = useAppStore((s) => s.listeningSince);
  const setListeningSince = useAppStore((s) => s.setListeningSince);
  const settings = useAppStore((s) => s.settings);
  const patchSetting = useAppStore((s) => s.patchSetting);
  const practice = useLiveStore((s) => s.practice);

  const inputs = useAudioInputs();
  const savedDevice = typeof settings?.micDeviceLabel === 'string' ? settings.micDeviceLabel : '';
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (listeningSince == null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [listeningSince]);

  const listening = asrStatus === 'listening' || asrStatus === 'connecting';

  const start = () => {
    window.api?.startListening(savedDevice || undefined);
    // Optimistic — corrected by onAsrStatus when the engine exposes it.
    setAsrStatus('listening');
    setListeningSince(Date.now());
  };
  const stop = () => {
    window.api?.stopListening();
    setAsrStatus('stopped');
    setListeningSince(null);
  };

  const chooseDevice = (label: string) => {
    patchSetting('micDeviceLabel', label);
    void window.api?.setSetting('micDeviceLabel', label);
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline bg-surface px-4 py-2.5">
      <span data-tour="start-listening">
        {listening ? (
          <Button label="Stop listening" variant="outline" big onClick={stop} />
        ) : (
          <Button label="Start listening" variant="solid" big onClick={start} disabled={!hasEngine()} />
        )}
      </span>

      <label className="flex items-center gap-x-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">mic</span>
        <select
          value={savedDevice}
          onChange={(e) => chooseDevice(e.target.value)}
          disabled={listening}
          className="max-w-52 text-xs"
        >
          <option value="">default microphone</option>
          {inputs.length === 0 && (
            <option value="" disabled>
              no inputs found — check cables & sound settings
            </option>
          )}
          {inputs.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {listening && <LevelMeter db={audioLevel} />}
      {asrDetail && (
        <span
          className={`max-w-72 truncate text-[10px] uppercase tracking-widest ${
            asrStatus === 'error' ? 'text-red-500' : 'text-neutral-400'
          }`}
          title={asrDetail}
        >
          {asrDetail}
        </span>
      )}
      {listeningSince != null && (
        <span className="text-xs tabular-nums tracking-widest text-neutral-500">{elapsed(listeningSince, now)}</span>
      )}

      <div className="flex items-center gap-x-2">
        {segment && <Pill active>{segment.type}</Pill>}
        {prayerMode && <Pill active>prayer · display held</Pill>}
      </div>

      <div className="ml-auto flex items-center gap-x-5">
        <span data-tour="practice">
          {practice ? (
            <TextButton label="STOP PRACTICE" primary onClick={stopPractice} />
          ) : (
            <TextButton
              label="PRACTICE"
              onClick={startPractice}
              disabled={!hasEngine() || listening}
              title="Rehearse with a simulated service — nothing is recorded"
            />
          )}
        </span>
        <span data-tour="end-service">
          <Button label="End service" variant="outline" onClick={onEndService} disabled={!hasEngine()} />
        </span>
      </div>
    </div>
  );
}

function PracticeBanner() {
  const practice = useLiveStore((s) => s.practice);
  if (!practice) return null;

  return (
    <div className="flex shrink-0 items-center gap-x-4 bg-accent px-4 py-2 text-white">
      <span className="text-[10px] font-bold uppercase tracking-widest">
        practice · {practice.step}/{practice.total}
      </span>
      <p className="min-w-0 flex-1 truncate text-sm" title={practice.coach}>
        {practice.coach}
      </p>
      <button
        type="button"
        onClick={stopPractice}
        className="shrink-0 rounded border border-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest hover:bg-white hover:text-ink"
      >
        Stop practice
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* End-of-service review                                               */
/* ------------------------------------------------------------------ */

function AmendInputs({ item, onAmend }: { item: ReviewItem; onAmend: (ref: VerseRef) => void }) {
  const [book, setBook] = useState(item.proposed?.book ?? '');
  const [chapter, setChapter] = useState(item.proposed ? String(item.proposed.chapter) : '');
  const [verse, setVerse] = useState(item.proposed?.verse != null ? String(item.proposed.verse) : '');

  const apply = () => {
    const ch = Number.parseInt(chapter, 10);
    if (!book.trim() || Number.isNaN(ch)) return;
    const v = Number.parseInt(verse, 10);
    onAmend({ book: book.trim(), chapter: ch, verse: Number.isNaN(v) ? null : v });
  };

  return (
    <span className="flex flex-wrap items-baseline gap-x-3">
      <input value={book} onChange={(e) => setBook(e.target.value)} placeholder="book" className="w-28 text-sm" />
      <input value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="ch" inputMode="numeric" className="w-10 text-sm" />
      <input value={verse} onChange={(e) => setVerse(e.target.value)} placeholder="vs" inputMode="numeric" className="w-10 text-sm" />
      <TextButton label="APPLY" primary onClick={apply} />
    </span>
  );
}

function ReviewRow({ item }: { item: ReviewItem }) {
  const markReviewResolved = useLiveStore((s) => s.markReviewResolved);
  const [amending, setAmending] = useState(false);

  const resolve = (resolution: ReviewResolution, amendedTo?: VerseRef) => {
    void window.api?.resolveReviewItem?.(item.id, resolution, amendedTo)?.catch(() => undefined);
    markReviewResolved(item.id, resolution, amendedTo);
    setAmending(false);
  };

  const proposedText = item.proposed
    ? `${item.proposed.book} ${item.proposed.chapter}${item.proposed.verse != null ? `:${item.proposed.verse}` : ''}`
    : 'no reference proposed';

  return (
    <li>
      <Panel className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
          {clockTime(item.ts)} · {item.kind}
        </p>
        <p className="font-scripture text-lg italic">“{item.heard}”</p>
        <p className="text-sm">
          proposed · <span className="font-scripture">{proposedText}</span>
        </p>
        {item.resolution ? (
          <p className={`text-xs uppercase tracking-widest ${item.resolution === 'rejected' ? 'text-neutral-400' : 'text-accent'}`}>
            {item.resolution}
            {item.amendedTo && (
              <span className="pl-2 font-scripture normal-case tracking-normal">
                → {item.amendedTo.book} {item.amendedTo.chapter}
                {item.amendedTo.verse != null ? `:${item.amendedTo.verse}` : ''}
              </span>
            )}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button label="Confirm" variant="solid" onClick={() => resolve('confirmed')} />
            <Button label="Reject" onClick={() => resolve('rejected')} />
            <TextButton label="AMEND" onClick={() => setAmending((a) => !a)} />
            {amending && <AmendInputs item={item} onAmend={(ref) => resolve('amended', ref)} />}
          </div>
        )}
      </Panel>
    </li>
  );
}

function ServiceReview({ onBack }: { onBack: () => void }) {
  const reviewItems = useLiveStore((s) => s.reviewItems);
  const setGeneratedNotes = useLiveStore((s) => s.setGeneratedNotes);
  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [busy, setBusy] = useState<'summary' | 'notes' | null>(null);

  const saveSummary = async () => {
    setBusy('summary');
    try {
      const res = await window.api?.saveServiceSummary();
      setSummaryResult(res?.success ? `summary saved${res.path ? ` — ${res.path}` : ''}` : res?.error ?? 'could not save summary');
    } catch {
      setSummaryResult('could not save summary');
    } finally {
      setBusy(null);
    }
  };

  const generateNotes = async () => {
    setBusy('notes');
    try {
      const notes = await window.api?.generateSermonNotes();
      if (notes) {
        /* The NOTES tab is gone — the sermon-notes card on the dashboard
           owns the outline and both exports now. The notes still land in
           the live store, which is what that card reads, so this only
           stopped jumping somewhere. */
        setGeneratedNotes(notes);
        setSummaryResult('notes generated — see the sermon notes card');
      }
    } catch {
      setSummaryResult('could not generate notes');
    } finally {
      setBusy(null);
    }
  };

  const unresolved = reviewItems.filter((i) => !i.resolution).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">Service review</h2>
          <p className="text-sm text-neutral-500">
            {reviewItems.length === 0
              ? 'No uncertain moments were queued.'
              : `${reviewItems.length} uncertain ${reviewItems.length === 1 ? 'moment' : 'moments'} · ${unresolved} left to resolve. Your answers train this preacher's profile.`}
          </p>
          {!hasEngine() && <EngineNote />}
        </div>

        {reviewItems.length > 0 && (
          <ul className="space-y-4">
            {reviewItems.map((item) => (
              <ReviewRow key={item.id} item={item} />
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button label="Save summary" variant="solid" onClick={() => void saveSummary()} disabled={!hasEngine() || busy != null} />
          <Button label="Generate notes" variant="solid" onClick={() => void generateNotes()} disabled={!hasEngine() || busy != null} />
          <TextButton label="BACK TO LIVE" onClick={onBack} />
        </div>
        {busy && <p className="text-sm italic text-neutral-400">{busy === 'summary' ? 'saving…' : 'generating…'}</p>}
        {summaryResult && <p className="text-sm text-neutral-500">{summaryResult}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function Live() {
  const setReviewItems = useLiveStore((s) => s.setReviewItems);
  const practice = useLiveStore((s) => s.practice);
  const setAsrStatus = useAppStore((s) => s.setAsrStatus);
  const setListeningSince = useAppStore((s) => s.setListeningSince);
  const [phase, setPhase] = useState<'live' | 'review'>('live');

  const endService = async () => {
    if (practice) stopPractice();
    window.api?.stopListening();
    setAsrStatus('stopped');
    setListeningSince(null);
    try {
      await window.api?.endService();
    } catch {
      /* engine may have no active service; review anyway */
    }
    try {
      const items = (await window.api?.getReviewItems?.()) ?? [];
      setReviewItems(items);
    } catch {
      setReviewItems([]);
    }
    setPhase('review');
  };

  if (phase === 'review') {
    return <ServiceReview onBack={() => setPhase('live')} />;
  }

  return (
    <div className="flex h-full flex-col">
      <DbBanner />
      <PracticeBanner />
      <div className="grid min-h-0 flex-1 grid-cols-[230px_minmax(0,1fr)_360px] gap-3 p-3">
        <ServiceOrderPanel />
        <div className="flex min-h-0 flex-col gap-3">
          <PreviewPanel />
          <TranscriptPanel />
          <ScriptureSearch />
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <OutputPanel />
          <AlertPanel />
          <TimersPanel />
          <QueuePanel />
          <PulpitLogPanel />
        </div>
      </div>
      <BottomBar onEndService={() => void endService()} />
    </div>
  );
}
