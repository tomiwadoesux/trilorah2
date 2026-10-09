import { CloseIcon } from '../../ui';
import { AppShell } from './AppShell';

/*
 * S-18 — every popup, as an empty frame.
 *
 * The owner wants all of the app's popups redesigned (2026-10-08) and asked
 * for a placeholder of each first, so the redesign can be agreed one popup
 * at a time before any of them is rebuilt. So this is a frame per popup at
 * its REAL size over the dimmed ground it really opens on — header, body,
 * footer, scrim — and nothing inside it yet. The facts on each frame (what
 * opens it, where it lives, how big it is) come from the code as it stands.
 *
 * Six families, because the frame is what they share:
 *   · tile expand  — a dashboard card flown to the centre (expand.tsx)
 *   · flight       — a dialog that lifts off a button (FlightPopup)
 *   · confirm      — a small yes/no bubble
 *   · menu         — a list anchored to its trigger (ActionMenu, ContextMenu, Select, MicPicker)
 *   · panel        — the phone pairing sheets
 *   · other        — the find veil, the notification popover, the drag shelf
 */

type Family = 'tile expand' | 'flight' | 'confirm' | 'menu' | 'panel' | 'other';

interface Popup {
  id: string;
  label: string;
  family: Family;
  /** Where it opens from. */
  opens: string;
  /** What it holds today. */
  holds: string;
  file: string;
  w: number;
  h: number;
  /** Menus and bubbles sit by their trigger, not at the centre. */
  anchor?: 'top-left' | 'top-right' | 'bottom' | 'preview';
  /** Has a footer row of actions. */
  footer?: boolean;
}

