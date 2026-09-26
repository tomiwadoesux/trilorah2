import { ConnectionsTile } from './ConnectionsTile';
import { Expandable } from './expand';
import { RowList, type Row } from '../settingsRows';

/*
 * The connections tile, made to open.
 *
 * ConnectionsTile is unchanged — it is still the six-row list read from
 * across the booth. This wraps it so pressing it lifts the tile onto the
 * OBS, vMix and pairing settings that used to be the Connected page in
 * S-10. The list is the glance; the box is where you fix it.
 */

const ROWS: Row[] = [
  { kind: 'toggle', key: 'obsEnabled', label: 'OBS Studio', blurb: 'Switch scenes and set the browser source from Trilorah.', value: true },
  { kind: 'text', key: 'obsHost', label: 'OBS host', blurb: '', value: 'localhost', when: ['obsEnabled', true] },
  { kind: 'number', key: 'obsPort', label: 'OBS port', blurb: '', value: 4455, when: ['obsEnabled', true] },
  { kind: 'secret', key: 'obsPassword', label: 'OBS password', blurb: '', set: true, when: ['obsEnabled', true] },
  { kind: 'action', key: 'obsConnect', label: 'Test OBS', blurb: 'Connects and lists the scenes it finds. Do this before Sunday, not on it.', button: 'connect', note: 'connected · 4 scenes', when: ['obsEnabled', true] },
  { kind: 'toggle', key: 'vmixEnabled', label: 'vMix', blurb: 'Set the active input and drive overlays.', value: false },
  { kind: 'text', key: 'vmixHost', label: 'vMix host', blurb: '', value: 'localhost', when: ['vmixEnabled', true] },
  { kind: 'number', key: 'vmixPort', label: 'vMix port', blurb: '', value: 8088, when: ['vmixEnabled', true] },
  { kind: 'action', key: 'vmixStatus', label: 'Test vMix', blurb: '', button: 'check', note: 'not checked', when: ['vmixEnabled', true] },
  { kind: 'toggle', key: 'remoteControlEnabled', label: 'Remote control', blurb: 'Let a paired phone or Stream Deck send commands on the church network.', value: true },
  { kind: 'action', key: 'pairing', label: 'Paired devices', blurb: 'Devices that may control the app. Pair with a six-digit code shown on this screen; revoke any of them here.', button: 'pair a device', note: 'ws://localhost:8081 · 1 device paired' },
  { kind: 'note', key: 'externalControlDocs', text: 'Stream Deck / Bitfocus Companion send JSON like {"action":"START_LISTENING"}. Commands: START_LISTENING · STOP_LISTENING · CLEAR_SCREEN · PUSH_PREVIEW · NEXT · PREVIOUS.' },
];

export function ConnectedTile({ className }: { className?: string }) {
  return (
    <Expandable
      className={className}
      title="Connected"
      glyph={false}
      blurb="Software the app talks to — the switcher, the stream, the Stream Deck."
      size={{ w: 680, h: 640 }}
      tile={({ onOpen }) => (
        <button type="button" onClick={onOpen} className="flex min-h-0 w-full flex-1 flex-col text-left">
          <ConnectionsTile className="min-h-0 w-full flex-1" />
        </button>
      )}
    >
      <RowList rows={ROWS} />
    </Expandable>
  );
}
