import { isEmptyPreview } from '../../emptyPreviewMode';
import { useEffect, useState } from 'react';
import { Panel, Dot } from '../parts';
import { PlusIcon } from '../../../ui';

/*
 * The connections list — the OTHER SOFTWARE this app talks to.
 *
 * Narrowed on 2026-09-27 at the owner's word. It used to also carry the
 * Bible database, the microphone and the displays, and those are a
 * different kind of fact: they are this machine's own equipment, always
 * present, nothing to connect to and nothing a church chooses. They read
 * as connections only because they had a green dot next to them. The
 * pre-flight card already answers "is the mic working, is there a Bible,
 * is a display assigned" — that is where a machine fact belongs.
 *
 * What is left is software running somewhere else that we hold a
 * conversation with: a switcher, a stream deck, the cloud. Each one is
 * something a church either has or does not, can set up or take away, and
 * can lose in the middle of a service — which is what makes a live status
 * worth a row at all.
 *
 * So the list is open-ended, and says so: the last row is the way to add
 * one. A fixed list could only ever be wrong for a church that runs
 * something it does not name.
 *
 * Each row says its state twice, as a word and as a colour, because at
 * booth distance the dot is all that carries and up close the word is what
 * tells "connecting" apart from "off" — the two states whose dots are the
 * easiest pair to confuse.
 */

type LinkState = 'connected' | 'not connected' | 'connecting' | 'off';

type LinkId = 'obs' | 'vmix' | 'companion' | 'cloud';

interface Link {
  /* The row is keyed by which integration it is, not by its position: the
     same names come back every poll. */
  id: LinkId;
  name: string;
  state: LinkState;
}

const STATE_TONE: Record<LinkState, 'ok' | 'warn' | 'danger' | 'idle'> = {
  connected: 'ok',
  'not connected': 'danger',
  connecting: 'warn',
  off: 'idle',
};

/* The word takes the dot's colour, so the pair reads as one statement
   rather than as a label with an indicator next to it. Off is the
   exception: nothing is wrong, so it drops out of the status palette into
   plain muted ink and stops competing for the eye. */
const STATE_INK: Record<LinkState, string> = {
  connected: '#8fd3c0',
  'not connected': '#eac7c6',
  connecting: '#e4d87a',
  off: 'rgb(229 243 242 / 0.35)',
};

/* What the state means, in the booth's words. Shown beside the name on
   hover: the dot says how it is, this says what to do about it. */
const STATE_WHY: Record<LinkState, string> = {
  connected: 'talking to it',
  'not connected': 'set up, but not reachable — open the card',
  connecting: 'checking…',
  off: 'not set up',
};

const ROWS: { id: LinkId; name: string }[] = [
  { id: 'obs', name: 'OBS Studio' },
  { id: 'vmix', name: 'vMix' },
  { id: 'companion', name: 'Stream Deck' },
  { id: 'cloud', name: 'Trilorah Cloud' },
];

/* What the design surface shows when there is no engine behind it. */
const SAMPLE: Record<LinkId, LinkState> = {
  obs: 'connected',
  vmix: 'off',
  companion: 'connected',
  cloud: 'not connected',
};

const POLL_MS = 6000;

function fromVmix(s: VmixStatus): LinkState {
  if (!s.enabled) return 'off';
  return s.reachable ? 'connected' : 'not connected';
}

function fromObs(s: ObsStatus): LinkState {
  if (!s.enabled) return 'off';
  return s.connected ? 'connected' : 'not connected';
}

