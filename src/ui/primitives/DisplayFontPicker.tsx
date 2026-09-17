import { useState } from 'react';
import { cx } from '../lib/cx';
import { useNudge } from '../hooks/useNudge';

export type FontOption = 'default' | 'serif' | 'uppercase';

export interface DisplayFontOption {
  id: FontOption;
  label: string;
  sample: string;
  fontFamily?: string;
}

export const DISPLAY_FONT_OPTIONS: DisplayFontOption[] = [
  {
    id: 'default',
    label: 'default',
    sample: 'Aa',
    fontFamily: 'var(--tri-font, Roboto, sans-serif)',
  },
  {
    id: 'serif',
    label: 'serif',
    sample: 'Aa',
    fontFamily: 'Georgia, "Times New Roman", serif',
  },
  {
    id: 'uppercase',
    label: 'uppercase',
    sample: 'AA',
    fontFamily: 'var(--tri-font, Roboto, sans-serif)',
  },
];

export interface DisplayFontPickerProps {
  value?: FontOption;
  onChange?: (next: FontOption) => void;
  disabled?: boolean;
  className?: string;
}

export function DisplayFontPicker({
  value,
  onChange,
  disabled = false,
  className = '',
}: DisplayFontPickerProps) {
  const [internalSelected, setInternalSelected] = useState<FontOption>('default');
  const selected = value ?? internalSelected;

  const handleSelect = (id: FontOption) => {
    if (disabled) return;
    setInternalSelected(id);
    onChange?.(id);
  };

  return (
    <div className={cx('flex flex-col gap-2 lowercase', className)}>
      <span className="tri-label text-[var(--tri-ink-muted)]">display font</span>
      <div className="flex items-start gap-4">
        {DISPLAY_FONT_OPTIONS.map((opt) => {
          return (
            <FontCardItem
              key={opt.id}
              option={opt}
              displaySample={opt.sample}
              displayLabel={opt.label}
              isSelected={selected === opt.id}
              disabled={disabled}
              onClick={() => handleSelect(opt.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface FontCardItemProps {
  option: DisplayFontOption;
  displaySample: string;
  displayLabel: string;
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
}

function FontCardItem({
  option,
  displaySample,
  displayLabel,
  isSelected,
  disabled,
  onClick,
}: FontCardItemProps) {
  const { ref, nudge } = useNudge<HTMLButtonElement>();

  /*
   * The card fills its share of the row and keeps its shape while doing it:
   * height follows width through aspect-ratio, so growing makes a bigger
   * square, not a stretched one. OUTER_SIZE is now only the ratio's origin
   * (86x86, square) and the minimum the card will shrink to.
   *
   * The caption and the selected dash keep their own sizes; the sample
   * glyph scales with the card (37cqw), because it is the card's content —
   * a big card with a small Aa in it reads as empty, not bigger.
   *
   * Concentric geometric formula for nested rounded surfaces:
   * R_outer = R_inner + Gap, Size_inner = Size_outer - (2 * Gap)
   */
  /* From the tier. The card's *size* is deliberately not here: it is fluid,
     filling its share of the row with aspect-ratio holding the square. */
  const GAP = 'var(--tri-card-gap)';
  /* cqw = 1% of the cell the card fills — the corner keeps its proportion
     whatever the card's size works out to. */
  const OUTER_RADIUS = 'calc(var(--tri-font-card-round) * 1cqw)';
  const INNER_RADIUS = 'calc(var(--tri-font-card-round) * 1cqw - var(--tri-card-gap))';

  return (
    <div
      className="flex min-w-0 flex-1 flex-col items-center gap-[2px]"
      /* Capped: the glyph inside is cqw-scaled and would otherwise balloon
         with the window while the caption stays put — see --tri-card-max. */
      style={{ containerType: 'inline-size', maxWidth: 'var(--tri-card-max)' }}
    >
      <button
        ref={ref}
        type="button"
        aria-pressed={isSelected}
        aria-disabled={disabled || undefined}
        onClick={disabled ? nudge : onClick}
        className={cx(
          'relative flex w-full items-center justify-center transition-all duration-200 focus:outline-none select-none',
          disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        )}
        style={{
          aspectRatio: '1',
          padding: GAP,
          borderRadius: OUTER_RADIUS,
          // Width comes from --tri-border; only the overlay is set here.
          boxShadow: isSelected
            ? 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.20), inset 0 0 0 var(--tri-border) var(--tri-edge, #07271c)'
            : 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.16)',
        }}
      >
        {/* Inner Linear Card (computed 76px x 76px with 5px gap & 20px radius) */}
        <div
          className={cx(
            'flex h-full w-full items-center justify-center transition-all duration-200',
            isSelected
              ? 'tri-surface tri-interactive'
              : 'bg-[rgb(0_0_0_/_0.20)] hover:bg-[rgb(255_255_255_/_0.04)]',
          )}
          style={{
            borderRadius: INNER_RADIUS,
          }}
        >
          <span
            className="font-normal leading-none tracking-normal select-none transition-colors duration-200"
            style={{
              /* The drawn 32px on the drawn 86px card, as a proportion — the
                 glyph is the card's content, not a caption, so it scales with
                 the card the way the corner does. */
              fontSize: '37cqw',
              fontFamily: option.fontFamily,
              color: 'var(--tri-accent-yellow, #e4d87a)',
              opacity: isSelected ? 1 : 0.65,
            }}
          >
            {displaySample}
          </span>
        </div>
      </button>

      {/* Subtle, balanced (180ms) yellow pill dash under selected card with 5px top space */}
      <div
        className="mt-[5px] mb-[2px] h-[3px] w-[20px] rounded-full"
        style={{
          backgroundColor: 'var(--tri-accent-yellow, #e4d87a)',
          opacity: isSelected ? 1 : 0,
          transform: isSelected ? 'scaleX(1)' : 'scaleX(0.7)',
          transition: 'all 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />

      {/* Subtitle label below (default, serif, uppercase/lowercase) */}
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
        {displayLabel}
      </span>
    </div>
  );
}
