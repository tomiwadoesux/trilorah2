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
const SHOWN = 2;

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
  return <Panel className={className} />;
}

export function ReadinessTileFull({
  className,
  checks = CHECKS,
}: {
  className?: string;
  checks?: readonly ReadinessCheck[];
}) {
  const trouble = checks.filter((c) => c.state !== 'ok');
  /*
   * No checks is NOT a pass.
   *
   * An empty array is what arrives while pre-flight is still running, and
   * what arrives if it failed to run at all. Both were reading as "ready for
   * service" in mint, which is the one sentence this tile must never say
   * without having earned it — a green verdict nobody checked is worse than
   * no tile, because it is trusted. It gets its own posture: idle dot, muted
   * ink, no ring, and a footer that says why there is no verdict yet.
   */
  const unknown = checks.length === 0;
  const ready = !unknown && trouble.length === 0;
  /* A fail anywhere sets the tile's ring, but the verdict line stays gold in
     both problem shapes: the number of things to do is the message, and two
     urgencies would only ask which one to read first. */
  const worst = trouble.some((c) => c.state === 'fail') ? 'fail' : 'warn';

  /* Details rather than labels: on the green side the reader wants the facts
     ("4 displays · scarlett solo"), not the checklist's own wording, which
     they already trust to have run. */
  const summary = checks.map((c) => c.detail).join(' · ');

  /*
   * Two rows is what the 105-weight cell actually holds. A third would push
   * the footer out of the panel, and the footer is the line that stops two
   * problems reading as a dead machine — so the list yields before it does.
   * Failures sort ahead of warnings: if only two rows are going to be read,
   * they must be the two that stop the service.
   */
  const ordered = [...trouble].sort(
    (a, b) => (a.state === 'fail' ? 0 : 1) - (b.state === 'fail' ? 0 : 1),
  );
  const shown = ordered.slice(0, SHOWN);
  const hidden = ordered.length - shown.length;

  return (
    <Panel
      className={className}
      bodyClass="pt-3"
      tone={ready || unknown ? 'default' : worst === 'fail' ? 'danger' : 'live'}
    >
      <div
        /* No justify-between: the middle band is flex-1 and eats the free
           space, so there is never any left to distribute and the rule was
           only ever describing an intent the layout already had. */
        className="flex h-full min-h-0 flex-col gap-[var(--tri-gap)]"
        /* Scoped here and not on Panel — Panel is shared with every region of
           the screen, and one tile's display scale is not something to hand
           all of them. */
        style={{ containerType: 'inline-size' }}
      >
        {/* Band one: the verdict. The only thing on this tile that has to
            carry across a dark booth, so it is the only thing off the type
            scale — sized in cqw, light at display weight the way the
            preacher's name is. */}
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <Dot tone={unknown ? 'idle' : ready ? 'ok' : STATE_TONE[worst]} />
          <h2
            className="min-w-0 truncate lowercase"
            style={{
              fontFamily: 'var(--tri-font)',
              fontSize: 'clamp(18px, 3.1cqw, 30px)',
              fontWeight: 300,
              letterSpacing: '0.01em',
              color: unknown ? MUTED : ready ? MINT : GOLD,
            }}
          >
            {unknown ? (
              'checking…'
            ) : ready ? (
              'ready for service'
            ) : (
              <>
                {/* tabular-nums on the count for the same reason every figure
                    in the bento has it: this line redraws as checks resolve,
                    and proportional digits make the words shuffle. */}
                <span className="tabular-nums">{trouble.length}</span> {troubleWords(trouble.length)}
              </>
            )}
          </h2>
        </div>

        {/* Band two: the one that gives. Green, it is a single line of proof
            and the slack is deliberate air under the verdict. In trouble, it
            is the list, and the same region absorbs it. */}
        {ready || unknown ? (
          <p
            className="min-h-0 flex-1 text-[length:var(--tri-size-xs)] leading-[1.5]"
            style={{ color: MUTED }}
          >
            {unknown ? 'pre-flight has not reported yet' : summary}
          </p>
        ) : (
          <ul className="flex min-h-0 flex-1 flex-col gap-[var(--tri-card-gap)] overflow-hidden">
            {shown.map((check) => (
              /* Each failing check is a door: the whole row is the target,
                 not a button parked at its end. Non-interactive here because
                 the dashboard is read — this is the drawing of the door, and
                 the screen it opens onto does not exist yet. */
              <li
                key={check.id}
                className={cx(
                  surface({ tone: 'default', shape: 'panel', wide: true }),
                  /*
                   * shrink-0 at natural height, NOT flex-1.
                   *
                   * ConnectionsTile's rows share their region because that
                   * list is the whole tile and its cell is 236 weight tall.
                   * This one lands in the 105 cell — about 95px at the
                   * default artboard — where the verdict, the footer and the
                   * panel's own padding have already spent ~80px before the
                   * list gets a pixel. Rows told to divide what is left get
                   * ~7px each and clip through the middle of their own type,
                   * which is a worse failure than the failure it is
                   * reporting. They keep their two lines and the count below
                   * carries whatever does not fit.
                   */
                  'flex shrink-0 items-center gap-2 px-2.5 py-1.5',
                )}
                /* 30px is the Panel's own radius and far too round for a card
                   nested inside one; corner-shape survives from the surface
                   class. */
                style={{ borderRadius: 12 }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[length:var(--tri-size)] font-semibold text-[var(--tri-ink)]">
                    {check.label}
                  </span>
                  <span
                    className="block truncate text-[length:var(--tri-size-xs)] lowercase"
                    style={{ color: STATE_INK[check.state] }}
                  >
                    {check.detail}
                  </span>
                </span>
                {check.fix && (
                  /* The door's words, in the tile's caption voice. It is a
                     destination, not an act — the row says where it goes, it
                     does not claim to have fixed anything. */
                  <span
                    className="shrink-0 whitespace-nowrap text-[length:var(--tri-size-eyebrow)] lowercase"
                    style={{ color: MUTED }}
                  >
                    {check.fix}
                  </span>
                )}
              </li>
            ))}
            {hidden > 0 && (
              /* Not a row: a card here would claim to be a door to one
                 thing, and this is the count of several. It is the list
                 admitting its own edge, in the caption voice. */
              <li
                className="shrink-0 truncate px-2.5 text-[length:var(--tri-size-xs)] lowercase"
                style={{ color: MUTED }}
              >
                <span className="tabular-nums">{hidden}</span> more below
              </li>
            )}
          </ul>
        )}

        {/* Band three: the footer, present in both postures so the tile does
            not change height class when it turns. Green, it says how much was
            checked; in trouble, how much still passed — which is the sentence
            that keeps a two-item list from reading as a broken machine. */}
        {/* No tracking: 0.14em belongs to the uppercase eyebrow, where it
            opens letterforms that are all the same height. On a lowercase
            sentence it only pulls the words apart. */}
        <p
          className="shrink-0 truncate text-[length:var(--tri-size-eyebrow)] lowercase"
          style={{ color: MUTED }}
        >
          {unknown ? (
            'no checks reported'
          ) : (
            <>
              <span className="tabular-nums">{checks.length - trouble.length}</span> of{' '}
              <span className="tabular-nums">{checks.length}</span> checks passed
            </>
          )}
        </p>
      </div>
    </Panel>
  );
}
