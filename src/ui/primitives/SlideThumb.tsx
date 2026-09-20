import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { slideBackdrop, type BackdropStyle } from '../lib/slideBackdrop';
import { ChevronDownIcon, PencilIcon } from '../icons';

/*
 * D-54 — a slide, small.
 *
 * The picture is the point. An operator scanning a song for the second chorus
 * is matching shapes, not reading labels, so the thumbnail carries the weight
 * and the caption underneath is only there to settle ties.
 *
 * What fills the frame is a real render of the slide once there is one. Until
 * then it is drawn the way the projector draws one — a dark picture, a dim
 * overlay, the words — so the card looks like the thing it stands for. It is
 * deliberately not a design-system surface: a slide is content, and dressing
 * it in the interface gradient made every card look like a piece of chrome.
 */

export interface SlideThumbProps {
  /** "Verse 1", "Chorus", "Bridge" — what the operator is looking for. */
  label: string;
  /** A rendered preview once one exists; the placeholder wash stands in. */
  preview?: string;
  /**
   * The words on the slide, drawn over the wash — as stanzas, each a run of
   * lines. Closer to the real render than an empty rectangle is, and closer
   * to what the congregation sees, which is the whole reason this is a
   * picture and not a list row. Two stanzas is the usual: the verse and the
   * one after it, so the card shows where the song is going.
   */
  stanzas?: string[][];
  /**
   * Which stand-in picture to draw when there is no `preview`. Defaults to
   * `index`, so a grid gets a different picture per card for free.
   */
  backdrop?: number;
  /** Which drawing to use for the stand-in. */
  backdropStyle?: BackdropStyle;
  /**
   * When the slide is one of a run — a verse in a song — the card can page
   * through its siblings in place. Arrows on the edges and a "2 / 5" in the
   * corner, on hover only: at rest the card is a picture of one slide, and
   * the run is a thing you find out about by reaching for it.
   */
  pager?: {
    /** Index of the slide showing, 0-based. */
    at: number;
    count: number;
    onStep: (delta: -1 | 1) => void;
  };
  /**
   * A word that stays on the picture, unlike the pager's counter — for a
   * slide that is standing in for something not here yet. An imported deck
   * whose pages are still converting says "24 slides" so the card is honest
   * about being a placeholder for a real file of a known size; hover-only
   * would have hidden the one fact the card has.
   *
   * Drawn where the pager's counter sits, and only when there is no pager:
   * a deck you cannot page through is exactly the deck that needs this, and
   * the two never want the corner at the same time.
   */
  badge?: ReactNode;
  /**
   * Draw `label` under the frame. Off when the caller is titling the card
   * itself — a name that belongs to the whole thing reads as a heading over
   * it, not as a strip of text fenced inside the picture it names.
   */
  showCaption?: boolean;
  selected?: boolean;
  /** On the projector right now. Outranks selected. */
  live?: boolean;
  onSelect?: () => void;
  /** The commit gesture — double-click, matching the verse rows. */
  onSend?: () => void;
  onEdit?: () => void;
  /** Position in its grid, so a selection can be scrolled into view. */
  index?: number;
  className?: string;
}

