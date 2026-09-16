import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../../ui';

/*
 * Parts the screen mockups are drawn from.
 *
 * These are deliberately NOT in src/ui. A screen is where you find out what
 * a component actually has to do — a panel header only earns a `right` slot
 * once two screens need one. Anything here that survives two screens gets
 * promoted into src/ui with a D-* id; until then it stays local, so the
 * design system never grows a component on speculation.
 */

/** Panel — the card every region of a screen sits in. */
export function Panel({
  title,
  right,
  children,
  className,
  bodyClass,
  style,
  bodyStyle,
  tone = 'default',
  bare = false,
  unavailable = false,
}: {
  title?: string;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClass?: string;
  /* Mainly for scoping tokens onto a panel — the header band reads
     --tri-bar-h, so a panel that has to match a taller strip beside it sets
     that here rather than growing a height prop nobody else would use. */
  style?: CSSProperties;
  /* For overriding the body's own padding. bodyClass cannot: cx is a plain
     join, so a pb-* passed in would emit alongside the base pb-3 and CSS
     source order would decide which one won. An inline style always wins. */
  bodyStyle?: CSSProperties;
  tone?: 'default' | 'live' | 'danger';
  /*
   * The tile's numbers are not real yet. Draws NotAvailable over the body,
   * so a placeholder can never be mistaken for a reading. A string says
   * what it is waiting for; `true` states it without a reason.
   */
  unavailable?: boolean | string;
  /*
   * A panel that holds other surfaces rather than content.
   *
   * Without this the themes editor's columns sit on a panel background and
   * you get a box inside a box inside a box — three stacked 2.2% whites,
   * each one lighter than the last, which reads as a rendering mistake. A
   * bare panel keeps the region's geometry and gives up its own fill.
   */
  bare?: boolean;
}) {
  return (
    <section
      className={cx(
        'tri-rounded-surface flex min-h-0 min-w-0 flex-col overflow-hidden',
        !bare && 'bg-[rgb(255_255_255_/_0.022)]',
        tone === 'live' && 'ring-1 ring-[rgb(228_216_122_/_0.32)]',
        tone === 'danger' && 'ring-1 ring-[rgb(234_199_198_/_0.28)]',
        className,
      )}
      style={bare ? style : { boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.055)', ...style }}
    >
      {/*
        No rule under the title.

        It was drawn so the header would read as a band rather than a word
        floating in the corner of an empty box, and it did that — but the
        panel already has an outline, and a second line drawn across it a
        header's height down cut the box in two. The eye read the strip as a
        separate object stacked on the panel rather than as the panel's own
        top, which is exactly what it is.

        What makes it a header is the type and the space around it: an
        eyebrow at 0.16em tracking, alone on a --tri-bar-h row with the
        contents starting below it. That is enough, and it is what the
        dashboard tiles do downstairs with no rule of their own.
      */}
      {title && (
        <header
          /* Symmetric: the actions sit the same distance off the right edge
             as the title sits off the left, so the bar reads as one line
             with matched margins rather than a title and a cluster pushed
             into a corner. */
          className="flex h-[var(--tri-bar-h)] shrink-0 items-center justify-between gap-x-2 px-4"
        >
          {/* `length:` because text-[var(...)] is ambiguous to Tailwind — it
              reads it as a colour and never sets a size, which left this
              label at the browser default. */}
          <span className="text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em] text-[rgb(229_243_242_/_0.55)]">
            {title}
          </span>
          {right}
        </header>
      )}
      {/* The base padding is conditional rather than overridden by bodyClass:
          cx is a plain join, so a `p-0` passed in would emit alongside
          `px-3 pb-3` and CSS source order would pick the winner. A panel
          holding surfaces has no padding of its own to override. */}
      <div
        className={cx(
          'min-h-0 flex-1 overflow-hidden',
          !bare && 'px-3 pb-3',
          /* The overlay is absolutely positioned, so the body it covers has
             to be the containing block. Only when there is one to draw —
             a stray `relative` changes nothing visually but would shift any
             absolutely-positioned child a tile draws for its own reasons. */
          unavailable && 'relative',
          bodyClass,
        )}
        style={bodyStyle}
      >
        {children}
        {unavailable && (
          <NotAvailable reason={typeof unavailable === 'string' ? unavailable : undefined} />
        )}
      </div>
    </section>
  );
}

/** Pill — a small status word. The one badge the whole system uses. */
export function Pill({
  children,
  tone = 'quiet',
}: {
  children: ReactNode;
  tone?: 'quiet' | 'live' | 'auto' | 'warn' | 'danger' | 'ok';
}) {
  const tones: Record<string, string> = {
    quiet: 'bg-[rgb(255_255_255_/_0.06)] text-[rgb(229_243_242_/_0.6)]',
    live: 'bg-[rgb(228_216_122_/_0.16)] text-[#e4d87a]',
    auto: 'bg-[rgb(122_200_180_/_0.16)] text-[#8fd3c0]',
    ok: 'bg-[rgb(122_200_180_/_0.12)] text-[#8fd3c0]',
    warn: 'bg-[rgb(228_216_122_/_0.12)] text-[rgb(228_216_122_/_0.85)]',
    danger: 'bg-[rgb(234_199_198_/_0.14)] text-[#eac7c6]',
  };
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center rounded-full px-2 py-[3px] text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.14em]',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Status dot — engine, mic, display. Colour is the whole message. */
export function Dot({ tone }: { tone: 'ok' | 'warn' | 'danger' | 'idle' }) {
  const colors = {
    ok: '#8fd3c0',
    warn: '#e4d87a',
    danger: '#eac7c6',
    idle: 'rgb(229 243 242 / 0.28)',
  };
  return (
    <span
      className="inline-block size-[6px] shrink-0 rounded-full"
      style={{ backgroundColor: colors[tone] }}
    />
  );
}

/** Input level meter — the operator's proof the mic is alive. */
export function Meter({ level, bars = 18 }: { level: number; bars?: number }) {
  return (
    <div className="flex items-end gap-[2px]" aria-hidden>
      {Array.from({ length: bars }, (_, i) => {
        const on = i / bars < level;
        return (
          <span
            key={i}
            className="w-[3px] rounded-[1px]"
            style={{
              height: 4 + (i % 5) * 2,
              backgroundColor: on ? '#8fd3c0' : 'rgb(229 243 242 / 0.14)',
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Scripture, as it reads in the app — serif, because the projector is.
 *
 * `measure` caps the line at 46 characters. Without it the verse simply
 * takes the panel's width, which is fine at 1400 and absurd at 2560: the
 * same verse measured 52 characters a line on the default window and 103
 * on a 1080p desktop, which is roughly twice the width an eye can track
 * back from. Panels get wider; lines of type do not.
 */
export function Scripture({
  children,
  size = 15,
  measure = true,
}: {
  children: ReactNode;
  size?: number;
  measure?: boolean;
}) {
  return (
    <p
      className="text-[rgb(229_243_242_/_0.92)]"
      style={{
        fontFamily: 'var(--font-scripture)',
        fontWeight: 'var(--font-scripture-weight)' as never,
        fontSize: size,
        lineHeight: 1.5,
        maxWidth: measure ? '46ch' : undefined,
      }}
    >
      {children}
    </p>
  );
}

/** The empty state every panel falls back to. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center">
      <span className="text-[length:var(--tri-size-xs)] leading-relaxed text-[rgb(229_243_242_/_0.3)]">{children}</span>
    </div>
  );
}

/**
 * Laid over a tile whose numbers are not real yet.
 *
 * A dashboard's whole job is to be trusted at a glance from across the
 * booth, and a tile that shows a confident figure it invented does more
 * damage than a tile showing nothing: nobody checks a number that looks
 * fine. So the placeholder content stays visible underneath — the layout is
 * real and worth seeing — but it is dimmed and blurred out of legibility so
 * no individual figure can be read off it and believed.
 *
 * `reason` says what the tile is waiting for, because "not available" alone
 * invites a bug report. When it is waiting on something the church has to
 * do (sign in, connect a service), that sentence is the instruction.
 */
export function NotAvailable({ reason }: { reason?: string }) {
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 px-4 text-center"
      style={{
        backdropFilter: 'blur(3px) saturate(0.4)',
        WebkitBackdropFilter: 'blur(3px) saturate(0.4)',
        background: 'rgb(14 20 19 / 0.62)',
      }}
    >
      <span className="text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em] text-[rgb(229_243_242_/_0.5)]">
        not available
      </span>
      {reason && (
        <span className="max-w-[24ch] text-[length:var(--tri-size-xs)] leading-relaxed text-[rgb(229_243_242_/_0.32)]">
          {reason}
        </span>
      )}
    </div>
  );
}
