import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { cx } from '../lib/cx';
import { surface, strokeStyle } from '../lib/surface';
import { useElementWidth } from '../hooks/useElementWidth';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

/*
 * C-20 — Slider. Figma: `Slider` (87:400).
 *
 * 34px track with a solid --tri-edge outline, tick dots, a hairline handle,
 * and the value read out on the label row. The filled portion is the SAME
 * gradient at full alpha, and in Figma it is a clipping window over a
 * full-width gradient — the fill does not squash as the value drops, so that
 * is reproduced here.
 *
 * Geometry rules that make it read as one object:
 *
 *   1. The fill ends AT the handle. A `width: {pct}%` fill and an inset
 *      handle only agree at 50%; everywhere else the handle floats off the
 *      edge of its own fill.
 *   2. The fill never collapses — at zero it is a rounded stub around the
 *      handle, so the control looks like a filled thing at its minimum.
 *   3. Ticks live UNDER the fill and fade as its leading edge arrives, so a
 *      dot is never seen to blink out.
 *
 * Interaction rules — why this is not a bare <input type=range>:
 *
 *   4. Pressing the handle GRABS it. The native input jumps the value to
 *      wherever the pointer landed, which throws away the value the user was
 *      aiming at with the last drag. Here the grab records an offset and
 *      drags relative to it, so the handle stays exactly under the finger
 *      that picked it up.
 *   5. Pressing the track SLIDES there. A jump gives no sense of how far the
 *      value moved; the eye has to re-find the handle afterwards.
 *   6. Hovering near the handle draws it toward the pointer. It makes the
 *      target feel picked-up-able before the press, and the offset is purely
 *      visual — the value never changes on hover.
 *
 * The range input stays underneath for keyboard control and screen-reader
 * semantics; only its pointer behaviour is replaced.
 */

/** The handle's travel is inset from both ends, matching the Figma geometry. */
const HANDLE_INSET = 8;

/* Height comes from --tri-slider-h — deliberately shorter than the select
   it sits beside: a slider is a line you grab, not a box you open, and at
   field height the track reads as a slab. Horizontal geometry below stays in JS because it is
   measured against the track's real width, not a token. */

/*
 * The handle is a short muted stroke, not a tall bright one: it marks the
 * value, it is not the subject. It grows and takes full ink while held, so
 * the grab is visible.
 */
/* Kept proportional to the track (was 15/34 and 21/34) so the taller track
   does not turn the handle into a tall bright bar. Both come from the tier. */
const HANDLE_W = 2;

/** Tick dots sit inside this padding at each end. */
const TICK_PAD = 10;
const TICK_SIZE = 2;

/*
 * How near the fill's leading edge has to get before a dot gives way.
 * Without it the fill swallows each dot the moment it arrives — a hard
 * on/off that catches the eye mid-drag.
 */
const TICK_FADE_PX = 16;

/** Press within this of the handle and you have grabbed it, not the track. */
const GRAB_RADIUS = 16;

/** Hover magnetism: reach, peak travel, and how quickly it gives way. */
const MAGNET_RANGE = 34;
const MAGNET_MAX = 5;

/** A press on open track travels for this long before settling. */
const SLIDE_MS = 260;

type Mode = 'idle' | 'pressed' | 'dragging';

interface SliderProps {
  label?: string;
  valueSuffix?: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Tick marks drawn along the track. Figma drew seven. */
  ticks?: number;
  disabled?: boolean;
  /**
   * The value is being dragged from somewhere else — a handle on a canvas,
   * say — and this slider is only reporting it. Skips the travel animation
   * for the same reason the slider's own drag does: a handle easing toward
   * where the hand was 200ms ago reads as lag, not as polish.
   */
  immediate?: boolean;
  className?: string;
}

