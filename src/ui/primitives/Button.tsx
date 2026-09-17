import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { surface, toneClass, type SurfaceTone } from '../lib/surface';
import { useNudge } from '../hooks/useNudge';

/*
 * C-01 — Button. Figma: `Buttom Icon` (97:376), `Buttom noIcon` (97:405),
 * `Delete Button Icon` (97:381), `Delete Button noIcon` (97:421).
 *
 * Geometry from the file, one size up: Figma's 9px padding / 28px height
 * reads cramped at real size, so the box comes from --tri-control-* (32px
 * tall, 12px padding, 12px label). Surface, corner, stroke, hover, press —
 * all of it comes from the system; this file owns only what makes a button
 * a button.
 */

interface ButtonProps {
  label: string;
  onClick?: () => void;
  /** Leading glyph — pass an icon component from ../icons. */
  icon?: ReactNode;
  /** danger = the red set used for destructive actions. */
  tone?: SurfaceTone;
  /**
   * Refuses the press rather than hiding from it: the button stays
   * focusable and answers a click with a nudge instead of silence.
   */
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
  disabled = false,
  title,
  type = 'button',
  className = '',
}: ButtonProps) {
  const { ref, nudge } = useNudge<HTMLButtonElement>();

  return (
    <button
      ref={ref}
      // A refused submit must not submit, so the type is neutralised too.
      type={disabled ? 'button' : type}
      aria-disabled={disabled || undefined}
      onClick={disabled ? nudge : onClick}
      title={title}
      className={cx(
        surface({ tone, shape: 'control', interactive: true }),
        toneClass(tone),
        'tri-label',
        'inline-flex items-center justify-center gap-[6px] whitespace-nowrap lowercase',
        /* No font-size here: .tri-label carries it (--tri-size). A utility
           on this element would be dead anyway — tokens.css is injected
           unlayered and outranks Tailwind's utilities layer. */
        'min-h-[var(--tri-control-h)] px-[var(--tri-control-pad-x)]',
        className,
      )}
    >
      {icon}
      {label}
    </button>
  );
}
