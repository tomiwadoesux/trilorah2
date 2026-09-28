import { useMemo, useState } from 'react';
import { AddRow, ProfileHeader, ProfileBody, Avatar, TrustBar, StagePill, pressKeys } from './PreachersTile';
import { usePreachers, removePreacher, saveTeaching, type Preacher } from './preachers';
import { Panel, Pill } from '../parts';
import { TeachingPanels } from './Teaching';
import { LearningActions } from './LearningActions';
import type { PreacherTeaching } from '../../../../shared/preacherLearning';
import { Button, SearchField, cx } from '../../../ui';

/*
 * S-02 · profile — the third posture of the Live screen.
 *
 * The same profile the preachers tile opens in a flown box, given the whole
 * window instead. It is the screen an operator opens BEFORE a service: has
 * the app learned this preacher, is it allowed to push on its own yet, what
 * did it get wrong last week. That is a reading task with no time pressure,
 * so it wants the room — in the tile's box the trust chart and the four
 * training gates are competing for 640px.
 *
 * It opens on whoever is preaching today, because nine times in ten that is
 * the one being asked about. The rail lists everyone so a second preacher is
 * one press away, and the list is the same component the tile uses — a
 * preacher row that looked different here than on the dashboard would be a
 * row the operator has to learn twice.
 */

const MUTED = 'rgb(229 243 242 / 0.45)';
const RULE = 'inset 0 -1px 0 rgb(255 255 255 / 0.06)';

/*
 * A preacher, as the profile rail draws them.
 *
 * NOT the dashboard tile's PreacherRow. That row is built for a box the
 * width of the window: after the name it spends 150px on a trust bar, 96 on
 * a stage pill and 104 on a "set for today" button, which in a 260px rail
 * leaves the name nothing and truncates it away entirely. Here the same
 * facts stack under the name instead of lining up beside it, and the one
 * that cannot stack — "set for today" — moves onto the profile header,
 * where it already exists.
 *
 * The selected row is marked, which the tile's row has no need to do: there
 * the list closes when you pick someone, here it stays open beside them and
 * has to say who is being shown.
 */
function CompactRow({
  p,
  active,
  selected,
  onOpen,
}: {
  p: Preacher;
  active: boolean;
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <li style={{ boxShadow: RULE }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={pressKeys(onOpen)}
        aria-current={selected}
        className={cx(
          'group/p flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-2 outline-none transition-colors',
          selected ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04] focus-visible:bg-white/[0.05]',
        )}
      >
        <Avatar p={p} size={30} ring={selected} />
        <div className="min-w-0 flex-1">
          {/* Today's preacher is the one row carrying BOTH pills, and with
              the stage pill beside it as well that left the name about
              forty pixels — "Pastor Dan" came out as "Pas…". The today pill
              moves down to the trust row, which has the room: the name gets
              the whole line, and the row that matters most is the one that
              was unreadable. */}
          <p className="flex min-w-0 items-center">
            <span className="truncate text-[length:var(--tri-size)] font-semibold text-[var(--tri-ink)]">{p.name}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5">
            {active && <Pill tone="live">today</Pill>}
            <TrustBar value={p.trustLowerBound} gate={p.gates?.trust} className="min-w-0 flex-1" />
            <span className="shrink-0 text-[length:var(--tri-size-eyebrow)] tabular-nums" style={{ color: MUTED }}>
              {p.services ? pctOf(p.trustLowerBound) : '—'}
            </span>
          </p>
        </div>
        <StagePill p={p} />
      </div>
    </li>
  );
}

