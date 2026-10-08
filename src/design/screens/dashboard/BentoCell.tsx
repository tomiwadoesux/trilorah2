import { useLayoutEffect, useRef, type PointerEvent, type ReactNode } from 'react';

/** A stable pointer target around a card whose real width can change. */
export function BentoCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`dashboard-bento__cell ${className}`}>
    <div className="dashboard-bento__motion">{children}</div>
  </div>;
}

type Cell = { el: HTMLElement; left: number; top: number; width: number; height: number };

/** Adjacent cards share one moving boundary, so their gutter stays constant. */
export function BentoGrid({ children }: { children: ReactNode }) {
  const grid = useRef<HTMLDivElement>(null);
  const cells = useRef<Cell[]>([]);
  const active = useRef<Cell | null>(null);
  const enabled = useRef(false);

  const reset = (row: Cell[], duration = 680) => {
    for (const cell of row) {
      cell.el.style.setProperty('--bento-motion-ms', `${duration}ms`);
      cell.el.style.setProperty('--bento-left', '0px');
      cell.el.style.setProperty('--bento-right', '0px');
      cell.el.dataset.hovered = 'false';
      delete cell.el.dataset.growSide;
    }
  };
  const rowOf = (cell: Cell) => cells.current.filter(other => Math.abs(other.top - cell.top) < 1);

  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const media = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    const sync = () => {
      /* Hover growth is off for now (owner, 2026-10-08) — restore the line
         below and the @media block in dashboardBento.css to bring it back. */
      // enabled.current = media.matches && !document.hidden;
      enabled.current = false;
      if (!enabled.current) { reset(cells.current, 0); active.current = null; }
    };
    let width = 0;
    const measure = () => {
      if (width !== el.clientWidth) {
        reset(cells.current, 0);
        active.current = null;
        width = el.clientWidth;
      }
      cells.current = [...el.children].filter((child): child is HTMLElement => child instanceof HTMLElement).map(child => ({
        el: child, left: child.offsetLeft, top: child.offsetTop, width: child.offsetWidth, height: child.offsetHeight,
      }));
    };
    sync();
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    media.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled.current || event.pointerType === 'touch' || !grid.current) return;
    const rect = grid.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // Hit-test the resting cells: moving edges cannot retrigger a stationary pointer.
    const next = cells.current.find(cell => x >= cell.left && x <= cell.left + cell.width && y >= cell.top && y <= cell.top + cell.height);
    if (!next || next.el === active.current?.el) return;
    const row = rowOf(next);
    if (active.current && Math.abs(active.current.top - next.top) >= 1) reset(rowOf(active.current));
    active.current = next;
    const index = row.indexOf(next);
    const left = row[index - 1];
    const right = row[index + 1];
    if (!left && !right) return;
    const direction = left && right ? (Math.random() < .5 ? -1 : 1) : left ? -1 : 1;
    const neighbour = direction < 0 ? left : right;
    if (!neighbour) return;
    // A noticeably wider card, while the donor keeps enough room for its controls.
    const growth = Math.min(90, next.width * .24, neighbour.width - Math.min(240, neighbour.width * .8));
    reset(row, 560);
    next.el.dataset.hovered = 'true';
    next.el.dataset.growSide = direction < 0 ? 'left' : 'right';
    if (direction > 0) {
      next.el.style.setProperty('--bento-right', `${growth}px`);
      neighbour.el.style.setProperty('--bento-left', `${growth}px`);
    } else {
      next.el.style.setProperty('--bento-left', `${-growth}px`);
      neighbour.el.style.setProperty('--bento-right', `${-growth}px`);
    }
  };
  const leave = () => {
    if (active.current) reset(rowOf(active.current));
    active.current = null;
  };

  return <div ref={grid} className="dashboard-bento__grid" onPointerMove={move} onPointerLeave={leave} onPointerCancel={leave}>
    {children}
  </div>;
}
