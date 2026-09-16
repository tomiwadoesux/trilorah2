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

export function PreacherStatsTile({ className }: { className?: string }) {
  return (
    <Panel className={className} bodyClass="pt-3" unavailable="builds up after a few services with this preacher">
      <div
        className="flex h-full min-h-0 flex-col justify-between"
        /* cqw only means anything with a container under it, and it has to be
           this box rather than the Panel: Panel is shared with every other
           region of the screen, and one tile's type scale is not something to
           hand all of them. */
        style={{ containerType: 'inline-size' }}
      >
        {/* The name is the tile's title — there is no panel header, because a
            label saying "preacher" above a name saying "Pastor Dan" is the
            same word twice. */}
        <div className="shrink-0">
          <h2
            className="truncate text-[var(--tri-ink)]"
            style={{
              fontFamily: 'var(--tri-font)',
              fontSize: 'clamp(22px, 3.4cqw, 34px)',
              fontWeight: 300,
              letterSpacing: '0.01em',
            }}
          >
            {PREACHER.name}
          </h2>
          <p className="mt-0.5 text-[length:var(--tri-size-xs)]" style={{ color: MUTED }}>
            {PREACHER.services}
          </p>
        </div>

        <div className="flex shrink-0 items-end justify-between gap-[var(--tri-gap)]">
          <div className="min-w-0">
            <p
              className="tabular-nums text-[var(--tri-ink)]"
              style={{
                fontFamily: 'var(--tri-font)',
                fontSize: 'clamp(42px, 7.4cqw, 76px)',
                fontWeight: 300,
                lineHeight: 0.9,
                letterSpacing: '0.02em',
              }}
            >
              {PREACHER.accuracy}%
            </p>
            <p className="mt-1 lowercase text-[length:var(--tri-size-xs)]" style={{ color: MUTED }}>
              detection accuracy
            </p>
          </div>

          <div className="min-w-0 text-right text-[length:var(--tri-size-xs)] leading-[1.3]">
            {FACTS.map((fact) => (
              /* The whole pair holds one line, label included. min-w-0 on the
                 block is what makes that safe: the line can never widen the
                 tile, it can only stop "most referenced books:" breaking in
                 two and taking a fifth line's height out of the row. */
              <p key={fact.label} className="whitespace-nowrap">
                <span style={{ color: MUTED }}>{fact.label} </span>
                <span className="font-semibold text-[rgb(229_243_242_/_0.9)]">{fact.value}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
