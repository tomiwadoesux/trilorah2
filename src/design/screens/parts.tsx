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
  blurb,
  onOpen,
  icon,
  right,
  children,
  className,
  bodyClass,
  style,
  bodyStyle,
  tone = 'default',
  bare = false,
  unavailable = false,
  empty = false,
}: {
  title?: string;
  /** Center the heading until this panel has content. */
  empty?: boolean;
  /**
   * One sentence under the title, saying what the card is for.
   *
   * The Supabase-bento shape the owner pointed at: icon and name on one
   * line, a sentence directly beneath it, the card's own content below
   * that. It replaces the habit of pushing the explanation out to the
   * right of the header, where it competes with the name for the same
   * line and gets truncated first on a narrow tile.
   *
   * Only worth giving a card whose name does not already say it. "service
   * timer" needs no gloss; "readiness" and "outputs" do.
   */
  blurb?: string;
  /**
   * What the blurb does when pressed. Given one, the sentence becomes the
   * card's own way in: the words stay exactly as they read, and a green
   * arrow lands after the last one.
   *
   * The whole card still opens — this does not replace that, and must not,
   * because a card the operator has learned to press anywhere would become
   * a card with one live word in it. What the arrow adds is a TARGET: an
   * affordance you can see without hovering, on a surface that otherwise
   * gives no sign it is pressable. The rest of the card is the shortcut for
   * whoever already knows; this is the sign for whoever does not.
   */
  onOpen?: () => void;
  /** A small glyph in a square before the title. On a tile that opens it
      turns mint with the tile's hover, alongside its card art. */
  icon?: ReactNode;
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
             into a corner.

             With a blurb the bar stops being a fixed-height row: the
             sentence sets the height, and the padding under it is what
             separates the pair from the content rather than the leftover
             space in a 38px strip. Without one the row keeps --tri-bar-h
             exactly, so every card that had no blurb is untouched. */
          className={cx(
            'tri-panel-header flex shrink-0 gap-x-2 px-4',
            empty && 'tri-panel-header--empty',
            blurb ? 'flex-col pb-2.5 pt-3' : 'h-[var(--tri-bar-h)] items-center justify-between',
          )}
        >
          {/* `length:` because text-[var(...)] is ambiguous to Tailwind — it
              reads it as a colour and never sets a size, which left this
              label at the browser default. */}
          <span className={cx('tri-panel-heading flex min-w-0 items-center gap-2', blurb && 'w-full justify-between')}>
            <span className="flex min-w-0 items-center gap-2">
              {icon && (
                <span
                  aria-hidden
                  className={cx(
                    'grid size-[22px] shrink-0 place-items-center rounded-[5px] bg-[rgb(255_255_255_/_0.05)] text-[rgb(229_243_242_/_0.62)]',
                    'shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.08)] transition-[color,box-shadow] duration-300',
                    'group-hover/tile:text-[#8fd3c0] group-hover/tile:shadow-[inset_0_0_0_1px_rgb(143_211_192_/_0.35)]',
                  )}
                >
                  {icon}
                </span>
              )}
              <span className="tri-panel-title truncate text-[calc(var(--tri-size-eyebrow)+1.5px)] font-semibold uppercase tracking-[0.16em] text-[rgb(229_243_242_/_0.85)]">
                {title}
              </span>
            </span>
            {blurb && right}
          </span>
          {/* The sentence lines up with the TITLE, not the icon: indented
              by the icon's width plus its gap, so the two read as one
              stacked block rather than the sentence starting under a
              square it has nothing to do with. */}
          {blurb && (
            <p
              className="mt-1 text-[length:var(--tri-size-xs)] leading-snug"
              style={{ color: 'rgb(229 243 242 / 0.45)', paddingLeft: icon ? 30 : 0 }}
            >
              {onOpen ? <BlurbLink onOpen={onOpen}>{blurb}</BlurbLink> : blurb}
            </p>
          )}
          {!blurb && right}
        </header>
      )}
      {/* The base padding is conditional rather than overridden by bodyClass:
          cx is a plain join, so a `p-0` passed in would emit alongside
          `px-3 pb-3` and CSS source order would pick the winner. A panel
          holding surfaces has no padding of its own to override. */}
      <div
        className={cx(
          'tri-panel-body min-h-0 flex-1 overflow-hidden',
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

/*
 * The blurb, as the card's way in.
 *
 * An inline button rather than a block: the arrow has to sit after the LAST
 * WORD of the sentence, not out at the right edge of the card. An arrow
 * parked in the corner reads as "next", which is a different promise —
 * this one means "this sentence takes you in".
 *
 * `inline` with the arrow inside the same flow is what keeps the two
 * together when the sentence wraps: the arrow follows the final word onto
 * whatever line it lands on, so the pair never separates. The arrow is in
 * a whitespace-nowrap span with a non-breaking space before it so it can
 * never be the only thing on a line of its own.
 *
 * Green only here. The card's own content stays colourless (the bento is
 * deliberately so), which is exactly what lets one small green mark per
 * card carry "this is the thing to press" without the board turning into a
 * field of buttons.
 */
function BlurbLink({ children, onOpen }: { children: ReactNode; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        /* The card behind this is pressable too. Without this the press
           counts twice — once here, once on the card — which on an
           Expandable tile opens and immediately re-opens it. */
        e.stopPropagation();
        onOpen();
      }}
      className="group/blurb cursor-pointer text-left transition-colors hover:text-[rgb(229_243_242_/_0.72)]"
    >
      {children}
      {/* The arrow chip that used to end every blurb is gone: the expand
          cue in the tile's corner is the one "this opens" signal now, and
          two arrows saying it twice made both mean less. The blurb still
          presses. */}
    </button>
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
        'inline-flex shrink-0 items-center rounded-md px-2 py-[3px] text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.14em]',
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
