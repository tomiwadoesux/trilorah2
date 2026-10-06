import type { ReactNode } from 'react';
import { cx } from '../../ui';
import { useArtboard } from './artboard';

/*
 * S-01 — App Shell.
 *
 * The frame every other screen is drawn inside — window ground, corners,
 * and the banner rail. It carries no chrome of its own: the owner removed
 * the title bar (brand, ten tabs, status cluster), so a screen now gets the
 * whole window and states the app's condition itself. What is left here is
 * only what no single screen can own — the ground it is painted on, and a
 * banner that must survive whatever screen you are looking at.
 *
 * The artboard therefore represents the *content area*. The real window
 * keeps the default OS title bar, which sits above this and costs ~28px.
 */

/* Width and height come from the artboard — see ./artboard — because the
   app is not one size. The banner is the only fixed metric left. */
export const BANNER_H = 29;

export const TABS = [
  'LIVE',
  'BIBLE',
  'SONGS',
  'MEDIA',
  'THEMES',
  'SCHEDULE',
  'PREACHERS',
  'NOTES',
  'SETTINGS',
  'CLOUD',
] as const;

export interface ShellModel {
  tab: (typeof TABS)[number];
  engine: 'connected' | 'connecting' | 'missing' | 'error';
  /** Mode ribbon — practice and prayer both change what the buttons mean. */
  mode?: 'practice' | 'prayer' | null;
  offline?: boolean;
  update?: boolean;
  banner?: { tone: 'info' | 'warn' | 'danger'; text: string } | null;
}

export function AppShell({ model, children }: { model: ShellModel; children?: ReactNode }) {
  const size = useArtboard();

  return (
    <div
      /* data-shell: what an expanding tile measures itself against — see
         dashboard/expand.tsx. The shell, not the viewport, because the
         sandbox scales the artboard and the real app does not. */
      data-shell
      className="relative flex min-w-0 flex-col overflow-hidden bg-paper text-ink"
      // A real window follows its parent immediately. A fixed pixel width here
      // becomes the flex parent's minimum width and prevents resize observation.
      style={{ width: size.full ? '100%' : size.w, height: size.full ? '100%' : size.h, borderRadius: size.full ? 0 : 10 }}
    >
      {/* A banner pushes the content down rather than covering it — an
          operator mid-service must never lose a control to a notice. */}
      {model.banner && (
        <div
          className={cx(
            'shrink-0 border-b px-4 py-1.5 text-[length:var(--tri-size-xs)]',
            model.banner.tone === 'danger'
              ? 'border-[rgb(234_199_198_/_0.2)] bg-[rgb(234_199_198_/_0.07)] text-[#eac7c6]'
              : model.banner.tone === 'warn'
                ? 'border-[rgb(228_216_122_/_0.18)] bg-[rgb(228_216_122_/_0.06)] text-[rgb(228_216_122_/_0.9)]'
                : 'border-hairline bg-[rgb(255_255_255_/_0.03)] text-[rgb(229_243_242_/_0.6)]',
          )}
        >
          {model.banner.text}
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The S-01 sheet itself — the frame with nothing in it                */
/* ------------------------------------------------------------------ */

export const APP_SHELL_STATES = [
  { id: 'S-01a', label: 'engine ready', note: 'The everyday frame. Engine up, nothing to announce.' },
  { id: 'S-01b', label: 'engine missing', note: 'Running outside Electron, or the engine never started — controls are inert.' },
  { id: 'S-01c', label: 'engine crashed', note: 'The engine died mid-service. The banner has to survive whatever tab you are on.' },
  { id: 'S-01d', label: 'update ready', note: 'A new version is downloaded and waiting for a restart.' },
  { id: 'S-01e', label: 'offline', note: 'No network. Local ASR and the local Bible still work; cloud sync does not.' },
  { id: 'S-01f', label: 'practice mode', note: 'Nothing reaches the projector. The mode ribbon is the only thing stopping a real push.' },
  { id: 'S-01g', label: 'prayer mode', note: 'Output held deliberately — the operator has taken the screen out of service.' },
];

const SHELL_STATES: Record<string, ShellModel> = {
  'S-01a': { tab: 'LIVE', engine: 'connected' },
  'S-01b': {
    tab: 'LIVE',
    engine: 'missing',
    banner: { tone: 'info', text: 'engine not connected — running outside Electron; controls are inert' },
  },
  'S-01c': {
    tab: 'LIVE',
    engine: 'error',
    banner: { tone: 'danger', text: 'the engine stopped responding — verses will not advance. restart engine' },
  },
  'S-01d': { tab: 'LIVE', engine: 'connected', update: true },
  'S-01e': { tab: 'CLOUD', engine: 'connected', offline: true, banner: { tone: 'warn', text: 'offline — scripture and local transcription still work, cloud sync is paused' } },
  'S-01f': { tab: 'LIVE', engine: 'connected', mode: 'practice', banner: { tone: 'info', text: 'practice mode — nothing you push reaches the projector' } },
  'S-01g': { tab: 'LIVE', engine: 'connected', mode: 'prayer' },
};

export function AppShellScreen({ state }: { state: string }) {
  const model = SHELL_STATES[state] ?? SHELL_STATES['S-01a'];
  const size = useArtboard();
  const contentH = size.h - (model.banner ? BANNER_H : 0);
  return (
    <AppShell model={model}>
      {/* The content area, measured. Every other screen gets exactly this
          box — drawing it explicitly is the whole point of S-01. */}
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-y-2">
          <div className="font-mono text-[length:var(--tri-size-xs)] text-[rgb(229_243_242_/_0.3)]">
            content area — {size.w} × {contentH}
          </div>
          <div className="font-mono text-[length:var(--tri-size-xs)] text-[rgb(229_243_242_/_0.22)]">
            {size.label} · window {size.w} × {size.h}
          </div>
          <div className="text-[length:var(--tri-size-eyebrow)] uppercase tracking-[0.2em] text-[rgb(229_243_242_/_0.18)]">
            S-02 … S-11 render here
          </div>
        </div>
      </div>
    </AppShell>
  );
}
