import { useState, type ReactNode } from 'react';
import { cx, Button, Select, Slider, SegmentedControl } from '../../ui';
import { Dot } from './parts';

/*
 * One settings row, drawn once.
 *
 * S-10's pages and the dashboard's expanding tiles show the same settings —
 * the companion tile opens onto the companion settings, the giving tile onto
 * the giving fields — so the row is a module both import rather than a
 * shape each redraws. A setting that looks different on the dashboard than
 * in Settings is a setting the operator has to learn twice.
 *
 * The format is the owner's Preacher-AI mock: a name, one sentence saying
 * what the thing does in the church's own words, and the control on the
 * right. `key` is the real settings.ts key, so wiring is save(key, value)
 * per row and nothing else moves.
 */

export interface DeepgramKey {
  id: string;
  /** What the church called it — "main", "backup", "pastor sam's". */
  name: string;
  /** The first three characters, kept so two keys can be told apart. */
  prefix: string;
  active: boolean;
}

export interface DisplayInfo {
  id: string;
  name: string;
  w: number;
  h: number;
  role: 'projector' | 'stream' | 'stage' | null;
  /** The display the app itself is on — it cannot also be the projector. */
  isOperator?: boolean;
}

export interface FontFace {
  id: string;
  family: string;
  /** The CSS stack, with the fallback that is closest in colour. */
  stack: string;
  kind: 'serif' | 'sans';
}

export type Row =
  | { kind: 'toggle'; key: string; label: string; blurb: string; value: boolean; advanced?: boolean; when?: [string, unknown] }
  | { kind: 'number'; key: string; label: string; blurb: string; value: number; unit?: string; advanced?: boolean; when?: [string, unknown] }
  | { kind: 'percent'; key: string; label: string; blurb: string; value: number; advanced?: boolean; when?: [string, unknown] }
  | { kind: 'slider'; key: string; label: string; blurb: string; value: number; min: number; max: number; step?: number; unit?: string; advanced?: boolean; when?: [string, unknown] }
  | { kind: 'text'; key: string; label: string; blurb: string; value: string; placeholder?: string; advanced?: boolean; when?: [string, unknown] }
  | { kind: 'secret'; key: string; label: string; blurb: string; set: boolean; advanced?: boolean; when?: [string, unknown] }
  | { kind: 'select'; key: string; label: string; blurb: string; value: string; options: string[]; advanced?: boolean; when?: [string, unknown] }
  | { kind: 'segment'; key: string; label: string; blurb: string; value: string; options: string[]; advanced?: boolean; when?: [string, unknown] }
  | { kind: 'action'; key: string; label: string; blurb: string; button: string; tone?: 'default' | 'danger'; note?: string; advanced?: boolean; when?: [string, unknown] }
  | { kind: 'status'; key: string; label: string; blurb: string; state: 'ok' | 'warn' | 'danger' | 'idle'; text: string; advanced?: boolean; when?: [string, unknown] }
  | { kind: 'keys'; key: string; label: string; blurb: string; keys: DeepgramKey[]; advanced?: boolean; when?: [string, unknown] }
  | { kind: 'displays'; key: string; label: string; blurb: string; displays: DisplayInfo[]; advanced?: boolean; when?: [string, unknown] }
  | { kind: 'fonts'; key: string; label: string; blurb: string; value: string; faces: FontFace[]; advanced?: boolean; when?: [string, unknown] }
  | { kind: 'note'; key: string; text: string; advanced?: boolean; when?: [string, unknown] };

/** Rows with a `value` seed the page's local state. */
export function seedValues(rows: Row[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) if ('value' in row) out[row.key] = row.value;
  return out;
}

