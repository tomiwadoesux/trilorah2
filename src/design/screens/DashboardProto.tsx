import type { ReactNode } from 'react';
import { cx, SettingsIcon, CloseIcon, SparkleIcon, ChevronDownIcon } from '../../ui';
import { AppShell } from './AppShell';
import { Panel } from './parts';

/*
 * S-03 — the app with no tab nav.
 *
 * A wireframe, deliberately: boxes and skeleton bars, no real tiles. The
 * question it answers is one of arrangement — when the ten-tab nav goes,
 * where does each tab's work live? — and a drawing of boxes answers that
 * faster than a screen of working components would.
 *
 * The rules it draws:
 *   · one header row, shared by both views. The app's own title bar is
 *     gone; what it carried (wordmark, mic, help, settings) sits at the
 *     right end of this row.
*   · the dashboard bento gains one card — SERMON NOTES — and absorbs the
 *     rest of the old tabs into tiles that already exist. Media stays in
 *     the operator browser; output settings go to the theme editor.
 *   · profile settings live behind ⚙, as a popup, not a card.
 *   · a card opens the way the companion tile already does: it lifts off
 *     the grid and grows to the centre.
 */

export const DASHBOARD_PROTO_STATES = [
  { id: 'S-03a', label: 'dashboard', note: 'The bento with the old tabs folded in. NEW marks a card that does not exist yet; + marks something absorbed into a tile that does.' },
  { id: 'S-03b', label: 'card open', note: 'A card lifted off the grid — here SERMON NOTES — the same flight the companion tile already makes.' },
  { id: 'S-03c', label: 'profile open', note: 'The ⚙ popup: account, church, giving, keys. Everything that used to be the SETTINGS tab and is about who you are rather than how the engine runs.' },
  { id: 'S-03d', label: 'operator', note: 'The operator view under the same header. The rail gains the schedule tab’s two actions; nothing else moves.' },
];

/* ------------------------------------------------------------------ */
/* Skeleton primitives                                                 */
/* ------------------------------------------------------------------ */

/** A grey bar standing in for a line of text. Width is a fraction. */
function Bar({ w = 1, h = 8, dim = false }: { w?: number; h?: number; dim?: boolean }) {
  return (
    <div
      className={cx('rounded-full', dim ? 'bg-white/[0.05]' : 'bg-white/[0.09]')}
      style={{ width: `${w * 100}%`, height: h }}
    />
  );
}

function Bars({ rows, className }: { rows: number[]; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {rows.map((w, i) => (
        <Bar key={i} w={w} />
      ))}
    </div>
  );
}

/** A dashed placeholder for a picture, a chart, a QR — anything that is not text. */
function Block({ label, className, h }: { label?: string; className?: string; h?: number | string }) {
  return (
    <div
      className={cx(
        'flex items-center justify-center rounded-[calc(var(--tri-radius-control)-6px)] border border-dashed border-white/15 text-[10px] lowercase tracking-wide text-white/35',
        className,
      )}
      style={{ height: h }}
    >
      {label}
    </div>
  );
}

/** Tag on a tile: what is new, what has been absorbed. */
function Tag({ kind, children }: { kind: 'new' | 'absorbed' | 'from'; children: ReactNode }) {
  return (
    <span
      className={cx(
        'rounded-full px-1.5 py-[1px] text-[9px] font-semibold lowercase tracking-wide',
        kind === 'new' && 'bg-[rgb(228_216_122_/_0.18)] text-[rgb(228_216_122_/_0.95)]',
        kind === 'absorbed' && 'bg-white/[0.08] text-white/70',
        kind === 'from' && 'text-white/35',
      )}
    >
      {kind === 'absorbed' ? `+ ${children}` : children}
    </span>
  );
}

/** A row inside a tile marking something that was a tab and is now here. */
function Absorbed({ what, from }: { what: string; from: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-white/12 px-2 py-1">
      <Tag kind="absorbed">{what}</Tag>
      <Tag kind="from">was {from}</Tag>
    </div>
  );
}

