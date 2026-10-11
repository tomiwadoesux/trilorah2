import { useEngine } from '../engine';
import { isEmptyPreview } from '../../emptyPreviewMode';
import { useEffect, useRef, useState } from 'react';
import { Button, cx } from '../../../ui';
import { Panel } from '../parts';
import { EmptyMark } from '../emptyArt';
import { DisplayConnectionArt } from '../DisplayConnectionArt';
import { Expandable } from './expand';
import { SettingRow, type Row } from '../settingsRows';
import { OUTPUTS_STYLES, SHIPPED_OUTPUTS, outputsStyle } from './outputs/styles';
import { ROLE_NAME, ROLE_AUDIENCE, ROLE_SHOWS, SAMPLE, STATE_WORD, type Role, type Screen } from './outputs/types';
import { AUTOMATIC, NO_SCREEN, displayChoice, displayOptions, saveDisplay, saveRole, screensFrom, useOutputsStatus } from './outputs/fromEngine';

/*
 * The outputs card — which screens are plugged in and what each one does.
 *
 * Fills the cell band 2 held empty. The face is a picture (./outputs);
 * pressing it lifts the tile onto the settings, one group per screen: what
 * it is, which job it does, which display it is on. In the app every fact
 * is the engine's (./outputs/fromEngine): the displays really connected,
 * where each output is or will open, whether its window is open. It used to
 * read SAMPLE everywhere, so every church saw an Epson and a BlackMagic
 * whatever was on their desk. Changing a job or a display writes the
 * settings the engine already acts on — outputRoles repaints the open
 * windows, outputDisplays moves them.
 *
 * On the design page a dashed bar sits over the card and switches between
 * the designs under review (./outputs/styles), all drawn on SAMPLE so each
 * is judged on the same room. The pick survives a reload. The app's own
 * window never shows the bar.
 */

const PICK_KEY = 'tri.outputs.design';
const ROLES: Role[] = ['projector', 'stream', 'stage', 'timer'];

/* The sample's displays, for the design page's picker. */
const SAMPLE_DISPLAYS = [NO_SCREEN, 'Epson EB-2247U', 'BlackMagic HDMI', 'Dell P2419H', 'this laptop'];

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

interface Picker {
  options: string[];
  choice: (s: Screen) => string;
  blurb: string;
}

type RowEntry = { row: Row; onChange?: (next: unknown) => void };

/* One group per screen. The status line says where it is and what it is
   doing; the two choices under it are the whole of what an operator can
   change about a screen from here. Each row carries its own change, so
   the box follows the card rather than keeping a copy that drifts. */
function rowsFor(
  screens: Screen[],
  picker: Picker,
  onRole: (id: string, role: Role) => void,
  onDisplay: (id: string, choice: string) => void,
): RowEntry[] {
  return screens.flatMap((s): RowEntry[] => [
    {
      row: {
        kind: 'status',
        key: `${s.id}.status`,
        label: `${ROLE_NAME[s.role]} — for ${ROLE_AUDIENCE[s.role]}`,
        blurb: ROLE_SHOWS[s.role],
        state: s.windowed ? 'warn' : s.state === 'live' ? 'ok' : 'idle',
        text: s.disabled ? 'off — no output window' : s.windowed
          ? 'no display of its own — a window on this laptop'
          : [s.display, s.size && `${s.size.w}×${s.size.h}`, STATE_WORD[s.state]].filter(Boolean).join(' · '),
      },
    },
    {
      row: { kind: 'segment', key: `${s.id}.role`, label: 'job', blurb: '', value: s.role, options: ROLES },
      onChange: (next: unknown) => onRole(s.id, next as Role),
    },
    {
      row: { kind: 'select', key: `${s.id}.display`, label: 'display', blurb: picker.blurb, value: picker.choice(s), options: picker.options },
      onChange: (next: unknown) => onDisplay(s.id, String(next)),
    },
  ]);
}

export function OutputsTile({ className }: { className?: string }) {
  const [design] = useState(onDesignPage);
  const [pick, setPick] = useState(() => (design ? readPick() : null) ?? SHIPPED_OUTPUTS);
  /* The app's card is the engine's. The design page, and a browser tab with
     no engine behind it, draw the sample. Until the engine answers, the app
     draws nothing rather than a room that is not there. */
  const [engine] = useState(() => !design && typeof window !== 'undefined' && !!window.api);
  const status = useOutputsStatus();
  const { latestReference } = useEngine();
  const [sample, setSample] = useState<Screen[]>(isEmptyPreview ? [] : SAMPLE);
  const screens = engine ? (status ? screensFrom(status) : []) : sample;

  useEffect(() => {
    if (design) writePick(pick);
  }, [design, pick]);

  /* The shared Select reports one pick twice (pointer-down, then click).
     A display pick already on its way to the engine is not sent again: each
     one moves an open window, and the wall should move once. Emptied when
     the engine's next answer lands. */
  const sending = useRef(new Map<string, string>());
  useEffect(() => {
    sending.current.clear();
  }, [status]);

  /* Sets, or cycles, a screen's job. */
  const onRole = (id: string, role?: Role) => {
    const s = screens.find((x) => x.id === id);
    if (!s) return;
    const next = role ?? ROLES[(ROLES.indexOf(s.role) + 1) % ROLES.length];
    if (next === s.role) return;
    if (engine) void saveRole(id, next).catch(() => undefined);
    else setSample((prev) => prev.map((x) => (x.id === id ? { ...x, role: next } : x)));
  };

  const onDisplay = (id: string, choice: string) => {
    if (!engine) {
      setSample((prev) => prev.map((x) => (x.id === id ? { ...x, display: choice, disabled: choice === NO_SCREEN, state: 'off', windowed: choice === 'this laptop' } : x)));
      return;
    }
    if (!status || choice === displayChoice(status, id) || sending.current.get(id) === choice) return;
    sending.current.set(id, choice);
    const d = status.displays.find((x) => x.name === choice);
    void saveDisplay(id, choice === NO_SCREEN ? 'none' : d ? d.id : null).catch(() => undefined);
  };

  const picker: Picker =
    engine && status
      ? {
          options: displayOptions(status),
          choice: (s) => displayChoice(status, s.id),
          blurb: `Choose no screen to close and disable this output. ${AUTOMATIC} assigns external screens in order.`,
        }
      : {
          options: SAMPLE_DISPLAYS,
          choice: (s) => (s.windowed ? 'this laptop' : s.display),
          blurb: 'Which screen it opens on. Unset, externals are handed out in order.',
        };

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
        tile={({ onOpen }) => screens.length === 0 || screens.every(screen => screen.disabled || screen.windowed)
          ? <Panel empty title="outputs" onOpen={onOpen} className="min-h-0 w-full flex-1">
              <EmptyMark w={180} h={170} plain art={<DisplayConnectionArt reference={latestReference ?? undefined} />}
                line="choose where the room sees it"
                below={<div className="mt-3"><Button label="select display" onClick={onOpen} /></div>} />
            </Panel>
          : <Face screens={screens} onRole={onRole} onOpen={onOpen} className="min-h-0 w-full flex-1" />}
      >
        <div data-guide="outputs-settings">
          {rowsFor(screens, picker, onRole, onDisplay).map(({ row, onChange }) => (
            <SettingRow key={row.key} row={row} value={'value' in row ? row.value : undefined} onChange={onChange ?? (() => undefined)} />
          ))}
        </div>
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
