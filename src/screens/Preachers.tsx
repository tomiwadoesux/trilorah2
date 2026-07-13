import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { TextButton, SectionLabel, EngineNote, hasEngine } from '../components/ui';
import { pct } from '../lib/verse';

interface ProfileRow {
  id: string;
  name: string;
  stats?: PreacherStats;
}

function trustState(stats?: PreacherStats): { label: string; accent: boolean } {
  if (!stats) return { label: 'NO DATA YET', accent: false };
  if (stats.autoModeEligible) return { label: 'AUTO MODE ELIGIBLE', accent: true };
  if (stats.mature) return { label: 'MATURE', accent: false };
  return { label: 'TRAINING', accent: false };
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function ProfileDetail({ row }: { row: ProfileRow }) {
  const s = row.stats;
  return (
    <div className="space-y-3 pt-2 text-sm text-neutral-500">
      {s ? (
        <p>
          corrections last service · {s.correctionsLastService} — every confirm, reject, and amend
          you make in the end-of-service review teaches this profile.
        </p>
      ) : (
        <p>no adaptation data yet — stats appear after the first service with this preacher.</p>
      )}
      <div className="max-w-2xl space-y-1.5">
        <p>
          <span className="text-ink">precision</span> — the share of auto-detected verses that turned
          out to be right for this preacher.
        </p>
        <p>
          <span className="text-ink">trust lower bound</span> — a cautious floor under that precision
          (Wilson bound), so a lucky streak on few samples doesn't count as trust.
        </p>
        <p>
          <span className="text-ink">auto mode</span> — once the trust floor clears the threshold,
          detected verses go live without waiting for the operator. Until then everything stops in
          preview first.
        </p>
      </div>
    </div>
  );
}

export function Preachers() {
  const activePreacherId = useAppStore((s) => s.activePreacherId);
  const setActivePreacher = useAppStore((s) => s.setActivePreacher);
  const setTrustLowerBound = useAppStore((s) => s.setTrustLowerBound);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [newName, setNewName] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
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
      setDeleteArmId(null);
      await reload();
    } catch {
      setNote('could not delete profile');
    }
  };

  return (
    <div className="space-y-12">
      <section className="space-y-5">
        <SectionLabel>preachers</SectionLabel>
        {!hasEngine() && <EngineNote />}
        {rows.length === 0 && hasEngine() && (
          <p className="text-sm italic text-neutral-400">no profiles yet</p>
        )}
        <ul className="space-y-6">
          {rows.map((row) => {
            const state = trustState(row.stats);
            const active = row.id === activePreacherId;
            return (
              <li key={row.id} className="space-y-2 border-b border-hairline pb-6">
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  <span className={`text-lg ${active ? 'font-semibold' : ''}`}>{row.name}</span>
                  {active && (
                    <span className="text-xs uppercase tracking-widest text-accent">active</span>
                  )}
                  <span className={`text-xs uppercase tracking-widest ${state.accent ? 'text-accent' : 'text-neutral-400'}`}>
                    {state.label}
                  </span>
                </div>
                {row.stats && (
                  <p className="text-sm text-neutral-500">
                    samples {row.stats.samples} · services {row.stats.services} · precision{' '}
                    {pct(row.stats.precision)} · trust ≥ {pct(row.stats.trustLowerBound)}
                  </p>
                )}
                <div className="flex flex-wrap items-baseline gap-x-8">
                  {!active && <TextButton label="SET ACTIVE" primary onClick={() => void setActive(row)} />}
                  <TextButton
                    label={detailId === row.id ? 'HIDE DETAIL' : 'DETAIL'}
                    onClick={() => setDetailId((d) => (d === row.id ? null : row.id))}
                  />
                  {deleteArmId === row.id ? (
                    <>
                      <TextButton label="CONFIRM DELETE" onClick={() => void remove(row)} />
                      <TextButton label="KEEP" onClick={() => setDeleteArmId(null)} />
                    </>
                  ) : (
                    <TextButton label="DELETE" onClick={() => setDeleteArmId(row.id)} />
                  )}
                </div>
                {detailId === row.id && <ProfileDetail row={row} />}
              </li>
            );
          })}
        </ul>
        {note && <p className="text-sm text-neutral-500">{note}</p>}
      </section>

      <section className="space-y-4">
        <SectionLabel>new profile</SectionLabel>
        <form
          className="flex items-baseline gap-x-6"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="preacher's name"
            className="w-64 text-sm"
          />
          <TextButton label="NEW PROFILE" primary onClick={() => void create()} disabled={!hasEngine() || !newName.trim()} />
        </form>
        <p className="max-w-2xl text-sm text-neutral-500">
          The engine learns each preacher separately — their favorite verses, how they call
          references, how often they quote from memory. Trust builds service by service until
          auto mode is earned.
        </p>
      </section>
    </div>
  );
}
