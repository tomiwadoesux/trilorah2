import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useLiveStore } from '../stores/liveStore';
import { TextButton, SectionLabel, EngineNote, hasEngine } from '../components/ui';
import { formatRef, describeVoiceCommand, clockTime } from '../lib/verse';

const EMPHASIS_WINDOW_MS = 3000;

/* ------------------------------------------------------------------ */
/* Transcript                                                          */
/* ------------------------------------------------------------------ */

function TranscriptStream() {
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

  if (lines.length === 0) {
    return hasEngine() ? (
      <p className="text-sm italic text-neutral-400">waiting for the first words…</p>
    ) : (
      <EngineNote />
    );
  }

  return (
    <div ref={scrollRef} className="max-h-[42vh] overflow-y-auto">
      <p className="text-lg leading-relaxed md:text-xl">
        {lines.map((line) => {
          const recent = now - line.ts < EMPHASIS_WINDOW_MS;
          return (
            <span key={line.id} className={recent ? 'font-medium text-ink' : 'text-neutral-500'}>
              {line.text}{' '}
            </span>
          );
        })}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Listening controls                                                  */
/* ------------------------------------------------------------------ */

function ListeningControls() {
  const asrStatus = useAppStore((s) => s.asrStatus);
  const setAsrStatus = useAppStore((s) => s.setAsrStatus);
  const audioLevel = useAppStore((s) => s.audioLevel);
  const [deviceLabel, setDeviceLabel] = useState('');

  const listening = asrStatus === 'listening' || asrStatus === 'connecting';

  const start = () => {
    window.api?.startListening(deviceLabel.trim() || undefined);
    // Optimistic — corrected by onAsrStatus when the engine exposes it.
    setAsrStatus('listening');
  };
  const stop = () => {
    window.api?.stopListening();
    setAsrStatus('stopped');
  };

  return (
    <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
      {listening ? (
        <TextButton label="STOP LISTENING" onClick={stop} />
      ) : (
        <TextButton label="START LISTENING" primary onClick={start} disabled={!hasEngine()} />
      )}
      <label className="flex items-baseline gap-x-3 text-sm">
        <span className="text-xs uppercase tracking-widest text-neutral-400">device</span>
        <input
          value={deviceLabel}
          onChange={(e) => setDeviceLabel(e.target.value)}
          placeholder="default microphone"
          className="w-56 text-sm"
        />
      </label>
      {listening && audioLevel != null && (
        <span className="text-xs tracking-widest text-neutral-400">{audioLevel} dB</span>
      )}
      <TextButton label="OPEN OUTPUT" onClick={() => window.api?.openOutput()} disabled={!hasEngine()} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Preview / Live verse blocks                                         */
/* ------------------------------------------------------------------ */

function PreviewBlock() {
  const preview = useLiveStore((s) => s.preview);
  const setPreview = useLiveStore((s) => s.setPreview);
  const setLive = useLiveStore((s) => s.setLive);

  const push = () => {
    window.api?.pushToLive();
    if (preview) {
      setLive(preview);
      setPreview(null);
    }
  };

  return (
    <section className="space-y-3">
      <SectionLabel>preview</SectionLabel>
      {preview ? (
        <div className="space-y-3">
          <p className="font-scripture text-2xl">{formatRef(preview.detection)}</p>
          {preview.text ? (
            <p className="font-scripture text-lg leading-relaxed">{preview.text}</p>
          ) : (
            <p className="text-sm italic text-neutral-400">fetching text…</p>
          )}
          <div className="flex gap-x-8">
            <TextButton label="PUSH TO LIVE" primary onClick={push} />
            <TextButton label="DISMISS" onClick={() => setPreview(null)} />
          </div>
        </div>
      ) : (
        <p className="text-sm italic text-neutral-400">nothing in preview</p>
      )}
    </section>
  );
}

function LiveBlock() {
  const live = useLiveStore((s) => s.live);
  const displayVersion = useLiveStore((s) => s.displayVersion);
  const version = live?.detection.version ?? displayVersion ?? 'KJV';

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-x-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">live</span>
        <span className="text-xs uppercase tracking-widest text-neutral-400">{version}</span>
      </div>
      {live ? (
        <div className="space-y-3">
          <p className="font-scripture text-2xl text-accent">{formatRef(live.detection)}</p>
          {live.text && <p className="font-scripture text-lg leading-relaxed">{live.text}</p>}
        </div>
      ) : (
        <p className="text-sm italic text-neutral-400">output is clear</p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Queue, state line, voice log, manual input                          */
/* ------------------------------------------------------------------ */

function VerseQueue() {
  const queue = useLiveStore((s) => s.queue);
  if (queue.length === 0) return null;

  return (
    <section className="space-y-3">
      <SectionLabel>mentioned, not shown</SectionLabel>
      <ul className="space-y-2">
        {queue.map((item) => (
          <li key={`${item.ref}-${item.ts}`} className="flex flex-wrap items-baseline gap-x-6">
            <span className="font-scripture text-lg">{item.ref}</span>
            <span className="text-sm text-neutral-400">{item.reason}</span>
            <TextButton label="SHOW NOW" primary onClick={() => window.api?.sendText(item.ref)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function EngineStateLine() {
  const segment = useAppStore((s) => s.segment);
  const intentState = useAppStore((s) => s.intentState);
  const prayerMode = useAppStore((s) => s.prayerMode);

  return (
    <section className="space-y-2">
      <p className="text-xs uppercase tracking-widest text-neutral-400">
        segment · {segment ? `${segment.type} since ${clockTime(segment.startedAt)}` : 'unknown'}
        <span className="px-2">—</span>
        intent · {intentState}
      </p>
      {prayerMode && (
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">
          prayer — display suppressed
        </p>
      )}
    </section>
  );
}

function VoiceCommandLog() {
  const voiceLog = useLiveStore((s) => s.voiceLog);
  if (voiceLog.length === 0) return null;

  return (
    <section className="space-y-3">
      <SectionLabel>heard from the pulpit</SectionLabel>
      <ul className="space-y-1.5">
        {voiceLog.slice(0, 6).map((event, i) => (
          <li key={`${event.ts}-${i}`} className="text-sm text-neutral-500">
            <span className="font-scripture italic">“…{event.utterance}”</span>
            <span className="px-2">→</span>
            {describeVoiceCommand(event)}
            <span className="pl-3 text-xs text-neutral-400">{clockTime(event.ts)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ManualInput() {
  const [text, setText] = useState('');
  const send = () => {
    const t = text.trim();
    if (!t) return;
    window.api?.sendText(t);
    setText('');
  };

  return (
    <section className="space-y-3">
      <SectionLabel>typed fallback</SectionLabel>
      <form
        className="flex items-baseline gap-x-6"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="type a reference or phrase, e.g. John 3:16"
          className="w-full max-w-md text-sm"
        />
        <TextButton label="SEND" primary onClick={send} disabled={!hasEngine() || !text.trim()} />
      </form>
    </section>
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
    <li className="space-y-2 border-b border-hairline pb-5">
      <p className="text-xs uppercase tracking-widest text-neutral-400">
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
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <TextButton label="CONFIRM" primary onClick={() => resolve('confirmed')} />
          <TextButton label="REJECT" onClick={() => resolve('rejected')} />
          <TextButton label="AMEND" onClick={() => setAmending((a) => !a)} />
          {amending && <AmendInputs item={item} onAmend={(ref) => resolve('amended', ref)} />}
        </div>
      )}
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
    <div className="space-y-10">
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
        <ul className="space-y-5">
          {reviewItems.map((item) => (
            <ReviewRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
        <TextButton label="SAVE SUMMARY" primary onClick={() => void saveSummary()} disabled={!hasEngine() || busy != null} />
        <TextButton label="GENERATE NOTES" primary onClick={() => void generateNotes()} disabled={!hasEngine() || busy != null} />
        <TextButton label="BACK TO LIVE" onClick={onBack} />
      </div>
      {busy && <p className="text-sm italic text-neutral-400">{busy === 'summary' ? 'saving…' : 'generating…'}</p>}
      {summaryResult && <p className="text-sm text-neutral-500">{summaryResult}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function Live() {
  const setReviewItems = useLiveStore((s) => s.setReviewItems);
  const setAsrStatus = useAppStore((s) => s.setAsrStatus);
  const [phase, setPhase] = useState<'live' | 'review'>('live');

  const endService = async () => {
    window.api?.stopListening();
    setAsrStatus('stopped');
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
    <div className="space-y-12">
      <ListeningControls />

      <section className="space-y-3">
        <SectionLabel>transcript</SectionLabel>
        <TranscriptStream />
      </section>

      <PreviewBlock />
      <div className="border-b border-hairline" />
      <LiveBlock />
      <VerseQueue />
      <EngineStateLine />
      <VoiceCommandLog />
      <ManualInput />

      <div className="border-t border-hairline pt-8">
        <TextButton label="END SERVICE" onClick={() => void endService()} disabled={!hasEngine()} />
      </div>
    </div>
  );
}