function pctOf(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function ProfileView() {
  const { preachers, activeId } = usePreachers();
  const [picked, setPicked] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  /*
   * Edits to what a preacher has been taught, held here until the engine
   * takes them. The IPC all exists — getVocabulary/setVocabulary,
   * getCommandLog/teachCommandPhrase, and the ledger's own alias table —
   * so wiring this is replacing `patch` with those calls, keyed by id, and
   * nothing above it moves.
   */
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');


  /* Today's preacher unless one was picked. Falling back to the first keeps
     the screen from being empty on a church that has not set an active one,
     which is every church before its first service. */
  const base: Preacher | null =
    preachers.find((p) => p.id === (picked ?? activeId)) ?? preachers[0] ?? null;
  const shown = base;

  const patch = async (id: string, next: Partial<PreacherTeaching>) => {
    setSaving(true); setSaveMessage('Saving…');
    try { await saveTeaching(id, next); setSaveMessage('Saved on this computer.'); }
    catch (error) { setSaveMessage(error instanceof Error ? error.message : 'Could not save. Please retry.'); }
    finally { setSaving(false); }
  };

  const q = query.trim().toLowerCase();
  const shownList = useMemo(
    () => (q ? preachers.filter((p) => p.name.toLowerCase().includes(q) || p.role.includes(q)) : preachers),
    [preachers, q],
  );

  return (
    <div className="flex h-full min-h-0 w-full gap-[var(--tri-gap)]">
      {/* The operator rail's width exactly — one left column across all
          three views, so switching posture never shifts the edge the eye
          reads down.

          This was 260px flat, set when 18% was narrower than a preacher row
          needed and names truncated. It is the wider of the two now at any
          normal window (342px against 260 at 1920), so the rows have more
          room than they were given, not less. `min-w-[240px]` keeps them
          safe if the window is ever dragged narrow enough for 18% to fall
          under what a name needs. */}
      <div
        className="flex min-h-0 min-w-[240px] shrink-0 flex-col"
        style={{ width: 'var(--tri-rail-w)' }}
      >
        <Panel title="preachers" className="min-h-0 flex-1" bodyClass="pt-0">
          <div className="flex h-full min-h-0 flex-col gap-2">
            <Button label={adding ? 'cancel' : 'add preacher'} onClick={() => setAdding(!adding)} />
            <SearchField value={query} onChange={setQuery} placeholder="search" className="shrink-0" />
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {shownList.map((p) => (
                <CompactRow
                  key={p.id}
                  p={p}
                  active={p.id === activeId}
                  selected={p.id === shown?.id}
                  onOpen={() => setPicked(p.id)}
                />
              ))}
              {!shownList.length && (
                <li className="px-1 py-3 text-[length:var(--tri-size-xs)] lowercase" style={{ color: MUTED }}>
                  nobody by that name
                </li>
              )}
            </ul>
          </div>
        </Panel>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {adding ? (
          <Panel title="add preacher" className="min-h-0 flex-1">
            <AddRow initialName={shownList.length ? '' : query} onCancel={() => setAdding(false)} onAdded={(p) => {
              setPicked(p.id);
              setQuery('');
              setAdding(false);
            }} />
          </Panel>
        ) : shown ? (
          <Panel className="min-h-0 flex-1" bodyClass="px-0 pb-0 pt-0">
            <div className="flex h-full min-h-0 flex-col">
              <div className="shrink-0 px-6 pt-5">
                <ProfileHeader p={shown} active={shown.id === activeId} />
              </div>
              <ProfileBody
                p={shown}
                beforeReport={<LearningActions key={shown.id} p={shown} />}
                onRemove={() => {
                  removePreacher(shown.id);
                  setPicked(null);
                }}
              >
                {/* The teaching panels sit inside the profile's own scroll,
                    under the report — you read how it is doing, and the
                    thing you can do about it is the next thing down. */}
                <details className="rounded-xl border border-white/10 p-4">
                  <summary className="cursor-pointer text-sm font-semibold">Advanced teaching · book names, vocabulary and voice commands</summary>
                  <fieldset disabled={saving || !shown.learning} className="mt-4 disabled:opacity-50">
                    <TeachingPanels key={shown.id} p={shown} onChange={(next) => void patch(shown.id, next)} />
                  </fieldset>
                  {saveMessage && <p role="status" className="mt-3 text-sm text-white/75">{saveMessage}</p>}
                </details>
              </ProfileBody>
            </div>
          </Panel>
        ) : (
          <Panel className="min-h-0 flex-1">
            <div className="grid h-full place-items-center">
              <p className="text-[length:var(--tri-size-xs)] lowercase" style={{ color: 'rgb(229 243 242 / 0.45)' }}>
                no preachers yet — choose add preacher to create a profile
              </p>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
