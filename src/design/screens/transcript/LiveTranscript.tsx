import { useState } from 'react';
import { cx } from '../../../ui';
import type { TranscriptStripProps } from './types';
import { useDemoSpeech } from './demoSermon';
import { SHIPPED_TRANSCRIPT, TRANSCRIPT_STYLES, transcriptStyle } from './styles';

/*
 * The transcript strip as the Live screen draws it.
 *
 * In the app it is simply the shipped design fed by the engine.
 *
 * On the design page (design.html) it also carries a small demo bar above
 * it: switch between the D-27 designs in place, and play a pretend sermon
 * through whichever is showing so it can be judged moving, where it lives.
 * The demo only plays while the engine is not hearing anything — the
 * moment real speech arrives it takes over, so a sandbox run with SANDBOX=1
 * can never show filler over what a preacher actually said. The main
 * window (index.html) never shows the bar and never plays the demo.
 */

const PICK_KEY = 'tri.d27.transcript';
const SPEEDS = [1, 1.5, 2];

function onDesignPage() {
  return typeof location !== 'undefined' && /design\.html$/.test(location.pathname);
}

function readPick(): string | null {
  try {
    return localStorage.getItem(PICK_KEY);
  } catch {
    return null;
  }
}

function writePick(id: string) {
  try {
    localStorage.setItem(PICK_KEY, id);
  } catch {
    /* A private window: the pick just does not survive a reload. */
  }
}

export function LiveTranscript({ spoken, asr, onOpenDashboard }: TranscriptStripProps) {
  const [design] = useState(onDesignPage);
  const [pick, setPick] = useState(() => (design ? readPick() : null) ?? SHIPPED_TRANSCRIPT);
  const [demoOn, setDemoOn] = useState(true);
  const [speed, setSpeed] = useState(1);

  const real = asr === 'listening' || spoken.lines.length > 0 || Boolean(spoken.partial);
  /* Shown whenever the design page has no real speech; paused, it holds. */
  const showDemo = design && !real;
  const playing = showDemo && demoOn;
  const demo = useDemoSpeech({ playing, speed });

  const style = transcriptStyle(design ? pick : SHIPPED_TRANSCRIPT);
  const Strip = style.Component;
  const feed = showDemo ? demo.spoken : spoken;

  return (
    <div className="relative flex min-w-0 flex-1 items-stretch">
      <Strip spoken={feed} asr={showDemo ? 'listening' : asr} onOpenDashboard={onOpenDashboard} />
      {design && (
        <DemoBar
          pick={style.id}
          onPick={(id) => {
            setPick(id);
            writePick(id);
          }}
          demoOn={demoOn}
          onToggle={() => setDemoOn((v) => !v)}
          onRestart={demo.restart}
          speed={speed}
          onSpeed={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}
          blocked={real}
        />
      )}
    </div>
  );
}

/*
 * Design tooling, and dressed as such: the sandbox chrome's small caps and
 * a dashed ring, so it can never be mistaken for part of the screen being
 * judged. It floats over the browser's bottom edge, right-aligned, where it
 * covers the least.
 */
function DemoBar({
  pick,
  onPick,
  demoOn,
  onToggle,
  onRestart,
  speed,
  onSpeed,
  blocked,
}: {
  pick: string;
  onPick: (id: string) => void;
  demoOn: boolean;
  onToggle: () => void;
  onRestart: () => void;
  speed: number;
  onSpeed: () => void;
  blocked: boolean;
}) {
  const chip = 'rounded-md px-2 py-1 transition-colors';
  return (
    <div
      className={cx(
        'absolute bottom-full right-0 z-30 mb-2 flex items-center gap-1 rounded-lg px-1.5 py-1',
        'font-mono text-[10px] uppercase tracking-[0.12em] text-[rgb(229_243_242_/_0.6)]',
        'border border-dashed border-white/20 bg-[rgb(14_18_18_/_0.94)] backdrop-blur-md',
      )}
    >
      <span className="px-1.5 text-[rgb(229_243_242_/_0.4)]">d-27 demo</span>
      {TRANSCRIPT_STYLES.map((s) => (
        <button
          key={s.id}
          type="button"
          title={s.blurb}
          onClick={() => onPick(s.id)}
          className={cx(chip, s.id === pick ? 'bg-white/[0.12] text-white' : 'hover:text-white')}
        >
          {s.name}
        </button>
      ))}
      <span className="mx-1 h-3.5 w-px bg-white/15" />
      <button
        type="button"
        onClick={onToggle}
        disabled={blocked}
        title={blocked ? 'the engine is hearing real speech — the demo stays off' : undefined}
        className={cx(chip, blocked ? 'opacity-40' : 'hover:text-white')}
      >
        {blocked ? 'live speech' : demoOn ? 'pause' : 'play'}
      </button>
      <button type="button" onClick={onRestart} className={cx(chip, 'hover:text-white')}>
        restart
      </button>
      <button type="button" onClick={onSpeed} className={cx(chip, 'w-9 hover:text-white')} title="speaking speed">
        {speed}×
      </button>
    </div>
  );
}
