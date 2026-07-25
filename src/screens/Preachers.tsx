import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import {
  Button,
  EmptyState,
  EngineNote,
  Panel,
  PanelHeader,
  Pill,
  SectionLabel,
  TextButton,
  TrustBar,
  hasEngine,
} from '../components/ui';
import { pct } from '../lib/verse';

interface ProfileRow {
  id: string;
  name: string;
  stats?: PreacherStats;
}

function trustState(stats?: PreacherStats): { label: string; accent: boolean } {
  if (!stats) return { label: 'no data yet', accent: false };
  if (stats.autoModeEligible) return { label: 'auto mode eligible', accent: true };
  if (stats.mature) return { label: 'mature', accent: false };
  return { label: 'training', accent: false };
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* ------------------------------------------------------------------ */
/* Detail panels                                                       */
/* ------------------------------------------------------------------ */

function ReadinessRow({ met, children }: { met: boolean; children: string }) {
  return (
    <li className={`flex items-baseline gap-x-2 text-sm ${met ? 'text-ink' : 'text-neutral-400'}`}>
      <span aria-hidden="true" className="font-mono">{met ? '●' : '○'}</span>
      {children}
    </li>
  );
}

function TrustDetail({ row }: { row: ProfileRow }) {
  const settings = useAppStore((s) => s.settings);
  const s = row.stats;
  const state = trustState(s);

  const gate = typeof settings?.autoModeMinTrust === 'number' ? settings.autoModeMinTrust : 0.9;
  const minSamples = typeof settings?.autoModeMinSamples === 'number' ? settings.autoModeMinSamples : 100;
  const minServices = typeof settings?.autoModeMinServices === 'number' ? settings.autoModeMinServices : 5;

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader right={<Pill active={state.accent}>{state.label}</Pill>}>trust meter</PanelHeader>
        {s ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <TrustBar value={s.trustLowerBound} gate={gate} />
              <p className="text-[10px] uppercase tracking-widest text-neutral-400">
                trust floor {pct(s.trustLowerBound)} · auto-mode gate {pct(gate)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {[
                ['precision', pct(s.precision)],
                ['samples', String(s.samples)],
                ['services', String(s.services)],
                ['corrections last', String(s.correctionsLastService)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">{label}</dt>
                  <dd className="text-xl font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <EmptyState>no adaptation data yet — stats appear after the first service with this preacher</EmptyState>
        )}
      </Panel>

      <Panel>
        <PanelHeader>auto-mode readiness</PanelHeader>
        {s ? (
          <ul className="space-y-2">
            <ReadinessRow met={s.trustLowerBound >= gate}>
              {`trust floor at or above ${pct(gate)} — now ${pct(s.trustLowerBound)}`}
            </ReadinessRow>
            <ReadinessRow met={s.samples >= minSamples}>
              {`at least ${minSamples} verified detections — now ${s.samples}`}
            </ReadinessRow>
            <ReadinessRow met={s.services >= minServices}>
              {`at least ${minServices} services together — now ${s.services}`}
            </ReadinessRow>
          </ul>
        ) : (
          <EmptyState>run a service with this preacher to start the meter</EmptyState>
        )}
        <p className="mt-4 max-w-xl text-sm text-neutral-500">
          Once every gate is met, detected verses go live without waiting for the operator. Until
          then everything stops in preview first. Every confirm, reject, and amend in the
          end-of-service review — and the practice room — trains this profile.
        </p>
      </Panel>

      <Panel>
        <PanelHeader>how the numbers work</PanelHeader>
        <div className="max-w-xl space-y-2 text-sm text-neutral-500">
          <p>
            <span className="text-ink">precision</span> — the share of auto-detected verses that
            turned out to be right for this preacher.
          </p>
          <p>
            <span className="text-ink">trust floor</span> — a cautious lower bound under that
            precision (Wilson bound), so a lucky streak on few samples doesn't count as trust.
          </p>
          <p>
            <span className="text-ink">corrections</span> — how many detections you fixed in the
            last service. Mature profiles stop prompting when this stays near zero.
          </p>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function Preachers() {
  const activePreacherId = useAppStore((s) => s.activePreacherId);
  const setActivePreacher = useAppStore((s) => s.setActivePreacher);
  const setTrustLowerBound = useAppStore((s) => s.setTrustLowerBound);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [newName, setNewName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteArmId, setDeleteArmId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const api = window.api;
    if (!api) return;
    try {
      const [profiles, stats] = await Promise.all([
        api.listPreacherProfiles(),
        api.getPreacherStats?.().catch(() => undefined) ?? Promise.resolve(undefined),
      ]);
      const statById = new Map((stats ?? []).map((s) => [s.id, s]));
      // Stats may know preachers the profile folder doesn't (and vice versa).
      const merged: ProfileRow[] = profiles.map((p) => ({ ...p, stats: statById.get(p.id) }));
      for (const s of stats ?? []) {
        if (!merged.some((r) => r.id === s.id)) merged.push({ id: s.id, name: s.name, stats: s });
      }
      setRows(merged);
      setSelectedId((sel) => sel ?? merged[0]?.id ?? null);
    } catch {
      setNote('could not load profiles');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    const base = slugify(name) || 'preacher';
    const id = rows.some((r) => r.id === base) ? `${base}-${Date.now().toString(36)}` : base;
    try {
      await window.api?.createPreacherProfile(id, name);
      setNewName('');
      setNote(null);
      setSelectedId(id);
      await reload();
    } catch {
      setNote('could not create profile');
    }
  };

  const setActive = async (row: ProfileRow) => {
    try {
      const res = await window.api?.setActivePreacher(row.id);
      if (res?.success) {
        setActivePreacher(row.id, res.name ?? row.name);
        setTrustLowerBound(row.stats?.trustLowerBound ?? null);
        setNote(null);
      } else {
        setNote(res?.error ?? 'could not set active preacher');
      }
    } catch {
      setNote('could not set active preacher');
    }
  };

  const remove = async (row: ProfileRow) => {
    try {
      await window.api?.deletePreacherProfile(row.id);
      if (activePreacherId === row.id) {
        setActivePreacher(null, null);
        setTrustLowerBound(null);
      }
      if (selectedId === row.id) setSelectedId(null);
      setDeleteArmId(null);
      await reload();
    } catch {
      setNote('could not delete profile');
    }
  };

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Preachers</h2>
        <p className="text-sm text-neutral-500">
          The engine learns each preacher separately — trust builds service by service until auto
          mode is earned.
        </p>
        {!hasEngine() && <EngineNote />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel pad={false} dataTour="preacher-profiles">
            <div className="border-b border-hairline px-4 py-3">
              <SectionLabel>profiles</SectionLabel>
            </div>
            {rows.length === 0 ? (
              <div className="px-4 py-4">
                <EmptyState>no profiles yet</EmptyState>
              </div>
            ) : (
              <ul>
                {rows.map((row) => {
                  const state = trustState(row.stats);
                  const active = row.id === activePreacherId;
                  const isSelected = row.id === selectedId;
                  return (
                    <li key={row.id} className={`border-l-2 ${isSelected ? 'border-accent bg-paper' : 'border-transparent'}`}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className="block w-full px-4 py-3 text-left"
                      >
                        <span className="flex items-baseline justify-between gap-x-3">
                          <span className={`text-sm ${isSelected || active ? 'font-semibold' : ''}`}>{row.name}</span>
                          {active && <Pill active>active</Pill>}
                        </span>
                        <span className={`text-[10px] uppercase tracking-widest ${state.accent ? 'text-accent' : 'text-neutral-400'}`}>
                          {state.label}
                          {row.stats && ` · trust ${pct(row.stats.trustLowerBound)}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader>new profile</PanelHeader>
            <form
              className="flex items-center gap-x-3"
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="preacher's name"
                className="w-full text-sm"
              />
              <Button label="Create" variant="solid" onClick={() => void create()} disabled={!hasEngine() || !newName.trim()} />
            </form>
          </Panel>
          {note && <p className="text-sm text-neutral-500">{note}</p>}
        </div>

        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{selected.name}</h3>
              <div className="flex items-center gap-x-4">
                {selected.id !== activePreacherId && (
                  <Button label="Set active" variant="solid" onClick={() => void setActive(selected)} />
                )}
                {deleteArmId === selected.id ? (
                  <>
                    <TextButton label="CONFIRM DELETE" onClick={() => void remove(selected)} />
                    <TextButton label="KEEP" onClick={() => setDeleteArmId(null)} />
                  </>
                ) : (
                  <TextButton label="DELETE" onClick={() => setDeleteArmId(selected.id)} />
                )}
              </div>
            </div>
            <TrustDetail row={selected} />
          </div>
        ) : (
          <EmptyState>select a profile to see its training state</EmptyState>
        )}
      </div>
    </div>
  );
}
