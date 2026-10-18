"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Settings2, Minus, Plus, RotateCcw, Radio } from '@/components/icons';
import type { WordTiming } from '@/lib/wordTimings';
import { readingPassages, currentReadingWord, delayedReadingPosition, readingWordPhase, type ReadingPassage } from '@/lib/readAlong';
import { DEFAULT_HOLD_MS, NUDGE_STEP_MS, clampNudge, formatNudge, readNudge, writeNudge } from '@/lib/syncPrefs';
import { usePlayhead } from '@/lib/usePlayhead';
import StreamPlayer from './StreamPlayer';
import CompanionEmpty from './CompanionEmpty';
import { capitalizeScriptureNames, capitalizeScriptureWords } from '../../../../../../shared/scriptureNames';

interface Chunk { id: string; text: string; is_final: boolean; timestamp: string; segment_type: string; words: WordTiming[] | null; offset_ms: number | null }
interface Verse { id: string; ref: string; pushed_at: string }

export default function TranscriptStream({ chunks, verses, segment, isLive, publishTranscript, serviceStartedAt, streamUrl, loading = false, loadError = false, onRetry }: {
  chunks: Chunk[]; verses: Verse[]; segment: string; isLive: boolean; publishTranscript: boolean;
  serviceStartedAt: string; streamUrl: string | null;
  loading?: boolean; loadError?: boolean; onRetry?: () => void;
}) {
  const startedAtMs = Date.parse(serviceStartedAt);
  const livePassages = useMemo(() => readingPassages(chunks.map(c => ({ ...c,
    text: capitalizeScriptureNames(c.text), words: c.words?.length ? capitalizeScriptureWords(c.words) : null,
  })), startedAtMs), [chunks, startedAtMs]);
  const [heldPassages, setHeldPassages] = useState<ReadingPassage[] | null>(null);
  const passages = heldPassages ?? livePassages;
  const words = useMemo(() => passages.flatMap(p => p.words).sort((a, b) => a.s - b.s), [passages]);
  const start = words[0]?.s ?? 0;
  const end = words.at(-1)?.e ?? start;
  const hasTimings = words.length > 0;
  const [nudgeMs, setNudgeMs] = useState(0);
  useEffect(() => setNudgeMs(readNudge()), []);
  const setNudge = useCallback((next: number) => { const value = clampNudge(next); setNudgeMs(value); writeNudge(value); }, []);
  const playerSeconds = useRef<number | null>(null);
  const [playerDriving, setPlayerDriving] = useState(false);
  const onPlayerSeconds = useCallback((seconds: number | null) => { playerSeconds.current = seconds; }, []);
  const [following, setFollowing] = useState(true);
  const heldPosition = useRef<number | null>(null);
  const readingActive = isLive || playerDriving;
  useEffect(() => {
    if (!readingActive) { heldPosition.current = null; setHeldPassages(null); setFollowing(true); }
  }, [readingActive]);
  const compute = useCallback(() => {
    if (heldPosition.current != null && readingActive) return heldPosition.current;
    if (playerSeconds.current != null) return delayedReadingPosition(playerSeconds.current, DEFAULT_HOLD_MS, nudgeMs);
    if (isLive) return delayedReadingPosition((Date.now() - startedAtMs) / 1000, DEFAULT_HOLD_MS, nudgeMs);
    return end + 2;
  }, [isLive, readingActive, startedAtMs, nudgeMs, end]);
  const playhead = usePlayhead(compute);
  const [sheetOpen, setSheetOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastLineTop = useRef<number | null>(null);
  const current = readingActive ? currentReadingWord(words, playhead) : null;
  const currentPassage = passages.findLastIndex(p => p.from <= playhead);
  // A bounded moving window includes earlier context AND the words still ahead.
  // Freeze it while the reader scrolls back, so the DOM cannot move under them.
  const [windowStart, setWindowStart] = useState(0);
  useEffect(() => {
    if (!readingActive || !following || currentPassage < 0) return;
    if (currentPassage < windowStart || currentPassage >= windowStart + 10) setWindowStart(Math.max(0, currentPassage - 3));
  }, [currentPassage, following, windowStart, readingActive]);
  const visible = passages.slice(windowStart, windowStart + 18);
  const scrollToCurrent = useCallback((instant = false) => {
    const container = scrollRef.current;
    const word = container?.querySelector<HTMLElement>('[data-current="true"]') ?? container?.querySelector<HTMLElement>('[data-anchor="true"]');
    if (!container || !word || !container.clientHeight) return;
    const top = word.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    if (!instant && lastLineTop.current != null && Math.abs(top - lastLineTop.current) < 8) return;
    lastLineTop.current = top;
    // Scroll only at a line change; never restart a smooth scroll every word.
    container.scrollTo({ top: Math.max(0, top - container.clientHeight * .32),
      behavior: instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, []);
  useEffect(() => { if (readingActive && following) scrollToCurrent(); }, [current, currentPassage, following, windowStart, scrollToCurrent, readingActive]);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => { if (readingActive && following) { lastLineTop.current = null; scrollToCurrent(true); } });
    observer.observe(container);
    const content = container.querySelector('.reader-passages');
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [following, scrollToCurrent, hasTimings, chunks.length > 0, readingActive]);
  const holdReading = () => {
    if (!readingActive) return;
    heldPosition.current = compute();
    setHeldPassages(passages);
    setFollowing(false);
  };
  const resumeFollowing = () => {
    heldPosition.current = null;
    setHeldPassages(null);
    const index = livePassages.findLastIndex(p => p.from <= compute());
    setWindowStart(Math.max(0, index - 3));
    setFollowing(true); lastLineTop.current = null;
  };
  const matchedVerses = useMemo(() => {
    const result = new Map<string, Verse[]>();
    for (const verse of verses) {
      let best: Chunk | undefined;
      let distance = 8000;
      for (const chunk of chunks) {
        const diff = Math.abs(Date.parse(chunk.timestamp) - Date.parse(verse.pushed_at));
        if (diff < distance) { best = chunk; distance = diff; }
      }
      const passage = best && passages.find(p => p.chunkIds.includes(best!.id));
      if (passage) result.set(passage.id, [...(result.get(passage.id) ?? []), verse]);
    }
    return result;
  }, [chunks, verses, passages]);

  if (isLive && ['worship', 'prayer'].includes(segment)) return <CompanionEmpty title={segment === 'worship' ? 'A moment of worship' : 'A moment of prayer'}>Follow along will return when the message continues.</CompanionEmpty>;
  if (!publishTranscript) return <CompanionEmpty title="This transcript isn’t shared">You can still explore the scriptures and notes published for this service.</CompanionEmpty>;
  if (!chunks.length && loading) return <CompanionEmpty title="Opening the message…">Loading the published words for this service.</CompanionEmpty>;
  if (!chunks.length && loadError) return <div className="read-along"><CompanionEmpty title="Couldn’t load the message">Check your connection, then try again.</CompanionEmpty><button className="resource-link" style={{ justifyContent: 'center', marginBottom: 24 }} onClick={onRetry}>Try again</button></div>;
  if (!chunks.length) return <div className="read-along"><StreamPlayer url={streamUrl} onSeconds={onPlayerSeconds} onDrivingChange={setPlayerDriving}/><CompanionEmpty title={isLive ? 'Ready for the first word' : 'No transcript published'}>{isLive ? 'Keep this page open. The message will appear here as it is spoken.' : 'The church hasn’t shared a transcript for this service.'}</CompanionEmpty></div>;

  const waitingForWords = isLive && following && hasTimings && playhead > end + 1.5;
  return <div className="read-along" data-reading-active={readingActive}>
    <StreamPlayer url={streamUrl} onSeconds={onPlayerSeconds} onDrivingChange={setPlayerDriving} />
    <div className="reader-toolbar">
      <span><Radio size={16}/>{isLive ? 'LIVE TRANSCRIPT' : 'PUBLISHED TRANSCRIPT'}</span>
      {readingActive && hasTimings && <button className="reader-sync" onClick={() => setSheetOpen(true)} aria-label="Adjust transcript sync"><Settings2 size={18}/><span>Sync</span></button>}
    </div>
    <div className="reader-scroll-wrap">
      <div ref={scrollRef} className="transcript-words" tabIndex={0} aria-label="Service transcript" onWheel={holdReading} onTouchMove={holdReading} onKeyDown={e => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) holdReading(); }}>
        {windowStart > 0 && <button className="reader-history" onClick={() => { holdReading(); setWindowStart(Math.max(0, windowStart - 12)); scrollRef.current?.scrollTo({ top: 0 }); }}>Earlier words</button>}
        <div className="reader-passages">
          {visible.map(p => <p key={p.id} className="reader-passage" data-timed={p.words.length > 0} data-anchor={p.id === passages[currentPassage]?.id ? 'true' : undefined} data-phase={playhead < p.from ? 'upcoming' : playhead > p.to ? 'past' : 'current'}>
            {p.words.length ? p.words.map(w => <span key={w.id}><span data-word={w.id} data-phase={readingWordPhase(w, current, playhead)} data-current={current === w.id ? 'true' : undefined} className={`reader-word ${current === w.id ? 'reader-word--current' : ''}`}>{w.w}</span>{' '}</span>) : p.text}
            {matchedVerses.get(p.id)?.map(v => <span className="companion-verse-pill" key={v.id}>{v.ref}</span>)}
          </p>)}
        </div>
        {windowStart + 18 < passages.length && <button className="reader-history" onClick={() => { holdReading(); setWindowStart(windowStart + 12); scrollRef.current?.scrollTo({ top: 0 }); }}>Later words</button>}
      </div>
    </div>
    <div className="reader-status-bar">
      <div className="reader-status-copy" role="status"><span className={isLive ? 'companion-live' : ''}>{!following && readingActive ? 'Reading held' : waitingForWords ? 'Waiting for more words' : isLive ? 'Following live' : playerDriving ? 'Following the stream' : 'Read at your own pace'}</span>{readingActive && <small>{!following ? 'New words keep arriving' : playerDriving ? 'A few seconds behind the video' : nudgeMs === 0 ? 'About 5 seconds behind' : 'Timing adjusted on this device'}</small>}</div>
      {readingActive && <button className="reader-follow-control" onClick={following ? holdReading : resumeFollowing}>{following ? 'Hold reading' : <><ArrowDown size={16}/>{isLive ? 'Back to live' : 'Follow stream'}</>}</button>}
    </div>
    {sheetOpen && <SyncSheet nudgeMs={nudgeMs} onNudge={setNudge} onClose={() => setSheetOpen(false)} playerDriving={playerDriving}/>}
  </div>;
}

