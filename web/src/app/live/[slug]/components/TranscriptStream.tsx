"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Settings2, Minus, Plus, RotateCcw } from "@/components/icons";
import {
  activeWordIndex,
  playheadSeconds,
  wordState,
  type WordTiming,
} from "@/lib/wordTimings";
import {
  DEFAULT_HOLD_MS,
  DEFAULT_STREAM_DELAY_MS,
  NUDGE_STEP_MS,
  clampNudge,
  formatNudge,
  readNudge,
  writeNudge,
} from "@/lib/syncPrefs";
import { usePlayhead } from "@/lib/usePlayhead";
import StreamPlayer from "./StreamPlayer";

interface Chunk {
  id: string;
  text: string;
  is_final: boolean;
  timestamp: string;
  segment_type: string;
  words: WordTiming[] | null;
  offset_ms: number | null;
}

interface Verse {
  id: string;
  ref: string;
  pushed_at: string;
}

/**
 * A forty-minute sermon is ~6000 words. Rendering all of them as individual
 * spans is thousands of DOM nodes fighting a per-frame class update, on the
 * cheapest phone in the building. Older chunks stay in React state so the
 * viewer can scroll back a little, but only this many reach the DOM.
 */
const RENDER_WINDOW_CHUNKS = 14;

/** Where the word being spoken should sit on screen — not centred; reading happens below it. */
const ACTIVE_WORD_VIEWPORT_FRACTION = 0.4;

/**
 * One word, placed on the service's own timeline.
 *
 * `words[].s` is relative to the start of the chunk's recognised audio and
 * `offset_ms` is where that chunk's FIRST word sits in the service, so the two
 * are stitched by subtracting the chunk's own first start. Doing it once here
 * keeps the per-frame work down to a comparison.
 */
interface PlacedWord extends WordTiming {
  key: string;
}

interface Line {
  chunkId: string;
  /** Null on the whisper path — the chunk has text but no timings. */
  words: PlacedWord[] | null;
  text: string;
  verse: Verse | undefined;
  /** Absolute service seconds for the chunk's first and last word, when timed. */
  from: number;
  to: number;
}

/**
 * The congregation-facing transcript.
 *
 * Reads like the lyrics screen everyone already knows: words already spoken in
 * solid white, the word being spoken lit in the brand green, what is coming
 * dimmed. Chunk boundaries are deliberately invisible — a Deepgram chunk break
 * is an artefact of the socket, not a sentence, so consecutive chunks flow as
 * one paragraph rather than one box each.
 *
 * Everything runs a few seconds BEHIND the room on purpose. See syncPrefs for
 * why, and for the nudge the viewer gets when their stream disagrees.
 */