export function Slider({
  label,
  valueSuffix = '',
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  ticks = 9,
  disabled = false,
  immediate = false,
  className = '',
}: SliderProps) {
  const span = max - min || 1;

  const { ref: trackRef, width: trackW } = useElementWidth<HTMLDivElement>();
  const inputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>('idle');
  const [magnet, setMagnet] = useState(0);
  /** Distance from pointer to handle at the moment of the grab. */
  const grabOffset = useRef(0);

  // Dragging must be glued to the finger; everything else — a press on open
  // track, an arrow key, a change from elsewhere — is worth watching travel.
  const shown = useAnimatedNumber(value, {
    duration: SLIDE_MS,
    immediate: immediate || mode === 'dragging',
  });

  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / span) * 100));

  // The geometry below is in real pixels because it has to be: the handle
  // travels inside an inset, so its position is not a percentage of the
  // track and no calc() over an unknown width can tie the fill to it.
  const travel = Math.max(0, trackW - HANDLE_INSET * 2);
  const handleX = HANDLE_INSET + travel * (pct(shown) / 100);
  // The fill closes over the handle by the same inset it starts with, so at
  // 0 it is a stub and at 100 it reaches the far edge exactly.
  const fillW = Math.min(trackW, handleX + HANDLE_INSET);

  // Dots span the padded width, first and last sitting on the padding.
  const tickSpan = Math.max(0, trackW - TICK_PAD * 2);
  const tickPositions =
    trackW === 0 || ticks < 1
      ? []
      : Array.from({ length: ticks }, (_, i) =>
          ticks === 1 ? TICK_PAD + tickSpan / 2 : TICK_PAD + (tickSpan * i) / (ticks - 1),
        );

  /** Full strength far from the fill, gone by the time it arrives. */
  const tickOpacity = (x: number) => Math.min(1, Math.abs(x - fillW) / TICK_FADE_PX);

  const pointerX = (e: ReactPointerEvent) => {
    const rect = trackRef.current?.getBoundingClientRect();
    return rect ? e.clientX - rect.left : 0;
  };

  const valueAt = (x: number) => {
    if (travel <= 0) return value;
    const raw = min + ((x - HANDLE_INSET) / travel) * span;
    const snapped = min + Math.round((raw - min) / step) * step;
    return Math.max(min, Math.min(max, snapped));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const x = pointerX(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    inputRef.current?.focus();
    setMode('pressed');
    // Whatever magnetism was applied gives way now — it transitions back to
    // zero rather than snapping, so the handle never appears to jump on grab.
    setMagnet(0);

    if (Math.abs(x - handleX) <= GRAB_RADIUS) {
      // Rule 4: grabbed the handle. Keep the value, remember the offset.
      grabOffset.current = handleX - x;
    } else {
      // Rule 5: pressed open track. Travel there, from here.
      grabOffset.current = 0;
      onChange(valueAt(x));
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const x = pointerX(e);

    if (mode === 'idle') {
      // Rule 6: magnetism, visual only. Strongest just off the handle and
      // gone at the edge of its reach, so there is no line the handle
      // visibly snaps across.
      const dx = x - handleX;
      const reach = Math.abs(dx);
      const pull = reach >= MAGNET_RANGE ? 0 : dx * (1 - reach / MAGNET_RANGE) * 0.6;
      setMagnet(Math.max(-MAGNET_MAX, Math.min(MAGNET_MAX, pull)));
      return;
    }

    setMode('dragging');
    onChange(valueAt(x + grabOffset.current));
  };

  const endPress = (e?: ReactPointerEvent<HTMLDivElement>) => {
    if (e?.currentTarget && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setMode('idle');
    setMagnet(0);
  };

  // Global fallback: if user releases pointer over another element or outside window,
  // ensure mode immediately resets to idle.
  useEffect(() => {
    if (mode === 'idle') return;

    const handleGlobalPointerUp = () => {
      setMode('idle');
      setMagnet(0);
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [mode]);

  const held = mode !== 'idle';

  return (
    <div className={cx('min-w-0 w-full select-none', className)}>
      {/*
        Label and value share one line above the track. The value used to sit
        inside the track, where the fill eventually slides underneath it and
        the two fight for the same pixels; up here it is always legible and
        reads as what it is — the label's answer.
      */}
      <div className="tri-label flex min-w-0 items-baseline justify-between gap-2 lowercase select-none">
        {/*
          Both inherit .tri-label's --tri-size from the row above rather than
          setting a size of their own. The label is a control label — every
          other picker label in the same panel is base — and the value is its
          answer on the same baseline, so a step between them was two sizes on
          one line.
        */}
        <span className="min-w-0 font-medium" style={{ color: 'var(--tri-ink-muted)' }}>
          {label}
        </span>
        <span className="shrink-0 tabular-nums opacity-80" style={{ color: 'var(--tri-ink-muted)' }}>
          {value}{valueSuffix}
        </span>
      </div>

      <div
        ref={trackRef}
        className={cx('relative touch-none', disabled ? 'cursor-default' : 'cursor-pointer')}
        style={{ height: 'var(--tri-slider-h)' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onLostPointerCapture={endPress}
        onPointerLeave={() => mode === 'idle' && setMagnet(0)}
      >
        {/* Track */}
        <div
          className={cx(surface({ shape: 'panel', stroke: 'edge' }), 'absolute inset-0')}
          style={strokeStyle('edge')}
        />

        {/*
          Tick dots — beneath the fill, and each one yields as the fill's
          leading edge reaches it. Positioned absolutely rather than by
          flexbox: the fade needs every dot's distance from that edge, which
          means knowing where each dot actually is.
        */}
        <div className="pointer-events-none absolute inset-0">
          {tickPositions.map((x, i) => (
            <span
              key={i}
              className="absolute top-1/2 rounded-full"
              style={{
                left: x,
                height: TICK_SIZE,
                width: TICK_SIZE,
                transform: 'translate(-50%, -50%)',
                background: 'var(--tri-ink-muted)',
                opacity: tickOpacity(x),
              }}
            />
          ))}
        </div>

        {/*
          Filled portion — a window onto the full-width gradient.
        */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden tri-rounded-surface"
          style={{
            width: fillW,
            transition:
              mode === 'dragging'
                ? 'none'
                : 'width var(--tri-dur-state-trail, 240ms) var(--tri-ease-out)',
          }}
        >
          <div
            className={cx(
              surface({ shape: 'panel', solid: true, stroke: 'none' }),
              'absolute inset-y-0 left-0',
            )}
            style={{ width: trackW || '100%' }}
          />
        </div>

        {/* Handle, riding the leading edge of the fill. */}
        <div
          className="pointer-events-none absolute top-1/2"
          style={{
            left: handleX + magnet,
            height: held ? 'var(--tri-handle-h-active)' : 'var(--tri-handle-h)',
            width: HANDLE_W,
            borderRadius: HANDLE_W / 2,
            background: held ? 'var(--tri-ink)' : 'var(--tri-ink-muted)',
            transform: 'translate(-50%, -50%)',
            transition:
              mode === 'dragging'
                ? 'height var(--tri-dur-press) var(--tri-ease-out), background-color var(--tri-dur-press) var(--tri-ease-out)'
                : 'left 220ms var(--tri-ease-soft, cubic-bezier(0.16, 1, 0.3, 1)), height var(--tri-dur-press) var(--tri-ease-out), background-color var(--tri-dur-press) var(--tri-ease-out)',
          }}
        />

        <input
          ref={inputRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={valueSuffix ? `${value}${valueSuffix}` : undefined}
          onChange={(e) => onChange(Number(e.target.value))}
          // Keyboard and assistive tech only — pointer handling lives above,
          // because the native jump-to-pointer is exactly what rule 4 rejects.
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      </div>
    </div>
  );
}
