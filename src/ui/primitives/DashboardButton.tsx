import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { surface, strokeStyle } from '../lib/surface';
import { useNudge } from '../hooks/useNudge';

/*
 * D-xx — Dashboard row button. Figma: `Dashboard Icon` (430:456).
 *
 * A wide surface with the label left and a glyph right: 39px tall, 10px
 * padding, the solid --tri-edge outline rather than the 12% ink hairline the
 * small controls use. Three states in the file — rest at 0.3 alpha and
 * selected at 0.65.
 *
 * Unlike Button, the label keeps its casing ("Today's Flow").
 */

interface DashboardButtonProps {
  label: string;
  onClick?: () => void;
  /** Trailing glyph, right-aligned. */
  icon?: ReactNode;
  /** Selected rows sit at the brighter alpha. */
  active?: boolean;
  /** Refused rather than inert — see Button. */
  disabled?: boolean;
  className?: string;
}

export function DashboardButton({
  label,
  onClick,
  icon,
  active = false,
  disabled = false,
  className = '',
}: DashboardButtonProps) {
  const { ref, nudge } = useNudge<HTMLButtonElement>();

  return (
    <button
      ref={ref}
      type="button"
      aria-disabled={disabled || undefined}
      onClick={disabled ? nudge : onClick}
      data-active={active}
      className={cx(
        surface({ shape: 'panel', interactive: true, wide: true, stroke: 'edge' }),
        'tri-label',
        'flex h-[var(--tri-row-h)] w-full items-center justify-between gap-4 p-[10px] text-left',
        className,
      )}
      style={{ ...strokeStyle('edge'), color: 'var(--tri-ink)' }}
    >
      <span>{label}</span>
      {icon}
    </button>
  );
}
