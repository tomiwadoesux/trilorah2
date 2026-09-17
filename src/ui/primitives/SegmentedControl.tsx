import { useRef, useState, type KeyboardEvent } from 'react';
import { cx } from '../lib/cx';

export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value?: T;
  onChange?: (next: T) => void;
  /** Named above the track, like every other control in the system. */
  label?: string;
  /** sm for a header or a bar; md to stand beside a button. */
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

/*
 * C-04 — Segmented control.
 *
 * Two to five exclusive options, all of them visible at once. That is the
 * whole reason it exists rather than a Select: a segmented control is for a
 * choice the operator should be able to SEE the alternatives to without
 * opening anything, and it stops being that past about five.
 *
 * The selection is one thumb that slides, not a class that moves from one
 * button to another. The difference is legible: a thumb travelling from
 * "local" to "stock" says those two are the same kind of thing and you have
 * moved between them; two buttons swapping highlight says nothing at all. It
 * is also the one part of this component that has to be positioned rather
 * than laid out — hence the absolute thumb over a grid of equal columns,
 * which keeps the segments equal no matter how long their words are.
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  disabled = false,
  className = '',
}: SegmentedControlProps<T>) {
  const [internal, setInternal] = useState<T>(options[0]?.id as T);
  const selected = value ?? internal;
  const index = Math.max(0, options.findIndex((o) => o.id === selected));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (next: T) => {
    if (disabled) return;
    setInternal(next);
    onChange?.(next);
  };

  /* Radio semantics, so arrows move the choice and tab moves past the whole
     control — a segmented control is one decision, not N stops. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1
      : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    select(options[next].id);
    refs.current[next]?.focus();
  };

  /* The thumb is inset by this on all four sides, and its corner is the
     track's less the same figure — R_outer = R_inner + gap, the system's
     rule for anything nested in anything. */
  const INSET = '2px';
  const height = size === 'sm' ? 'calc(var(--tri-control-h) - 6px)' : 'var(--tri-control-h)';

  return (
    <div className={cx('flex flex-col gap-2 lowercase', className)}>
      {label ? <span className="tri-label text-[var(--tri-ink-muted)]">{label}</span> : null}
      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cx(
          'tri-rounded-control relative grid w-fit',
          disabled && 'cursor-not-allowed opacity-40',
        )}
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
          height,
          padding: INSET,
          background: 'rgb(0 0 0 / 0.20)',
          boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.10)',
        }}
      >
        {/*
          One thumb, positioned by column rather than by width arithmetic:
          left is the inset, width is a column, and travel is that width
          times the index. Equal columns are what makes that true, and the
          grid above is what makes the columns equal.
        */}
        <span
          aria-hidden
          className="tri-surface tri-rounded-control pointer-events-none absolute"
          style={{
            top: INSET,
            bottom: INSET,
            left: INSET,
            width: `calc((100% - ${INSET} * 2) / ${options.length})`,
            transform: `translateX(${index * 100}%)`,
            borderRadius: `calc(var(--tri-radius-control) - ${INSET})`,
            transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
        {options.map((opt, i) => {
          const isSelected = opt.id === selected;
          return (
            <button
              key={opt.id}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-disabled={disabled || undefined}
              /* Only the chosen one is tabbable — see the radiogroup note. */
              tabIndex={isSelected ? 0 : -1}
              onClick={() => select(opt.id)}
              className={cx(
                'relative z-10 flex items-center justify-center px-3 transition-colors duration-150',
                'text-[length:var(--tri-size-xs)] whitespace-nowrap focus:outline-none',
                disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                isSelected
                  ? 'text-[var(--tri-ink)]'
                  : 'text-[var(--tri-ink-muted)] hover:text-[var(--tri-ink)]',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