export default function TranscriptStream({
  chunks,
  verses,
  segment,
  isLive,
  publishTranscript,
  serviceStartedAt,
  streamUrl,
}: {
  chunks: Chunk[];
  verses: Verse[];
  segment: string;
  isLive: boolean;
  publishTranscript: boolean;
  serviceStartedAt: string;
  streamUrl: string | null;
}) {
  const startedAtMs = useMemo(
    () => new Date(serviceStartedAt).getTime(),
    [serviceStartedAt],
  );

  // Per-device sync nudge. Read in an effect, not in the initialiser: this
  // component server-renders and localStorage does not exist there.
  const [nudgeMs, setNudgeMs] = useState(0);
  useEffect(() => setNudgeMs(readNudge()), []);
  const setNudge = useCallback((next: number) => {
    const clamped = clampNudge(next);
    setNudgeMs(clamped);
    writeNudge(clamped);
  }, []);

  /**
   * When the embedded stream is playing we have the listener's ACTUAL clock and
   * every estimate above becomes unnecessary — currentTime is the truth.
   */
  const playerSecondsRef = useRef<number | null>(null);
  const [playerDriving, setPlayerDriving] = useState(false);

  const computePlayhead = useCallback(() => {
    const fromPlayer = playerSecondsRef.current;
    if (fromPlayer != null) {
      // The player's zero is the start of the broadcast, which is the start of
      // the service; the deliberate hold still applies so words do not land early.
      return Math.max(0, fromPlayer - DEFAULT_HOLD_MS / 1000);
    }
    // Only assume stream latency when there is actually a stream to be behind.
    //
    // The congregant sitting in the building is the common case and they are
    // behind the preacher by nothing at all, but this subtracted a full
    // twenty seconds of YouTube latency from their playhead regardless. The
    // words were on the page, yet the highlight and the auto-scroll were
    // parked ~24s back down the transcript, so the live word never showed
    // while the preacher was speaking. The deliberate hold still applies —
    // that one is about Deepgram revising its tail, not about the stream.
    const assumedStreamDelay = streamUrl ? DEFAULT_STREAM_DELAY_MS : 0;
    return playheadSeconds(
      Date.now(),
      startedAtMs,
      assumedStreamDelay + nudgeMs,
      DEFAULT_HOLD_MS,
    );
  }, [startedAtMs, nudgeMs, streamUrl]);

  const playhead = usePlayhead(computePlayhead);

  // Map verses onto the chunk nearest in wall-clock time, as before — verse
  // pushes carry a timestamp, not a word offset.
  const versesByChunkId = useMemo(() => {
    const map = new Map<string, Verse>();
    for (const v of verses) {
      const vt = new Date(v.pushed_at).getTime();
      let best: Chunk | null = null;
      let bestDiff = Infinity;
      for (const c of chunks) {
        const diff = Math.abs(new Date(c.timestamp).getTime() - vt);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = c;
        }
      }
      if (best && bestDiff < 8000) map.set(best.id, v);
    }
    return map;
  }, [chunks, verses]);

  /**
   * Ordered by the SERVICE timeline, then windowed.
   *
   * `timestamp` is when a chunk reached the database, which is not reliably the
   * order the words were spoken in: Deepgram can revise and re-send, and two
   * chunks that land in the same round trip carry the same timestamp, leaving
   * the sort to break ties however it likes. `offset_ms` is the recogniser's
   * own position in the audio and is the only honest answer. Untimed rows fall
   * back to their timestamp, which is all a whisper service gives us.
   */
  const ordered = useMemo(() => {
    const at = (c: Chunk) =>
      c.offset_ms != null ? startedAtMs + c.offset_ms : new Date(c.timestamp).getTime();
    return [...chunks].sort((a, b) => at(a) - at(b));
  }, [chunks, startedAtMs]);

  /** Only the tail reaches the DOM; the rest stays in state for scrollback. */
  const windowed = useMemo(
    () => ordered.slice(-RENDER_WINDOW_CHUNKS),
    [ordered],
  );

  const lines: Line[] = useMemo(
    () =>
      windowed.map((c) => {
        const timed = Array.isArray(c.words) && c.words.length > 0 ? c.words : null;
        if (!timed || c.offset_ms == null) {
          return {
            chunkId: c.id,
            words: null,
            text: c.text,
            verse: versesByChunkId.get(c.id),
            from: 0,
            to: 0,
          };
        }
        const base = c.offset_ms / 1000 - timed[0].s;
        const words: PlacedWord[] = timed.map((w, i) => ({
          w: w.w,
          s: base + w.s,
          e: base + w.e,
          key: `${c.id}:${i}`,
        }));
        return {
          chunkId: c.id,
          words,
          text: c.text,
          verse: versesByChunkId.get(c.id),
          from: words[0].s,
          to: words[words.length - 1].e,
        };
      }),
    [windowed, versesByChunkId],
  );

  const hasTimings = lines.some((l) => l.words !== null);

  if (segment === "worship") {
    return (
      <Placeholder
        emoji="🎵"
        title="Worship in progress"
        subtitle="Live transcript pauses during songs."
      />
    );
  }
  if (segment === "prayer") {
    return (
      <Placeholder emoji="🙏" title="In prayer" subtitle="Take a moment with the room." />
    );
  }
  if (!publishTranscript && !isLive) {
    return (
      <Placeholder
        emoji=""
        title="Transcript not archived"
        subtitle="The verses and notes for this service are still available — tap the tabs below."
      />
    );
  }
  if (chunks.length === 0) {
    return (
      <>
        <StreamPlayer
          url={streamUrl}
          onSeconds={(s) => (playerSecondsRef.current = s)}
          onDrivingChange={setPlayerDriving}
        />
        <Placeholder
          emoji=""
          title={isLive ? "Listening…" : "No transcript yet"}
          subtitle={isLive ? "The first words will land here in a moment." : ""}
        />
      </>
    );
  }

  return (
    <>
      <StreamPlayer
        url={streamUrl}
        onSeconds={(s) => (playerSecondsRef.current = s)}
        onDrivingChange={setPlayerDriving}
      />
      <TranscriptBody
        lines={lines}
        playhead={playhead}
        hasTimings={hasTimings}
        nudgeMs={nudgeMs}
        onNudge={setNudge}
        playerDriving={playerDriving}
        isLive={isLive}
      />
    </>
  );
}

