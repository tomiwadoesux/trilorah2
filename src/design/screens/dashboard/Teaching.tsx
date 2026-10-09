import { useState, type KeyboardEvent } from 'react';
import { cx, surface, PlusIcon, CloseIcon } from '../../../ui';
import { FIELD, Toggle } from '../settingsRows';
import type { Preacher, SoundsLike } from './preachers';
import type { PreacherTeaching } from '../../../../shared/preacherLearning';

/*
 * What the operator can TEACH a preacher's profile.
 *
 * The profile until now was a report card — trust, accuracy, gates, charts.
 * All of it reading, none of it doing, which left the operator watching a
 * number go down with no way to act on it. These three panels are the other
 * half: the places a person puts knowledge INTO the engine, all of them
 * already real (electron/preachers/vocabulary.ts, correctionLedger.ts's
 * alias table, and `ignoreTails` in engine/commandConfig.ts).
 *
 *   sounds like   "rawmeans" is Romans. The recogniser is CONSISTENT about
 *                 what it gets wrong, so one row fixes every Sunday after.
 *   vocabulary    names and church words to boost — the ASR is given these
 *                 as hints before it listens, not corrected after.
 *   ignored tails words this preacher habitually adds after a reference
 *                 ("amen", "are you with me") so they stop being read as
 *                 part of it.
 *
 * Why they are separate panels rather than one settings list: they act at
 * three different moments — before the mic hears (vocabulary), as the words
 * arrive (sounds like), and after the reference is parsed (tails) — and an
 * operator who is guessing which one to use will put a name in the wrong
 * box. The panel's own sentence says when it applies.
 */

const MUTED = 'rgb(229 243 242 / 0.45)';
const INK_SOFT = 'rgb(229 243 242 / 0.82)';
const MINT = '#8fd3c0';
const RULE = 'inset 0 -1px 0 rgb(255 255 255 / 0.06)';

function Panel({
  title,
  blurb,
  right,
  children,
  className,
}: {
  title: string;
  blurb: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(surface({ tone: 'default', shape: 'panel', wide: true }), 'flex min-w-0 flex-col gap-2.5 px-4 py-3', className)}
      style={{ borderRadius: 6 }}
    >
      <header className="flex items-center justify-between gap-2">
        <span className="text-[calc(var(--tri-size-eyebrow)+1.5px)] font-semibold uppercase tracking-[0.16em] text-[rgb(229_243_242_/_0.85)]">
          {title}
        </span>
        {right}
      </header>
      {/* The sentence is part of the control, not decoration: it is the
          only thing that tells these three panels apart. */}
      <p className="text-[length:var(--tri-size-eyebrow)] lowercase leading-relaxed" style={{ color: MUTED }}>
        {blurb}
      </p>
      {children}
    </section>
  );
}

/** A one-line add box. Enter commits, Escape clears. */
function AddLine({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [value, setValue] = useState('');
  const commit = () => {
    const v = value.trim();
    if (!v) return;
    onAdd(v);
    setValue('');
  };
  return (
    <div className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setValue('');
        }}
        placeholder={placeholder}
        className={cx(FIELD, 'min-w-0 flex-1 text-[length:var(--tri-size-xs)]')}
      />
      <button
        type="button"
        onClick={commit}
        disabled={!value.trim()}
        aria-label="add"
        className="grid size-[26px] shrink-0 place-items-center rounded-[5px] transition-colors hover:bg-white/[0.08] disabled:opacity-30"
        style={{ color: MUTED, boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.12)' }}
      >
        <PlusIcon size={12} />
      </button>
    </div>
  );
}

/** A removable word. The × only appears under the pointer. */
function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="group/chip inline-flex max-w-full items-center gap-1 rounded-md py-[3px] pl-2.5 pr-1.5 text-[length:var(--tri-size-xs)]"
      style={{ color: INK_SOFT, boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.12)' }}
    >
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`remove ${label}`}
        className="grid size-[14px] shrink-0 place-items-center rounded-full opacity-0 transition-opacity hover:bg-white/[0.12] focus-visible:opacity-100 group-hover/chip:opacity-100"
        style={{ color: MUTED }}
      >
        <CloseIcon size={10} />
      </button>
    </span>
  );
}

