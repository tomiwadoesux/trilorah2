import { useEffect, useState } from 'react';
import { cx } from '../../../../ui';
import { Panel } from '../../parts';
import { PresentationIcon } from '../../../../ui';
import { MUTED, ROLE_NAME, ROLE_AUDIENCE, STATE_WORD, type OutputsFace, type Screen, type Role } from './types';

/*
 * A · floor plan. The owner's pick, 2026-09-27; redrawn the same day
 * after "it looks so AI-generated".
 *
 * What was wrong: fake verse text, a glow, gold dashed borders, status
 * dots, a caption under everything. Each one is a thing a generator adds
 * because it can. What is left is what a person would draw on a whiteboard
 * to explain the room: the wall, wide, at the top; the small screens under
 * it; every one a black rectangle with a bezel; and on each a single grey
 * shape where its picture goes — a block in the middle for the verse, a
 * bar along the bottom for the stream's lower third, a corner mark and a
 * foot line for the stage monitor, a short block for the timer's digits.
 * No words. The face is a picture; pressing it opens the settings, and
 * that is where the names and the choices live.
 *
 * One ink, two strengths: a screen that is live has its shape at full
 * strength, a cleared or black one has it faint. A screen with no display
 * of its own has no bezel — it is drawn as an outline, because it is not a
 * screen yet.
 */

const INK_LIVE = 'rgb(229 243 242 / 0.55)';
const INK_OFF = 'rgb(229 243 242 / 0.14)';

/* The shape on the screen, per job. Every measure is a percentage of the
   screen, so the same drawing works at any size. */
function Shape({ role, ink }: { role: Role; ink: string }) {
  const s = { background: ink };
  switch (role) {
    case 'projector':
      return <span className="absolute left-[24%] top-[40%] h-[13%] w-[52%] rounded-[2px]" style={s} />;
    case 'stream':
      return <span className="absolute bottom-[12%] left-[8%] h-[16%] w-[84%] rounded-[2px]" style={s} />;
    case 'stage':
      return (
        <>
          <span className="absolute right-[7%] top-[10%] h-[12%] w-[18%] rounded-[1px]" style={s} />
          <span className="absolute left-[24%] top-[42%] h-[11%] w-[52%] rounded-[2px]" style={s} />
          <span className="absolute bottom-[10%] left-[7%] h-[9%] w-[34%] rounded-[1px]" style={s} />
        </>
      );
    case 'timer':
      return <span className="absolute left-[30%] top-[36%] h-[28%] w-[40%] rounded-[2px]" style={s} />;
  }
}

function ScreenBox({ s, className }: { s: Screen; className?: string }) {
  const live = s.state === 'live' && !s.windowed;
  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-[4px]',
        s.windowed ? 'border border-dashed border-[rgb(229_243_242_/_0.18)]' : 'bg-black shadow-[inset_0_0_0_1px_rgb(229_243_242_/_0.14)]',
        className,
      )}
    >
      <Shape role={s.role} ink={live ? INK_LIVE : INK_OFF} />
    </div>
  );
}

/* A step through the screens. Bottom right, over the picture, because that
   is the corner the eye is not reading and the hand already expects a next
   control to be. */
function Step({ back, onClick, disabled }: { back?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        /* The card itself opens the settings; these do not. */
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-label={back ? 'previous screen' : 'next screen'}
      className={cx(
        'grid size-6 place-items-center rounded-md transition-colors',
        'text-[rgb(229_243_242_/_0.55)] hover:bg-white/[0.08] hover:text-white',
        'active:scale-[var(--tri-press-scale)] disabled:pointer-events-none disabled:opacity-25',
      )}
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d={back ? 'M10 3 L5 8 L10 13' : 'M6 3 L11 8 L6 13'} />
      </svg>
    </button>
  );
}

export function FloorPlanOutputs({ screens, onOpen, className }: OutputsFace) {
  /*
   * One screen at a time, and the operator says which.
   *
   * It used to draw the projector and nothing else — the card showed a
   * black rectangle with no name on it, so the one question it was there to
   * answer ("what is the wall doing?") had a picture but the three other
   * screens had nothing at all, and even the picture did not say which
   * screen it was. Now the screen is NAMED under the picture and the
   * arrows page through the rest, so every output this machine drives is
   * reachable from the face rather than only from the settings box.
   *
   * The cell is still not tall enough for a row of small screens under a
   * wide one, which is why this pages rather than tiling: a cut-off row
   * reads as unfinished, and a screen drawn at thumbnail size says nothing
   * a word would not say better.
   */
  const [at, setAt] = useState(() => {
    const i = screens.findIndex((s) => s.role === 'projector');
    return i < 0 ? 0 : i;
  });
  /* A screen unplugged mid-service must not leave this pointing past the
     end of the list. */
  useEffect(() => {
    setAt((i) => Math.min(i, Math.max(0, screens.length - 1)));
  }, [screens.length]);

  const shown = screens[at] ?? screens[0];
  const windowed = screens.filter((s) => s.windowed).length;
  if (!shown) return null;

  const step = (d: number) => setAt((i) => (i + d + screens.length) % screens.length);

  return (
    <Panel
      title="outputs"
      icon={<PresentationIcon size={13} />}
      blurb="the screens this machine drives, and what each one shows."
      onOpen={onOpen}
      className={className}
      right={
        <span className="text-[length:var(--tri-size-eyebrow)] lowercase" style={{ color: MUTED }}>
          {screens.length} screens{windowed ? ` · ${windowed} without a display` : ''}
        </span>
      }
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          /* The arrows work from the keyboard too, and do not open the box. */
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            step(e.key === 'ArrowLeft' ? -1 : 1);
            return;
          }
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen?.();
          }
        }}
        title="open the output settings"
        className="flex h-full min-h-0 w-full cursor-pointer flex-col gap-1.5 text-left outline-none"
      >
        <ScreenBox s={shown} className="min-h-0 w-full flex-1" />

        {/* What it is, and what it is doing — the line the picture cannot
            say on its own. The arrows sit on the same row, hard right. */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[12px] font-medium lowercase text-[var(--tri-ink)]">
              {ROLE_NAME[shown.role]} <span style={{ color: MUTED }}>· for {ROLE_AUDIENCE[shown.role]}</span>
            </div>
            <div className="truncate text-[10px] lowercase" style={{ color: MUTED }}>
              {shown.windowed
                ? 'no display of its own — a window on this laptop'
                : `${shown.display} · ${STATE_WORD[shown.state]}`}
            </div>
          </div>
          {screens.length > 1 && (
            <div className="flex shrink-0 items-center gap-0.5">
              <Step back onClick={() => step(-1)} />
              {/* Which of how many, so paging has an end in sight. */}
              <span className="px-0.5 font-mono text-[10px] tabular-nums" style={{ color: MUTED }}>
                {at + 1}/{screens.length}
              </span>
              <Step onClick={() => step(1)} />
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
