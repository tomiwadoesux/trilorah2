import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { PersonIcon } from '@radix-ui/react-icons';
import { Button, PlusIcon, SearchField, SegmentedControl, cx, surface } from '../../../ui';
import { Panel, Pill } from '../parts';
import { FIELD } from '../settingsRows';
import { FlightPopup } from '../songs/FlightPopup';

import { Expandable } from './expand';
import {
  GATES,
  addPreacher,
  cleanName,
  findByName,
  removePreacher,
  setActivePreacher,
  stageOf,
  usePreachers,
  type Preacher,
  type PreacherRole,
  type ServicePoint,
  type TrainingStage,
} from './preachers';

/*
 * Preachers — the tile, the list it opens, and the profile the list opens.
 *
 * This is where the old PREACHERS tab went. The tile says who is preaching
 * today and how many the app knows, with an add button, because those are
 * the two things anyone reaches for before a service. Pressing it lifts the
 * list: search, add, pick today's preacher. Pressing a preacher in the list
 * flies their profile out of the row — stats and how far training has got.
 *
 * Every number here is SAMPLE DATA from ./preachers — see the note there.
 */

const MUTED = 'rgb(229 243 242 / 0.45)';
const INK_SOFT = 'rgb(229 243 242 / 0.82)';
const MINT = '#8fd3c0';
const GOLD = '#e4d87a';
const ROSE = '#eac7c6';
const RULE = 'inset 0 -1px 0 rgb(255 255 255 / 0.06)';

const pct = (v: number) => `${Math.round(v * 100)}%`;

const STAGE: Record<TrainingStage, { label: string; tone: 'quiet' | 'warn' | 'ok' | 'auto' }> = {
  new: { label: 'new', tone: 'quiet' },
  training: { label: 'training', tone: 'warn' },
  mature: { label: 'mature', tone: 'ok' },
  auto: { label: 'auto ready', tone: 'auto' },
};

export function StagePill({ p }: { p: Preacher }) {
  const s = STAGE[stageOf(p)];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

/* ------------------------------------------------------------------ */
/* Small parts                                                         */
/* ------------------------------------------------------------------ */

/* Tints for the initials. Muted versions of the palette the rest of the
   dashboard already speaks in — nothing a status colour could be read as. */
const TINTS = ['143 211 192', '228 216 122', '234 199 198', '176 184 236', '205 205 212'];
const TITLES = new Set(['pastor', 'pst', 'sis', 'sister', 'bro', 'brother', 'min', 'minister', 'rev', 'dr', 'evang', 'deacon', 'elder']);

function initials(name: string): string {
  const words = name.split(' ').filter(Boolean);
  const rest = words.filter((w) => !TITLES.has(w.toLowerCase().replace(/\./g, '')));
  const use = rest.length ? rest : words;
  return use
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function tintOf(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function Avatar({ p, size = 28, ring = false }: { p: Preacher; size?: number; ring?: boolean }) {
  const tint = tintOf(p.id);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        color: `rgb(${tint})`,
        background: `rgb(${tint} / 0.14)`,
        /* In a stack the ring is the tile's own ground, so overlapping
           circles read as separate people rather than one blob. */
        boxShadow: ring ? '0 0 0 2px rgb(20 20 22)' : undefined,
      }}
    >
      {initials(p.name)}
    </span>
  );
}

/** Trust against the auto-mode line, with the line drawn on the track. */
export function TrustBar({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cx('relative block h-[4px] rounded-full bg-white/[0.07]', className)}>
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: pct(Math.min(1, value)), background: value >= GATES.trust ? MINT : 'rgb(229 243 242 / 0.5)' }}
      />
      <span
        aria-hidden
        className="absolute -top-[2px] h-[8px] w-px"
        style={{ left: pct(GATES.trust), background: 'rgb(228 216 122 / 0.75)' }}
      />
    </span>
  );
}

/** A surface block with the same eyebrow every card on the dashboard has. */
function Block({ title, right, children, className }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section
      className={cx(surface({ tone: 'default', shape: 'panel', wide: true }), 'flex min-w-0 flex-col gap-3 px-4 py-3', className)}
      style={{ borderRadius: 12 }}
    >
      <header className="flex items-baseline justify-between gap-2">
        <span className="text-[calc(var(--tri-size-eyebrow)+1.5px)] font-semibold uppercase tracking-[0.16em] text-[rgb(229_243_242_/_0.85)]">
          {title}
        </span>
        {right}
      </header>
      {children}
    </section>
  );
}

