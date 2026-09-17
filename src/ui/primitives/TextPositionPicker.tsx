import { useState } from 'react';
import { cx } from '../lib/cx';
import { useNudge } from '../hooks/useNudge';
import { useElementWidth } from '../hooks/useElementWidth';

export type TextPositionOption = 'top' | 'bottom-right' | 'bottom-center' | 'bottom-left';

export interface TextPositionItem {
  id: TextPositionOption;
  label: string;
}

export const TEXT_POSITION_OPTIONS: TextPositionItem[] = [
  { id: 'top', label: 'top' },
  { id: 'bottom-right', label: 'bottom right' },
  { id: 'bottom-center', label: 'bottom center' },
  { id: 'bottom-left', label: 'bottom left' },
];

export interface TextPositionPickerProps {
  /** The control names what it positions, and screens disagree: the theme
      editor calls this "verse layout". */
  label?: string;
  value?: TextPositionOption;
  onChange?: (next: TextPositionOption) => void;
  /** Two columns gives a live theme editor room for legible previews. */
  columns?: 2 | 4;
  disabled?: boolean;
  className?: string;
}

export function TextPositionPicker({
  label = 'text position',
  value = 'top',
  onChange,
  columns = 4,
  disabled = false,
  className = '',
}: TextPositionPickerProps) {
  const [internalSelected, setInternalSelected] = useState<TextPositionOption>('top');
  const selected = value ?? internalSelected;

  const handleSelect = (id: TextPositionOption) => {
    if (disabled) return;
    setInternalSelected(id);
    onChange?.(id);
  };

  return (
    <div className={cx('flex flex-col gap-2 lowercase', className)}>
      <span className="tri-label text-[var(--tri-ink-muted)]">{label}</span>
      {/* The primitive defaults to one compact row. In the live editor its
          two-column form fills the panel: two equal cards, each one half of
          the available width, at every screen size. */}
      <div
        className="grid w-full items-start gap-4"
        style={{
          gridTemplateColumns:
            columns === 2
              ? 'repeat(2, minmax(0, 1fr))'
              : 'repeat(4, minmax(0, var(--tri-card-max)))',
        }}
      >
        {TEXT_POSITION_OPTIONS.map((opt) => (
          <PositionCardItem
            key={opt.id}
            option={opt}
            isSelected={selected === opt.id}
            disabled={disabled}
            onClick={() => handleSelect(opt.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface PositionCardItemProps {
  option: TextPositionItem;
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
}

function PositionCardItem({ option, isSelected, disabled, onClick }: PositionCardItemProps) {
  const { ref, nudge } = useNudge<HTMLButtonElement>();

  // Concentric geometric formula for nested rounded surfaces:
  // R_outer = R_inner + Gap
  /* Was pinned at the file's 108x64. It now scales with its grid cell so the
     cards span the control column; 108x57 becomes the aspect ratio and a
     floor, so the position graphic never renders smaller than it was drawn. */
  /* All from the tier — see the metrics block in tokens.css. The card's
     floor and its shape are separate tokens because they behave differently:
     the floor grows between tiers, the shape never changes.
     R_outer = R_inner + gap keeps the corners concentric at any tier. */
  const GAP = 'var(--tri-card-gap)';
  /* cqw = 1% of the cell the card fills, so these track the card's real
     width. R_outer = R_inner + gap still holds, at any size. */
  const OUTER_RADIUS = 'calc(var(--tri-card-round) * 1cqw)';
  const INNER_RADIUS = 'calc(var(--tri-card-round) * 1cqw - var(--tri-card-gap))';

  return (
    <div className="flex min-w-0 flex-col items-center gap-[2px]" style={{ containerType: 'inline-size' }}>
      <button
        ref={ref}
        type="button"
        aria-pressed={isSelected}
        aria-disabled={disabled || undefined}
        onClick={disabled ? nudge : onClick}
        className={cx(
          'relative flex items-center justify-center transition-all duration-200 focus:outline-none',
          disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        )}
        style={{
          /* No minimum: the four cards live in a grid-cols-4, and a floor
             just overflows the cell on a narrow column — the card pokes out
             of the row and the whole control reads as broken. The graphic
             inside is cqw-scaled, so it shrinks with the card instead. */
          width: '100%',
          aspectRatio: 'var(--tri-card-ratio)',
          padding: GAP,
          borderRadius: OUTER_RADIUS,
          // Width comes from --tri-border; only the overlay is set here.
          boxShadow: isSelected
            ? 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.20), inset 0 0 0 var(--tri-border) var(--tri-edge, #07271c)'
            : 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.16)',
        }}
      >
        {/* Inner Card (green linear gradient fill when selected, borderless) */}
        <div
          className={cx(
            'relative flex h-full w-full overflow-hidden p-1.5 transition-all duration-200',
            isSelected
              ? 'tri-surface tri-interactive'
              : 'bg-[rgb(0_0_0_/_0.20)] hover:bg-[rgb(255_255_255_/_0.04)]',
          )}
          style={{
            borderRadius: INNER_RADIUS,
            // The graphic inside sizes itself in cqw, so the card has to be the
            // container that query resolves against.
            containerType: 'inline-size',
          }}
        >
          {/* Card Horizontal Layout Graphics */}
          <PositionGraphic id={option.id} isSelected={isSelected} />
        </div>
      </button>

      {/* Subtle, balanced (180ms) yellow pill dash under selected card */}
      <div
        className="mt-[5px] mb-[2px] h-[3px] w-[20px] rounded-full"
        style={{
          backgroundColor: 'var(--tri-accent-yellow, #e4d87a)',
          opacity: isSelected ? 1 : 0,
          transform: isSelected ? 'scaleX(1)' : 'scaleX(0.7)',
          transition: 'all 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />

      {/* Subtitle label below (top, bottom right, bottom center, bottom left) */}
      <span
        /* Size comes from .tri-label. An sm utility here was dead — see
           the note in Button. */
        className="tri-label lowercase"
        style={{
          color: isSelected ? 'var(--tri-ink, #e5f3f2)' : 'var(--tri-ink-muted, rgb(229 243 242 / 0.64))',
          transform: isSelected ? 'translateY(2px)' : 'translateY(-11px)',
          transition:
            'transform 180ms cubic-bezier(0.16, 1, 0.3, 1), color 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {option.label}
      </span>
    </div>
  );
}

function PositionGraphic({ id, isSelected }: { id: TextPositionOption; isSelected: boolean }) {
  const lineOpacity = isSelected ? 0.55 : 0.32;

  /*
   * Everything here was drawn in px against the old fixed 108x64 card, so a
   * wider card only added padding around a fixed-size diagram. The same
   * numbers are now expressed in cqw — percent of the card's own width — so
   * the lines, their thickness, the gaps and the dash all grow with the card
   * and the graphic keeps the proportions it was drawn with.
   *
   * Divisor is 98: the 108 card minus the inner padding the lines sit inside.
   */
  const w = (px: number) => `${((px / 98) * 100).toFixed(3)}cqw`;

  /* Tapering stack, longest to shortest — the drawn widths, now relative. */
  const LINES = [76, 58, 42, 26];
  const DASH_W = w(18);

  /*
   * Thickness and gap are the two values that must not be fractional.
   *
   * In cqw they resolve to something like 2.7px, and because each line sits at
   * a different offset in the stack, they land on different subpixel
   * boundaries: one line straddles a pixel edge and antialiases across three
   * rows (reads thick and soft), the next lands clean (reads thin and crisp).
   * Identical values, visibly different lines.
   *
   * So they are measured and rounded here rather than handed to CSS as a
   * fraction. They still scale with the card — just in whole-pixel steps,
   * which is the only thing a hairline can actually be.
   */
  const { ref: graphicRef, width: graphicW } = useElementWidth<HTMLDivElement>();
  const scale = graphicW > 0 ? graphicW / 98 : 1;
  const THICK = `${Math.max(2, Math.round(2 * scale))}px`;
  const LINE_GAP = `${Math.max(3, Math.round(4 * scale))}px`;

  const lines = (align: 'center' | 'start') => (
    <div
      className={cx('flex w-full flex-col', align === 'center' ? 'items-center' : 'items-start')}
      style={{ gap: LINE_GAP }}
    >
      {LINES.map((lw) => (
        <div
          key={lw}
          className="rounded-full bg-current"
          style={{ height: THICK, width: w(lw), opacity: lineOpacity }}
        />
      ))}
    </div>
  );

  const dash = (
    <div
      className="rounded-full"
      style={{
        height: THICK,
        width: DASH_W,
        backgroundColor: 'var(--tri-accent-yellow, #e4d87a)',
      }}
    />
  );

  /* py/px were 3px/4px on the drawn card; relative for the same reason. */
  const frame = {
    paddingBlock: w(3),
    paddingInline: w(4),
    /* Dash-to-stack spacing, scaling like everything else. Deliberately wider
       than the gap inside the stack — the dash is a different thing from the
       text it marks, and the space is what says so. */
    gap: w(10),
  };

  /*
   * justify-between put every spare pixel between the dash and the stack, so
   * the two read as unrelated. They are centred as one group with a fixed gap
   * instead — the dash stays visibly attached to the text it marks.
   */
  const stack = 'flex h-full w-full flex-col justify-center';

  if (id === 'top') {
    return (
      <div ref={graphicRef} className={cx(stack, 'items-center')} style={frame}>
        {dash}
        {lines('center')}
      </div>
    );
  }

  if (id === 'bottom-center') {
    return (
      <div ref={graphicRef} className={cx(stack, 'items-center')} style={frame}>
        {lines('center')}
        {dash}
      </div>
    );
  }

  if (id === 'bottom-right') {
    return (
      <div ref={graphicRef} className={stack} style={frame}>
        {lines('start')}
        <div className="flex w-full justify-end">{dash}</div>
      </div>
    );
  }

  // bottom-left
  return (
    <div ref={graphicRef} className={stack} style={frame}>
      {lines('start')}
      <div className="flex w-full justify-start">{dash}</div>
    </div>
  );
}