/** A row's `when` gate: [key, value] the row waits for. */
export function rowVisible(row: Row, values: Record<string, unknown>): boolean {
  return !row.when || values[row.when[0]] === row.when[1];
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

/*
 * The switch, drawn here. The system has no toggle primitive yet (C-19 is
 * still a baseline sheet); this is what one will have to be. Two states,
 * one thumb that travels, the on colour is the system's own mint.
 */
export function Toggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cx(
        'relative h-[20px] w-[36px] shrink-0 rounded-full transition-colors duration-[var(--tri-dur-state)]',
        on ? 'bg-[rgb(143_211_192_/_0.55)]' : 'bg-[rgb(255_255_255_/_0.1)]',
      )}
      style={{ boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.08)' }}
    >
      <span
        aria-hidden
        className="absolute top-[3px] size-[14px] rounded-full bg-[var(--tri-ink)] transition-[left] duration-[var(--tri-dur-state)] ease-[var(--tri-ease-out)]"
        style={{ left: on ? 19 : 3 }}
      />
    </button>
  );
}

export const FIELD = cx(
  'tri-rounded-control h-[var(--tri-field-h-sm)] bg-[rgb(0_0_0_/_0.2)] px-3 text-[length:var(--tri-size)] text-[var(--tri-ink)] outline-none',
  'placeholder:text-[rgb(229_243_242_/_0.28)] focus:bg-[rgb(0_0_0_/_0.28)]',
);

const MUTED = 'rgb(229 243 242 / 0.45)';

function Secret({ set }: { set: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cx(FIELD, 'flex w-[220px] items-center gap-2 tabular-nums text-[rgb(229_243_242_/_0.35)]')}>
        <span aria-hidden className="text-[10px]">🔒</span>
        <span className="tracking-[0.2em]">{set ? '••••••••••••••••••' : ''}</span>
        {!set && <span className="text-[rgb(229_243_242_/_0.28)]">not set</span>}
      </div>
      <Button label={set ? 'reveal' : 'add'} className="shrink-0" />
    </div>
  );
}

function StatusLine({ state, text }: { state: 'ok' | 'warn' | 'danger' | 'idle'; text: string }) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap text-[length:var(--tri-size-xs)] text-[rgb(229_243_242_/_0.72)]">
      <Dot tone={state} />
      {text}
    </span>
  );
}

/*
 * More than one Deepgram key, and a padlock on every one of them.
 *
 * A church adds a key once and never sees it again: it shows as its first
 * three characters and a run of dots, and revealing it asks for the
 * password that was set when it was added. Switching the speech engine to
 * whisper and back does not touch the list — the keys are the church's,
 * not the engine's. The active one is a radio, not a select, because at
 * two or three keys the alternatives should be visible without opening
 * anything.
 */
function KeyList({ keys }: { keys: DeepgramKey[] }) {
  const [active, setActive] = useState(keys.find((k) => k.active)?.id ?? keys[0]?.id);
  return (
    <div className="flex w-[340px] flex-col gap-1.5">
      {keys.map((k) => {
        const on = k.id === active;
        return (
          <div
            key={k.id}
            className={cx(
              'tri-rounded-control flex items-center gap-2.5 px-2.5 py-[6px]',
              on ? 'bg-[rgb(143_211_192_/_0.08)]' : 'bg-[rgb(0_0_0_/_0.16)]',
            )}
            style={{ boxShadow: on ? 'inset 0 0 0 1px rgb(143 211 192 / 0.35)' : 'inset 0 0 0 1px rgb(255 255 255 / 0.06)' }}
          >
            <button
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setActive(k.id)}
              title={`use ${k.name}`}
              className="grid size-[14px] shrink-0 place-items-center rounded-full"
              style={{ boxShadow: `inset 0 0 0 1px ${on ? '#8fd3c0' : 'rgb(229 243 242 / 0.3)'}` }}
            >
              {on && <span className="size-[6px] rounded-full bg-[#8fd3c0]" />}
            </button>
            <span className="min-w-0 flex-1 truncate text-[length:var(--tri-size-xs)] text-[var(--tri-ink)]">{k.name}</span>
            <span className="shrink-0 font-mono text-[length:var(--tri-size-xs)] tabular-nums tracking-[0.1em] text-[rgb(229_243_242_/_0.4)]">
              {k.prefix}••••••••
            </span>
            <button
              type="button"
              title="reveal — asks for the password set when this key was added"
              className="shrink-0 text-[length:var(--tri-size-eyebrow)] lowercase text-[rgb(229_243_242_/_0.4)] transition-colors hover:text-[rgb(229_243_242_/_0.75)]"
            >
              reveal
            </button>
          </div>
        );
      })}
      <div className="flex justify-end pt-0.5">
        <Button label="add a key" />
      </div>
    </div>
  );
}