/** The nudge sheet. Plain language — "ahead"/"behind", not milliseconds. */
function SyncSheet({
  nudgeMs,
  onNudge,
  onClose,
  playerDriving,
}: {
  nudgeMs: number;
  onNudge: (ms: number) => void;
  onClose: () => void;
  playerDriving: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const panel = dialog.current;
    const previous = document.activeElement;
    panel?.showModal();
    return () => {
      panel?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="reading-dialog companion-sync-dialog"
      aria-labelledby="transcript-sync-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        className="reading-options-panel"
      >
        <h2 id="transcript-sync-title" className="text-lg font-semibold mb-1">Transcript sync</h2>
        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
          {playerDriving
            ? "Following the video’s clock. Nudge the words if they lead or trail the audio."
            : "If the words are landing before or after you hear them, nudge them here. Remembered on this device."}
        </p>

        <div className="flex items-center justify-between gap-3">
          <SheetButton
            label="Too late"
            icon={<Minus size={16} />}
            onClick={() => onNudge(nudgeMs - NUDGE_STEP_MS)}
          />
          <div className="text-center min-w-[92px]">
            <p className="text-lg font-semibold tabular-nums">{formatNudge(nudgeMs)}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-600 mt-0.5">
              1s steps
            </p>
          </div>
          <SheetButton
            label="Too early"
            icon={<Plus size={16} />}
            onClick={() => onNudge(nudgeMs + NUDGE_STEP_MS)}
          />
        </div>

        {nudgeMs !== 0 && (
          <button
            onClick={() => onNudge(0)}
            className="mt-5 w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        )}

        <button
          onClick={onClose}
          className="mt-3 w-full py-3 rounded-xl bg-white/5 text-sm font-medium hover:bg-white/10 transition-colors"
        >
          Done
        </button>
      </div>
    </dialog>
  );
}

function SheetButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.97] transition-all"
    >
      {icon}
      <span className="text-[11px] text-gray-400">{label}</span>
    </button>
  );
}
