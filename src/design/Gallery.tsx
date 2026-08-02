import { useEffect, useState, type ReactNode } from 'react';
import { REGISTRY, ALL_ENTRIES, findEntry } from './registry';

/*
 * The sandbox shell.
 *
 * Runs in its own Electron window beside the real app, off the same Vite
 * server — so editing a component hot-reloads the specimen sheet and the
 * live screen at the same instant. The toolbar drives the two foundation
 * decisions that cannot be made on paper: booth mode (F-02) and density
 * (F-05).
 */

type Theme = 'light' | 'dark';
type Density = 'compact' | 'comfortable' | 'touch';

const DENSITIES: Density[] = ['compact', 'comfortable', 'touch'];

/** Canvas widths worth checking — the app window, and the two panel columns. */
const WIDTHS: [string, number | null][] = [
  ['full', null],
  ['app 1400', 1400],
  ['column 640', 640],
  ['panel 380', 380],
];

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash.slice(1));
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export function Gallery() {
  const hash = useHashRoute();
  const entry = findEntry(hash || null);

  const [theme, setTheme] = useState<Theme>('light');
  const [density, setDensity] = useState<Density>('comfortable');
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.density = density;
  }, [theme, density]);

  // ⌘K-less quick nav: j/k step through the sheet list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key !== 'j' && e.key !== 'k') return;
      const i = ALL_ENTRIES.findIndex((x) => x.id === entry.id);
      const next = ALL_ENTRIES[e.key === 'j' ? i + 1 : i - 1];
      if (next) window.location.hash = next.id;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entry.id]);

  const built = ALL_ENTRIES.length;
  const total = REGISTRY.reduce((n, g) => n + g.total, 0);

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* ---------------------------------------------------------- */}
      {/* Nav                                                         */}
      {/* ---------------------------------------------------------- */}
      <aside
        data-gallery-chrome
        className="fixed inset-y-0 left-0 w-60 overflow-y-auto border-r border-hairline bg-surface"
      >
        <div className="border-b border-hairline px-4 py-3">
          <div className="text-sm font-bold tracking-[0.3em]">TRILORAH</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-widest text-neutral-400">
            design sandbox
          </div>
          <div className="mt-2 font-mono text-[10px] text-neutral-400">
            {built} / {total} built
          </div>
        </div>

        <nav className="py-2">
          {REGISTRY.map((group) => (
            <div key={group.title} className="mb-3">
              <div className="flex items-baseline justify-between px-4 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                  {group.title}
                </span>
                <span className="font-mono text-[10px] text-neutral-300">
                  {group.entries.length}/{group.total}
                </span>
              </div>
              {group.entries.map((e) => {
                const active = e.id === entry.id;
                return (
                  <a
                    key={e.id}
                    href={`#${e.id}`}
                    className={`flex items-baseline gap-x-2 px-4 py-1.5 text-xs transition-colors ${
                      active
                        ? 'bg-accent text-[var(--color-on-accent)]'
                        : 'text-neutral-500 hover:text-ink'
                    }`}
                  >
                    <span className="font-mono text-[10px] opacity-60">{e.id}</span>
                    <span>{e.title}</span>
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <p className="px-4 pb-6 text-[10px] leading-relaxed text-neutral-400">
          j / k to step through sheets. Full list in design/UI-INVENTORY.md.
        </p>
      </aside>

      {/* ---------------------------------------------------------- */}
      {/* Toolbar + canvas                                            */}
      {/* ---------------------------------------------------------- */}
      <div className="ml-60">
        <header
          data-gallery-chrome
          className="sticky top-0 z-10 flex items-center gap-x-6 border-b border-hairline bg-surface px-6 py-2"
        >
          <ToolbarGroup label="theme">
            {(['light', 'dark'] as Theme[]).map((t) => (
              <ToolbarOption key={t} active={theme === t} onClick={() => setTheme(t)}>
                {t}
              </ToolbarOption>
            ))}
          </ToolbarGroup>

          <ToolbarGroup label="density">
            {DENSITIES.map((d) => (
              <ToolbarOption key={d} active={density === d} onClick={() => setDensity(d)}>
                {d}
              </ToolbarOption>
            ))}
          </ToolbarGroup>

          <ToolbarGroup label="width">
            {WIDTHS.map(([label, w]) => (
              <ToolbarOption key={label} active={width === w} onClick={() => setWidth(w)}>
                {label}
              </ToolbarOption>
            ))}
          </ToolbarGroup>

          <span className="ml-auto font-mono text-[10px] text-neutral-400">
            {window.api ? 'engine connected' : 'no engine'}
          </span>
        </header>

        <main className="px-10 py-10">
          <div style={width ? { maxWidth: width } : undefined} className={width ? 'mx-auto' : ''}>
            <entry.Component />
          </div>
        </main>
      </div>
    </div>
  );
}

function ToolbarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-x-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
        {label}
      </span>
      <div className="flex items-center gap-x-0.5">{children}</div>
    </div>
  );
}

function ToolbarOption({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
        active ? 'bg-accent text-[var(--color-on-accent)]' : 'text-neutral-400 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