export function SlideThumb({
  label,
  preview,
  stanzas,
  backdrop,
  backdropStyle,
  pager,
  badge,
  showCaption = true,
  selected = false,
  live = false,
  onSelect,
  onSend,
  onEdit,
  index,
  className = '',
}: SlideThumbProps) {
  return (
    <div
      data-row={index}
      className={cx('tri-rounded-control group relative flex flex-col overflow-hidden', className)}
    >
      {/*
        The card's edge, drawn on a layer ABOVE the picture. An inset
        box-shadow on the container paints under its children, and the
        picture fills the container — so the ring was there, and invisible,
        behind a bitmap. Same fix as the heard card. Live and selected do
        not brighten on hover: they are already saying something louder.
      */}
      <span
        aria-hidden
        className={cx(
          /* tri-rounded-control, not rounded-[inherit]: `corner-shape` is
             not an inherited property, so inheriting the radius alone drew
             this ring as a plain circular corner over a squircle card. */
          'tri-rounded-control pointer-events-none absolute inset-0 z-10 transition-shadow duration-150',
          live
            ? 'shadow-[inset_0_0_0_var(--tri-border)_rgb(228_216_122_/_0.6)]'
            : selected
              ? 'shadow-[inset_0_0_0_var(--tri-border)_rgb(255_255_255_/_0.42)]'
              : 'shadow-[inset_0_0_0_var(--tri-border)_rgb(255_255_255_/_0.22)] group-hover:shadow-[inset_0_0_0_var(--tri-border)_rgb(255_255_255_/_0.42)]',
        )}
      />
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={onSend}
        aria-pressed={selected}
        className="relative block w-full cursor-pointer overflow-hidden bg-black focus:outline-none"
        style={{ aspectRatio: '16 / 9' }}
      >
        {/*
          The picture. A real render when there is one; otherwise the drawn
          stand-in, which is a dark photograph in everything but provenance.
          It eases in on hover — a slide is a picture, and a picture that
          answers the pointer is one you can tell is live.
        */}
        <img
          src={preview ?? slideBackdrop(backdrop ?? index ?? 0, backdropStyle)}
          alt=""
          draggable={false}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />

        {/*
          The dim. This is the projector's own overlay, not decoration: the
          words have to clear the picture on the screen and they have to clear
          it here. Kept light — the picture is the point of the card, and the
          text shadows do most of the clearing — and heavier only at the
          foot, where the vignette already is.
        */}
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgb(0 0 0 / 0.45) 0%, rgb(0 0 0 / 0.18) 50%, rgb(0 0 0 / 0.08) 100%)',
          }}
        />

        {/*
          The words, set the way the screen sets them: each line on its own
          line, stanzas held apart by a small gap, the whole block centred.
          Clipped rather than scrolled or shrunk to fit — a thumbnail is for
          recognising a slide, and past four lines nobody is still matching
          shapes. No section label: "verse 1" over the words was a caption
          on a picture that is itself a caption, and the counter in the
          corner already says where in the song you are.
        */}
        {!preview && stanzas?.length ? (
          /* The words step in from the edges while the arrows are up, so a
             chevron never lands on a letter. Padding animates, not the text:
             the words stay put in the middle and the margins move.

             Two stanzas split the frame into equal halves — a grid, not a
             flex column with a gap — so the rule between them sits on the
             frame's exact centre line and each verse is centred in its own
             half. A gap-spaced column put the rule wherever the text
             heights happened to leave it. */
          <span
            className={cx(
              'absolute inset-0 grid overflow-hidden px-1.5 text-center',
              'transition-[padding] duration-150',
              stanzas.length > 1 ? 'grid-rows-2' : 'grid-rows-1',
              pager && pager.count > 1 && 'group-hover:px-8',
            )}
          >
            {stanzas.map((lines, si) => (
              <span
                key={si}
                /* The base step — one size up from the caption step, which
                   read as fine print against a 234px frame. Lines wrap.

                   The two verses HUG the rule: the upper one sits on the
                   floor of its half, the lower one on the ceiling of its,
                   each held off the line by a small pad. Centring each in
                   its own half left the rule alone in a band of empty
                   picture, which read as two cards stacked, not one slide
                   with a break in it. */
                className={cx(
                  'flex min-h-0 flex-col items-center text-[length:var(--tri-size)] font-normal leading-[1.3] tracking-[-0.01em] text-[rgb(255_255_255_/_0.92)]',
                  stanzas.length > 1
                    ? si === 0
                      ? 'justify-end pb-[7px]'
                      : 'justify-start pt-[7px]'
                    : 'justify-center',
                )}
                style={{ textShadow: '0 1px 2px rgb(0 0 0 / 0.7), 0 0 14px rgb(0 0 0 / 0.45)' }}
              >
                {lines.map((line, li) => (
                  <span key={li} className="block">
                    {line}
                  </span>
                ))}
              </span>
            ))}
            {/* The verse break, drawn on the centre line of the frame. */}
            {stanzas.length > 1 ? (
              <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 h-px w-7 -translate-x-1/2 -translate-y-1/2 bg-[rgb(255_255_255_/_0.32)]"
              />
            ) : null}
          </span>
        ) : null}
      </button>

      {pager && pager.count > 1 ? (
        <>
          {/*
            The arrows stop the pointer at pointerdown, not just at click:
            the wrapper around this card starts a drag on a held pointer, and
            a step through the verses is not a pick-up. Clamped at the ends
            rather than wrapping — "3 / 5" means two more to come, and a
            wrap would make the count a lie.
          */}
          {([-1, 1] as const).map((delta) => {
            const atEnd = delta < 0 ? pager.at === 0 : pager.at === pager.count - 1;
            return (
              <button
                key={delta}
                type="button"
                disabled={atEnd}
                aria-label={delta < 0 ? 'previous verse' : 'next verse'}
                onPointerDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  pager.onStep(delta);
                }}
                className={cx(
                  'absolute top-1/2 z-20 flex h-[24px] w-[24px] -translate-y-1/2 items-center justify-center rounded-full',
                  'bg-[rgb(0_0_0_/_0.45)] text-[rgb(255_255_255_/_0.9)] backdrop-blur-sm',
                  'opacity-0 transition-opacity duration-150 focus:opacity-100 group-hover:opacity-100',
                  'disabled:pointer-events-none disabled:!opacity-0',
                  delta < 0 ? 'left-1.5' : 'right-1.5',
                )}
              >
                <ChevronDownIcon size={11} className={delta < 0 ? 'rotate-90' : '-rotate-90'} />
              </button>
            );
          })}
          <span
            aria-live="polite"
            className={cx(
              'pointer-events-none absolute bottom-1.5 right-2 z-20 rounded-full px-1.5 py-[2px]',
              'bg-[rgb(0_0_0_/_0.45)] text-[9px] tabular-nums leading-none text-[rgb(255_255_255_/_0.85)] backdrop-blur-sm',
              'opacity-0 transition-opacity duration-150 group-hover:opacity-100',
            )}
          >
            {pager.at + 1} / {pager.count}
          </span>
        </>
      ) : null}

      {badge && !(pager && pager.count > 1) ? (
        <span
          className={cx(
            'pointer-events-none absolute bottom-1.5 right-2 z-20 rounded-full px-1.5 py-[2px]',
            'bg-[rgb(0_0_0_/_0.45)] text-[9px] tabular-nums leading-none text-[rgb(255_255_255_/_0.85)] backdrop-blur-sm',
          )}
        >
          {badge}
        </span>
      ) : null}

      {/*
        The edit affordance sits on the slide rather than beside it, because
        there is one per slide and a column of pencils down the side would be
        four controls pointing at four different things with nothing to say
        which is which. Top-RIGHT: the words are centred and two stanzas
        tall, so the top-left corner is where a long first line begins and
        the pencil was sitting on its first letter. Nothing else lives in
        the top-right — the counter is bottom-right, the arrows mid-edge.

        Hover-only, like the arrows and the counter it shares the frame
        with — the frame is full of words now, and a pencil that is always
        there is always on a letter. The card teaches that it opens the
        same way it teaches that it pages: by answering the pointer.
      */}
      {/* Only where it does something. A grid that edits from its own
          caption row (songs) passes no onEdit, and a pencil that answers
          the pointer and then ignores the click is worse than none. */}
      {onEdit ? <button
        type="button"
        onClick={onEdit}
        aria-label={`edit ${label}`}
        className={cx(
          'absolute right-2 top-2 z-20 flex h-[22px] w-[22px] items-center justify-center rounded-full',
          'bg-[rgb(0_0_0_/_0.35)] text-[rgb(255_255_255_/_0.85)] backdrop-blur-sm',
          'opacity-0 transition-opacity duration-150 focus:opacity-100 group-hover:opacity-100',
        )}
      >
        <PencilIcon size={11} />
      </button> : null}

      {showCaption ? (
        <span
          className={cx(
            'block px-2 py-2 text-center text-[length:var(--tri-size-sm)]',
            live
              ? 'text-[rgb(228_216_122_/_0.9)]'
              : selected
                ? 'text-[var(--tri-ink)]'
                : 'text-[rgb(229_243_242_/_0.62)]',
          )}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
