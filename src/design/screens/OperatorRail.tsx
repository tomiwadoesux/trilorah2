import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '../../ui';

/** The run and transcript start equally sized, and resize independently of the library. */
export function OperatorRail({ run, transcript, footer }: { run: ReactNode; transcript: ReactNode; footer: ReactNode }) {
  const [share, setShare] = useState(.5);
  const split = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; share: number; height: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const expanded = share < .5;
  const clamp = (value: number) => Math.max(.25, Math.min(.75, value));
  return <div className="operator-rail row-span-3 flex min-h-0 min-w-0 flex-col gap-[var(--tri-gap)]" style={{ '--stage-handle-h': '24px' } as CSSProperties}>
    <div ref={split} className="operator-rail-split grid min-h-0 flex-1" style={{ gridTemplateRows: `minmax(0, ${share}fr) var(--stage-handle-h) minmax(0, ${1 - share}fr)` }}>
      {run}
      <div className="stage-resizer-track">
        <button type="button" className="stage-resizer" aria-pressed={expanded}
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
            drag.current = { y: event.clientY, share, height: Math.max(1, (split.current?.clientHeight ?? 24) - 24), moved: false };
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
          <span className="stage-resizer-button">{expanded ? <ChevronDownIcon size={12} /> : <ChevronUpIcon size={12} />}</span>
        </button>
      </div>
      {transcript}
    </div>
    {footer}
  </div>;
}
