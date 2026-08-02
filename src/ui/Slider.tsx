/*
 * C-20 — Slider. Figma: `Slider` (87:400).
 *
 * 34px track at 8px radius with a solid --tri-edge border, seven 2px tick
 * dots, a 14px hairline handle, and the value read out at the right end
 * inside the track. The filled portion is the SAME gradient at full alpha,
 * and in Figma it is a clipping window over a full-width gradient — the
 * fill does not squash as the value drops, so that is reproduced here.
 *
 * A transparent range input sits on top so dragging, keyboard control and
 * screen-reader semantics come from the platform rather than pointer math.
 */

/** The handle's travel is inset from both ends, matching the Figma geometry. */
const HANDLE_INSET = 8;

interface SliderProps {
  label?: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Tick marks drawn along the track. Figma draws seven. */
  ticks?: number;
  disabled?: boolean;
  className?: string;
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  ticks = 7,
  disabled,
  className = '',
}: SliderProps) {
  const span = max - min || 1;
  const pct = Math.max(0, Math.min(100, ((value - min) / span) * 100));

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div
          className="tri-label lowercase"
          style={{ color: 'var(--tri-ink-muted)' }}
        >
          {label}
        </div>
      )}

      <div className="relative h-[34px]">
        {/* Track */}
        <div
          className="tri-surface absolute inset-0 rounded-[var(--tri-radius-surface)] border"
          style={{ borderColor: 'var(--tri-edge)' }}
        />

        {/* Filled portion — a window onto the full-width gradient. */}
        <div
          className="absolute inset-y-0 left-0 overflow-hidden rounded-[var(--tri-radius-surface)]"
          style={{ width: `${pct}%` }}
        >
          <div
            className="tri-surface tri-surface--solid absolute inset-y-0 left-0 rounded-[var(--tri-radius-surface)]"
            style={{ width: pct > 0 ? `${10000 / pct}%` : '100%' }}
          />
        </div>

        {/* Tick dots */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-[10px]">
          {Array.from({ length: ticks }, (_, i) => (
            <span
              key={i}
              className="size-[2px] rounded-full"
              style={{ background: 'var(--tri-ink-muted)' }}
            />
          ))}
        </div>

        {/*
          Handle. Figma parks it at x=8 for value 0 and x=145 of a 253px
          track at 60 — i.e. it travels inside an 8px inset rather than to
          the bare edges, so it never overhangs the rounded corners.
        */}
        <div
          className="pointer-events-none absolute top-1/2 h-[14px] w-px -translate-y-1/2"
          style={{
            left: `calc(${HANDLE_INSET}px + (100% - ${HANDLE_INSET * 2}px) * ${pct / 100})`,
            background: 'var(--tri-ink)',
          }}
        />

        {/* Value */}
        <div
          className="tri-label pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2 tabular-nums"
          style={{
            color: 'var(--tri-ink-muted)',
            fontSize: 'var(--tri-size-sm)',
            lineHeight: 1,
            letterSpacing: '0.2px',
          }}
        >
          {value}
        </div>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
        />
      </div>
    </div>
  );
}