/**
 * Split out so the hooks below it run on every render path that reaches the
 * transcript, and none of the placeholder paths — the early returns above would
 * otherwise make hook order conditional.
 */
function TranscriptBody({
  lines,
  playhead,
  hasTimings,
  nudgeMs,
  onNudge,
  playerDriving,
  isLive,
}: {
  lines: Line[];
  playhead: number;
  hasTimings: boolean;
  nudgeMs: number;
  onNudge: (ms: number) => void;
  playerDriving: boolean;
  isLive: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLElement | null>(null);
  const [following, setFollowing] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  /**
   * A viewer who scrolls up is reading something they missed; yanking them back
   * to the live word is the single rudest thing this page could do.
   *
   * Telling their scroll from ours turned out to be unanswerable from the
   * scroll event itself. A smooth scrollTo emits events for hundreds of
   * milliseconds, so a timer-based guard swallows a real finger drag that lands
   * inside it; and a position-based guard is defeated by anything that resizes
   * the container — opening the stream player shrinks it, the browser clamps
   * scrollTop to suit, and that is indistinguishable from a person scrolling.
   *
   * So the INPUT is the signal, not the scroll. A wheel, a touch or a keypress
   * in the transcript is a person; everything else is the page moving itself.
   * Unambiguous, and it cannot be confused by a layout change.
   */
  const stopFollowing = useCallback(() => setFollowing(false), []);

  const scrollTo = useCallback((top: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(top, el.scrollHeight - el.clientHeight));
    el.scrollTo({ top: clamped, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? "auto" : "smooth" });
  }, []);

  /**
   * Keep the lit word ~40% down the viewport. Scrolling to the ELEMENT rather
   * than to the bottom is what makes several lines of what is coming stay
   * visible below it, which is the whole look the owner asked for.
   */
  useEffect(() => {
    if (!following) return;
    const el = scrollRef.current;
    const target = activeRef.current;
    if (!el) return;
    const wanted = target
      ? target.offsetTop - el.clientHeight * ACTIVE_WORD_VIEWPORT_FRACTION
      : el.scrollHeight;
    // A few pixels of drift every frame would fight the smooth scroll forever.
    if (Math.abs(wanted - el.scrollTop) < 24) return;
    scrollTo(wanted);
  }, [following, playhead, lines.length, scrollTo]);

  const jumpToLive = useCallback(() => {
    setFollowing(true);
    const el = scrollRef.current;
    const target = activeRef.current;
    if (!el) return;
    scrollTo(
      target ? target.offsetTop - el.clientHeight * ACTIVE_WORD_VIEWPORT_FRACTION : el.scrollHeight,
    );
  }, [scrollTo]);

  // The hint that keeps activeWordIndex linear-and-cheap across frames.
  const hint = useRef(0);

  return (
    // Flex rather than the fixed h-[calc(100vh-180px)] the other tabs use: the
    // optional player above this takes a variable slice of the screen, and a
    // fixed height under it pushes the last lines behind the tab bar.
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        ref={scrollRef}
        onWheel={stopFollowing}
        onTouchMove={stopFollowing}
        onKeyDown={stopFollowing}
        className="transcript-words flex-1 min-h-0 overflow-y-auto px-5 py-6"
      >
        {/* Bottom padding so the LAST word can still sit at the 40% line rather
            than jamming the edge. The top needs almost none — the very first
            words of a service are the one case where starting high is correct,
            and a third of a blank viewport above them reads as a broken page. */}
        <div className="pb-[55vh]">
          {lines.map((line) => (
            <TranscriptLine
              key={line.chunkId}
              line={line}
              playhead={playhead}
              hintRef={hint}
              activeRef={activeRef}
            />
          ))}
        </div>
      </div>

      {/* Jump-to-live. Only offered when it would do something. */}
      {!following && (
        <button
          onClick={jumpToLive}
          className="companion-go absolute left-1/2 -translate-x-1/2 bottom-3 z-10 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px]"
        >
          <ArrowDown size={13} />
          Jump to live
        </button>
      )}

      {/* Sync nudge. Deliberately quiet — the congregation is not here to
          configure anything, and the one viewer whose stream is out by ten
          seconds needs it badly. Bottom-right, on the backdrop rather than over
          the text column, so it never sits on a word someone is reading. */}
      {hasTimings && isLive && (
        <button
          onClick={() => setSheetOpen(true)}
          aria-label="Adjust transcript sync"
          className="absolute right-2 bottom-4 z-10 p-2.5 rounded-full bg-[#0a0a0a]/80 backdrop-blur text-gray-600 hover:text-gray-300 transition-colors"
        >
          <Settings2 size={15} />
        </button>
      )}

      {sheetOpen && (
        <SyncSheet
          nudgeMs={nudgeMs}
          onNudge={onNudge}
          onClose={() => setSheetOpen(false)}
          playerDriving={playerDriving}
        />
      )}
    </div>
  );
}

