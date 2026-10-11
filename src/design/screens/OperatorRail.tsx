import { useRef, useState, type CSSProperties, type ReactNode } from 'react';

/** The run and transcript start equally sized, and resize independently of the library. */
export function OperatorRail({ run, transcript, footer }: { run: ReactNode; transcript: ReactNode; footer: ReactNode }) {
  const [share, setShare] = useState(.5);
  const split = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; share: number; height: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const expanded = share < .5;
  const clamp = (value: number) => Math.max(.25, Math.min(.75, value));
  return <div className="operator-rail row-span-3 flex min-h-0 min-w-0 flex-col gap-[var(--tri-gap)]">
    <div ref={split} className="operator-rail-split tri-rounded-surface grid min-h-0 flex-1 overflow-hidden bg-[#111111]"
      style={{ gridTemplateRows: `minmax(0, ${share}fr) 1px minmax(0, ${1 - share}fr)`, boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.055)' } as CSSProperties}>
      {run}
      <div className="operator-rail-divider relative z-10 h-px bg-white/10">
        <button type="button" className="absolute inset-x-0 -top-1 h-[9px] cursor-row-resize touch-none outline-none hover:bg-white/[0.035] focus-visible:bg-white/10" aria-pressed={expanded}
          aria-label={expanded ? 'balance left panels' : 'expand transcript'}
          title={`${expanded ? 'balance left panels' : 'expand transcript'} — drag to resize the left panels`}
          onKeyDown={event => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault();
              setShare(value => clamp(value + (event.key === 'ArrowUp' ? -.05 : .05)));
            } else if (event.key === 'Home') {
              event.preventDefault(); setShare(.5);
            }
          }}
          onPointerDown={event => {
            if (event.button !== 0) return;
            suppressClick.current = false;
            drag.current = { y: event.clientY, share, height: Math.max(1, (split.current?.clientHeight ?? 1) - 1), moved: false };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            const start = drag.current;
            if (!start) return;
            if (!(event.buttons & 1)) { drag.current = null; return; }
            if (!start.moved && Math.abs(event.clientY - start.y) < 4) return;
            start.moved = true;
            setShare(clamp(start.share + (event.clientY - start.y) / start.height));
          }}
          onPointerUp={() => { suppressClick.current = !!drag.current?.moved; drag.current = null; }}
          onLostPointerCapture={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; suppressClick.current = true; }}
          onClick={event => {
            const moved = suppressClick.current;
            suppressClick.current = false;
            if (moved && event.detail !== 0) return;
            setShare(expanded ? .5 : .3);
          }}>
        </button>
      </div>
      {transcript}
    </div>
    {footer}
  </div>;
}
