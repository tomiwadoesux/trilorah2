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
    window.api?.pushToLive();
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
            <EmptyState>waiting for the first words…</EmptyState>
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
          <TextButton label="CLEAR" onClick={() => setLive(null)} disabled={!live} />
        </div>
      </div>
      {/* The projector canvas — a faithful miniature of the audience screen. */}
      <div className="flex aspect-video flex-col items-center justify-center gap-y-3 bg-canvas px-6 text-center">
        {live ? (
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
        <span className="ml-auto flex items-baseline gap-x-3">
          <TextButton label={qrShown ? 'HIDE QR' : 'SHOW QR'} primary={qrShown} onClick={() => void toggleQr()} disabled={!hasEngine()} />
          {qrNote && <span className="text-[10px] text-neutral-400">{qrNote}</span>}
        </span>
      </div>
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
  const setTab = useAppStore((s) => s.setTab);
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
        setGeneratedNotes(notes);
        setTab('notes');
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
          <QueuePanel />
          <PulpitLogPanel />
        </div>
      </div>
      <BottomBar onEndService={() => void endService()} />
    </div>
  );
}