const POPUPS: Popup[] = [
  { id: 'a', label: 'companion', family: 'tile expand', opens: 'companion tile', holds: 'what the phone page shows, who may open it', file: 'dashboard/CompanionTile.tsx', w: 720, h: 640 },
  { id: 'b', label: 'readiness', family: 'tile expand', opens: 'readiness tile', holds: 'every pre-flight check and what it found', file: 'dashboard/ReadinessTile.tsx', w: 720, h: 640 },
  { id: 'c', label: 'timers', family: 'tile expand', opens: 'service timer tile', holds: 'durations, countdowns, extra time; an inline toast', file: 'dashboard/TimersTile.tsx', w: 720, h: 640 },
  { id: 'd', label: 'connected', family: 'tile expand', opens: 'connected card', holds: 'switcher, Stream Deck, cloud', file: 'dashboard/ConnectedTile.tsx', w: 720, h: 640 },
  { id: 'e', label: 'preachers', family: 'tile expand', opens: 'preachers tile', holds: 'preacher list, how well each is known, who preaches today', file: 'dashboard/PreachersTile.tsx', w: 720, h: 640 },
  { id: 'f', label: 'preacher profile', family: 'flight', opens: 'a row in preachers', holds: 'profile header + that preacher’s profile, stacked over the list', file: 'dashboard/PreachersTile.tsx', w: 880, h: 740, footer: true },
  { id: 'g', label: 'notifications', family: 'tile expand', opens: 'notifications tile', holds: 'updates, actions, service log', file: 'dashboard/NotificationsTile.tsx', w: 720, h: 640 },
  { id: 'h', label: 'voice commands', family: 'tile expand', opens: 'voice commands tile', holds: 'pulpit commands and what was heard', file: 'dashboard/VoiceCommandsTile.tsx', w: 720, h: 640 },
  { id: 'i', label: 'outputs', family: 'tile expand', opens: 'outputs tile', holds: 'screens this machine drives, which display each is on', file: 'dashboard/OutputsTile.tsx', w: 720, h: 640 },
  { id: 'j', label: 'giving', family: 'tile expand', opens: 'giving tile', holds: 'giving buttons shown on the phone page', file: 'dashboard/GivingTile.tsx', w: 720, h: 640 },
  { id: 'k', label: 'transcript', family: 'tile expand', opens: 'preacher transcript tile', holds: 'the whole service transcript', file: 'dashboard/PreachingTile.tsx', w: 720, h: 640 },
  { id: 'l', label: 'sermon notes', family: 'tile expand', opens: 'sermon notes tile', holds: 'the outline built while the sermon is preached', file: 'dashboard/SermonNotesTile.tsx', w: 720, h: 640 },
  { id: 'm', label: 'add song', family: 'flight', opens: 'songs › add', holds: 'search / youtube / paste routes', file: 'songs/AddSongDialog.tsx', w: 720, h: 640, footer: true },
  { id: 'n', label: 'song editor', family: 'flight', opens: 'a song, or add-song’s result', holds: 'title, authors, sections, drafts', file: 'songs/SongEditor.tsx', w: 880, h: 740, footer: true },
  { id: 'o', label: 'song close prompt', family: 'confirm', opens: 'closing the editor with changes', holds: 'keep editing / keep / discard', file: 'songs/SongEditor.tsx', w: 360, h: 150, footer: true },
  { id: 'p', label: 'scan review', family: 'flight', opens: 'run › scan or paste', holds: 'the rows read from the programme; scan again; add to run', file: 'run/ScanReview.tsx', w: 720, h: 640, footer: true },
  { id: 'q', label: 'replace the run?', family: 'confirm', opens: 'run header clock button', holds: 'segment + queued counts, yes / no', file: 'run/RunHeaderActions.tsx', w: 300, h: 120, anchor: 'top-left', footer: true },
  { id: 'r', label: '.tri files', family: 'flight', opens: 'run header › .tri', holds: 'save / open / new; category boxes; a nested confirm', file: 'run/TriPackageActions.tsx', w: 680, h: 640, footer: true },
  { id: 's', label: 'quick slide', family: 'flight', opens: 'slides › quick slide', holds: 'title, subtitle, bullets → a one-page deck', file: 'presentations.tsx', w: 520, h: 500, footer: true },
  { id: 't', label: 'add menu', family: 'menu', opens: 'run + (header, empty rail, each segment)', holds: 'segment types, scan, paste', file: 'ui/primitives/ActionMenu.tsx', w: 220, h: 260, anchor: 'top-left' },
  { id: 'u', label: 'context menu', family: 'menu', opens: 'right-click on a run row', holds: 'rename / up / down / duplicate / remove / edit', file: 'run/ContextMenu.tsx', w: 200, h: 220, anchor: 'top-left' },
  { id: 'v', label: 'select', family: 'menu', opens: 'any dropdown field', holds: 'the option list', file: 'ui/primitives/Select.tsx', w: 240, h: 200, anchor: 'top-left' },
  { id: 'w', label: 'screen picker', family: 'menu', opens: 'output screen button', holds: 'automatic, each display, no screen', file: 'Live.tsx', w: 260, h: 200, anchor: 'top-right' },
  { id: 'x', label: 'mic picker', family: 'menu', opens: 'audio button', holds: 'input devices + phone mic', file: 'components/MicPicker.tsx', w: 280, h: 220, anchor: 'top-right' },
  { id: 'y', label: 'phone mic', family: 'panel', opens: 'mic picker › phone mic', holds: 'QR, approve, the words coming back', file: 'components/PhoneMicPanel.tsx', w: 380, h: 520, footer: true },
  { id: 'z', label: 'mobile remote', family: 'panel', opens: 'mobile remote button', holds: 'server on/off, address, QR, code, approvals, paired phones', file: 'components/MobileRemotePanel.tsx', w: 420, h: 560, footer: true },
  { id: 'aa', label: 'notification popover', family: 'other', opens: 'the log bar’s chevron', holds: 'active / history tabs, cards', file: 'components/NotificationCenter.tsx', w: 380, h: 440, anchor: 'top-right' },
  { id: 'ab', label: 'find veil', family: 'other', opens: 'find on a caught verse', holds: 'candidate passages over the preview, paged ← →', file: 'ScriptureCatches.tsx', w: 560, h: 315, anchor: 'preview' },
  { id: 'ac', label: 'drag shelf', family: 'other', opens: 'parking a drag', holds: 'the parked chips; pause all / cancel all', file: 'drag.tsx', w: 520, h: 64, anchor: 'bottom' },
];