/*
 * The displays as they sit on the desk: one rectangle per screen, in the
 * screen's own aspect, its name beneath and its job on it. A list of three
 * "display 2 · 1920 × 1080" lines makes the operator do the geometry in
 * their head; two boxes side by side, one of them lit, is the answer.
 */
function DisplayMap({ displays }: { displays: DisplayInfo[] }) {
  const ROLE_INK: Record<NonNullable<DisplayInfo['role']>, string> = {
    projector: '#8fd3c0',
    stream: '#e4d87a',
    stage: 'rgb(229 243 242 / 0.7)',
  };
  return (
    <div className="flex flex-wrap items-end gap-4">
      {displays.map((d) => {
        const w = 132;
        const h = Math.round((w * d.h) / d.w);
        const ink = d.role ? ROLE_INK[d.role] : 'rgb(229 243 242 / 0.3)';
        return (
          <button key={d.id} type="button" className="group flex flex-col items-center gap-1.5">
            <span
              className="tri-rounded-control relative flex items-center justify-center overflow-hidden bg-[rgb(0_0_0_/_0.25)] transition-colors group-hover:bg-[rgb(0_0_0_/_0.35)]"
              style={{ width: w, height: h, boxShadow: `inset 0 0 0 1.5px ${d.role ? ink : 'rgb(255 255 255 / 0.1)'}` }}
            >
              <span className="text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em]" style={{ color: ink }}>
                {d.isOperator ? 'this screen' : d.role ?? 'unused'}
              </span>
            </span>
            <span className="text-[length:var(--tri-size-xs)] text-[var(--tri-ink)]">{d.name}</span>
            <span className="-mt-1 text-[length:var(--tri-size-eyebrow)] tabular-nums" style={{ color: MUTED }}>
              {d.w} × {d.h}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/*
 * Scripture's typeface. Serif or sans is the church's decision — the themes
 * tab lets them pick either per theme — and THIS is where they say which
 * serif and which sans. Six of each, all Google-hosted, all chosen for the
 * back row rather than the screenshot: open counters, a real bold, and
 * nothing that needs a large size to be legible.
 */
function FontChooser({ value, faces, onChange }: { value: string; faces: FontFace[]; onChange: (next: string) => void }) {
  const [kind, setKind] = useState<'serif' | 'sans'>(faces.find((f) => f.id === value)?.kind ?? 'serif');
  const shown = faces.filter((f) => f.kind === kind);
  return (
    <div className="flex w-[420px] flex-col gap-3">
      <SegmentedControl
        size="sm"
        value={kind}
        options={[
          { id: 'serif', label: 'serif' },
          { id: 'sans', label: 'sans serif' },
        ]}
        onChange={(k) => setKind(k as 'serif' | 'sans')}
        className="w-[200px] self-end"
      />
      <div className="grid grid-cols-3 gap-2">
        {shown.map((f) => {
          const on = f.id === value;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange(f.id)}
              className={cx(
                'tri-rounded-control flex flex-col items-start gap-1 px-3 pb-2 pt-2.5 text-left transition-colors',
                on ? 'bg-[rgb(143_211_192_/_0.08)]' : 'bg-[rgb(0_0_0_/_0.16)] hover:bg-[rgb(0_0_0_/_0.24)]',
              )}
              style={{ boxShadow: on ? 'inset 0 0 0 1px rgb(143 211 192 / 0.4)' : 'inset 0 0 0 1px rgb(255 255 255 / 0.06)' }}
            >
              <span className="text-[22px] leading-none text-[var(--tri-ink)]" style={{ fontFamily: f.stack, fontWeight: 600 }}>
                Aa
              </span>
              <span className="truncate text-[length:var(--tri-size-eyebrow)]" style={{ color: on ? '#8fd3c0' : MUTED }}>
                {f.family}
              </span>
            </button>
          );
        })}
      </div>
      {/* The proof: a verse, in the face, at something like projector
          proportion. The card's "Aa" says the letterforms; this says the
          line. */}
      {(() => {
        const face = faces.find((f) => f.id === value);
        return face ? (
          <p className="text-[15px] leading-[1.4] text-[rgb(229_243_242_/_0.8)]" style={{ fontFamily: face.stack, fontWeight: 600 }}>
            For God so loved the world, that he gave his only begotten Son.
          </p>
        ) : null;
      })()}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The row                                                             */
/* ------------------------------------------------------------------ */

/* Name and sentence on the left, the control right-aligned. The control
   column has a floor width so the left column's ragged edge stays put as
   you scroll — a settings page you scan is a column of names, and a name
   that jumps sideways because the switch beside it got wider is a name you
   have to re-find. Wide controls (the key list, the display map, the font
   chooser) drop under the text instead: they are the row's content, not a
   control beside it. */
export function SettingRow({ row, value, onChange }: { row: Row; value: unknown; onChange: (next: unknown) => void }) {
  if (row.kind === 'note') {
    return (
      <p className="max-w-[560px] py-2 text-[length:var(--tri-size-xs)] leading-relaxed" style={{ color: MUTED }}>
        {row.text}
      </p>
    );
  }

  let control: ReactNode;
  let wide = false;
  switch (row.kind) {
    case 'toggle':
      control = <Toggle on={Boolean(value)} onChange={onChange} />;
      break;
    case 'number':
      control = (
        <span className="flex items-baseline gap-1.5">
          <input className={cx(FIELD, 'w-[88px] text-right tabular-nums')} inputMode="numeric" value={String(value)} onChange={(e) => onChange(Number(e.target.value) || 0)} />
          {row.unit && <span className="text-[length:var(--tri-size-eyebrow)] text-[rgb(229_243_242_/_0.4)]">{row.unit}</span>}
        </span>
      );
      break;
    case 'percent':
      control = (
        <span className="flex items-baseline gap-1.5">
          <input className={cx(FIELD, 'w-[64px] text-right tabular-nums')} inputMode="numeric" value={String(Math.round(Number(value) * 100))} onChange={(e) => onChange((Number(e.target.value) || 0) / 100)} />
          <span className="text-[length:var(--tri-size-eyebrow)] text-[rgb(229_243_242_/_0.4)]">%</span>
        </span>
      );
      break;
    case 'slider':
      control = (
        <span className="flex w-[280px] items-center gap-3">
          <Slider value={Number(value)} onChange={onChange} min={row.min} max={row.max} step={row.step} ticks={5} className="flex-1" />
          <span className="w-[40px] shrink-0 text-right tabular-nums text-[length:var(--tri-size)] text-[var(--tri-ink)]">
            {String(value)}
            <span className="text-[length:var(--tri-size-eyebrow)] text-[rgb(229_243_242_/_0.4)]">{row.unit}</span>
          </span>
        </span>
      );
      break;
    case 'text':
      control = <input className={cx(FIELD, 'w-[280px]')} value={String(value)} placeholder={row.placeholder} spellCheck={false} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'secret':
      control = <Secret set={row.set} />;
      break;
    case 'select':
      control = <Select value={String(value)} options={row.options.map((o) => ({ value: o, label: o }))} onChange={onChange} className="w-[200px]" />;
      break;
    case 'segment':
      control = <SegmentedControl size="sm" value={String(value)} options={row.options.map((o) => ({ id: o, label: o }))} onChange={onChange} className="w-[260px]" />;
      break;
    case 'action':
      control = (
        <span className="flex items-center gap-3">
          {row.note && <span className="whitespace-nowrap text-[length:var(--tri-size-xs)]" style={{ color: MUTED }}>{row.note}</span>}
          <Button label={row.button} tone={row.tone} />
        </span>
      );
      break;
    case 'status':
      control = <StatusLine state={row.state} text={row.text} />;
      break;
    case 'keys':
      control = <KeyList keys={row.keys} />;
      wide = true;
      break;
    case 'displays':
      control = <DisplayMap displays={row.displays} />;
      wide = true;
      break;
    case 'fonts':
      control = <FontChooser value={String(value)} faces={row.faces} onChange={onChange} />;
      wide = true;
      break;
  }

  return (
    <div className={cx('py-4', wide ? 'flex flex-col gap-4' : 'flex items-center gap-8')} style={{ boxShadow: 'inset 0 -1px 0 rgb(255 255 255 / 0.06)' }}>
      <div className="min-w-0 flex-1">
        <div className="text-[length:var(--tri-size)] font-semibold text-[var(--tri-ink)]">{row.label}</div>
        {row.blurb && (
          <p className="mt-1 max-w-[520px] text-[length:var(--tri-size-xs)] leading-relaxed text-[rgb(229_243_242_/_0.5)]">{row.blurb}</p>
        )}
      </div>
      <div className={cx('flex', wide ? 'justify-start' : 'shrink-0 justify-end')} style={wide ? undefined : { minWidth: 120 }}>
        {control}
      </div>
    </div>
  );
}

/** A run of rows with local state — what a page and an expanded tile share. */
export function RowList({ rows, className }: { rows: Row[]; className?: string }) {
  const [values, setValues] = useState<Record<string, unknown>>(() => seedValues(rows));
  const set = (key: string) => (next: unknown) => setValues((v) => ({ ...v, [key]: next }));
  return (
    <div className={className}>
      {rows.filter((r) => rowVisible(r, values)).map((row) => (
        <SettingRow key={row.key} row={row} value={values[row.key]} onChange={set(row.key)} />
      ))}
    </div>
  );
}

/* The curated faces, shared by Settings and anything that previews them. */
export const SCRIPTURE_FACES: FontFace[] = [
  { id: 'cormorant', family: 'Cormorant Garamond', stack: '"Cormorant Garamond", Georgia, serif', kind: 'serif' },
  { id: 'eb-garamond', family: 'EB Garamond', stack: '"EB Garamond", Georgia, serif', kind: 'serif' },
  { id: 'playfair', family: 'Playfair Display', stack: '"Playfair Display", Georgia, serif', kind: 'serif' },
  { id: 'baskerville', family: 'Libre Baskerville', stack: '"Libre Baskerville", Georgia, serif', kind: 'serif' },
  { id: 'fraunces', family: 'Fraunces', stack: '"Fraunces", Georgia, serif', kind: 'serif' },
  { id: 'newsreader', family: 'Newsreader', stack: '"Newsreader", Georgia, serif', kind: 'serif' },
  { id: 'inter', family: 'Inter', stack: '"Inter", system-ui, sans-serif', kind: 'sans' },
  { id: 'manrope', family: 'Manrope', stack: '"Manrope", system-ui, sans-serif', kind: 'sans' },
  { id: 'dm-sans', family: 'DM Sans', stack: '"DM Sans", system-ui, sans-serif', kind: 'sans' },
  { id: 'outfit', family: 'Outfit', stack: '"Outfit", system-ui, sans-serif', kind: 'sans' },
  { id: 'jakarta', family: 'Plus Jakarta Sans', stack: '"Plus Jakarta Sans", system-ui, sans-serif', kind: 'sans' },
  { id: 'figtree', family: 'Figtree', stack: '"Figtree", system-ui, sans-serif', kind: 'sans' },
];
