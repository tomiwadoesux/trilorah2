import { Sheet, Group, Cell, Matrix, Note, Spec, Swatch } from '../Sheet';

/*
 * Foundation sheets — F-01 … F-15 of design/UI-INVENTORY.md.
 * These are decision surfaces, not components: each sheet exists so a
 * choice can be made by looking rather than by arguing.
 */

/* ------------------------------------------------------------------ */
/* F-01 — colour                                                       */
/* ------------------------------------------------------------------ */

export function ColorTokens() {
  return (
    <Sheet
      id="F-01"
      title="Colour tokens"
      status="draft"
      summary="The six shipped tokens, plus the semantic gaps the inventory flags. Flip the theme in the toolbar to see each token under booth mode."
    >
      <Group title="Shipped — src/index.css">
        <Matrix cols={6}>
          <Swatch token="--color-paper" />
          <Swatch token="--color-surface" />
          <Swatch token="--color-ink" />
          <Swatch token="--color-accent" />
          <Swatch token="--color-hairline" />
          <Swatch token="--color-canvas" />
        </Matrix>
      </Group>

      <Group title="Provisional — sandbox only" hint="not yet in the app">
        <Matrix cols={6}>
          <Swatch token="--color-on-accent" />
        </Matrix>
      </Group>

      <Note>
        <strong>Missing semantic tokens.</strong> There is no <code>danger</code>,{' '}
        <code>warn</code>, <code>ok</code>, <code>live</code>, <code>preview</code>,{' '}
        <code>muted</code>, <code>overlay-scrim</code> or <code>focus-ring</code>. Every screen
        currently improvises with raw <code>neutral-*</code> classes — grep shows{' '}
        <code>text-neutral-400</code> in almost every file. Deciding these is F-01's real job.
      </Note>

      <Note>
        <strong>Live vs preview needs colour.</strong> The operator has to tell at a glance what is
        on the projector and what is only staged. Black-on-white cannot carry that alone under
        stage lighting — this is the one place the strict monochrome rule may have to bend.
      </Note>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* F-03 — type                                                         */
/* ------------------------------------------------------------------ */

const SCALE: [string, string, string][] = [
  ['display', 'text-5xl font-semibold tracking-tight', 'output slides only'],
  ['h1', 'text-2xl font-semibold tracking-tight', 'screen titles'],
  ['h2', 'text-lg font-semibold', 'panel titles'],
  ['h3', 'text-base font-semibold', 'sub-sections'],
  ['body', 'text-sm', 'default'],
  ['body-sm', 'text-xs', 'dense lists'],
  ['label', 'text-[10px] font-semibold uppercase tracking-widest', 'every label today'],
  ['mono', 'font-mono text-xs', 'refs, codes, shortcuts'],
];

export function Typography() {
  return (
    <Sheet
      id="F-03"
      title="Type scale"
      status="draft"
      summary="The scale as it is actually used today, reverse-engineered from the screens. Decide what survives before any component is restyled."
    >
      <Group title="Scale">
        <div className="space-y-5">
          {SCALE.map(([name, cls, use]) => (
            <div key={name} className="grid grid-cols-[7rem_1fr_9rem] items-baseline gap-x-4">
              <span className="font-mono text-[10px] text-neutral-400">{name}</span>
              <span className={cls}>The entrance of thy words giveth light</span>
              <span className="text-xs text-neutral-400">{use}</span>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Scripture serif" hint="--font-scripture">
        <p className="max-w-2xl font-scripture text-2xl leading-snug">
          For God so loved the world, that he gave his only begotten Son, that whosoever believeth
          in him should not perish, but have everlasting life.
        </p>
      </Group>

      <Note>
        <strong>The uppercase-tracked label is everywhere.</strong> It is on every{' '}
        <code>SectionLabel</code>, <code>Pill</code>, <code>Button</code> and tab in the app. At
        10px with <code>tracking-widest</code> it is the single most defining choice in the current
        look — and the least legible at a glance in a dark booth. Keep, soften, or drop: this is
        the first call to make.
      </Note>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* F-04 / F-06 — spacing and radius                                    */
/* ------------------------------------------------------------------ */

const SPACE = [1, 2, 3, 4, 6, 8, 12, 16, 24];
const RADIUS: [string, string][] = [
  ['none', 'rounded-none'],
  ['sm', 'rounded-sm'],
  ['md', 'rounded-md'],
  ['lg', 'rounded-lg'],
  ['full', 'rounded-full'],
];

export function SpacingRadius() {
  return (
    <Sheet
      id="F-04 / F-06"
      title="Spacing & radius"
      status="draft"
      summary="4px base. Density (F-05) scales the root font size, so anything sized in rem moves with it — the toolbar toggle shows the effect."
    >
      <Group title="Spacing scale">
        <div className="flex items-end gap-x-3">
          {SPACE.map((n) => (
            <div key={n} className="space-y-1.5 text-center">
              <div className="bg-ink" style={{ width: n * 4, height: 28 }} />
              <div className="font-mono text-[10px] text-neutral-400">{n * 4}</div>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Radius scale">
        <div className="flex items-center gap-x-4">
          {RADIUS.map(([name, cls]) => (
            <Cell key={name} label={name}>
              <div className={`h-14 w-14 border border-hairline bg-surface ${cls}`} />
            </Cell>
          ))}
        </div>
      </Group>

      <Spec
        rows={[
          ['base unit', '4px'],
          ['panel padding', 'p-4 (16px) — Panel default'],
          ['panel radius', 'rounded-md — every Panel today'],
          ['borders', '1px hairline, no shadows anywhere yet (F-07 undecided)'],
        ]}
      />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* F-08 — motion                                                       */
/* ------------------------------------------------------------------ */

export function Motion() {
  return (
    <Sheet
      id="F-08"
      title="Motion"
      status="todo"
      summary="Durations and easings. The hard constraint: nothing on the Live surface may exceed ~150ms, and nothing on the projector may animate in a way that strobes on camera."
    >
      <Group title="Shipped" hint="the only animation in the app today">
        <Cell label="animate-pulse-quiet — 2s ease-in-out infinite">
          <span className="animate-pulse-quiet text-accent">●</span>
          <span className="animate-pulse-quiet text-xs uppercase tracking-widest">listening</span>
        </Cell>
      </Group>

      <Spec
        rows={[
          ['instant', '80ms — state flips, toggles'],
          ['fast', '140ms — hovers, the Live surface ceiling'],
          ['base', '220ms — panels, drawers'],
          ['slow', '400ms — modals, output cross-fades'],
          ['reduced motion', 'undecided — must be honoured before ship'],
        ]}
      />

      <Note>
        Output transitions (O-11) are a separate problem from UI motion. Cross-fades on a projector
        are seen through a camera at 30fps — they need their own duration, and probably their own
        easing.
      </Note>
    </Sheet>
  );
}
