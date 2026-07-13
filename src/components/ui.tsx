import type { ReactNode } from 'react';

/**
 * The three text primitives the whole UI is built from.
 * Buttons are text. Labels are quiet. Absence of an engine is a whisper.
 */

interface TextButtonProps {
  label: string;
  onClick?: () => void;
  /** Primary actions render in the single accent color. */
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
        primary ? 'text-accent' : 'text-ink'
      }`}
    >
      {label}
    </button>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs uppercase tracking-widest text-neutral-400">{children}</div>
  );
}

/** Quiet placeholder shown wherever engine data would appear in a plain browser. */
export function EngineNote({ what = 'engine not connected' }: { what?: string }) {
  return <p className="text-sm italic text-neutral-400">{what}</p>;
}

export function hasEngine(): boolean {
  return typeof window !== 'undefined' && window.api != null;
}