/** Enter and Space press a div that stands in for a button. */
export function pressKeys(action: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };
}

/* ------------------------------------------------------------------ */
/* The tile                                                            */
/* ------------------------------------------------------------------ */

/*
 * One card, again.
 *
 * It was split in two for a moment — "preaching today" beside "everyone" —
 * and that was one division too many for what it holds. Today's preacher
 * and the roster are the same subject read at two distances, and neither
 * half had enough in it to earn its own header: the left card ran out of
 * content before it ran out of height, and the right one was mostly a
 * drawing. Back in one card they fill it, and the band's second cell is
 * left empty for whatever earns it.
 *
 * The orbit drawing is gone with the split. It placed every preacher on a
 * ring by how far along their training was, which is a real fact drawn
 * honestly — but at this size the rings read as an ornament rather than a
 * chart, and it was the largest thing on the card while saying the least.
 *
 * And then most of the words went too. The card had been answering the
 * whole question — services, verses caught, accuracy, a trust bar, the
 * percentage under it, the gate it was heading for, a tally of the roster
 * by stage. All true, all available one press away in the profile, and
 * together they turned a card you GLANCE at into one you have to read.
 * A bento tile's job is to say which card to open, not to save you from
 * opening it.
 *
 * So: who is preaching, and how well the app knows them. That is the
 * sentence in the blurb and now it is also the whole card — a name and a
 * stage pill. The numbers are not lost, they are behind the press, which
 * is the one thing every part of this card already does.
 */
