import { cx, surface } from '../../../ui';
import { Panel, Dot } from '../parts';

/*
 * Readiness — the one question asked twenty minutes before a service, by
 * someone who is not going to read five rows to find the answer: is this
 * machine going to embarrass us in front of three hundred people?
 *
 * So the tile answers it once, at display scale, and then stops. On a normal
 * Sunday every check passes and listing all five would be five lines saying
 * the same word — a wall of "ok" is not reassurance, it is homework, and the
 * eye has to audit it to learn nothing. The passing state is therefore
 * collapsed to a verdict and a single muted line naming what was actually
 * checked, which is the proof that the verdict was earned rather than
 * assumed.
 *
 * The failing state spends everything it saved: the count goes gold, and
 * only the checks that failed are listed, each one a door — the whole row
 * would open the screen that fixes it. Nothing that passed appears, because
 * a failure buried in a list of successes is how a display gets missed.
 *
 * Both postures are the same three bands — verdict, body, footer — so the
 * tile keeps its silhouette across the switch and the change of colour is
 * the whole signal. A green tile that looks like an empty tile has not said
 * anything; a red tile that has to be re-learned costs the twenty minutes it
 * was meant to buy.
 */

export interface ReadinessCheck {
  id: string;
  label: string;
  state: 'ok' | 'warn' | 'fail';
  /** The specific fact behind the state — "4 assigned", "no model on disk". */
  detail: string;
  /** The door's words. Absent on a check nothing can be done about here. */
  fix?: string;
}

/*
 * Placeholder standing in for the real pre-flight result. Shaped exactly as
 * the `checks` prop, so wiring this to the engine is a one-line swap at the
 * call site — the tile itself never changes.
 */
const CHECKS: readonly ReadinessCheck[] = [
  { id: 'display', label: 'output display assigned', state: 'ok', detail: '4 displays' },
  { id: 'mic', label: 'microphone signal', state: 'ok', detail: 'scarlett solo' },
  { id: 'model', label: 'speech model', state: 'ok', detail: 'whisper-local, offline capable' },
  { id: 'bible', label: 'bible database', state: 'ok', detail: '6 versions' },
  { id: 'disk', label: 'disk space for the recording', state: 'ok', detail: '54 gb free' },
];

/* The tile's second voice, hoisted for the same reason PreacherStatsTile
   hoists its own: it lands on the summary line, the fix words and the
   footer, and a caption a shade brighter than its neighbour reads as a
   mistake rather than a hierarchy. */
const MUTED = 'rgb(229 243 242 / 0.45)';

const MINT = '#8fd3c0';
const GOLD = '#e4d87a';
const ROSE = '#eac7c6';

/* A warn is not a fail — the service will run — but it is the operator's to
   look at, so it borrows the acting colour rather than the alarm one. */
const STATE_INK: Record<ReadinessCheck['state'], string> = {
  ok: MINT,
  warn: GOLD,
  fail: ROSE,
};

const STATE_TONE: Record<ReadinessCheck['state'], 'ok' | 'warn' | 'danger'> = {
  ok: 'ok',
  warn: 'warn',
  fail: 'danger',
};

/* The most rows the short cell in the middle band can show above the footer.
   Deliberately not a scroll: nobody is standing in front of this board to
   scroll it, and the verdict line has already given the true count. */

/** "2 things need attention" — the count is the sentence's subject. */
function troubleWords(n: number): string {
  return n === 1 ? 'thing needs attention' : 'things need attention';
}

/*
 * EMPTIED at the owner's request ("remove the contents from the bg for now,
 * we don't need them"), pending a redesign of what this cell should say.
 * The shell is the same Panel with the same grid weight, so the bento does
 * not reflow; the verdict design is kept whole below as ReadinessTileFull
 * and coming back is a one-line swap here.
 */
export function ReadinessTile({ className }: { className?: string }) {
  return <ReadinessTileFull className={className} />;
}

export function ReadinessTileFull({
  className,
  checks = CHECKS,
}: {
  className?: string;
  checks?: readonly ReadinessCheck[];
}) {
  const trouble = checks.filter((c) => c.state !== 'ok');
  const unknown = checks.length === 0;
  const ready = !unknown && trouble.length === 0;
  const worst = trouble.some((c) => c.state === 'fail') ? 'fail' : 'warn';

  return (
    <Panel
      title="readiness"
      className={className}
      tone={ready || unknown ? 'default' : worst === 'fail' ? 'danger' : 'live'}
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        {/* The checks, as blocks in a row — S-03's arrangement. Each is the
            thing checked, what it found, and a bar that is full when it
            passed. Five short blocks read faster than one long sentence. */}
        <div
          className="grid min-h-0 flex-1 gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, checks.length)}, minmax(0, 1fr))` }}
        >
          {checks.map((check) => (
            <div
              key={check.id}
              className={cx(surface({ tone: 'default', shape: 'panel', wide: true }), 'flex min-h-[46px] min-w-0 flex-col justify-between gap-1 px-2.5 py-1.5')}
              style={{ borderRadius: 10 }}
            >
              <span className="truncate text-[length:var(--tri-size-eyebrow)] lowercase" style={{ color: MUTED }}>
                {check.label}
              </span>
              <span className="truncate text-[length:var(--tri-size-xs)] lowercase" style={{ color: STATE_INK[check.state] }}>
                {check.detail}
              </span>
              <span className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className="block h-full rounded-full"
                  style={{ width: check.state === 'ok' ? '100%' : check.state === 'warn' ? '55%' : '15%', background: STATE_INK[check.state] }}
                />
              </span>
            </div>
          ))}
        </div>

        {/* The verdict, as a foot line rather than a headline: the blocks
            already said it, this is the count. */}
        <p className="flex shrink-0 items-center gap-2 truncate text-[length:var(--tri-size-xs)] lowercase" style={{ color: MUTED }}>
          <Dot tone={unknown ? 'idle' : ready ? 'ok' : STATE_TONE[worst]} />
          {unknown ? (
            'pre-flight has not reported yet'
          ) : ready ? (
            <>ready for service · <span className="tabular-nums">{checks.length}</span> of <span className="tabular-nums">{checks.length}</span> checks passed</>
          ) : (
            <><span className="tabular-nums">{trouble.length}</span> {troubleWords(trouble.length)} · <span className="tabular-nums">{checks.length - trouble.length}</span> of <span className="tabular-nums">{checks.length}</span> passed</>
          )}
        </p>
      </div>
    </Panel>
  );
}