export const POPUP_STATES = POPUPS.map((p) => ({
  id: `S-18${p.id}`,
  label: p.label,
  note: `${p.family} · opens from ${p.opens} · holds ${p.holds} · ${p.file}`,
}));

/* ------------------------------------------------------------------ */

/** The dimmed app behind every popup: the bento's grid, as boxes. */
function Ground() {
  return (
    <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 gap-[var(--tri-gap)] p-2.5 pt-14 opacity-60">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="tri-rounded-surface bg-[#111111]" style={{ boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.055)' }} />
      ))}
    </div>
  );
}

/** The one line of facts every frame prints on itself. */
function Facts({ p }: { p: Popup }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] leading-relaxed">
      <dt className="text-[rgb(229_243_242_/_0.4)]">family</dt><dd>{p.family}</dd>
      <dt className="text-[rgb(229_243_242_/_0.4)]">opens from</dt><dd>{p.opens}</dd>
      <dt className="text-[rgb(229_243_242_/_0.4)]">holds</dt><dd>{p.holds}</dd>
      <dt className="text-[rgb(229_243_242_/_0.4)]">size</dt><dd className="tabular-nums">{p.w} × {p.h}</dd>
      <dt className="text-[rgb(229_243_242_/_0.4)]">file</dt><dd className="font-mono text-[10px]">{p.file}</dd>
    </dl>
  );
}

/** The frame: a header with the name and ✕, a dashed body, an optional footer. */
function Frame({ p, menu = false }: { p: Popup; menu?: boolean }) {
  return (
    <div
      role="dialog"
      aria-label={p.label}
      className="tri-rounded-surface flex flex-col overflow-hidden bg-[var(--tri-pop)] text-[var(--tri-ink)]"
      style={{ width: p.w, height: p.h, maxWidth: '100%', maxHeight: '100%', boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.12), 0 24px 60px rgb(0 0 0 / 0.5)' }}
    >
      {!menu && (
        <header className="flex h-[var(--tri-topbar-h)] shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{p.label}</span>
          <span className="grid size-6 place-items-center text-[rgb(229_243_242_/_0.6)]"><CloseIcon size={12} /></span>
        </header>
      )}
      <div className="relative min-h-0 flex-1 p-4">
        <div className="absolute inset-3 rounded-md border border-dashed border-white/[0.14]" />
        <div className="relative">
          {menu ? (
            <ul className="space-y-1 text-[12px]">
              {['—', '—', '—', '—'].map((s, i) => <li key={i} className="h-7 rounded-md bg-white/[0.04]">{s}</li>)}
            </ul>
          ) : <Facts p={p} />}
        </div>
      </div>
      {p.footer && (
        <footer className="flex h-12 shrink-0 items-center justify-end gap-2 border-t border-white/[0.08] px-4">
          <span className="h-7 w-20 rounded-md bg-white/[0.06]" />
          <span className="h-7 w-20 rounded-md bg-white/[0.12]" />
        </footer>
      )}
    </div>
  );
}

function Placed({ p }: { p: Popup }) {
  const menu = p.family === 'menu';
  const at =
    p.anchor === 'top-left' ? 'items-start justify-start p-2.5 pt-20 pl-72'
    : p.anchor === 'top-right' ? 'items-start justify-end p-2.5 pt-14'
    : p.anchor === 'bottom' ? 'items-end justify-center p-2.5'
    : p.anchor === 'preview' ? 'items-start justify-center pt-16'
    : 'items-center justify-center p-6';
  return (
    <div className={`absolute inset-0 flex ${at}`} style={{ background: menu || p.anchor ? 'transparent' : 'var(--tri-pop-scrim)' }}>
      {menu || p.anchor ? <Frame p={p} menu={menu} /> : <Frame p={p} />}
    </div>
  );
}

export function PopupsScreen({ state }: { state: string }) {
  const p = POPUPS.find((x) => `S-18${x.id}` === state) ?? POPUPS[0];
  return (
    <AppShell model={{ tab: 'LIVE', engine: 'connected' }}>
      <div className="tri-workspace-aurora relative h-full w-full">
        <Ground />
        <Placed p={p} />
      </div>
    </AppShell>
  );
}