/**
 * One chunk, rendered as flowing prose.
 *
 * Whole-line opacity is NOT used on the timed path: every word carries its own
 * state, so the "already read" tail stays solid white and legible rather than
 * fading out from under someone who is still finishing the sentence.
 */
function TranscriptLine({
  line,
  playhead,
  hintRef,
  activeRef,
}: {
  line: Line;
  playhead: number;
  hintRef: React.MutableRefObject<number>;
  activeRef: React.MutableRefObject<HTMLElement | null>;
}) {
  // Untimed (whisper) chunk: fall back to a gentle per-chunk fade by age. Not
  // the old latest-vs-rest snap — this keeps several lines readable and lets
  // opacity arrive at the same rate the text does.
  if (!line.words) {
    return (
      <p className="text-[17px] leading-[1.75] text-gray-200 mb-3 transition-opacity duration-[1200ms] opacity-90">
        {line.text}
        {line.verse && <VersePill verse={line.verse} />}
      </p>
    );
  }

  const active =
    playhead >= line.from - 0.001
      ? activeWordIndex(line.words, playhead, hintRef.current)
      : -1;
  if (active >= 0) hintRef.current = active;

  return (
    <p className="text-[19px] leading-[1.7] mb-1.5 font-medium">
      {line.words.map((w, i) => {
        const state = wordState(w, playhead);
        const isActive = i === active && state !== "coming";
        return (
          <span
            key={w.key}
            ref={
              isActive
                ? (el) => {
                    if (el) activeRef.current = el;
                  }
                : undefined
            }
            /* Duration is the honest part of this: opacity and colour move over
               ~450ms so nothing ever appears or vanishes on a single frame. */
            className={`${
              state === "said"
                ? "text-white opacity-100"
                : state === "saying"
                  ? "text-brand opacity-100"
                  : "text-white opacity-[0.35]"
            }`}
          >
            {w.w}{" "}
          </span>
        );
      })}
      {line.verse && <VersePill verse={line.verse} />}
    </p>
  );
}

function VersePill({ verse }: { verse: Verse }) {
  return (
    <span className="companion-verse-pill">{verse.ref}</span>
  );
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
  return (
    <div
      className="fixed inset-0 z-30 flex items-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl bg-[#131313] border-t border-white/10 px-5 pt-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold mb-1">Transcript sync</p>
        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
          {playerDriving
            ? "Matched to the player you are listening to — no adjustment needed."
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
    </div>
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

function Placeholder({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-8">
      {emoji && <div className="text-5xl mb-4 opacity-80">{emoji}</div>}
      <p className="text-base font-medium text-gray-300 mb-1">{title}</p>
      {subtitle && <p className="text-sm text-gray-500 max-w-xs">{subtitle}</p>}
    </div>
  );
}