function Face({
  preachers,
  active,
  onOpen,
  onAdd,
}: {
  preachers: Preacher[];
  active: Preacher | null;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const others = preachers.filter((p) => p.id !== active?.id);

  return (
    <Panel
      title="preachers"
      icon={<PersonIcon width={13} height={13} />}
      blurb="who is preaching today, and how well the app knows them."
      onOpen={onOpen}
      className="min-h-0 flex-1"
      right={
        <span className="text-[length:var(--tri-size-eyebrow)] lowercase tabular-nums" style={{ color: MUTED }}>
          {preachers.length} {preachers.length === 1 ? 'preacher' : 'preachers'}
        </span>
      }
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={pressKeys(onOpen)}
        aria-label="open the preachers list"
        className="flex h-full min-h-0 cursor-pointer flex-col gap-3 text-left outline-none"
      >
        {/* Today: who is on, and the one word for how far training has
            got. The top of the card, because during a service it is the
            only part of this anyone needs at a glance. */}
        {active ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar p={active} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-[var(--tri-ink)]">{active.name}</p>
              <p className="truncate text-[length:var(--tri-size-xs)] lowercase" style={{ color: MUTED }}>
                preaching today · {active.role}
              </p>
            </div>
            <StagePill p={active} />
          </div>
        ) : (
          <p className="text-[length:var(--tri-size-xs)] leading-relaxed lowercase" style={{ color: MUTED }}>
            nobody is set for today — open the list and pick who is preaching
          </p>
        )}

        {/* A rule, then everyone else. One card, two distances: the line is
            what the second header used to be. */}
        <div className="mt-auto border-t border-white/[0.07] pt-3">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="flex -space-x-2">
              {others.slice(0, 5).map((p) => (
                <Avatar key={p.id} p={p} size={26} ring />
              ))}
              {others.length > 5 && (
                <span
                  className="grid size-[26px] place-items-center rounded-full bg-white/[0.08] text-[10px] font-semibold tabular-nums"
                  style={{ color: INK_SOFT, boxShadow: '0 0 0 2px rgb(20 20 22)' }}
                >
                  +{others.length - 5}
                </span>
              )}
              {others.length === 0 && (
                <span className="text-[length:var(--tri-size-xs)] lowercase" style={{ color: MUTED }}>
                  nobody else yet
                </span>
              )}
            </span>
            {/* Its own press: the card opens either way, but this one opens
                it with the name field already waiting. */}
            <span className="shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <Button label="add preacher" icon={<PlusIcon size={11} />} onClick={onAdd} />
            </span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function PreachersTile({ className }: { className?: string }) {
  const { preachers, activeId } = usePreachers();
  const active = preachers.find((p) => p.id === activeId) ?? null;

  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [origin, setOrigin] = useState<HTMLElement | null>(null);

  /* Every open from the tile starts from nothing. The list can be closed
     while a profile is up (its ✕ is still reachable by keyboard under the
     profile's ground), and that unmounts the profile without ever telling
     it to close — so without this, the next open would bring the old
     profile back up unasked. The search goes the same way: a list that
     reopens filtered to one name, under a tile saying "5 preachers",
     reads as preachers having gone missing. */
  const startClean = () => {
    setProfileOpen(false);
    setProfileId(null);
    setOrigin(null);
    setQuery('');
  };

  const openProfile = (id: string, el: HTMLElement | null) => {
    setOrigin(el);
    setProfileId(id);
    setProfileOpen(true);
  };

  /* The profile keeps drawing the preacher it opened on while it flies home,
     even if that preacher was just removed — a box emptying mid-flight reads
     as a crash. */
  const lastProfile = useRef<Preacher | null>(null);
  const found = preachers.find((p) => p.id === profileId) ?? null;
  if (found) lastProfile.current = found;
  const profile = found ?? lastProfile.current;

  useEffect(() => {
    if (!justAdded) return;
    const t = window.setTimeout(() => setJustAdded(null), 1800);
    return () => window.clearTimeout(t);
  }, [justAdded]);

  return (
    <Expandable
      className={className}
      title="Preachers"
      glyph={false}
      ring={false}
      blurb="Everyone who preaches here, how well the app knows each of them, and who is preaching today."
      size={{ w: 780, h: 660 }}
      tile={({ onOpen }) => (
        <Face
          preachers={preachers}
          active={active}
          onOpen={() => {
            startClean();
            setAdding(false);
            onOpen();
          }}
          onAdd={() => {
            startClean();
            setAdding(true);
            onOpen();
          }}
        />
      )}
    >
      <PreacherList
        preachers={preachers}
        activeId={activeId}
        query={query}
        setQuery={setQuery}
        adding={adding}
        setAdding={setAdding}
        justAdded={justAdded}
        onAdded={(p) => {
          setAdding(false);
          setQuery('');
          setJustAdded(p.id);
        }}
        onOpenProfile={openProfile}
      />

      {/* On top of the open list: its own ground covers the list, and Esc
          closes this one first (see FlightPopup's layer). */}
      <FlightPopup
        open={profileOpen}
        origin={origin}
        layer={60}
        size={{ w: 880, h: 740 }}
        label={profile ? `${profile.name} — profile` : 'profile'}
        onRequestClose={() => setProfileOpen(false)}
        onClosed={() => setProfileId(null)}
        header={profile ? <ProfileHeader p={profile} active={profile.id === activeId} /> : null}
      >
        {profile && (
          <ProfileBody
            key={profile.id}
            p={profile}
            onRemove={() => {
              removePreacher(profile.id);
              setProfileOpen(false);
            }}
          />
        )}
      </FlightPopup>
    </Expandable>
  );
}

/* ------------------------------------------------------------------ */
/* The list                                                            */
/* ------------------------------------------------------------------ */

export function PreacherList({
  preachers,
  activeId,
  query,
  setQuery,
  adding,
  setAdding,
  justAdded,
  onAdded,
  onOpenProfile,
}: {
  preachers: Preacher[];
  activeId: string | null;
  query: string;
  setQuery: (q: string) => void;
  adding: boolean;
  setAdding: (a: boolean) => void;
  justAdded: string | null;
  onAdded: (p: Preacher) => void;
  onOpenProfile: (id: string, el: HTMLElement | null) => void;
}) {
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => (q ? preachers.filter((p) => p.name.toLowerCase().includes(q) || p.role.includes(q)) : preachers),
    [preachers, q],
  );
  const auto = preachers.filter((p) => stageOf(p) === 'auto').length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="search by name or role"
          className="flex-1"
          onSubmit={() => {
            /* Enter on a search that found exactly one person opens them;
               on one that found nobody, it offers to add them. */
            if (shown.length === 1) onOpenProfile(shown[0].id, null);
            else if (shown.length === 0 && q) setAdding(true);
          }}
        />
        <Button label={adding ? 'cancel' : 'add preacher'} icon={adding ? undefined : <PlusIcon size={11} />} onClick={() => setAdding(!adding)} />
      </div>

      {adding && (
        <AddRow
          /* Whatever was being searched for is the likeliest name. */
          initialName={shown.length === 0 ? cleanName(query) : ''}
          onAdded={onAdded}
          onCancel={() => setAdding(false)}
        />
      )}

      {shown.length > 0 ? (
        <ul className="flex flex-col">
          {shown.map((p, i) => (
            <PreacherRow
              key={p.id}
              p={p}
              active={p.id === activeId}
              last={i === shown.length - 1}
              fresh={p.id === justAdded}
              onOpen={onOpenProfile}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-2 px-1 py-6">
          <p className="text-[length:var(--tri-size)] lowercase" style={{ color: MUTED }}>
            {q ? <>nobody called “{query.trim()}” yet</> : 'no preachers yet'}
          </p>
          {!adding && (
            <Button
              label={q ? `add ${cleanName(query)}` : 'add the first one'}
              icon={<PlusIcon size={11} />}
              onClick={() => setAdding(true)}
            />
          )}
        </div>
      )}

      <p className="pt-1 text-[length:var(--tri-size-eyebrow)] lowercase tabular-nums" style={{ color: MUTED }}>
        {preachers.length} {preachers.length === 1 ? 'preacher' : 'preachers'}
        {auto > 0 && <> · {auto} ready for auto mode</>}
        {' · '}press anyone for their profile
      </p>
    </div>
  );
}

function AddRow({ initialName, onAdded, onCancel }: { initialName: string; onAdded: (p: Preacher) => void; onCancel: () => void }) {
  const [name, setName] = useState(initialName);
  const [role, setRole] = useState<PreacherRole>('pastor');
  /* The row may already be open when the search comes up empty; the name
     that was searched for is still the likeliest one. Only a real name is
     carried — a search that starts matching again must not wipe what was
     typed here. */
  useEffect(() => {
    if (initialName) setName(initialName);
  }, [initialName]);
  const clean = cleanName(name);
  const dupe = clean ? findByName(clean) : undefined;

  const submit = () => {
    if (!clean || dupe) return;
    const p = addPreacher(clean, role);
    if (p) onAdded(p);
  };

  return (
    <div
      className={cx(surface({ tone: 'default', shape: 'panel', wide: true }), 'flex flex-col gap-2 px-3 py-3')}
      style={{ borderRadius: 12 }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            /* Esc here cancels the add, not the whole list. */
            if (e.key === 'Escape') {
              e.stopPropagation();
              onCancel();
            }
          }}
          placeholder="their name — pastor dan, sis. grace…"
          aria-label="preacher's name"
          className={cx(FIELD, 'min-w-[220px] flex-1')}
        />
        <SegmentedControl
          size="sm"
          value={role}
          onChange={(r) => setRole(r)}
          options={[
            { id: 'pastor', label: 'pastor' },
            { id: 'minister', label: 'minister' },
            { id: 'guest', label: 'guest' },
          ]}
        />
        <Button label="add" onClick={submit} disabled={!clean || !!dupe} />
      </div>
      <p className="text-[length:var(--tri-size-eyebrow)] lowercase" style={{ color: dupe ? GOLD : MUTED }}>
        {dupe
          ? `${dupe.name} is already on the list`
          : 'they start at zero — the app learns them from their first service, and every correction you make trains it'}
      </p>
    </div>
  );
}

function PreacherRow({
  p,
  active,
  last,
  fresh,
  onOpen,
}: {
  p: Preacher;
  active: boolean;
  last: boolean;
  fresh: boolean;
  onOpen: (id: string, el: HTMLElement | null) => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const open = () => onOpen(p.id, ref.current);
  return (
    <li ref={ref} style={last ? undefined : { boxShadow: RULE }}>
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={pressKeys(open)}
        className={cx(
          'group/p flex cursor-pointer items-center gap-3 rounded-[12px] px-2.5 py-2.5 outline-none transition-colors',
          'hover:bg-white/[0.04] focus-visible:bg-white/[0.05]',
          fresh && 'bg-[rgb(143_211_192_/_0.08)]',
        )}
      >
        <Avatar p={p} size={34} />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[length:var(--tri-size)] font-semibold text-[var(--tri-ink)]">{p.name}</span>
            {active && <Pill tone="live">today</Pill>}
          </p>
          <p className="truncate text-[length:var(--tri-size-xs)] lowercase" style={{ color: MUTED }}>
            {p.role} · {p.services ? `${p.services} services · last ${p.lastPreached}` : 'not preached yet'}
          </p>
        </div>

        <div className="hidden w-[150px] shrink-0 flex-col gap-1.5 md:flex">
          <TrustBar value={p.trustLowerBound} />
          <span className="text-[length:var(--tri-size-eyebrow)] lowercase tabular-nums" style={{ color: MUTED }}>
            trust <span style={{ color: INK_SOFT }}>{p.services ? pct(p.trustLowerBound) : '—'}</span>
          </span>
        </div>

        <span className="w-[96px] shrink-0 whitespace-nowrap text-right">
          <StagePill p={p} />
        </span>

        {/* Setting today's preacher from the row, without opening them. On
            hover only: resting, the row is a name and where they stand. */}
        <span className="w-[104px] shrink-0 text-right" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {!active && (
            <button
              type="button"
              onClick={() => setActivePreacher(p.id)}
              className="rounded-full px-2.5 py-1 text-[length:var(--tri-size-xs)] lowercase opacity-0 transition-opacity hover:bg-white/[0.08] focus-visible:opacity-100 group-hover/p:opacity-100"
              style={{ color: INK_SOFT, boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.14)' }}
            >
              set for today
            </button>
          )}
        </span>

        <span aria-hidden className="shrink-0 text-[14px]" style={{ color: MUTED }}>
          ›
        </span>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* The profile                                                         */
/* ------------------------------------------------------------------ */

export function ProfileHeader({ p, active }: { p: Preacher; active: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3 pr-2">
      <Avatar p={p} size={44} />
      <div className="min-w-0 flex-1">
        <h2 className="flex min-w-0 items-center gap-2 text-[20px] font-semibold tracking-tight text-[var(--tri-ink)]">
          <span className="truncate">{p.name}</span>
          <StagePill p={p} />
          {active && <Pill tone="live">today</Pill>}
        </h2>
        <p className="mt-0.5 truncate text-[length:var(--tri-size-xs)] lowercase" style={{ color: MUTED }}>
          {p.role} · {p.services ? `preached ${p.services} ${p.services === 1 ? 'time' : 'times'} · last ${p.lastPreached}` : 'not preached yet'}
        </p>
      </div>
      {!active && <Button label="set for today" onClick={() => setActivePreacher(p.id)} className="shrink-0" />}
    </div>
  );
}

const STEPS: { id: TrainingStage; label: string; note: string }[] = [
  { id: 'new', label: 'new', note: 'no services yet' },
  { id: 'training', label: 'training', note: 'learning their voice' },
  { id: 'mature', label: 'mature', note: 'rarely corrected' },
  /* Eligible, not on: auto mode is its own switch, off by default, and a
     detection still stages to preview until someone turns it on. */
  { id: 'auto', label: 'auto ready', note: 'eligible — you switch it on' },
];

function Stepper({ stage }: { stage: TrainingStage }) {
  const at = STEPS.findIndex((s) => s.id === stage);
  return (
    <ol className="grid grid-cols-4 gap-2.5">
      {STEPS.map((s, i) => {
        const done = i < at;
        const here = i === at;
        return (
          <li key={s.id} className="flex min-w-0 flex-col gap-1.5">
            <span
              className="h-[3px] rounded-full"
              style={{ background: done || here ? MINT : 'rgb(255 255 255 / 0.08)', opacity: done ? 0.5 : 1 }}
            />
            <span
              className={cx('truncate text-[length:var(--tri-size)] lowercase', here && 'font-semibold')}
              style={{ color: here ? 'var(--tri-ink)' : done ? 'rgb(229 243 242 / 0.6)' : 'rgb(229 243 242 / 0.32)' }}
            >
              {s.label}
            </span>
            <span className="truncate text-[length:var(--tri-size-eyebrow)] lowercase" style={{ color: here ? MUTED : 'rgb(229 243 242 / 0.28)' }}>
              {s.note}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Gates({ p }: { p: Preacher }) {
  const rows = [
    { label: 'trust floor', now: p.trustLowerBound, need: GATES.trust, fmt: pct },
    { label: 'verified detections', now: p.samples, need: GATES.samples, fmt: (v: number) => String(v) },
    { label: 'services together', now: p.services, need: GATES.services, fmt: (v: number) => String(v) },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {rows.map((r) => {
        const met = r.now >= r.need;
        const frac = r.need ? Math.min(1, r.now / r.need) : 0;
        return (
          <div key={r.label} className="flex min-w-0 flex-col gap-1.5">
            <p className="flex items-baseline justify-between gap-2 text-[length:var(--tri-size-xs)] lowercase tabular-nums">
              <span className="truncate" style={{ color: MUTED }}>
                {met ? '● ' : '○ '}
                {r.label}
              </span>
              <span className="shrink-0" style={{ color: met ? MINT : INK_SOFT }}>
                {r.fmt(r.now)} <span style={{ color: MUTED }}>/ {r.fmt(r.need)}</span>
              </span>
            </p>
            <span className="block h-[4px] rounded-full bg-white/[0.06]">
              <span className="block h-full rounded-full" style={{ width: pct(frac), background: met ? MINT : GOLD }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Trust and accuracy across their services. Drawn in a stretched viewBox so
 * it fills whatever width the block has; the strokes keep their weight
 * (non-scaling-stroke) and the one dot is HTML so it stays round.
 */
function TrustChart({ history }: { history: ServicePoint[] }) {
  if (history.length < 2) {
    return (
      <p className="py-6 text-[length:var(--tri-size-xs)] lowercase leading-relaxed" style={{ color: MUTED }}>
        {history.length === 0 ? 'the chart starts after their first two services' : 'one service in — the line starts after the next'}
      </p>
    );
  }
  const n = history.length;
  const x = (i: number) => (i / (n - 1)) * 100;
  const y = (v: number) => 40 - v * 40;
  const line = (key: 'trust' | 'precision') =>
    history.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(2)} ${y(p[key]).toFixed(2)}`).join(' ');
  const last = history[n - 1];

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-3 text-[length:var(--tri-size-eyebrow)] lowercase" style={{ color: MUTED }}>
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-[10px] rounded" style={{ background: MINT }} /> trust
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-[10px] rounded bg-[rgb(229_243_242_/_0.4)]" /> accuracy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-[10px] rounded" style={{ background: GOLD }} /> auto at {pct(GATES.trust)}
        </span>
      </p>
      <div className="relative mr-1 h-[124px]">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <line x1={0} x2={100} y1={y(GATES.trust)} y2={y(GATES.trust)} stroke={GOLD} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <path d={`${line('trust')} L 100 40 L 0 40 Z`} fill="rgb(143 211 192 / 0.1)" />
          <path d={line('precision')} fill="none" stroke="rgb(229 243 242 / 0.35)" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          <path d={line('trust')} fill="none" stroke={MINT} strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        <span
          className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: '100%', top: `${(1 - last.trust) * 100}%`, background: MINT }}
        />
      </div>
      <p className="flex justify-between text-[length:var(--tri-size-eyebrow)] lowercase tabular-nums" style={{ color: MUTED }}>
        <span>{history[0].label}</span>
        <span>
          {last.label} · <span style={{ color: INK_SOFT }}>{pct(last.trust)}</span> trusted
        </span>
      </p>
    </div>
  );
}

function accuracyInk(v: number): string {
  return v >= 0.9 ? MINT : v >= 0.8 ? GOLD : ROSE;
}

export function ProfileBody({
  p,
  onRemove,
  children,
}: {
  p: Preacher;
  onRemove: () => void;
  /* Anything the caller wants under the report and above the footer. The
     tile's flown box passes nothing; the full-window profile passes the
     teaching panels (./Teaching). */
  children?: ReactNode;
}) {
  const [confirm, setConfirm] = useState(false);
  const none = p.services === 0;
  const stats: [string, string][] = [
    ['services', none ? '—' : String(p.services)],
    ['verses caught', none ? '—' : String(p.samples)],
    ['accuracy', none ? '—' : pct(p.precision)],
    ['trust floor', none ? '—' : pct(p.trustLowerBound)],
    ['fixed last time', none ? '—' : String(p.correctionsLastService)],
    ['avg sermon', p.avgSermonMin ? `${p.avgSermonMin} min` : '—'],
  ];
  const facts: [string, string][] = [
    ['most quoted', p.mostQuoted ?? '—'],
    ['top books', p.topBooks.length ? p.topBooks.join(', ') : '—'],
    ['sermon length', p.avgSermonMin ? `about ${p.avgSermonMin} min` : '—'],
    ['last preached', p.lastPreached ?? '—'],
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-6 gap-2">
          {stats.map(([label, value]) => (
            <div
              key={label}
              className={cx(surface({ tone: 'default', shape: 'panel', wide: true }), 'flex min-w-0 flex-col gap-1 px-3 py-2.5')}
              style={{ borderRadius: 10 }}
            >
              <span className="truncate text-[length:var(--tri-size-eyebrow)] lowercase" style={{ color: MUTED }}>
                {label}
              </span>
              <span className="truncate text-[20px] font-semibold leading-tight tabular-nums text-[var(--tri-ink)]">{value}</span>
            </div>
          ))}
        </div>

        <Block
          title="training progress"
          right={
            <span className="text-[length:var(--tri-size-eyebrow)] lowercase" style={{ color: MUTED }}>
              {stageOf(p) === 'auto'
                ? 'every gate met'
                : `${[p.trustLowerBound >= GATES.trust, p.samples >= GATES.samples, p.services >= GATES.services].filter(Boolean).length} of 3 gates met`}
            </span>
          }
        >
          <Stepper stage={stageOf(p)} />
          <Gates p={p} />
        </Block>

        <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3">
          <Block title="trust over services">
            <TrustChart history={p.history} />
          </Block>
          <Block title="habits">
            <dl className="flex flex-col gap-2">
              {facts.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 text-[length:var(--tri-size-xs)]">
                  <dt className="shrink-0 lowercase" style={{ color: MUTED }}>
                    {label}
                  </dt>
                  <dd className="truncate text-right font-semibold lowercase" style={{ color: INK_SOFT }}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Block>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Block
            title="recent services"
            right={
              <span className="text-[length:var(--tri-size-eyebrow)] uppercase tracking-[0.12em]" style={{ color: MUTED }}>
                verses · accuracy · length
              </span>
            }
          >
            {p.recent.length ? (
              <ul className="flex flex-col">
                {p.recent.map((r, i) => (
                  <li
                    key={r.date}
                    className="flex items-baseline justify-between gap-3 py-1.5 text-[length:var(--tri-size-xs)] tabular-nums"
                    style={i < p.recent.length - 1 ? { boxShadow: RULE } : undefined}
                  >
                    <span className="font-semibold lowercase text-[var(--tri-ink)]">{r.date}</span>
                    <span className="flex gap-3" style={{ color: MUTED }}>
                      <span>{r.verses}v</span>
                      <span style={{ color: accuracyInk(r.accuracy) }}>{pct(r.accuracy)}</span>
                      <span>{r.minutes} min</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[length:var(--tri-size-xs)] lowercase" style={{ color: MUTED }}>
                none yet
              </p>
            )}
          </Block>

          <Block
            title="misses to review"
            right={
              p.misses.length ? (
                <span className="text-[length:var(--tri-size-eyebrow)] lowercase tabular-nums" style={{ color: MUTED }}>
                  {p.misses.length}
                </span>
              ) : undefined
            }
          >
            {p.misses.length ? (
              <ul className="flex flex-col gap-2">
                {p.misses.map((m) => (
                  <li key={`${m.date}-${m.heard}`} className="flex min-w-0 flex-col gap-0.5 text-[length:var(--tri-size-xs)]">
                    <span className="truncate" style={{ color: INK_SOFT }}>
                      “{m.heard}”
                    </span>
                    {/* Not lowercased: these are references, and "1 John" is
                        a book name, not a caption. */}
                    <span className="truncate" style={{ color: MUTED }}>
                      caught <span style={{ color: ROSE }}>{m.caught}</span> → meant <span style={{ color: MINT }}>{m.meant}</span> · {m.date}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[length:var(--tri-size-xs)] lowercase" style={{ color: MUTED }}>
                {none ? 'nothing yet' : 'nothing to review — the app got every one right'}
              </p>
            )}
          </Block>
        </div>

        {children}

        <footer className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[length:var(--tri-size-eyebrow)] lowercase" style={{ color: 'rgb(229 243 242 / 0.3)' }}>
            sample numbers — the engine’s own replace these once profiles are wired
          </p>
          {confirm ? (
            <span className="flex shrink-0 items-center gap-3 text-[length:var(--tri-size-xs)] lowercase">
              <span style={{ color: MUTED }}>remove {p.name}?</span>
              <button type="button" onClick={onRemove} className="font-semibold hover:underline" style={{ color: ROSE }}>
                remove
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="hover:underline" style={{ color: INK_SOFT }}>
                keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="shrink-0 text-[length:var(--tri-size-xs)] lowercase hover:underline"
              style={{ color: MUTED }}
            >
              remove preacher
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
