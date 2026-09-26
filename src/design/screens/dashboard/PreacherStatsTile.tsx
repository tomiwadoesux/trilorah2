import { cx, surface } from '../../../ui';
import { Panel } from '../parts';

/*
 * Who is preaching, and how the engine tends to do with them.
 *
 * The only tile in the bento that reaches display scale, and it earns it by
 * distance: the rest of the tech team reads this one from across a dark
 * booth, where 12px is a smudge. The two figures it has to carry that far —
 * the preacher's name and the accuracy number — are therefore sized off the
 * tile's own width in cqw rather than off the type scale, which stops at
 * 12px. Everything else stays on the scale, so the jump reads as emphasis
 * rather than as a second typeface arriving.
 */

interface PreacherFact {
  label: string;
  value: string;
}

const PREACHER = {
  name: 'Pastor Dan',
  services: 'Preached 4 times',
  /** Share of his spoken references the engine caught correctly, across those services. */
  accuracy: 85,
} as const;

const FACTS: PreacherFact[] = [
  { label: 'average sermon length:', value: '35 min' },
  { label: 'most quoted verse:', value: 'romans 11:23' },
  { label: 'most referenced books:', value: 'psalm, romans, john' },
  { label: 'last preached:', value: '23 april 2026' },
];

/* The tile's second voice. Written out once because it lands on three
   separate blocks and they must not drift apart — a caption a shade
   brighter than its neighbour reads as a mistake, not a hierarchy. */
const MUTED = 'rgb(229 243 242 / 0.45)';

/*
 * EMPTIED at the owner's request ("remove the contents from the bg for now,
 * we don't need them"), pending a redesign. Same Panel, same grid weight, so
 * the band keeps its proportions; the old face is PreacherStatsTileFull.
 */
export function PreacherStatsTile({ className }: { className?: string }) {
  return <PreacherStatsTileFull className={className} />;
}

export function PreacherStatsTileFull({ className }: { className?: string }) {
  return (
    <Panel title="preacher" className={className}>
      {/* Two blocks, S-03's arrangement: who is preaching on the left, what
          the numbers say on the right. Quiet type — the name is the biggest
          thing here, and it is not big. */}
      <div className="grid h-full min-h-0 grid-cols-2 gap-2">
        <div
          className={cx(surface({ tone: 'default', shape: 'panel', wide: true }), 'flex min-h-0 min-w-0 flex-col justify-between px-3 py-2.5')}
          style={{ borderRadius: 10 }}
        >
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-[var(--tri-ink)]">{PREACHER.name}</p>
            <p className="mt-0.5 truncate text-[length:var(--tri-size-xs)] lowercase" style={{ color: MUTED }}>
              {PREACHER.services}
            </p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] font-semibold tabular-nums leading-none text-[var(--tri-ink)]">{PREACHER.accuracy}%</span>
            <span className="text-[length:var(--tri-size-xs)] lowercase" style={{ color: MUTED }}>
              detection accuracy
            </span>
          </div>
        </div>
        <div
          className={cx(surface({ tone: 'default', shape: 'panel', wide: true }), 'flex min-h-0 min-w-0 flex-col justify-center gap-1.5 px-3 py-2.5')}
          style={{ borderRadius: 10 }}
        >
          {FACTS.map((fact) => (
            <p key={fact.label} className="flex items-baseline justify-between gap-3 text-[length:var(--tri-size-xs)]">
              <span className="truncate lowercase" style={{ color: MUTED }}>{fact.label.replace(/:$/, '')}</span>
              <span className="shrink-0 font-semibold text-[rgb(229_243_242_/_0.9)]">{fact.value}</span>
            </p>
          ))}
        </div>
      </div>
    </Panel>
  );
}
