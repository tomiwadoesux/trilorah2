import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cx } from '../../../ui';
import { reducedMotion } from './expand';

/*
 * Card art — the wireframe drawing in the corner of a tile that opens.
 *
 * Borrowed from how Supabase draws its product cards: thin lines, tucked
 * into one corner, cut off by the card's own edge and fading out toward the
 * words so it never sits under anything that has to be read. At rest it is
 * a faint grey trace; when the pointer is on the tile it turns mint and
 * moves once, a short way, and settles. That is the whole signal: this card
 * is a door.
 *
 * Only on tiles that open and have somewhere empty to put it — a drawing
 * under a list of numbers is noise, not a hint.
 */

/**
 * The layer the drawing lives in. Absolutely placed in the corner of
 * whatever positioned box holds it, under that box's content, masked so it
 * fades out toward the top-left. Colour rides `currentColor`: grey at rest,
 * mint while the tile (`group/tile`, set by Expandable) is hovered.
 */
export function ArtLayer({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      className={cx(
        'pointer-events-none absolute text-[rgb(229_243_242_/_0.5)] opacity-60 transition-[color,opacity] duration-300',
        'group-hover/tile:text-[#8fd3c0] group-hover/tile:opacity-100',
        className,
      )}
      style={{
        maskImage: 'radial-gradient(130% 130% at 100% 100%, #000 38%, transparent 78%)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

/**
 * 0 at rest, 1 while hovered, eased between over `ms`. Drives the one move
 * a drawing makes. Under reduced motion it never moves — the colour change
 * alone says the card is live.
 */
export function useHoverProgress(hovered: boolean, ms = 900): number {
  const [t, setT] = useState(0);
  const now = useRef(0);
  useEffect(() => {
    if (reducedMotion()) return;
    const from = now.current;
    const to = hovered ? 1 : 0;
    if (from === to) return;
    let raf = 0;
    let start = 0;
    const step = (time: number) => {
      if (!start) start = time;
      const k = Math.min(1, (time - start) / ms);
      const v = from + (to - from) * easeOut(k);
      now.current = v;
      setT(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [hovered, ms]);
  return t;
}

/* ------------------------------------------------------------------ */
/* Preachers — the orbit                                               */
/* ------------------------------------------------------------------ */

export interface OrbitDot {
  id: string;
  /** 0 = innermost ring. The preachers tile maps training stage to this:
      auto-ready closest to the centre, new on the outside. */
  ring: number;
  /** Today's preacher — drawn larger, with a halo. */
  today?: boolean;
}

/* Tilted rings seen from a little above, like a planet's orbits. */
const CX = 196;
const CY = 124;
const TILT = (-14 * Math.PI) / 180;
const SQUASH = 0.4;
const RINGS = [34, 58, 84, 112];
/* How far each ring's dots travel on hover, in degrees. Inner rings go
   further, the way inner orbits run faster. */
const DRIFT = [58, 42, 30, 21];

function onRing(r: number, deg: number) {
  const th = (deg * Math.PI) / 180;
  const lx = r * Math.cos(th);
  const ly = SQUASH * r * Math.sin(th);
  return {
    x: CX + lx * Math.cos(TILT) - ly * Math.sin(TILT),
    y: CY + lx * Math.sin(TILT) + ly * Math.cos(TILT),
    /* The far half of the ring is behind the centre; dim it, so the
       drawing reads as depth rather than a flat doodle. */
    front: Math.sin(th) >= 0,
  };
}

export function OrbitArt({ dots, hovered, className }: { dots: OrbitDot[]; hovered: boolean; className?: string }) {
  const t = useHoverProgress(hovered);

  /* Spread each ring's dots evenly, and start each ring at its own angle so
     the dots do not line up along one spoke. */
  const placed = dots.map((d) => {
    const ring = Math.max(0, Math.min(RINGS.length - 1, d.ring));
    const same = dots.filter((o) => Math.max(0, Math.min(RINGS.length - 1, o.ring)) === ring);
    const i = same.indexOf(d);
    const base = 200 + ring * 47 + (360 / same.length) * i;
    return { ...d, ...onRing(RINGS[ring], base + t * DRIFT[ring]) };
  });

  return (
    <ArtLayer className={className}>
      <svg viewBox="0 0 260 170" className="h-full w-full overflow-visible">
        <g fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke">
          {RINGS.map((r, i) => (
            <ellipse
              key={r}
              cx={CX}
              cy={CY}
              rx={r}
              ry={r * SQUASH}
              transform={`rotate(${(TILT * 180) / Math.PI} ${CX} ${CY})`}
              strokeOpacity={0.5 - i * 0.08}
              strokeDasharray={i === RINGS.length - 1 ? '2 4' : undefined}
            />
          ))}
          {/* The centre — a small wire globe. */}
          <circle cx={CX} cy={CY} r={14} strokeOpacity={0.6} />
          <ellipse cx={CX} cy={CY} rx={14} ry={5} strokeOpacity={0.4} />
          <ellipse cx={CX} cy={CY} rx={5} ry={14} strokeOpacity={0.4} />
        </g>

        <g className="transition-[filter] duration-300 group-hover/tile:[filter:drop-shadow(0_0_4px_rgb(143_211_192_/_0.55))]">
          {placed.map((d) => (
            <g key={d.id} opacity={d.front ? 1 : 0.45}>
              {d.today && <circle cx={d.x} cy={d.y} r={7} fill="none" stroke="currentColor" strokeOpacity={0.7} strokeWidth={1} />}
              <circle cx={d.x} cy={d.y} r={d.today ? 3.6 : 2.6} fill="currentColor" />
            </g>
          ))}
        </g>
      </svg>
    </ArtLayer>
  );
}
