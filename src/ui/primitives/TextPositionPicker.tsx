import { useEffect, useId, useState } from 'react';
import { TEXT_POSITIONS, resolveTextPosition, type TextPositionOption } from '../../../shared/textPosition';
import { cx } from '../lib/cx';
import { useNudge } from '../hooks/useNudge';
import { ChevronDownIcon, ChevronUpIcon } from '../icons';

export type { TextPositionOption } from '../../../shared/textPosition';

export interface TextPositionItem {
  id: TextPositionOption;
  label: string;
}

export const TEXT_POSITION_OPTIONS: readonly TextPositionItem[] = TEXT_POSITIONS;
const PRIMARY_POSITIONS = TEXT_POSITION_OPTIONS.slice(0, 4);
const MORE_POSITIONS = TEXT_POSITION_OPTIONS.slice(4);

export interface TextPositionPickerProps {
  label?: string;
  value?: TextPositionOption;
  onChange?: (next: TextPositionOption) => void;
  columns?: 2 | 4;
  disabled?: boolean;
  className?: string;
}

export function TextPositionPicker({
  label = 'text position',
  value,
  onChange,
  columns = 4,
  disabled = false,
  className = '',
}: TextPositionPickerProps) {
  const labelId = useId();
  const moreId = useId();
  const [internalSelected, setInternalSelected] = useState<TextPositionOption>('center');
  const selected = value ?? internalSelected;
  const [expanded, setExpanded] = useState(() => MORE_POSITIONS.some((option) => option.id === selected));

  // A restored or externally changed selection should be visible. Manually
  // collapsing keeps that selection without forcing the section open again.
  useEffect(() => {
    if (MORE_POSITIONS.some((option) => option.id === selected)) setExpanded(true);
  }, [selected]);

  const handleSelect = (id: TextPositionOption) => {
    if (disabled) return;
    setInternalSelected(id);
    onChange?.(id);
  };

  return (
    <div role="group" aria-labelledby={labelId} className={cx('flex min-w-0 flex-col gap-2 lowercase', className)}>
      <span id={labelId} className="tri-label tri-control-heading text-[var(--tri-ink-muted)]">{label}</span>
      <div
        className="grid w-full min-w-0 items-start gap-x-3 gap-y-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {PRIMARY_POSITIONS.map((option) => (
          <PositionCardItem
            key={option.id}
            option={option}
            isSelected={selected === option.id}
            disabled={disabled}
            onClick={() => handleSelect(option.id)}
          />
        ))}
      </div>
      <div
        id={moreId}
        hidden={!expanded}
        className={cx('w-full min-w-0 items-start gap-x-3 gap-y-3', expanded ? 'grid' : 'hidden')}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {MORE_POSITIONS.map((option) => (
          <PositionCardItem
            key={option.id}
            option={option}
            isSelected={selected === option.id}
            disabled={disabled}
            onClick={() => handleSelect(option.id)}
          />
        ))}
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={moreId}
        onClick={() => setExpanded((open) => !open)}
        className="flex min-h-8 items-center gap-1.5 self-start rounded-sm text-[length:var(--tri-size-xs)] text-[var(--tri-ink-muted)] hover:text-[var(--tri-ink)] active:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tri-accent-yellow)]"
      >
        {expanded ? 'show less' : 'show more'}
        {expanded ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
      </button>
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

  return (
    <button
      ref={ref}
      type="button"
      aria-label={option.label}
      aria-pressed={isSelected}
      aria-disabled={disabled || undefined}
      onClick={disabled ? nudge : onClick}
      className={cx(
        'group/position flex min-w-0 flex-col items-center gap-1 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--tri-accent-yellow)]',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
      )}
    >
      <span className="relative block aspect-video w-full">
        <PositionGraphic id={option.id} isSelected={isSelected} />
      </span>
      <span aria-hidden className="h-0.5 w-3.5 shrink-0 rounded-full bg-[var(--tri-accent-yellow)]" style={{ opacity: isSelected ? 1 : 0 }} />
      <span className={cx(
        'min-h-[2.5em] w-full text-center text-[length:var(--tri-size-xs)] leading-tight',
        isSelected ? 'text-[var(--tri-ink)]' : 'text-[var(--tri-ink-muted)] group-hover/position:text-[var(--tri-ink)]',
      )}>
        {option.label}
      </span>
    </button>
  );
}