/*
 * "sounds like" — the alias table, as a sentence rather than a form.
 *
 * Each row reads left to right the way the fix works: what came out of the
 * recogniser, an arrow, what it means. The heard side is set in the app's
 * mono so it reads as a machine's output rather than as a word someone
 * chose — it is usually not a real word at all ("rawmeans", "thessa
 * loanians"), and setting it in the same face as the meaning made the two
 * look like alternatives rather than a mistake and its correction.
 *
 * The hit count is the reassurance that an entry is earning its place, and
 * it is what makes the LEARNED ones legible: an alias the app invented is
 * worth trusting exactly as far as the number of times it has fired.
 */
function SoundsLikeRow({ row, onRemove }: { row: SoundsLike; onRemove: () => void }) {
  return (
    <li className="group/row flex items-center gap-2 py-1.5" style={{ boxShadow: RULE }}>
      <span
        className="min-w-0 max-w-[45%] shrink truncate font-mono text-[length:var(--tri-size-xs)]"
        style={{ color: MUTED }}
        title={row.heard}
      >
        {row.heard}
      </span>
      <span aria-hidden className="shrink-0 text-[10px]" style={{ color: 'rgb(229 243 242 / 0.28)' }}>
        →
      </span>
      <span className="min-w-0 flex-1 truncate text-[length:var(--tri-size-xs)] font-semibold" style={{ color: INK_SOFT }}>
        {row.means}
      </span>

      {/* Learned entries say so; taught ones need no label — the absence of
          a mark is "a person put this here", which is the default reading
          of anything in a list you can type into. */}
      {row.source === 'learned' && (
        <span
          className="shrink-0 rounded-md px-1.5 py-px text-[length:var(--tri-size-eyebrow)] lowercase"
          style={{ color: MINT, background: 'rgb(143 211 192 / 0.12)' }}
          title="the app worked this out from a correction"
        >
          learned
        </span>
      )}
      <span className="w-[42px] shrink-0 text-right text-[length:var(--tri-size-eyebrow)] tabular-nums" style={{ color: MUTED }}>
        {row.hits ? `${row.hits}×` : '—'}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`forget ${row.heard}`}
        className="grid size-[18px] shrink-0 place-items-center rounded-full opacity-0 transition-opacity hover:bg-white/[0.12] focus-visible:opacity-100 group-hover/row:opacity-100"
        style={{ color: MUTED }}
      >
        <CloseIcon size={12} />
      </button>
    </li>
  );
}

