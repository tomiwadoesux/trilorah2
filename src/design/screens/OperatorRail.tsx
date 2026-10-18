import { useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'motion/react';
import { ChevronDownIcon, ChevronUpIcon } from '../../ui';
import { clampRailKeyboard, clampRailShare, elasticRailShare, RAIL_LIMITS, railDragBounds, railReleaseVelocity, settledRailShare, type RailBounds, type RailSample } from '../../lib/elasticRail';
import './operatorRail.css';

interface RailDrag {
  pointer: number; y: number; share: number; raw: number; height: number; moved: boolean;
  bounds: RailBounds; samples: RailSample[]; handle: HTMLButtonElement;
}

// Apple's 0.3s sheet response with 0.8 damping, mapped to a velocity-aware spring.
const FREQUENCY = 2 * Math.PI / .3;
const RELEASE_SPRING = { type: 'spring', mass: 1, stiffness: FREQUENCY ** 2, damping: 2 * .8 * FREQUENCY, restDelta: .0003, restSpeed: .003 } as const;
const INITIAL_ROWS = 'minmax(0, .5fr) var(--tri-gap) minmax(0, .5fr)';

/** The run and transcript start equally sized, and resize independently of the library. */
export function OperatorRail({ run, transcript, listen }: { run: ReactNode; transcript: ReactNode; listen: ReactNode }) {
  const [settled, setSettled] = useState(.5);
  const share = useMotionValue(.5);
  const reducedMotion = useReducedMotion();
  const resting = useRef(.5);
  const split = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const drag = useRef<RailDrag | null>(null);
  const suppressClick = useRef(false);
  const cancelDrag = useRef<() => void>(() => {});
  const expanded = settled > .5;

  const land = (value: number, velocity = 0, spring = false) => {
    const target = clampRailShare(value);
    resting.current = target;
    setSettled(target);
    share.stop();
    if (spring && !reducedMotion) animate(share, target, { ...RELEASE_SPRING, velocity });
    else share.jump(target);
  };
  const finishDrag = (pointer: number, cancelled: boolean, time: number) => {
    const start = drag.current;
    if (!start || start.pointer !== pointer) return;
    drag.current = null;
    split.current?.removeAttribute('data-resizing');
    suppressClick.current = start.moved || cancelled;
    if (start.handle.hasPointerCapture(pointer)) start.handle.releasePointerCapture(pointer);
    const target = cancelled ? start.share : settledRailShare(start.raw, start.bounds);
    land(target, cancelled ? 0 : railReleaseVelocity(start.samples, time), start.moved && !cancelled);
  };
  cancelDrag.current = () => { if (drag.current) finishDrag(drag.current.pointer, true, performance.now()); };

  useEffect(() => {
    // Resizing genuinely changes layout. Keep those frames out of React so the
    // transcript and running order aren't re-rendered for every spring sample.
    const draw = (latest: number) => {
      const value = clampRailShare(latest);
      if (split.current) split.current.style.gridTemplateRows = `minmax(0, ${value}fr) var(--tri-gap) minmax(0, ${1 - value}fr)`;
      handle.current?.setAttribute('aria-valuenow', String(Math.round(value * 100)));
      handle.current?.setAttribute('aria-valuetext', `Transcript ${Math.round(value * 100)}%, run of show ${Math.round((1 - value) * 100)}%`);
    };
    draw(share.get());
    const unsubscribe = share.on('change', draw);
    const cancel = () => cancelDrag.current();
    window.addEventListener('blur', cancel);
    return () => {
      unsubscribe();
      share.stop();
      window.removeEventListener('blur', cancel);
      const active = drag.current;
      drag.current = null;
      if (active?.handle.hasPointerCapture(active.pointer)) active.handle.releasePointerCapture(active.pointer);
    };
  }, [share]);
  useEffect(() => {
    if (reducedMotion && !drag.current) share.jump(resting.current);
  }, [reducedMotion, share]);

  return <div className="operator-rail row-span-3 flex min-h-0 min-w-0 flex-col gap-[var(--tri-gap)]">
    <div ref={split} className="operator-rail-split tri-rounded-surface grid min-h-0 flex-1 overflow-hidden bg-[#111111]"
      style={{ gridTemplateRows: INITIAL_ROWS, boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.055)' }}>
      {transcript}
      <div className="operator-rail-divider relative z-10 h-[var(--tri-gap)]">
        <button ref={handle} type="button" role="separator" aria-orientation="horizontal" aria-valuemin={20} aria-valuemax={80} aria-valuenow={Math.round(settled * 100)} aria-valuetext={`Transcript ${Math.round(settled * 100)}%, run of show ${Math.round((1 - settled) * 100)}%`}
          data-guide="rail-resizer" className="group absolute inset-x-0 top-1/2 h-[14px] -translate-y-1/2 cursor-row-resize touch-none outline-none"
          aria-label="Resize transcript and run of show"
          title={`${expanded ? 'balance left panels' : 'expand transcript'} — drag to resize, or use the up and down arrow keys`}
          onKeyDown={event => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault(); event.stopPropagation();
              cancelDrag.current();
              land(clampRailKeyboard(share.get() + (event.key === 'ArrowUp' ? -.05 : .05)));
            } else if (event.key === 'Home' || event.key === 'End') {
              event.preventDefault(); event.stopPropagation(); cancelDrag.current(); land(event.key === 'Home' ? RAIL_LIMITS.min : RAIL_LIMITS.max);
            } else if (event.key === 'Escape' && drag.current) {
              event.preventDefault(); event.stopPropagation(); cancelDrag.current();
            }
          }}
          onPointerDown={event => {
            if (event.button !== 0 || !event.isPrimary || drag.current) return;
            event.preventDefault();
            event.currentTarget.focus({ preventScroll: true });
            suppressClick.current = false;
            share.stop();
            const current = clampRailShare(share.get());
            share.jump(current);
            const dividerHeight = event.currentTarget.parentElement?.getBoundingClientRect().height ?? 5;
            drag.current = { pointer: event.pointerId, y: event.clientY, share: current, raw: current,
              height: Math.max(1, (split.current?.getBoundingClientRect().height ?? 1) - dividerHeight), moved: false,
              bounds: railDragBounds(current), samples: [{ value: current, time: event.timeStamp }], handle: event.currentTarget };
            split.current?.setAttribute('data-resizing', 'true');
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            const start = drag.current;
            if (!start || start.pointer !== event.pointerId) return;
            if (!(event.buttons & 1)) { finishDrag(event.pointerId, true, event.timeStamp); return; }
            if (!start.moved && Math.abs(event.clientY - start.y) < 4) return;
            start.moved = true;
            start.raw = start.share + (event.clientY - start.y) / start.height;
            const value = reducedMotion ? settledRailShare(start.raw, start.bounds) : elasticRailShare(start.raw, start.bounds);
            share.set(value);
            start.samples = [...start.samples.filter(sample => event.timeStamp - sample.time <= 100), { value, time: event.timeStamp }];
          }}
          onPointerUp={event => finishDrag(event.pointerId, false, event.timeStamp)}
          onLostPointerCapture={event => finishDrag(event.pointerId, true, event.timeStamp)}
          onPointerCancel={event => finishDrag(event.pointerId, true, event.timeStamp)}
          onClick={event => {
            const moved = suppressClick.current;
            suppressClick.current = false;
            if (moved && event.detail !== 0) return;
            land(share.get() > .5 ? .5 : .7);
          }}>
          <span aria-hidden="true" className="operator-rail-handle stage-resizer-button">
            {expanded ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
          </span>
        </button>
      </div>
      <div className="flex min-h-0 flex-col gap-[var(--tri-gap)]">
        <div className="shrink-0 px-[var(--tri-gap)] pt-[var(--tri-gap)]">{listen}</div>
        {run}
      </div>
    </div>
  </div>;
}
