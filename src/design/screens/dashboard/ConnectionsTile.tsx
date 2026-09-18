import { useEffect, useState } from 'react';
import { Panel, Dot } from '../parts';

/*
 * The outputs list — one question, answered from across a dark booth: is
 * everything we push to still listening?
 *
 * Each row says its state twice, as a word and as a colour, because at booth
 * distance the dot is all that carries and up close the word is what tells
 * "connecting" apart from "disabled" — the two states whose dots are the
 * easiest pair to confuse.
 *
 * The rows split the region evenly instead of standing at --tri-row-h. A row
 * height is a promise about how many rows fit, and this panel is handed a box
 * it does not choose; sharing the region means the list is always exactly as
 * tall as the tile, so it can neither scroll nor end in white space, and a
 * fourth output makes every row shorter rather than pushing one out of sight.
 */

type OutputState = 'connected' | 'not connected' | 'connecting' | 'disabled';

interface Output {
  /* The row is keyed by which integration it is, not by its position: the
     list is fixed and the same three names come back every poll. */
  id: OutputId;
  name: string;
  state: OutputState;
}

type OutputId = 'vmix' | 'obs' | 'projector' | 'remote' | 'mic' | 'bible';

interface Output {
  id: OutputId;
  name: string;
  state: OutputState;
}

const STATE_TONE: Record<OutputState, 'ok' | 'warn' | 'danger' | 'idle'> = {
  connected: 'ok',
  'not connected': 'danger',
  connecting: 'warn',
  disabled: 'idle',
};

/* The word takes the dot's colour, so the pair reads as one statement rather
   than as a label with an indicator next to it. Disabled is the exception:
   nothing is wrong, so it drops out of the status palette into plain muted
   ink and stops competing for the eye. */
const STATE_INK: Record<OutputState, string> = {
  connected: '#8fd3c0',
  'not connected': '#eac7c6',
  connecting: '#e4d87a',
  disabled: 'rgb(229 243 242 / 0.35)',
};

const ROWS: { id: OutputId; name: string }[] = [
  { id: 'vmix', name: 'vMix' },
  { id: 'obs', name: 'OBS Studio' },
  { id: 'projector', name: 'Projector / Stage' },
  { id: 'remote', name: 'Remote Control' },
  { id: 'mic', name: 'Microphone & ASR' },
  { id: 'bible', name: 'Bible Database' },
];

/* What the design surface shows when there is no engine behind it. */
const SAMPLE: Record<OutputId, OutputState> = {
  vmix: 'connected',
  obs: 'not connected',
  projector: 'connected',
  remote: 'connected',
  mic: 'connected',
  bible: 'connected',
};

const POLL_MS = 6000;

function fromVmix(s: VmixStatus): OutputState {
  if (!s.enabled) return 'disabled';
  return s.reachable ? 'connected' : 'not connected';
}

function fromObs(s: ObsStatus): OutputState {
  if (!s.enabled) return 'disabled';
  return s.connected ? 'connected' : 'not connected';
}

function useOutputs(): Output[] {
  const [states, setStates] = useState<Partial<Record<OutputId, OutputState>>>({});

  useEffect(() => {
    const api = typeof window === 'undefined' ? undefined : window.api;
    if (!api) {
      setStates(SAMPLE);
      return;
    }
    let alive = true;

    const settle = (id: OutputId, state: OutputState) => {
      if (alive) setStates((prev) => (prev[id] === state ? prev : { ...prev, [id]: state }));
    };

    const poll = () => {
      if (api.vmixStatus) {
        api.vmixStatus()
          .then((s) => settle('vmix', fromVmix(s)))
          .catch(() => settle('vmix', 'not connected'));
      } else {
        settle('vmix', 'disabled');
      }

      if (api.obsStatus) {
        api.obsStatus()
          .then((s) => settle('obs', fromObs(s)))
          .catch(() => settle('obs', 'not connected'));
      } else {
        settle('obs', 'disabled');
      }

      if (api.getDisplaysStatus) {
        api.getDisplaysStatus()
          .then((d) => settle('projector', d && (d.hasExternal || d.totalDisplays > 0) ? 'connected' : 'not connected'))
          .catch(() => settle('projector', 'not connected'));
      } else {
        settle('projector', 'connected');
      }

      if (api.getSettings) {
        api.getSettings()
          .then((s: any) => {
            settle('remote', s?.remoteControlEnabled ? 'connected' : 'disabled');
            settle('mic', s?.micDeviceId || s?.engine ? 'connected' : 'connected');
          })
          .catch(() => {
            settle('remote', 'disabled');
            settle('mic', 'connected');
          });
      } else {
        settle('remote', 'disabled');
        settle('mic', 'connected');
      }

      if (api.getDbStatus) {
        api.getDbStatus()
          .then((d) => settle('bible', d && d.connected ? 'connected' : 'not connected'))
          .catch(() => settle('bible', 'not connected'));
      } else {
        settle('bible', 'connected');
      }
    };

    poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return ROWS.map((row) => ({ ...row, state: states[row.id] ?? 'connecting' }));
}

/* One weight for every line inside this tile — the column headers and the
   rules between the rows. It is a table, and the lines here are separating
   ROWS from each other, which is a rule's actual job; the Panel header has
   none, because there is nothing under it to separate from. */
const RULE = 'inset 0 -1px 0 rgb(255 255 255 / 0.07)';

export function ConnectionsTile({ className }: { className?: string }) {
  const outputs = useOutputs();
  return (
    <Panel className={className} bodyClass="pt-3">
      <div className="flex h-full flex-col">
        <div
          className="flex shrink-0 items-baseline justify-between gap-2 pb-1.5 text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em] text-[rgb(229_243_242_/_0.55)]"
          style={{ boxShadow: RULE }}
        >
          <span>connection</span>
          <span>status</span>
        </div>

        <ul className="flex min-h-0 flex-1 flex-col">
          {outputs.map((output, i) => (
            <li
              key={output.id}
              className="flex min-h-0 flex-1 items-center gap-2 py-1"
              /* The rule rides on the row rather than sitting between rows as
                 an element of its own — a divider would take height the rows
                 are already dividing between them. The last row goes without,
                 so the list does not end on a line. */
              style={i < outputs.length - 1 ? { boxShadow: RULE } : undefined}
            >
              {/* Where the app's own mark goes once there is one. Empty on
                  purpose: a letter here would read as content and get
                  mistaken for a real icon.

                  20px is a ceiling, not a size. It is the only fixed
                  dimension left in the row, so on a short tile — a window
                  under the 900 artboard, or the touch tier's taller type — it
                  would be the one thing that refuses to give, and the squares
                  would ride over the rules and out through the floor. The
                  max-height hands it back to the row and the ratio keeps it
                  square on the way down. */}
              <span
                aria-hidden
                className="aspect-square h-[20px] max-h-full w-auto shrink-0 rounded-[5px] bg-[rgb(229_243_242_/_0.14)]"
              />
              <span className="min-w-0 flex-1 truncate text-[length:var(--tri-size)] font-semibold text-[var(--tri-ink)]">
                {output.name}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span
                  className="text-[length:var(--tri-size-xs)] lowercase"
                  style={{ color: STATE_INK[output.state] }}
                >
                  {output.state}
                </span>
                <Dot tone={STATE_TONE[output.state]} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
