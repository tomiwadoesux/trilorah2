import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cx, Button, Slider, type SurfaceTone, DashboardButton, DisplayFontPicker, type FontOption, TextPositionPicker, type TextPositionOption, Select, SegmentedControl, SettingsIcon, TrashIcon, ScriptureReferenceInput, type ScriptureBook } from '../../ui';
import { BOOKS, CHAPTER_COUNTS } from '../../lib/books';
import { Sheet, Group, Cell, Matrix, Note, Spec, Stage } from '../Sheet';

/*
 * Sheets for the components built from the Figma file (Section 1, 38:236).
 * These are the real design system — the ui.tsx sheets alongside them are
 * the old greyscale baseline they replace.
 */

/** Hover cannot be photographed, so force the alpha & stroke opacity to show it side by side. */
const HOVER = { '--tri-alpha': 0.7, '--tri-stroke-opacity': 0.04 } as CSSProperties;

/* ------------------------------------------------------------------ */
/* C-01 — Button                                                       */
/* ------------------------------------------------------------------ */

export function TriButton() {
  return (
    <Sheet
      id="C-01"
      title="Button"
      status="done"
      summary="Built from Buttom Icon (97:376), Buttom noIcon (97:405), Delete Button Icon (97:381) and Delete Button noIcon (97:421)."
    >
      <Group title="Tone × icon × state" hint="hover column is forced, not simulated">
        <Stage>
          <Matrix cols={3}>
            <Cell label="rest">
              <Button label="The Service" icon={<SettingsIcon />} />
            </Cell>
            <Cell label="hover (alpha 0.3 → 0.7)">
              <span style={HOVER}>
                <Button label="The Service" icon={<SettingsIcon />} />
              </span>
            </Cell>
            <Cell label="disabled">
              <Button label="The Service" icon={<SettingsIcon />} disabled />
            </Cell>

            <Cell label="rest · no icon">
              <Button label="The Service" />
            </Cell>
            <Cell label="hover · no icon">
              <span style={HOVER}>
                <Button label="The Service" />
              </span>
            </Cell>
            <Cell label="disabled · no icon">
              <Button label="The Service" disabled />
            </Cell>

            <Cell label="danger · rest">
              <Button label="delete account" tone="danger" icon={<TrashIcon />} />
            </Cell>
            <Cell label="danger · hover">
              <span style={HOVER}>
                <Button label="delete account" tone="danger" icon={<TrashIcon />} />
              </span>
            </Cell>
            <Cell label="danger · no icon">
              <Button label="delete account" tone="danger" />
            </Cell>
          </Matrix>
        </Stage>
      </Group>

      <Group title="Refusal" hint="click a disabled button — it answers">
        <Stage>
          <Cell label="press it twice">
            <Button label="push to live" icon={<SettingsIcon />} disabled />
            <Button label="delete account" tone="danger" icon={<TrashIcon />} disabled />
          </Cell>
        </Stage>
      </Group>

      <Note>
        <strong>A disabled control still answers.</strong> The native{' '}
        <code>disabled</code> attribute swallows the click and drops the button out of the tab order,
        so a refused press is indistinguishable from a missed one — the operator clicks again, mid
        service. These use <code>aria-disabled</code> instead: same meaning for a screen reader, but
        the press gets a 220ms shake back. It is the one motion in the system meant to be consciously
        noticed, because it is carrying a message. Under{' '}
        <code>prefers-reduced-motion</code> it becomes a brightness pulse with no travel.
      </Note>

      <Note>
        <strong>The system is one gradient.</strong> Every surface in your file shares the same four
        stops at the same four positions — <code>#07271C · #1D322F · #1A3630 · #1A3336</code> at
        10.05 / 36.45 / 63.06 / 89.95%. What changes between rest and hover is only the{' '}
        <strong>alpha: 0.3 → 0.7</strong>. Danger swaps the hue set to{' '}
        <code>#5C1010 · #761A1A · #782222 · #4B1212</code> and lifts its text from{' '}
        <code>#EAC7C6</code> to <code>#FEC9C9</code>. That is why this is four CSS variables and not
        forty hand-written gradients.
      </Note>

      <Note>
        <strong>Angles were drift, so I normalised them.</strong> Figma had a different angle on
        every component — 49.5°, 47.8°, 42.6°, 54.6°, 33.4°, 28.1° — with identical stops. That is
        what resizing a gradient fill does, not a design decision. Controls now use 48° and wide
        surfaces 33°. Say the word if any of those angles was deliberate.
      </Note>

      <Spec
        rows={[
          ['padding', '9px horizontal, none vertical — height comes from the 28px line-height'],
          ['gap', '5px to the icon'],
          ['radius', '6px (--tri-radius-control)'],
          ['border', '1px rgba(229,243,242,0.12)'],
          ['type', "Roboto 12px / 28px, 0.24px tracking, lowercase, shadow 0 1px 3.2px rgb(0 0 0 / .48)"],
          ['icons', 'Trilorah Cutout — original, currentColor, named parts ready for motion'],
        ]}
      />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* C-20 — Slider                                                       */
/* ------------------------------------------------------------------ */

export function TriSlider() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(60);
  const [c, setC] = useState(100);

  return (
    <Sheet
      id="C-20"
      title="Slider"
      status="done"
      summary="Built from Slider (87:400). Drag it, press the open track, and hover just off the handle — the three gestures behave differently on purpose."
    >
      <Group title="Values">
        <Stage>
          <div className="max-w-[253px] space-y-6">
            <Slider label="size" value={a} onChange={setA} />
            <Slider label="size" value={b} onChange={setB} />
            <Slider label="size" value={c} onChange={setC} />
            <Slider label="disabled" value={40} onChange={() => {}} disabled />
          </div>
        </Stage>
      </Group>

      <Note>
        <strong>The fill is a window, not a stretch.</strong> In your file the filled portion clips a
        full-width gradient rather than scaling one to fit — so the colour under the handle stays
        put as the value changes instead of sliding. Reproduced exactly; drag it and watch the
        gradient hold still.
      </Note>

      <Note>
        <strong>Three gestures, three behaviours.</strong> Pressing the <em>handle</em> grabs it — the
        value does not move, and the drag runs relative to where you took hold, so it stays under the
        finger that picked it up. Pressing the <em>open track</em> travels there over 260ms rather
        than teleporting, so you can see how far the value moved. <em>Hovering</em> within 34px draws
        the handle up to 5px toward the pointer — visual only, the value never changes on hover, and
        the pull gives way the moment you press. A bare <code>&lt;input type=range&gt;</code> does
        none of this: it jumps the value to wherever the pointer landed, which throws away the value
        you just aimed at. The input is still underneath for keyboard and screen readers.
      </Note>

      <Spec
        rows={[
          ['track', '34px tall, 8px radius, solid #07271C border'],
          ['fill', 'same gradient at alpha 1.0'],
          ['ticks', '9 × 2px dots, fading within 16px of the fill edge'],
          ['handle', '2px × 15px, 21px and full ink while held'],
          ['value', '10px, 0.2px tracking, right-aligned inside the track'],
        ]}
      />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard row                                                       */
/* ------------------------------------------------------------------ */

export function TriDashboardButton() {
  const [active, setActive] = useState(1);

  return (
    <Sheet
      id="D-111"
      title="Dashboard row"
      status="done"
      summary="Built from Dashboard Icon (430:456). Label left, glyph right, 39px tall — the row used down the operator panel."
    >
      <Group title="States">
        <Stage>
          <div className="max-w-[235px] space-y-3">
            <DashboardButton label="Today’s Flow" icon={<SettingsIcon />} />
            <span className="block" style={HOVER}>
              <DashboardButton label="Today’s Flow" icon={<SettingsIcon />} />
            </span>
            <DashboardButton label="Today’s Flow" icon={<SettingsIcon />} active />
          </div>
        </Stage>
      </Group>

      <Group title="As a list" hint="click to select">
        <Stage>
          <div className="max-w-[235px] space-y-3">
            {['Today’s Flow', 'Live Transcript', 'Sermon'].map((label, i) => (
              <DashboardButton
                key={label}
                label={label}
                icon={<SettingsIcon />}
                active={active === i}
                onClick={() => setActive(i)}
              />
            ))}
          </div>
        </Stage>
      </Group>

      <Note>
        <strong>Two things in this component need your call.</strong>
        <br />
        <strong>1. The font is missing.</strong> The label is set in{' '}
        <code>Ortica Linear</code>, which is not installed, so Figma fell back per-glyph — the
        exported code literally renders “Today’s Flow” as eleven separate spans alternating between
        Helvetica and Inter. I used Roboto to match the buttons. Send me the real font and I will
        swap it.
        <br />
        <strong>2. Variant2 looks corrupted.</strong> It has two gradient stops where every other
        surface has four. That reads as accidentally deleted stops rather than intent, so I mapped
        rest → 0.3 and selected → 0.65 (your Variant3) and left Variant2 out.
      </Note>

      <Spec
        rows={[
          ['size', '39px tall, 235px in the file — flexible here'],
          ['padding', '10px'],
          ['radius', '8px (--tri-radius-surface)'],
          ['border', 'solid #07271C — not the 12% hairline the small controls use'],
          ['casing', 'sentence case, unlike Button which lowercases'],
        ]}
      />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* C-04 — Segmented control                                            */
/* ------------------------------------------------------------------ */

export function TriSegmentedControl() {
  const [shelf, setShelf] = useState('local');
  const [output, setOutput] = useState('both');

  return (
    <Sheet
      id="C-04"
      title="Segmented control"
      status="done"
      summary="Two to five exclusive options, all visible at once, with one thumb that travels between them."
    >
      <Group title="Interactive specimen" hint="arrow keys move the choice; tab leaves the control">
        <Stage>
          <SegmentedControl
            label="media source"
            options={[
              { id: 'local', label: 'local' },
              { id: 'stock', label: 'stock' },
            ]}
            value={shelf}
            onChange={setShelf}
          />
        </Stage>
      </Group>

      <Group title="Counts" hint="past five, the words stop fitting and it should be a Select">
        <Stage>
          <div className="flex flex-col gap-6">
            <Cell label="two">
              <SegmentedControl options={[{ id: 'a', label: 'local' }, { id: 'b', label: 'stock' }]} />
            </Cell>
            <Cell label="three · controlled">
              <SegmentedControl
                options={[
                  { id: 'preview', label: 'preview' },
                  { id: 'live', label: 'live' },
                  { id: 'both', label: 'both' },
                ]}
                value={output}
                onChange={setOutput}
              />
            </Cell>
            <Cell label="four">
              <SegmentedControl
                options={[
                  { id: 'kjv', label: 'kjv' },
                  { id: 'niv', label: 'niv' },
                  { id: 'bbe', label: 'bbe' },
                  { id: 'rvr', label: 'rvr' },
                ]}
              />
            </Cell>
          </div>
        </Stage>
      </Group>

      <Group title="Sizes & states">
        <Stage>
          <div className="flex flex-col gap-6">
            <Cell label="sm — for a header or a bar">
              <SegmentedControl size="sm" options={[{ id: 'a', label: 'local' }, { id: 'b', label: 'stock' }]} />
            </Cell>
            <Cell label="md — beside a button">
              <SegmentedControl options={[{ id: 'a', label: 'local' }, { id: 'b', label: 'stock' }]} />
            </Cell>
            <Cell label="disabled">
              <SegmentedControl disabled options={[{ id: 'a', label: 'local' }, { id: 'b', label: 'stock' }]} />
            </Cell>
          </div>
        </Stage>
      </Group>

      <Note>
        The thumb slides rather than the highlight jumping, and that is the
        component. A travelling thumb says the options are the same kind of
        thing and you have moved between them; two buttons swapping highlight
        says nothing. Everything else here exists to make the travel true —
        equal grid columns so a long word cannot widen its own segment, and a
        thumb positioned by column index rather than by measuring anything.
      </Note>

      <Spec
        rows={[
          ['track', 'rgb(0 0 0 / 0.20), hairline inset stroke at 10% ink'],
          ['height', 'var(--tri-control-h); sm is that less 6px'],
          ['thumb', 'tri-surface at rest alpha, inset 2px on all four sides'],
          ['thumb radius', 'calc(var(--tri-radius-control) - 2px) — R_outer = R_inner + gap'],
          ['travel', 'translateX(index × 100%), 180ms cubic-bezier(0.16, 1, 0.3, 1)'],
          ['labels', 'var(--tri-size-xs) lowercase; ink when chosen, muted when not'],
          ['semantics', 'role=radiogroup / radio, arrow keys move, one tab stop'],
        ]}
      />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* C-05 — Display font picker                                          */
/* ------------------------------------------------------------------ */

export function TriDisplayFontPicker() {
  const [selectedFont, setSelectedFont] = useState<FontOption>('default');

  return (
    <Sheet
      id="C-05"
      title="Display font"
      status="done"
      summary="Built from Figma display font selector. 86×86px outer container (16px squircle radius) with 1px solid stroke (20% white overlay), 78×78px inner card (12px squircle radius), #E4D87A yellow glyphs & active dash."
    >
      <Group
        title="Interactive Selector"
        hint="click cards to switch display font · shown at 320px, the width of the control above it in S-02"
      >
        <Stage>
          {/* The cards fill their container, so a specimen without a stated
              width is not a specimen — it is whatever the sheet happens to
              be. 320px is the column the picker sits in on S-02. */}
          <div style={{ width: 320 }}>
            <DisplayFontPicker value={selectedFont} onChange={setSelectedFont} />
          </div>
        </Stage>
      </Group>

      <Group title="States">
        <Stage>
          <div className="flex flex-col gap-6">
            <Cell label="default selected">
              <DisplayFontPicker value="default" />
            </Cell>
            <Cell label="serif selected">
              <DisplayFontPicker value="serif" />
            </Cell>
            <Cell label="uppercase selected">
              <DisplayFontPicker value="uppercase" />
            </Cell>
            <Cell label="disabled">
              <DisplayFontPicker value="default" disabled />
            </Cell>
          </div>
        </Stage>
      </Group>

      <Spec
        rows={[
          ['outer card', '86 × 86px, 22px standard circular radius'],
          ['outer stroke', '1.45px solid with 20% white overlay (inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.20))'],
          ['inner card', '76 × 76px (5px equal gap), 17px standard circular radius, borderless fill'],
          ['fill', 'Linear gradient system surface at alpha 0.3'],
          ['glyph text', '32px #E4D87A yellow text'],
          ['active indicator', '20 × 3.5px rounded yellow (#E4D87A) pill dash under selected card'],
        ]}
      />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* C-06 — Text position                                               */
/* ------------------------------------------------------------------ */

export function TriTextPositionPicker() {
  const [selectedPos, setSelectedPos] = useState<TextPositionOption>('top');

  return (
    <Sheet
      id="C-06"
      title="Text position"
      status="done"
      summary="Interactive layout position selector matching Figma inspect specs (108x64 outer card, 20px radius, 1.45px stroke with 20% white overlay, yellow accent indicators)."
    >
      <Group title="Interactive specimen">
        <Stage>
          <TextPositionPicker value={selectedPos} onChange={setSelectedPos} />
        </Stage>
      </Group>

      <Group title="States">
        <Stage>
          <div className="flex flex-col gap-6">
            <Cell label="top selected">
              <TextPositionPicker value="top" />
            </Cell>
            <Cell label="bottom right selected">
              <TextPositionPicker value="bottom-right" />
            </Cell>
            <Cell label="bottom center selected">
              <TextPositionPicker value="bottom-center" />
            </Cell>
            <Cell label="bottom left selected">
              <TextPositionPicker value="bottom-left" />
            </Cell>
          </div>
        </Stage>
      </Group>

      <Spec
        rows={[
          ['outer card', '108 × 64px, 20px outer radius'],
          ['outer stroke', '1.45px solid with 20% white overlay (inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.20))'],
          ['inner card', '98 × 54px (5px equal gap), 15px radius, borderless clean fill'],
          ['fill', 'Linear gradient system surface at alpha 0.3 when selected'],
          ['yellow indicator', '18 × 2.5px rounded yellow (#E4D87A) pill dash indicator'],
          ['labels', '12px lowercase tri-label with 180ms vertical displacement animation'],
        ]}
      />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* C-07 — Select / Text effect dropdown                               */
/* ------------------------------------------------------------------ */

export function TriSelect() {
  const [selectedEffect, setSelectedEffect] = useState<string>('soft-shadow');

  return (
    <Sheet
      id="C-07"
      title="Text effect select"
      status="done"
      summary="Built from text effect dropdown design spec (360px wide trigger button, 14px radius, 1.45px stroke with 20% white overlay, floating glassmorphic overlay menu)."
    >
      <Group title="Interactive specimen">
        <Stage>
          <Select label="text effect" value={selectedEffect} onChange={setSelectedEffect} />
        </Stage>
      </Group>

      <Group title="States">
        <Stage>
          <div className="flex flex-col gap-6 w-full max-w-[360px]">
            <Cell label="default closed">
              <Select label="text effect" value="soft-shadow" />
            </Cell>
            <Cell label="hard shadow selected">
              <Select label="text effect" value="hard-shadow" />
            </Cell>
            <Cell label="disabled">
              <Select label="text effect" value="soft-shadow" disabled />
            </Cell>
          </div>
        </Stage>
      </Group>

      <Spec
        rows={[
          ['trigger button', '360 × 46px max-width, 14px concentric squircle radius'],
          ['trigger stroke', '1.45px solid with 20% white overlay (inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.20))'],
          ['menu overlay', '14px radius, 16px blur glassmorphic surface, 0 12px 32px drop shadow'],
          ['chevron icon', '12px SVG chevron, rotates 180° on active toggle'],
        ]}
      />
    </Sheet>
  );
}


/* ------------------------------------------------------------------ */
/* C-08 — Scripture reference input                                   */
/* ------------------------------------------------------------------ */

const SPEC_BOOKS: ScriptureBook[] = BOOKS.map((name, i) => ({
  name,
  chapters: CHAPTER_COUNTS[i],
}));

/** Genesis 1 and John 3, so the verse constraint has something real to bite on. */
const SPEC_VERSES = (bookIndex: number, chapter: number) =>
  bookIndex === 0 && chapter === 1 ? 31 : bookIndex === 42 && chapter === 3 ? 36 : undefined;

export function TriScriptureReferenceInput() {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);

  return (
    <Sheet
      id="C-08"
      title="Scripture reference input"
      status="done"
      summary="A guided reference builder, not a search field. It refuses any keystroke that cannot lead to a real verse — type 'revel' and the 'b' of 'revelb' never appears, because Revelation is the only book left standing. Same for numbers: Genesis takes 5 (5 and 50 both exist) and refuses the 1 after it."
    >
      <Group title="Interactive specimen">
        <Stage>
          <div className="flex w-full max-w-[520px] flex-col gap-3">
            <ScriptureReferenceInput
              books={SPEC_BOOKS}
              versesInChapter={SPEC_VERSES}
              value={value}
              onChange={setValue}
              onSubmit={(r) =>
                setSubmitted(`${r.book} ${r.chapter}${r.verse ? `:${r.verse}` : ''}`)
              }
            />
            {submitted && (
              <p className="text-[12px] lowercase text-[rgb(229_243_242_/_0.5)]">
                submitted: {submitted}
              </p>
            )}
          </div>
        </Stage>
      </Group>

      <Group title="Try these">
        <Note>
          Type <strong>gene</strong> — the rest of Genesis appears in low opacity; Tab or → accepts
          it. Type <strong>revelb</strong> — the b is refused and the field shakes. Type{' '}
          <strong>genesis 51</strong> — the 1 is refused, because Genesis ends at 50. Type{' '}
          <strong>jo</strong> — six books still match, so they are offered rather than guessed at.
        </Note>
      </Group>

      <Spec
        rows={[
          ['the rule', 'a keystroke is accepted iff the text it produces is a prefix of at least one complete, real reference'],
          ['stages', 'book → chapter → verse, each constrained by the one before it'],
          ['book vocabulary', '66 canonical names plus aliases; a leading digit belongs to the name (1 John)'],
          ['chapter bound', 'CHAPTER_COUNTS — real canon data, so Genesis 51 is refusable'],
          ['verse bound', 'supplied per chapter by the caller; unconstrained where unknown rather than guessed'],
          ['ghost text', 'the remainder of the best-matching book at 30% ink; Tab or → accepts'],
          ['refusal', 'useNudge — 3px shake, 220ms. Silence would read as a broken keyboard'],
          ['ambiguity', 'shown as pickable chips, never resolved silently'],
          ['field', '46px tall, matching Select; 1.45px hairline at 16% white'],
        ]}
      />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* F-02 — Type scale                                                  */
/* ------------------------------------------------------------------ */

const TYPE_STEPS: { token: string; role: string; where: string }[] = [
  { token: '--tri-size-eyebrow', role: 'eyebrow', where: 'column headers, badges, pills — uppercase and tracked' },
  { token: '--tri-size-xs', role: 'xs', where: 'meta: status lines, numeric readouts, hints' },
  { token: '--tri-size-sm', role: 'sm', where: 'secondary: captions, authorship, sub-labels' },
  { token: '--tri-size-body', role: 'body', where: 'content rows: a verse, a lyric, a list item' },
  { token: '--tri-size', role: 'base', where: 'controls and titles' },
];

/** Reads what a token actually resolves to, so the sheet cannot go stale. */
function useResolved(tokens: string[], scopeRef: React.RefObject<HTMLElement | null>) {
  const [px, setPx] = useState<Record<string, string>>({});
  useEffect(() => {
    const el = scopeRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const next: Record<string, string> = {};
    tokens.forEach((t) => {
      next[t] = cs.getPropertyValue(t).trim() || '—';
    });
    setPx(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeRef.current]);
  return px;
}

function ScaleTable({ density }: { density?: 'compact' | 'comfortable' | 'touch' }) {
  const ref = useRef<HTMLDivElement>(null);
  const px = useResolved(
    TYPE_STEPS.map((s) => s.token),
    ref,
  );

  return (
    <div ref={ref} data-density={density} className="w-full">
      <div className="flex flex-col gap-3">
        {TYPE_STEPS.map((step) => (
          <div key={step.token} className="flex items-baseline gap-4">
            <span className="w-[68px] shrink-0 font-mono text-[length:var(--tri-size-xs)] text-[rgb(229_243_242_/_0.42)]">
              {px[step.token] ?? '…'}
            </span>
            <span
              className={cx(
                'w-[92px] shrink-0 font-mono text-[length:var(--tri-size-xs)] text-[rgb(229_243_242_/_0.62)]',
              )}
            >
              {step.role}
            </span>
            <span
              className={cx(
                'min-w-0 flex-1 text-[var(--tri-ink)]',
                step.role === 'eyebrow' && 'uppercase tracking-[0.18em]',
              )}
              style={{ fontSize: `var(${step.token})` }}
            >
              The entrance of thy words giveth light
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TriTypeScale() {
  return (
    <Sheet
      id="F-02"
      title="Type scale"
      status="done"
      summary="Five steps, named by the job each one does. The pixel column is read from the live computed value rather than written down, so this sheet cannot drift from tokens.css."
    >
      <Group title="Scale (comfortable — the default)">
        <Stage>
          <ScaleTable />
        </Stage>
      </Group>

      <Group title="Across the density tiers">
        <Stage>
          <div className="flex w-full flex-col gap-7">
            {(['compact', 'comfortable', 'touch'] as const).map((d) => (
              <Cell key={d} label={d}>
                <ScaleTable density={d} />
              </Cell>
            ))}
          </div>
        </Stage>
      </Group>

      <Note>
        <strong>body does not scale.</strong> Every other step grows with the density tier, because
        it is chrome. A verse is content — a bigger screen should show <em>more</em> verses, not
        bigger ones, so <code>--tri-size-body</code> is 13px at every tier. The same rule already
        governs row heights.
      </Note>

      <Spec
        rows={[
          ['steps', 'eyebrow · xs · sm · body · base — nothing outside them'],
          ['before', 'six ad-hoc sizes across the screens (9, 10, 11, 12, 13, 14) doing four jobs'],
          ['eyebrow', '9 / 9 / 10px by tier — always uppercase, tracking 0.18em'],
          ['xs', '10 / 11 / 12px by tier'],
          ['sm', '11 / 12 / 14px by tier'],
          ['body', '13px, fixed at every tier — it is content, not chrome'],
          ['base', '13 / 14 / 16px by tier — matches --tri-control-size'],
          ['face', 'var(--font-ui); scripture sets in --font-scripture'],
        ]}
      />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* F-05 — Surface tones                                               */
/* ------------------------------------------------------------------ */

const TONES: { tone: SurfaceTone; set: string; use: string }[] = [
  { tone: 'default', set: 'teal', use: "the system's own voice — the default for anything that acts" },
  { tone: 'ash', set: 'ash', use: 'neutral: a control that is not about anything in particular' },
  { tone: 'gold', set: 'gold', use: 'now, live, look here first — the accent as a surface' },
  { tone: 'indigo', set: 'indigo', use: 'a second voice that is not a warning' },
  { tone: 'danger', set: 'red', use: 'destructive actions only' },
];

/** The four stops of one hue set, read live so the sheet cannot drift. */
function Ramp({ set }: { set: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [stops, setStops] = useState<string[]>([]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    setStops(
      [1, 2, 3, 4].map((i) => cs.getPropertyValue(`--tri-${set}-${i}`).trim()).filter(Boolean),
    );
  }, [set]);

  return (
    <div ref={ref} className="flex gap-1">
      {stops.map((rgb, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span
            className="h-7 w-12 rounded-[5px]"
            style={{ backgroundColor: `rgb(${rgb})`, boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.08)' }}
          />
          <span className="font-mono text-[9px] text-neutral-500">{[0, 33, 66, 100][i]}%</span>
        </div>
      ))}
    </div>
  );
}

export function TriSurfaceTones() {
  return (
    <Sheet
      id="F-05"
      title="Surface tones"
      status="done"
      summary="One material in five colours. A tone sets four variables and nothing else — same 48° angle, same alpha-carries-state model, same two-phase hover — so a gold button and a teal one are unmistakably the same object."
    >
      {/*
        One group, not two. The sheet used to show the five tones twice —
        once as buttons to hover, once as a mono word above a row of flat
        swatches — which asked the reader to hold the claim "these are the
        same material" in their head across two stages. Each tone is now the
        real C-01 Button, wearing its own name, standing over its own ramp:
        the thing, its ingredients, and what it is for, on one line.
      */}
      <Group
        title="The five tones"
        hint="hover one — the middle stops light first, the dark edges follow a beat later"
      >
        <Stage>
          <div className="flex w-full flex-col gap-5">
            {TONES.map((t) => (
              <div key={t.tone} className="flex flex-col gap-2">
                {/* Not a swatch of the tone — an actual button in it. Same
                    component the app ships, so the hover on this sheet is
                    the hover in the product by construction rather than by
                    a copy of its CSS that can drift. */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button label={t.set} tone={t.tone} />
                  <span className="text-[11px] text-neutral-500">{t.use}</span>
                </div>
                <Ramp set={t.set} />
              </div>
            ))}
          </div>
        </Stage>
      </Group>

      <Note>
        <strong>The hover is the whole trick.</strong> Two custom properties carry the alpha —{' '}
        <code>--tri-a-mid</code> at 110ms and <code>--tri-a-edge</code> at 240ms after a 40ms
        delay — so the surface lights from the inside out instead of switching on. It is declared
        once on <code>.tri-surface</code>, which is why a new tone gets it for free: a tone changes
        colour, never behaviour.
      </Note>

      <Spec
        rows={[
          ['what a tone is', 'four custom properties: --tri-1 … --tri-4'],
          ['what it is not', 'a different angle, alpha ramp, radius, stroke or transition'],
          ['deriving one', "turn the hue, hold the teal ramp's lightness: dark stop, then three near-equal steps"],
          ['the drift', 'stops 2–4 shift hue slightly — without it the surface reads as flat tint'],
          ['rest / hover / active', 'alpha 0.30 / 0.70 / 0.65 — identical in every tone'],
          ['adding one', 'define --tri-<name>-1..4, add .tri-surface--<name>, extend SurfaceTone'],
        ]}
      />
    </Sheet>
  );
}