function useLinks(): Link[] {
  const [states, setStates] = useState<Partial<Record<LinkId, LinkState>>>({});

  useEffect(() => {
    const api = typeof window === 'undefined' ? undefined : window.api;
    if (!api) {
      setStates(isEmptyPreview ? { obs: 'off', vmix: 'off', companion: 'off', cloud: 'off' } : SAMPLE);
      return;
    }
    let alive = true;

    const settle = (id: LinkId, state: LinkState) => {
      if (alive) setStates((prev) => (prev[id] === state ? prev : { ...prev, [id]: state }));
    };

    const poll = () => {
      if (api.obsStatus) {
        api.obsStatus()
          .then((s) => settle('obs', fromObs(s)))
          .catch(() => settle('obs', 'not connected'));
      } else {
        settle('obs', 'off');
      }

      if (api.vmixStatus) {
        api.vmixStatus()
          .then((s) => settle('vmix', fromVmix(s)))
          .catch(() => settle('vmix', 'not connected'));
      } else {
        settle('vmix', 'off');
      }

      /* A Stream Deck talks over the same socket a paired phone does, so a
         live socket IS the connection. `remoteConnected` is the right call
         and `remoteListDevices` the wrong one: the second answers who MAY
         connect, which stays true all week and would show a dot for a deck
         that is unplugged. */
      if (api.remoteConnected) {
        api.remoteConnected()
          .then((d: unknown) => settle('companion', Array.isArray(d) && d.length > 0 ? 'connected' : 'off'))
          .catch(() => settle('companion', 'off'));
      } else {
        settle('companion', 'off');
      }

      /* Signed in is not the same as reachable — but from across a booth
         the question is only "will the phones get anything", and being
         signed out is the commonest reason they will not. */
      if (api.cloudStatus) {
        api.cloudStatus()
          .then((c: any) => {
            if (!c?.configured) return settle('cloud', 'off');
            settle('cloud', c.signedIn ? 'connected' : 'not connected');
          })
          .catch(() => settle('cloud', 'not connected'));
      } else {
        settle('cloud', 'off');
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

/* The rules between the rows. They separate ROWS from each other, which
   is a rule's actual job; the Panel header has none, because there is
   nothing under it to separate from. No column headers either: the name
   and the state are the only two things on a row and neither needs
   naming. */
const RULE = 'inset 0 -1px 0 rgb(255 255 255 / 0.07)';
const MUTED = 'rgb(229 243 242 / 0.45)';

export function ConnectionsTile({
  className,
  onOpen,
  onAdd,
}: {
  className?: string;
  /** A press anywhere on the list. */
  onOpen?: () => void;
  /** The last row — where a church says it runs something not listed. */
  onAdd?: () => void;
}) {
  const links = useLinks();
  return (
    <Panel
      title="connected"
      empty={links.every(link => link.state === 'off')}
      onOpen={onOpen}
      className={className}
    >
      <ul className="flex h-full min-h-0 flex-col" onClick={onOpen}>
        {links.map((link) => {
          const off = link.state === 'off';
          return (
            <li
              key={link.id}
              className="group/row flex min-h-0 flex-1 items-center gap-2"
              /* The rule rides on the row rather than sitting between rows
                 as an element of its own — a divider would take height the
                 rows are already dividing between them. Every row carries
                 one, the add row included, so the list reads as one that
                 continues rather than one that has stopped. */
              style={{ boxShadow: RULE }}
            >
              {/* A row that is off is off as a whole: name and state both
                  step back, so the eye lands on what is actually running. */}
              <span
                className="min-w-0 flex-1 truncate text-[length:var(--tri-size)]"
                style={{ color: off ? MUTED : 'var(--tri-ink)' }}
              >
                {link.name}
                <span className="ml-2 hidden text-[length:var(--tri-size-xs)] lowercase group-hover/row:inline" style={{ color: MUTED }}>
                  {STATE_WHY[link.state]}
                </span>
              </span>
              <span
                className="flex shrink-0 items-center gap-1.5 text-[length:var(--tri-size-xs)] lowercase"
                style={{ color: STATE_INK[link.state] }}
              >
                {link.state}
                {!off && <Dot tone={STATE_TONE[link.state]} />}
              </span>
            </li>
          );
        })}

        {/* The list is open: a church may run something none of these rows
            names. Same height as the others so the rhythm holds, and last,
            so it reads as an offer rather than an instruction. */}
        <li className="flex min-h-0 flex-1 items-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd?.();
            }}
            className="flex w-full items-center gap-1.5 rounded-[6px] px-1 py-1 text-left transition-colors hover:bg-white/[0.05]"
            style={{ color: MUTED }}
          >
            <PlusIcon size={11} className="shrink-0" />
            <span className="truncate text-[length:var(--tri-size-xs)] lowercase">connect something else</span>
          </button>
        </li>
      </ul>
    </Panel>
  );
}
