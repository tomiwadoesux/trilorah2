import type { ReactNode } from 'react';

/*
 * D-xx — Dashboard row button. Figma: `Dashboard Icon` (430:456).
 *
 * A wide surface with the label left and a glyph right: 39px tall, 10px
 * padding, 8px radius, solid --tri-edge border (not the 12% ink hairline
 * the small controls use). Three states in the file — rest at 0.3 alpha
 * and selected at 0.65.
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
  disabled?: boolean;
  className?: string;
}

export function DashboardButton({
  label,
  onClick,
  icon,
  active = false,
  disabled,
  className = '',
}: DashboardButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-active={active}
      className={[
        'tri-surface tri-surface--wide tri-interactive tri-label',
        'flex h-[39px] w-full items-center justify-between gap-4',
        'rounded-[var(--tri-radius-surface)] border p-[10px] text-left',
        'transition-[background-image] duration-[140ms]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ borderColor: 'var(--tri-edge)', color: 'var(--tri-ink)' }}
    >
      <span>{label}</span>
      {icon}
    </button>
  );
}