/** Draw the same alignment and reference order the actual slide uses. */
function PositionGraphic({ id, isSelected }: { id: TextPositionOption; isSelected: boolean }) {
  const gradientId = useId();
  const position = resolveTextPosition(id);
  const widths = [100, 76, 54, 32];
  const groupHeight = 40;
  const y = position.vertical === 'top' ? 13 : position.vertical === 'bottom' ? 90 - 13 - groupHeight : (90 - groupHeight) / 2;
  const lineX = (width: number) => position.horizontal === 'left' ? 17 : position.horizontal === 'right' ? 143 - width : (160 - width) / 2;
  const textY = position.referenceAbove ? y + 12 : y;
  const referenceY = position.referenceAbove ? y : y + 37;
  const outerInset = 0.75;
  /* 5% of the card's width, as --tri-card-round says. */
  const outerRadius = 8;
  const rimInset = 3.5;
  const guideInset = 12;
  // Concentric curves: moving a frame inward subtracts that inset from its radius.
  const insetRadius = (inset: number) => Math.max(0, outerRadius - (inset - outerInset));
  const guideRadius = insetRadius(guideInset);
  const left = guideInset;
  const right = 160 - guideInset;
  const top = guideInset;
  const bottom = 90 - guideInset;
  const leg = 4;
  const roundedCorners = [
    `M${left} ${top + guideRadius + leg} V${top + guideRadius} A${guideRadius} ${guideRadius} 0 0 1 ${left + guideRadius} ${top} H${left + guideRadius + leg}`,
    `M${right - guideRadius - leg} ${top} H${right - guideRadius} A${guideRadius} ${guideRadius} 0 0 1 ${right} ${top + guideRadius} V${top + guideRadius + leg}`,
    `M${right} ${bottom - guideRadius - leg} V${bottom - guideRadius} A${guideRadius} ${guideRadius} 0 0 1 ${right - guideRadius} ${bottom} H${right - guideRadius - leg}`,
    `M${left + guideRadius + leg} ${bottom} H${left + guideRadius} A${guideRadius} ${guideRadius} 0 0 1 ${left} ${bottom - guideRadius} V${bottom - guideRadius - leg}`,
  ].join(' ');

  return (
    <svg viewBox="0 0 160 90" fill="none" aria-hidden="true" className="block h-full w-full">
      <defs>
        <linearGradient id={gradientId} x1="135" y1="0" x2="30" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor={isSelected ? 'rgb(var(--tri-teal-4))' : '#191b1e'} />
          <stop offset="0.58" stopColor={isSelected ? 'rgb(var(--tri-teal-3))' : '#121416'} />
          <stop offset="1" stopColor={isSelected ? 'rgb(var(--tri-teal-1))' : '#0d0f11'} />
        </linearGradient>
      </defs>
      <rect x={outerInset} y={outerInset} width={160 - outerInset * 2} height={90 - outerInset * 2} rx={outerRadius} fill={`url(#${gradientId})`} stroke="#ffffff" strokeOpacity={isSelected ? 0.3 : 0.16} strokeWidth="1.5" />
      <rect x={rimInset} y={rimInset} width={160 - rimInset * 2} height={90 - rimInset * 2} rx={insetRadius(rimInset)} stroke="#e5f3f2" strokeOpacity={isSelected ? 0.07 : 0.03} strokeWidth="0.75" />
      {/* Quiet corner marks make the content's inset legible at every size. */}
      <path d={roundedCorners} stroke="#c8d8d6" strokeWidth="0.75" strokeOpacity={isSelected ? 0.18 : 0.08} strokeLinecap="round" />
      {widths.map((width, index) => (
        <rect key={width} x={lineX(width)} y={textY + index * 8} width={width} height="3.2" rx="1.6" fill="#d0d9e1" opacity={isSelected ? 0.82 - index * 0.07 : 0.52 - index * 0.04} />
      ))}
      <rect x={lineX(24)} y={referenceY} width="24" height="3.2" rx="1.6" fill="var(--tri-accent-yellow, #e4d87a)" opacity={isSelected ? 1 : 0.85} />
    </svg>
  );
}
