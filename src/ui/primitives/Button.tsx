import type { ReactNode } from 'react';

/*
 * C-01 — Button. Figma: `Buttom Icon` (97:376), `Buttom noIcon` (97:405),
 * `Delete Button Icon` (97:381), `Delete Button noIcon` (97:421).
 *
 * Geometry straight from the file: 9px horizontal padding, no vertical
 * padding (the 28px line-height sets the height), 5px gap to the icon,
 * 6px radius, 1px border at 12% ink. Hover is not a different style — it
 * is the same gradient at 0.7 alpha instead of 0.3.
 */

interface ButtonProps {
  label: string;
  onClick?: () => void;
  /** Leading glyph — pass an icon component from ./icons. */
  icon?: ReactNode;
  /** danger = the red set used for destructive actions. */
  tone?: 'default' | 'danger';
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
  className?: string;
}

export function Button({
  label,
  onClick,
  icon,
  tone = 'default',
  disabled,
  title,
  type = 'button',
  className = '',
}: ButtonProps) {
  const danger = tone === 'danger';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'tri-surface tri-interactive tri-label',
        danger ? 'tri-surface--danger tri-tone-danger' : 'tri-tone',
        'inline-flex items-center justify-center gap-[5px] whitespace-nowrap lowercase',
        'rounded-[var(--tri-radius-control)] border px-[9px]',
        'transition-[background-image,color] duration-[140ms]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ borderColor: 'var(--tri-ink-faint)' }}
    >
      {icon}
      {label}
    </button>
  );
}
