import { useEffect, useState } from 'react';
import { cx } from '../../../ui';
import { Expandable } from './expand';
import { RowList, type Row } from '../settingsRows';
import { OUTPUTS_STYLES, SHIPPED_OUTPUTS, outputsStyle } from './outputs/styles';
import { ROLE_NAME, ROLE_AUDIENCE, ROLE_SHOWS, SAMPLE, STATE_WORD, type Role, type Screen } from './outputs/types';

/*
 * The outputs card — which screens are plugged in and what each one does.
 *
 * Fills the cell band 2 held empty. The face is a picture (./outputs);
 * pressing it lifts the tile onto the settings, one group per screen: what
 * it is, which job it does, which display it is on. The engine has every
 * fact shown (electron/output/outputState.ts, output/displays.ts,
 * `get-displays-status`); the wiring is the one thing left, so the card
 * reads SAMPLE for now and says so here, not on its face.
 *
 * On the design page a dashed bar sits over the card and switches between
 * the designs under review (./outputs/styles). The pick survives a reload.
 * The app's own window never shows the bar.
 */

const PICK_KEY = 'tri.outputs.design';
const ROLES: Role[] = ['projector', 'stream', 'stage', 'timer'];

/* What the popup lists a screen could be moved to. The engine's real list
   comes from `get-displays-status`; these are the sample's. */
const DISPLAYS = ['Epson EB-2247U', 'BlackMagic HDMI', 'Dell P2419H', 'this laptop'];

function onDesignPage() {
  return typeof location !== 'undefined' && /design\.html$/.test(location.pathname);
}

function readPick(): string | null {
  try {
    return localStorage.getItem(PICK_KEY);
  } catch {
    return null;
  }
}

function writePick(id: string) {
  try {
    localStorage.setItem(PICK_KEY, id);
  } catch {
    /* A private window: the pick just does not survive a reload. */
  }
}

/* One group per screen. The status line says where it is and what it is
   doing; the two choices under it are the whole of what an operator can
   change about a screen from here. */
function rowsFor(screens: Screen[]): Row[] {
  return screens.flatMap((s): Row[] => [
    {
      kind: 'status',
      key: `${s.id}.status`,
      label: `${ROLE_NAME[s.role]} — for ${ROLE_AUDIENCE[s.role]}`,
      blurb: ROLE_SHOWS[s.role],
      state: s.windowed ? 'warn' : s.state === 'live' ? 'ok' : 'idle',
      text: s.windowed ? 'no display of its own — a window on this laptop' : `${s.display} · ${s.size ? `${s.size.w}×${s.size.h}` : ''} · ${STATE_WORD[s.state]}`,
    },
    { kind: 'segment', key: `${s.id}.role`, label: 'job', blurb: '', value: s.role, options: ROLES },
    { kind: 'select', key: `${s.id}.display`, label: 'display', blurb: 'Which screen it opens on. Unset, externals are handed out in order.', value: s.windowed ? 'this laptop' : s.display, options: DISPLAYS },
  ]);
}

export function OutputsTile({ className }: { className?: string }) {
  const [design] = useState(onDesignPage);
  const [pick, setPick] = useState(() => (design ? readPick() : null) ?? SHIPPED_OUTPUTS);
  const [screens, setScreens] = useState<Screen[]>(SAMPLE);

  useEffect(() => {
    if (design) writePick(pick);
  }, [design, pick]);

  /* Local until the engine takes it: sets, or cycles, a screen's job. */
  const onRole = (id: string, role?: Role) =>
    setScreens((prev) =>
      prev.map((s) => (s.id === id ? { ...s, role: role ?? ROLES[(ROLES.indexOf(s.role) + 1) % ROLES.length] } : s)),
    );

  const style = outputsStyle(design ? pick : SHIPPED_OUTPUTS);
  const Face = style.Component;

  return (
    <div className={cx('relative flex min-h-0 min-w-0', className)}>
      <Expandable
        className="min-h-0 min-w-0 flex-1"
        title="Outputs"
        glyph={false}
        blurb="The screens this machine drives — what each one shows, and which display it is on."
        size={{ w: 640, h: 620 }}
        tile={({ onOpen }) => <Face screens={screens} onRole={onRole} onOpen={onOpen} className="min-h-0 w-full flex-1" />}
      >
        <RowList rows={rowsFor(screens)} />
      </Expandable>
      {design && (
        <div
          className={cx(
            'absolute -top-2 right-2 z-30 flex -translate-y-full items-center gap-1 rounded-lg px-1.5 py-1',
            'font-mono text-[10px] uppercase tracking-[0.12em] text-[rgb(229_243_242_/_0.6)]',
            'border border-dashed border-white/20 bg-[rgb(14_18_18_/_0.94)] backdrop-blur-md',
          )}
        >
          <span className="px-1.5 text-[rgb(229_243_242_/_0.4)]">outputs</span>
          {OUTPUTS_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.blurb}
              onClick={() => setPick(s.id)}
              className={cx('rounded-md px-2 py-1 transition-colors', s.id === pick ? 'bg-white/[0.12] text-white' : 'hover:text-white')}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