function Tile({
  title,
  isNew,
  className,
  children,
}: {
  title: string;
  isNew?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Panel title={title} right={isNew ? <Tag kind="new">new</Tag> : undefined} className={className}>
      <div className="flex h-full flex-col gap-2">{children}</div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* The one header                                                      */
/* ------------------------------------------------------------------ */

function Header({ view, gearOpen }: { view: 'operator' | 'dashboard'; gearOpen?: boolean }) {
  const RAIL = 'var(--tri-rail-w)';
  return (
    <div
      className="relative flex shrink-0 items-center gap-5 border-b border-white/[0.07]"
      style={{ height: 'var(--tri-topbar-h)' }}
    >
      <div className="flex shrink-0 items-stretch gap-5 pl-1" style={{ width: RAIL }}>
        {(['operator', 'dashboard'] as const).map((m) => (
          <span
            key={m}
            className={cx(
              'relative flex items-center text-[14.5px] lowercase tracking-wide',
              'after:absolute after:inset-x-0 after:bottom-0 after:h-px',
              m === view ? 'font-semibold text-white after:bg-white' : 'font-medium text-white/50',
            )}
          >
            {m}
          </span>
        ))}
      </div>
      <span className="size-[30px] shrink-0 rounded-full border border-dashed border-white/25" title="orb" />
      <span
        className="tri-rounded-control flex items-center bg-white/[0.07] px-4 text-[13.5px] font-medium lowercase text-white/90"
        style={{ height: 'var(--tri-topbar-h)' }}
      >
        ● start listening
      </span>
      <div className="flex-1" />
      <span className="inline-flex items-center gap-1 text-[13.5px] lowercase text-white/60">import <ChevronDownIcon size={12} /></span>
      <span className="font-mono text-[13.5px] text-white/75">3:19 pm</span>
      <span className="flex items-center gap-2 text-[13.5px] lowercase text-white/85">
        <span className="size-1.5 rounded-full bg-emerald-400/85" /> system ready
      </span>
      {/* What the app's title bar used to carry, now the tail of this row. */}
      <span className="ml-3 h-4 w-px bg-white/10" />
      <span className="inline-flex items-center gap-1 text-[12.5px] lowercase text-white/55">mic · macbook <ChevronDownIcon size={12} /></span>
      <span className="text-[12.5px] text-white/45">?</span>
      <span
        className={cx(
          'flex size-6 items-center justify-center rounded-full text-[13px]',
          gearOpen ? 'bg-white/15 text-white' : 'text-white/60',
        )}
      >
        <SettingsIcon size={16} />
      </span>
      <span className="pr-1 text-[10px] font-bold tracking-[0.3em] text-white/40">TRILORAH</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The bento                                                           */
/* ------------------------------------------------------------------ */

function Bento() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[var(--tri-gap)]">
      {/* Band 1 — timer, transcript, then the companion as a square with
          everything under the code, and giving in the room that frees up. */}
      <div className="flex min-h-0 basis-0 grow-[300] gap-[var(--tri-gap)]">
        <Tile title="service timer" className="basis-0 grow-[330]">
          <Block label="00 : 45 : 00" className="flex-1" />
        </Tile>
        <Tile title="preacher transcript" className="basis-0 grow-[400]">
          <Bars rows={[0.9, 0.7, 0.8, 0.5]} className="mt-1" />
        </Tile>
        <Tile title="companion" className="aspect-square shrink-0">
          <Block label="qr" className="w-full flex-1" />
          <Bars rows={[0.7, 0.45]} />
          <Absorbed what="sign in · link device" from="cloud" />
        </Tile>
        <Tile title="giving" className="min-w-0 basis-0 grow-[330]">
          <div className="grid flex-1 grid-cols-3 gap-2">
            {['zelle', 'venmo', 'cash app', 'paypal', 'gtbank', 'giving page'].map((g) => (
              <Block key={g} label={g} className="min-h-0" />
            ))}
          </div>
          <span className="text-[10px] lowercase text-white/35">logos, side by side — the room sees these on the wall</span>
        </Tile>
      </div>

      {/* Band 2 — the working cards. Readiness is three gates, not one long
          bar; the service log is a card here now, not a column off to the
          right. */}
      <div className="flex min-h-0 basis-0 grow-[330] gap-[var(--tri-gap)]">
        <div className="flex min-w-0 basis-0 grow-[640] flex-col gap-[var(--tri-gap)]">
          <Tile title="readiness" className="shrink-0">
            <div className="grid grid-cols-3 gap-2">
              {[
                ['trust floor', 0.72],
                ['verified detections', 0.45],
                ['services together', 0.6],
              ].map(([label, v]) => (
                <div key={String(label)} className="flex flex-col gap-1.5 rounded-md border border-dashed border-white/12 p-2">
                  <span className="text-[10px] lowercase text-white/45">{label}</span>
                  <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-white/30" style={{ width: `${Number(v) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <Absorbed what="trust thresholds" from="settings" />
          </Tile>
          <div className="flex min-h-0 flex-1 gap-[var(--tri-gap)]">
            <Tile title="voice commands" className="basis-0 grow-[1]">
              <Bars rows={[0.8, 0.6]} className="mt-1" />
            </Tile>
            <Tile title="connections" className="basis-0 grow-[1]">
              <Bars rows={[0.7, 0.7, 0.7]} className="mt-1" />
              <Absorbed what="mic · speech engine · language" from="settings" />
              <Absorbed what="obs · vmix" from="settings" />
            </Tile>
          </div>
        </div>
        <Tile title="notifications" className="min-w-0 basis-0 grow-[300]">
          <Absorbed what="the service log" from="the right column" />
          <div className="mt-1 flex flex-col gap-2.5">
            {[0.85, 0.6, 0.9, 0.5, 0.7, 0.65, 0.8].map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={cx('size-1.5 shrink-0 rounded-full', i === 0 ? 'bg-emerald-400/85' : 'bg-white/20')} />
                <Bar w={w} dim={i > 0} />
              </div>
            ))}
          </div>
        </Tile>
        <Tile title="sermon notes" isNew className="basis-0 grow-[300]">
          <Bars rows={[0.5, 0.85, 0.7, 0.6]} className="mt-1" />
          <div className="mt-auto flex gap-2">
            <Block label="generate" className="h-6 flex-1" />
            <Block label="export" className="h-6 flex-1" />
          </div>
        </Tile>
      </div>

      {/* Band 3 — the preacher, as today. Media and output are NOT cards:
          media is already in the operator browser, output is a set-once
          thing for the theme editor. */}
      <div className="flex min-h-0 basis-0 grow-[246] gap-[var(--tri-gap)]">
        <Tile title="preacher" className="basis-0 grow-[623]">
          <div className="flex gap-3">
            <Block label="stats" className="h-14 flex-1" />
            <Block label="trend" className="h-14 flex-1" />
          </div>
          <Absorbed what="profiles · create · set active" from="preachers" />
        </Tile>
        <Tile title="recent services" className="basis-0 grow-[258]">
          <Bars rows={[0.9, 0.9, 0.9]} className="mt-1" />
        </Tile>
        <Tile title="trust trend" className="basis-0 grow-[265]">
          <Block label="chart" className="flex-1" />
        </Tile>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

/** A card lifted to the centre — the companion tile's flight, frozen at the end. */
function OpenCard() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-10">
      <Panel
        title="sermon notes"
        right={<CloseIcon size={12} className="text-white/50" />}
        className="h-full w-full max-w-[1100px] !bg-[rgb(18_22_22)]"
        style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.65), inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.1)' }}
      >
        <div className="flex h-full gap-4">
          <div className="flex w-44 shrink-0 flex-col gap-2 pt-1">
            <Bar w={0.8} />
            <Bar w={0.6} dim />
            <Bar w={0.7} dim />
            <div className="mt-auto flex flex-col gap-2">
              <Block label="generate" className="h-7" />
              <Block label="export pdf" className="h-7" />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3 pt-1">
            <Bar w={0.4} h={14} />
            <Bars rows={[0.9, 0.85, 0.6]} />
            <Bar w={0.3} h={11} />
            <Bars rows={[0.8, 0.9, 0.5]} />
            <Bar w={0.35} h={11} />
            <Bars rows={[0.85, 0.7]} />
          </div>
        </div>
      </Panel>
    </div>
  );
}

/** The ⚙ popup — profile, not engine. */
function ProfilePopup() {
  return (
    <div className="absolute inset-0 z-20 bg-black/45">
      <div
        className="tri-rounded-surface absolute right-2 top-[calc(var(--tri-topbar-h)+10px)] flex h-[420px] w-[560px] overflow-hidden bg-[rgb(18_22_22)]"
        style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.6), inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.1)' }}
      >
        <div className="flex w-36 shrink-0 flex-col gap-1 border-r border-white/[0.07] p-3">
          {['account', 'church', 'giving', 'keys', 'about'].map((s, i) => (
            <span
              key={s}
              className={cx(
                'rounded-md px-2 py-1 text-[12px] lowercase',
                i === 0 ? 'bg-white/[0.1] text-white' : 'text-white/55',
              )}
            >
              {s}
            </span>
          ))}
          <span className="mt-auto px-2 text-[11px] lowercase text-white/40">sign out</span>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-5">
          <span className="text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em] text-white/55">
            account
          </span>
          {['email', 'password', 'church name', 'public web url'].map((f) => (
            <div key={f} className="flex flex-col gap-1.5">
              <span className="text-[10px] lowercase text-white/40">{f}</span>
              <Block className="h-8" />
            </div>
          ))}
          <div className="mt-auto flex justify-end">
            <Block label="save" className="h-7 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Operator view — only what changes                                   */
/* ------------------------------------------------------------------ */

function Operator() {
  return (
    <div
      className="grid min-h-0 flex-1 gap-[var(--tri-gap)]"
      style={{ gridTemplateColumns: 'var(--tri-rail-w) minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr) minmax(30%, 1fr) auto' }}
    >
      <Panel
        title="run of service (0)"
        right={
          <span className="flex items-center gap-1.5 text-[11px] text-white/50">
            <span className="rounded border border-white/15 px-1">+</span>
            <span className="rounded border border-white/15 px-1">⟲</span>
            <span className="rounded border border-dashed border-[rgb(228_216_122_/_0.5)] px-1 text-[rgb(228_216_122_/_0.9)]">📷</span>
            <span className="rounded border border-dashed border-[rgb(228_216_122_/_0.5)] px-1 text-[rgb(228_216_122_/_0.9)]"><SparkleIcon size={14} /></span>
          </span>
        }
        className="row-span-2"
      >
        <div className="mt-2 flex flex-col gap-2">
          <Absorbed what="import from photo (📷)" from="schedule" />
          <Absorbed what="suggest from history (✦)" from="schedule" />
        </div>
      </Panel>
      <div className="flex min-h-0 gap-[var(--tri-gap)]">
        <Panel className="flex-1">
          <Block label="preview" className="h-full" />
        </Panel>
        <Panel className="flex-1">
          <Block label="live" className="h-full" />
        </Panel>
      </div>
      <Panel title="verses · themes · songs · slides · media">
        <div className="flex items-center gap-2">
          <Block label="type a book name… or words you remember" className="h-8 flex-1" />
          <Absorbed what="search by words" from="bible" />
        </div>
        <Bars rows={[0.9, 0.85, 0.9, 0.8]} className="mt-3" />
      </Panel>
      <div className="col-span-2 flex h-11 items-center justify-center rounded-[var(--tri-radius-control)] border border-white/10 bg-white/[0.04] text-[11.5px] lowercase text-white/50">
        transcripts appear here
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function DashboardProtoScreen({ state }: { state: string }) {
  const view = state === 'S-03d' ? 'operator' : 'dashboard';
  return (
    <AppShell model={{ tab: 'LIVE', engine: 'connected' }}>
      <div className="relative flex h-full w-full flex-col gap-[var(--tri-gap)] p-2.5">
        <Header view={view} gearOpen={state === 'S-03c'} />
        {view === 'dashboard' ? <Bento /> : <Operator />}
        {state === 'S-03b' && <OpenCard />}
        {state === 'S-03c' && <ProfilePopup />}
      </div>
    </AppShell>
  );
}
