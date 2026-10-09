import { useState } from 'react';
import { cx } from '../lib/cx';
import { useNudge } from '../hooks/useNudge';
import { DISPLAY_FONTS } from '../../../shared/displayFont';
import { nextTextCase, resolveTextCase, type TextCase } from '../../../shared/textCase';
import { nextTextSpacing, TEXT_SPACING, type TextSpacing } from '../../../shared/textSpacing';
import './displayFontPicker.css';

export type FontOption = 'default' | 'serif' | 'uppercase';

export interface DisplayFontOption {
  id: FontOption | 'spacing';
  label: string;
  sample: string;
  fontFamily?: string;
}

export const DISPLAY_FONT_OPTIONS: DisplayFontOption[] = [
  {
    id: 'default',
    label: 'default',
    sample: 'Aa',
    fontFamily: DISPLAY_FONTS.default,
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
    fontFamily: DISPLAY_FONTS.default,
  },
  {
    id: 'spacing',
    label: 'normal',
    sample: 'AA',
    fontFamily: DISPLAY_FONTS.default,
  },
];

export interface DisplayFontPickerProps {
  value?: FontOption;
  onChange?: (next: FontOption) => void;
  textCase?: TextCase;
  onTextCaseChange?: (next: TextCase) => void;
  textSpacing?: TextSpacing;
  onTextSpacingChange?: (next: TextSpacing) => void;
  disabled?: boolean;
  className?: string;
}

export function DisplayFontPicker({
  value,
  onChange,
  textCase,
  onTextCaseChange,
  textSpacing,
  onTextSpacingChange,
  disabled = false,
  className = '',
}: DisplayFontPickerProps) {
  const [internalSelected, setInternalSelected] = useState<FontOption>('default');
  const [internalCase, setInternalCase] = useState<TextCase>(() => resolveTextCase(undefined, value));
  const selected = (value ?? internalSelected) === 'serif' ? 'serif' : 'default';
  const caseAction = nextTextCase(textCase ?? internalCase);
  const [internalSpacing, setInternalSpacing] = useState<TextSpacing>('normal');
  const spacing = textSpacing ?? internalSpacing;

  const handleSelect = (id: FontOption) => {
    if (disabled) return;
    setInternalSelected(id);
    onChange?.(id);
  };

  const handleCaseChange = () => {
    if (disabled) return;
    setInternalCase(caseAction);
    onTextCaseChange?.(caseAction);
  };

  const handleSpacingChange = () => {
    if (disabled) return;
    const next = nextTextSpacing(spacing);
    setInternalSpacing(next);
    onTextSpacingChange?.(next);
  };

  const renderCard = (opt: DisplayFontOption) => {
    const id = opt.id;
    return (
      <FontCardItem
        key={id}
        option={opt}
        displaySample={id === 'uppercase' ? (caseAction === 'uppercase' ? 'AA' : 'aa') : opt.sample}
        displayLabel={id === 'uppercase' ? caseAction : id === 'spacing' ? spacing : opt.label}
        isSelected={selected === id}
        spacing={id === 'spacing' ? spacing : undefined}
        disabled={disabled}
        onClick={id === 'uppercase' ? handleCaseChange : id === 'spacing' ? handleSpacingChange : () => handleSelect(id)}
      />
    );
  };

  return (
    <div className={cx('flex min-w-0 flex-col gap-2 lowercase', className)}>
      <span className="tri-label tri-control-heading text-[var(--tri-ink-muted)]">display font</span>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_2px_minmax(0,1fr)] items-start gap-x-2.5">
        <div role="group" aria-label="font choices" className="grid min-w-0 grid-cols-2 gap-3">
          {DISPLAY_FONT_OPTIONS.slice(0, 2).map(renderCard)}
        </div>
        <span aria-hidden className="h-4 w-0.5 -translate-y-3 self-center rounded-full bg-white/20" />
        <div role="group" aria-label="text controls" className="grid min-w-0 grid-cols-2 gap-3">
          {DISPLAY_FONT_OPTIONS.slice(2).map(renderCard)}
        </div>
      </div>
    </div>
  );
}

interface FontCardItemProps {
  option: DisplayFontOption;
  displaySample: string;
  displayLabel: string;
  isSelected: boolean;
  spacing?: TextSpacing;
  disabled: boolean;
  onClick: () => void;
}

