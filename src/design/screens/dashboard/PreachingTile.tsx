import { useState } from 'react';
import { Panel } from '../parts';
import { useEngine } from '../engine';
import { TimersTile } from './TimersTile';
import { cx } from '../../../ui';

/*
 * PreachingTile — Preacher live transcript card (Kinetic Focus).
 *
 * Sits in the top-left panel of the dashboard. Formatted with 2-3 lines max,
 * left-aligned so words stream in from the left starting edge where the line begins,
 * allowing comfortable read-along as sentences form in real time.
 */

export function PreachingTile({ className }: { className?: string }) {
  const [activeTab, setActiveTab] = useState<'transcript' | 'timer'>('transcript');
  const engine = useEngine();
  const { spoken, asr } = engine;

  if (activeTab === 'timer') {
    return (
      <div className={cx('relative flex h-full min-h-0 min-w-0 flex-col', className)}>
        {/* Toggle back to transcript */}
        <div className="absolute right-3 top-2.5 z-10">
          <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-black/70 p-0.5 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setActiveTab('transcript')}
              className="rounded-full px-2.5 py-0.5 text-[10px] font-medium lowercase tracking-wide text-white/50 transition-all hover:text-white"
            >
              transcript
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('timer')}
              className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold lowercase tracking-wide text-white shadow-sm"
            >
              timer
            </button>
          </div>
        </div>
        <TimersTile className="h-full w-full" />
      </div>
    );
  }

  const isLive = asr === 'listening';
  const hasRealSpeech = spoken.lines.length > 0 || Boolean(spoken.partial);

  // Sample lines for clean initial preview before speech begins:
  // Line 1 is longer / full width, and line 2 is shorter below it, starting from the left edge.
  const samplePrior = 'Let us turn our Bibles to the book of Romans chapter eight verse twenty-eight.';
  const sampleActive =
    'For God so loved the world that He gave His only begotten Son, that whoever believes in Him should not perish.';

  const priorText = hasRealSpeech
    ? spoken.partial
      ? spoken.lines[spoken.lines.length - 1]?.text
      : spoken.lines[spoken.lines.length - 2]?.text
    : samplePrior;

  const activeText = hasRealSpeech
    ? spoken.partial || spoken.lines[spoken.lines.length - 1]?.text || ''
    : sampleActive;

  const isForming = Boolean(spoken.partial) || (!hasRealSpeech && isLive);

  return (
    <Panel
      className={className}
      title="preacher transcript"
      bodyClass="pt-2 px-3 pb-3"
      right={
        <div className="flex items-center gap-2">
          {/* Live mic status badge */}
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5">
            <span
              className={cx(
                'size-1.5 rounded-full transition-all',
                isLive
                  ? 'animate-pulse bg-[#6ee7b7] shadow-[0_0_8px_#10b981]'
                  : 'bg-white/30',
              )}
            />
            <span className="text-[10px] font-medium lowercase tracking-wide text-white/70">
              {isLive ? 'live mic' : asr}
            </span>
          </div>

          {/* Tab switcher: transcript (active) | timer */}
          <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('transcript')}
              className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold lowercase tracking-wide text-white shadow-sm"
            >
              transcript
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('timer')}
              className="rounded-full px-2.5 py-0.5 text-[10px] font-medium lowercase tracking-wide text-white/50 transition-all hover:text-white"
            >
              timer
            </button>
          </div>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col justify-between gap-2.5">
        {/* Prior context sentence (dimmed, small, left-aligned) */}
        <div className="shrink-0 text-left">
          <p className="line-clamp-1 truncate text-left text-[11px] font-normal leading-normal text-white/35">
            {priorText || 'waiting for speech...'}
          </p>
        </div>

        {/* Kinetic Focus Box: 2 to 3 lines max, left-aligned with streaming words */}
        <div className="relative flex min-h-[96px] flex-1 flex-col justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.25)] backdrop-blur-md">
          <div className="text-left">
            <p className="line-clamp-3 text-left text-[15px] sm:text-[16px] font-medium leading-[1.55] tracking-wide text-[var(--tri-ink)] select-text">
              {activeText}
              {isForming && (
                <span
                  className="ml-1 inline-block h-[0.9em] w-[2px] translate-y-[2px] animate-pulse bg-[var(--tri-accent-yellow)] rounded-sm"
                  aria-hidden="true"
                />
              )}
            </p>
          </div>
        </div>

        {/* Subtle footer */}
        <div className="flex shrink-0 items-center justify-between text-[10px] lowercase text-white/30">
          <span>kinetic focus · streaming from left</span>
          <span>{hasRealSpeech ? 'live speech' : 'preview mode'}</span>
        </div>
      </div>
    </Panel>
  );
}