export function TeachingPanels({
  p,
  onChange,
}: {
  p: Preacher;
  onChange: (patch: Partial<PreacherTeaching>) => void;
}) {
  const [heard, setHeard] = useState('');
  const [means, setMeans] = useState('');

  const addAlias = () => {
    const h = heard.trim();
    const m = means.trim();
    if (!h || !m) return;
    onChange({ soundsLike: [{ heard: h, means: m, source: 'taught', hits: 0 }, ...p.soundsLike] });
    setHeard('');
    setMeans('');
  };

  const learned = p.soundsLike.filter((r) => r.source === 'learned').length;

  const voiceOn = p.voiceCommands !== false;

  return (
    <div className="flex flex-col gap-3">
      {/* Voice commands, for this preacher only.

          The app-wide switch is on the dashboard tile, because that is the
          one an operator stabs at when a command misfires mid-sermon. This
          one is the considered version: a guest who says "go on" every
          other sentence, or a pastor who never uses commands at all, set
          once before they preach and left alone. Two switches, two
          moments — so each says plainly what it covers. */}
      <Panel
        title="voice commands"
        blurb={
          voiceOn
            ? 'On for this preacher. What they say can move the screen — the phrases live on the dashboard.'
            : 'Off for this preacher. The app still listens for scripture; it just ignores their commands.'
        }
        right={<Toggle on={voiceOn} onChange={(next) => onChange({ voiceCommands: next })} />}
      />
      <Panel
        title="sounds like"
        blurb="a misheard book name and its correct Bible book. applied when followed by a chapter or number, so ordinary speech is left alone."
        right={
          <span className="text-[length:var(--tri-size-eyebrow)] lowercase tabular-nums" style={{ color: MUTED }}>
            {p.soundsLike.length} · <span style={{ color: MINT }}>{learned} learned</span>
          </span>
        }
      >
        {/* Two fields, because a row is two facts. One field with an arrow
            in it would have to be parsed, and the first operator to type a
            hyphen instead would get a silent no-op. */}
        <div className="flex items-center gap-1.5">
          <input
            value={heard}
            onChange={(e) => setHeard(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && addAlias()}
            placeholder="rawmeans"
            className={cx(FIELD, 'min-w-0 flex-1 font-mono text-[length:var(--tri-size-xs)]')}
          />
          <span aria-hidden className="shrink-0 text-[10px]" style={{ color: 'rgb(229 243 242 / 0.28)' }}>
            →
          </span>
          <input
            value={means}
            onChange={(e) => setMeans(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && addAlias()}
            placeholder="Romans"
            className={cx(FIELD, 'min-w-0 flex-1 text-[length:var(--tri-size-xs)]')}
          />
          <button
            type="button"
            onClick={addAlias}
            disabled={!heard.trim() || !means.trim()}
            aria-label="add"
            className="grid size-[26px] shrink-0 place-items-center rounded-[5px] transition-colors hover:bg-white/[0.08] disabled:opacity-30"
            style={{ color: MUTED, boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.12)' }}
          >
            <PlusIcon size={12} />
          </button>
        </div>

        {p.soundsLike.length ? (
          <ul className="flex max-h-[168px] flex-col overflow-y-auto">
            {p.soundsLike.map((row) => (
              <SoundsLikeRow
                key={`${row.heard}-${row.means}`}
                row={row}
                onRemove={() => onChange({ soundsLike: p.soundsLike.filter((r) => r !== row) })}
              />
            ))}
          </ul>
        ) : (
          <p className="py-1 text-[length:var(--tri-size-xs)] lowercase" style={{ color: MUTED }}>
            no book-name corrections yet — add a verified example here
          </p>
        )}
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        <Panel
          title="their words"
          blurb="names and church words used for local transcript matching. online speech can also use them as vocabulary hints."
        >
          <AddLine
            placeholder="a name, a place, a word"
            onAdd={(v) => !p.vocabulary.includes(v) && onChange({ vocabulary: [...p.vocabulary, v] })}
          />
          {p.vocabulary.length ? (
            <div className="flex flex-wrap gap-1.5">
              {p.vocabulary.map((t) => (
                <Chip key={t} label={t} onRemove={() => onChange({ vocabulary: p.vocabulary.filter((x) => x !== t) })} />
              ))}
            </div>
          ) : (
            <p className="text-[length:var(--tri-size-xs)] lowercase" style={{ color: MUTED }}>
              nothing yet
            </p>
          )}
        </Panel>

        <Panel
          title="ignored after a verse"
          blurb="what they habitually say straight after a reference. dropped from the tail so it is not read as part of the verse."
        >
          <AddLine
            placeholder="amen, say it with me"
            onAdd={(v) => !p.ignoreTails.includes(v) && onChange({ ignoreTails: [...p.ignoreTails, v] })}
          />
          {p.ignoreTails.length ? (
            <div className="flex flex-wrap gap-1.5">
              {p.ignoreTails.map((t) => (
                <Chip key={t} label={t} onRemove={() => onChange({ ignoreTails: p.ignoreTails.filter((x) => x !== t) })} />
              ))}
            </div>
          ) : (
            <p className="text-[length:var(--tri-size-xs)] lowercase" style={{ color: MUTED }}>
              nothing yet
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