function FontCardItem({
  option,
  displaySample,
  displayLabel,
  isSelected,
  spacing,
  disabled,
  onClick,
}: FontCardItemProps) {
  const { ref, nudge } = useNudge<HTMLButtonElement>();
  const isCaseControl = option.id === 'uppercase';
  const isSpacingControl = option.id === 'spacing';
  const isSettingControl = isCaseControl || isSpacingControl;
  const [animateSample, setAnimateSample] = useState(false);
  const sampleShift = TEXT_SPACING[spacing ?? 'normal'].sampleShift;

  /*
   * The card fills its share of the row and keeps its shape while doing it:
   * height follows width through aspect-ratio, so growing makes a bigger
   * square, not a stretched one. OUTER_SIZE is now only the ratio's origin
   * (86x86, square) and the minimum the card will shrink to.
   *
   * The caption scales within readable bounds; the sample
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
      className="flex w-full min-w-0 flex-col items-center gap-[2px]"
      /* Capped: the glyph inside is cqw-scaled and would otherwise balloon
         with the window while the caption stays put — see --tri-card-max. */
      style={{ containerType: 'inline-size', maxWidth: 'var(--tri-card-max)' }}
    >
      <button
        ref={ref}
        type="button"
        aria-label={isSpacingControl ? `text spacing: ${displayLabel}` : displayLabel}
        title={isCaseControl ? `Switch text to ${displayLabel}` : isSpacingControl ? `Text spacing: ${displayLabel}. Click for ${nextTextSpacing(spacing ?? 'normal')}.` : undefined}
        aria-pressed={isSettingControl ? undefined : isSelected}
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          if (disabled) { nudge(); return; }
          setAnimateSample(event.detail > 0);
          onClick();
        }}
        className={cx(
          'tri-font-card relative flex w-full items-center justify-center select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--tri-accent-yellow)]',
          disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        )}
        style={{
          aspectRatio: '1',
          padding: GAP,
          borderRadius: OUTER_RADIUS,
          // Width comes from --tri-border; only the overlay is set here.
          boxShadow: isSelected
            ? 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.30)'
            : 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.16)',
        }}
      >
        {/* Inner Linear Card (computed 76px x 76px with 5px gap & 20px radius) */}
        <div
          className={cx(
            'relative flex h-full w-full items-center justify-center bg-[rgb(0_0_0_/_0.20)] transition-colors duration-150',
            !isSelected && !isSettingControl && 'hover:bg-[rgb(255_255_255_/_0.04)]',
          )}
          style={{
            borderRadius: INNER_RADIUS,
          }}
        >
          {(isSelected || isSettingControl) && (
            <span
              aria-hidden
              className="tri-surface pointer-events-none absolute inset-0"
              style={{ borderRadius: 'inherit', opacity: isSettingControl ? 0.4 : 1 }}
            />
          )}
          <span
            className="relative font-normal leading-none tracking-normal select-none transition-colors duration-150"
            style={{
              /* The drawn 32px on the drawn 86px card, as a proportion — the
                 glyph is the card's content, not a caption, so it scales with
                 the card the way the corner does. */
              fontSize: '37cqw',
              fontFamily: option.fontFamily,
              textTransform: 'none',
              color: 'var(--tri-accent-yellow, #e4d87a)',
              opacity: isSelected ? 1 : isSettingControl ? 0.8 : 0.65,
            }}
          >
            {isCaseControl ? (
              <span aria-hidden className="tri-case-sample" data-animate={animateSample}>
                <span data-visible={displaySample === 'AA'}>AA</span>
                <span data-visible={displaySample === 'aa'}>aa</span>
              </span>
            ) : isSpacingControl ? (
              <span aria-hidden className="tri-spacing-sample" data-spacing={spacing} data-animate={animateSample}>
                <span style={{ transform: `translateX(${-sampleShift}em)` }}>A</span>
                <span style={{ transform: `translateX(${sampleShift}em)` }}>A</span>
              </span>
            ) : displaySample}
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
          transition: 'opacity 150ms ease, transform 150ms ease',
        }}
      />

      {/* Subtitle label below (default, serif, uppercase/lowercase) */}
      <span
        className="tri-label lowercase"
        style={{
          fontSize: 'clamp(11px, calc(8px + 4cqw), 15px)',
          fontWeight: 500,
          lineHeight: 1.4,
          letterSpacing: '0.01em',
          color: isSelected ? 'var(--tri-ink, #e5f3f2)' : 'var(--tri-ink-muted, rgb(229 243 242 / 0.64))',
          transition: 'color 150ms ease',
        }}
      >
        {displayLabel}
      </span>
    </div>
  );
}
