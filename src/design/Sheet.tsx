import { useEffect, useState, type ReactNode } from 'react';

/*
 * Spec-sheet layout primitives.
 *
 * The gallery shows every variant and state of a component at once, so a
 * design can be checked against it in one glance. These are the pieces
 * every sheet is built from — deliberately plain, so they never compete
 * visually with the specimens they frame.
 */

/** One component's page: id, title, why it exists, then the specimens. */
export function Sheet({
  id,
  title,
  status = 'todo',
  summary,
  children,
}: {
  /** Inventory id — C-01, D-22, F-03. */
  id: string;
  title: string;
  /** Where this component stands against the inventory. */
  status?: 'todo' | 'draft' | 'done';
  summary?: string;
  children: ReactNode;
}) {
  const tone =
    status === 'done'
      ? 'border-ink text-ink'
      : status === 'draft'
        ? 'border-hairline text-neutral-500'
        : 'border-dashed border-hairline text-neutral-400';

  return (
    <article className="space-y-8">
      <header className="space-y-2 border-b border-hairline pb-5">
        <div className="flex items-center gap-x-3">
          <span className="font-mono text-[11px] tracking-widest text-neutral-400">{id}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${tone}`}
          >
            {status}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {summary && <p className="max-w-2xl text-sm text-neutral-500">{summary}</p>}
      </header>
      <div className="space-y-10">{children}</div>
    </article>
  );
}

/** A titled band of specimens within a sheet. */
export function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-x-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
          {title}
        </h2>
        {hint && <span className="text-xs text-neutral-400">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** A labelled specimen — the atom of every sheet. */
export function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="font-mono text-[10px] tracking-wide text-neutral-400">{label}</div>
      <div className="flex min-h-8 flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/** Specimens laid out on a grid — the default for variant × state matrices. */
export function Matrix({ cols = 4, children }: { cols?: number; children: ReactNode }) {
  return (
    <div
      className="grid gap-x-6 gap-y-5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

/** Specimens on the dark projector canvas, for anything that lands on output. */
export function OnCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-md bg-canvas p-6">{children}</div>
  );
}

/** A finding worth acting on — gaps the sheet exposes. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border-l-2 border-ink bg-surface px-4 py-3 text-sm text-neutral-600">
      {children}
    </div>
  );
}

/** Key/value facts — props, tokens, decisions. */
export function Spec({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-hairline rounded-md border border-hairline bg-surface">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[10rem_1fr] gap-x-4 px-4 py-2.5 text-sm">
          <dt className="font-mono text-[11px] text-neutral-400">{k}</dt>
          <dd className="text-neutral-600">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A colour token, showing its live computed value under the current theme. */
export function Swatch({ token }: { token: string }) {
  const [value, setValue] = useState('');

  // The theme is switched by setting data-theme on <html>, which happens in
  // an effect — so read the computed value after paint, and again whenever
  // that attribute changes, or the hex shown would lag a render behind.
  useEffect(() => {
    const read = () =>
      setValue(getComputedStyle(document.documentElement).getPropertyValue(token).trim());
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [token]);

  return (
    <div className="space-y-1.5">
      <div
        className="h-14 w-full rounded-md border border-hairline"
        style={{ background: `var(${token})` }}
      />
      <div className="font-mono text-[10px] text-neutral-500">{token}</div>
      <div className="font-mono text-[10px] uppercase text-neutral-400">{value || '—'}</div>
    </div>
  );
}
