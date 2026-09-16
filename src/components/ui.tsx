import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/*
 * The component kit the whole UI is built from — black and white only.
 * Panels are white cards on paper with hairline borders; buttons come in
 * three volumes (solid, outline, text); labels stay quiet and tracked-out.
 */

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

interface ButtonProps {
  label: string;
  onClick?: () => void;
  /** solid = filled black (the one loud thing), outline = bordered, text = quiet. */
  variant?: 'solid' | 'outline' | 'text';
  disabled?: boolean;
  title?: string;
  /** Larger hit target for the actions operators press under pressure. */
  big?: boolean;
}

export function Button({ label, onClick, variant = 'outline', disabled, title, big }: ButtonProps) {
  const size = big ? 'px-5 py-2.5 text-sm' : 'px-3 py-1.5 text-xs';
  const look =
    variant === 'solid'
      ? 'bg-accent text-white hover:bg-neutral-800 disabled:bg-neutral-300'
      : variant === 'outline'
        ? 'border border-ink hover:bg-ink hover:text-white disabled:border-neutral-300 disabled:text-neutral-400 disabled:hover:bg-transparent'
        : 'underline-offset-4 hover:underline disabled:no-underline disabled:text-neutral-400';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded font-semibold uppercase tracking-widest transition-colors ${size} ${look}`}
    >
      {label}
    </button>
  );
}

/** Legacy text-only button — kept for screens not yet moved to Button. */
interface TextButtonProps {
  label: string;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
}

export function TextButton({ label, onClick, primary, disabled, title }: TextButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`text-xs uppercase tracking-wide underline-offset-4 hover:underline disabled:opacity-40 disabled:no-underline ${
        primary ? 'font-semibold text-accent' : 'text-ink'
      }`}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Panels                                                              */
/* ------------------------------------------------------------------ */

export function Panel({
  children,
  className = '',
  pad = true,
  dataTour,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
  /** Anchor name for the guided tour spotlight. */
  dataTour?: string;
}) {
  return (
    <div
      data-tour={dataTour}
      className={`rounded-md border border-hairline bg-surface ${pad ? 'p-4' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function PanelHeader({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-x-4">
      <SectionLabel>{children}</SectionLabel>
      {right}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">{children}</div>
  );
}

/* ------------------------------------------------------------------ */
/* Chips, meters, small displays                                       */
/* ------------------------------------------------------------------ */

export function Pill({
  children,
  active = false,
  title,
}: {
  children: ReactNode;
  active?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
        active ? 'border-accent bg-accent text-white' : 'border-hairline text-neutral-500'
      }`}
    >
      {children}
    </span>
  );
}

/** dB (-60..0) → a ten-segment horizontal level meter. */
export function LevelMeter({ db }: { db: number | null }) {
  const lit = db == null ? 0 : Math.max(0, Math.min(10, Math.round(((db + 60) / 60) * 10)));
  return (
    <span className="inline-flex items-end gap-[2px]" title={db == null ? 'no signal' : `${db} dB`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-sm ${i < lit ? 'bg-ink' : 'bg-hairline'}`}
          style={{ height: 4 + i * 1.2 }}
        />
      ))}
    </span>
  );
}

/**
 * A scrolling mic waveform — the sound-check surface.
 *
 * The level meter answers "is there signal"; this answers "is the signal any
 * good", which is the question during a sound check. Each dB sample pushes a
 * bar off the left, so a dead mic reads as a flat line rather than as a meter
 * that merely happens to sit at zero. Colour tracks headroom: green is
 * healthy, amber is hot, red is clipping.
 */
export function Waveform({ db, bars = 96 }: { db: number | null; bars?: number }) {
  const [history, setHistory] = useState<number[]>(() => Array(bars).fill(0));

  useEffect(() => {
    // Silence still advances the trace, so the line keeps moving when the
    // room goes quiet instead of freezing on the last loud sample.
    const v = db == null ? 0 : Math.max(0, Math.min(1, (db + 60) / 60));
    setHistory((prev) => [...prev.slice(1), v]);
  }, [db]);

  return (
    <div
      className="flex h-16 w-full items-center gap-[1px] overflow-hidden rounded-sm bg-black px-1"
      title={db == null ? 'no signal' : `${db} dB`}
    >
      {history.map((v, i) => {
        const pct = Math.max(2, v * 100);
        const colour = v > 0.9 ? 'bg-red-500' : v > 0.75 ? 'bg-amber-400' : 'bg-green-500';
        return (
          <span
            key={i}
            className={`flex-1 rounded-[1px] ${v === 0 ? 'bg-neutral-700' : colour}`}
            style={{ height: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}

/** A 0..1 fraction as a thin black progress bar with an optional gate marker. */
export function TrustBar({ value, gate }: { value: number; gate?: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-hairline">
      <div className="h-full rounded-full bg-ink" style={{ width: `${v * 100}%` }} />
      {gate != null && (
        <div
          className="absolute top-0 h-full w-[2px] bg-neutral-400"
          style={{ left: `${Math.max(0, Math.min(1, gate)) * 100}%` }}
          title={`auto-mode gate ${Math.round(gate * 100)}%`}
        />
      )}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-x-2 disabled:opacity-40"
      aria-pressed={checked}
    >
      <span
        className={`inline-flex h-4 w-7 items-center rounded-full border px-[2px] transition-colors ${
          checked ? 'justify-end border-accent bg-accent' : 'justify-start border-hairline bg-surface'
        }`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${checked ? 'bg-white' : 'bg-neutral-400'}`} />
      </span>
      {label && <span className="text-xs uppercase tracking-widest text-neutral-500">{label}</span>}
    </button>
  );
}

/** Labelled form row used across Settings and editors. */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">{label}</span>
      <div>{children}</div>
      {hint && <p className="text-xs text-neutral-400">{hint}</p>}
    </label>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-sm italic text-neutral-400">{children}</p>;
}

/** Quiet placeholder shown wherever engine data would appear in a plain browser. */
export function EngineNote({ what = 'engine not connected' }: { what?: string }) {
  return <p className="text-sm italic text-neutral-400">{what}</p>;
}

export function hasEngine(): boolean {
  return typeof window !== 'undefined' && window.api != null;
}
