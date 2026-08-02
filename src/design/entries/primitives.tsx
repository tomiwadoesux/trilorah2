import { useState } from 'react';
import {
  Button,
  TextButton,
  Panel,
  PanelHeader,
  SectionLabel,
  Pill,
  LevelMeter,
  TrustBar,
  Toggle,
  Field,
  EmptyState,
} from '../../components/ui';
import { Sheet, Group, Cell, Matrix, Note, Spec, OnCanvas } from '../Sheet';

/*
 * Sheets for what already exists in src/components/ui.tsx — the baseline
 * the custom UI replaces. Every variant and state on one page, so a new
 * design can be checked against the whole surface at once.
 */

/* ------------------------------------------------------------------ */
/* C-01 — Button                                                       */
/* ------------------------------------------------------------------ */

const VARIANTS = ['solid', 'outline', 'text'] as const;

export function Buttons() {
  return (
    <Sheet
      id="C-01"
      title="Button"
      status="draft"
      summary="Three volumes, two sizes, one disabled state. The inventory calls for six variants, five sizes, and loading — this sheet is the gap made visible."
    >
      <Group title="Variant × size">
        <Matrix cols={3}>
          {VARIANTS.map((v) => (
            <Cell key={v} label={`${v} · default`}>
              <Button label="Go live" variant={v} />
            </Cell>
          ))}
          {VARIANTS.map((v) => (
            <Cell key={`${v}-big`} label={`${v} · big`}>
              <Button label="Go live" variant={v} big />
            </Cell>
          ))}
          {VARIANTS.map((v) => (
            <Cell key={`${v}-disabled`} label={`${v} · disabled`}>
              <Button label="Go live" variant={v} disabled />
            </Cell>
          ))}
        </Matrix>
      </Group>

      <Group title="Legacy" hint="TextButton — kept for screens not yet migrated">
        <Cell label="TextButton">
          <TextButton label="Primary" primary />
          <TextButton label="Default" />
          <TextButton label="Disabled" disabled />
        </Cell>
      </Group>

      <Note>
        <strong>Finding: solid buttons break in booth mode.</strong> <code>Button</code> hardcodes{' '}
        <code>text-white</code> against <code>bg-accent</code>. The accent inverts to white in dark
        mode, so the label goes white-on-white — flip the theme toggle to see it. The fix is a{' '}
        <code>--color-on-accent</code> token (already provisional in{' '}
        <code>src/design/sandbox.css</code>), not a per-component override.
      </Note>

      <Note>
        <strong>Missing:</strong> danger, ghost, and the oversized <em>live</em> volume (D-25);
        loading state; icon slots; icon-only (C-02); full-width. Nothing in the app can currently
        express a destructive action.
      </Note>

      <Spec
        rows={[
          ['props', 'label, onClick, variant, disabled, title, big'],
          ['sizes', 'default (px-3 py-1.5 text-xs) · big (px-5 py-2.5 text-sm)'],
          ['type', 'always uppercase, tracking-widest, font-semibold'],
          ['a11y gap', 'no loading/busy state, no aria-label path for icon-only'],
        ]}
      />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* C-27 — Panel                                                        */
/* ------------------------------------------------------------------ */

export function Panels() {
  return (
    <Sheet
      id="C-27 / C-28 / C-29"
      title="Panel, PanelHeader, SectionLabel"
      status="draft"
      summary="The container the entire UI is made of: a white card on paper with a hairline border."
    >
      <Group title="Variants">
        <Matrix cols={2}>
          <Cell label="padded (default)">
            <Panel className="w-full">
              <PanelHeader right={<Pill active>3</Pill>}>verse queue</PanelHeader>
              <p className="text-sm text-neutral-500">Romans 8:28 — “we’ll come back to that”</p>
            </Panel>
          </Cell>
          <Cell label="pad={false}">
            <Panel pad={false} className="w-full">
              <div className="border-b border-hairline px-4 py-2">
                <SectionLabel>transcript</SectionLabel>
              </div>
              <p className="px-4 py-3 text-sm text-neutral-500">…turn with me to John chapter 3</p>
            </Panel>
          </Cell>
        </Matrix>
      </Group>

      <Note>
        <strong>Missing:</strong> footer slot, collapse, overflow menu, and a <code>tone</code> for
        live/warning states. The Live surface needs a panel that can say “this one is on air”.
      </Note>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* C-43 — Pill                                                         */
/* ------------------------------------------------------------------ */

export function Pills() {
  return (
    <Sheet
      id="C-43"
      title="Pill / Badge"
      status="draft"
      summary="Two states today: active and not. The inventory calls for seven tones."
    >
      <Group title="Shipped">
        <Cell label="active / inactive">
          <Pill active>live</Pill>
          <Pill>preview</Pill>
          <Pill active>12</Pill>
          <Pill>intent · reading</Pill>
        </Cell>
      </Group>

      <Note>
        <strong>Missing tones:</strong> ok, warn, danger, ai. A dropped ASR connection and a
        detected verse currently look identical.
      </Note>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* D-03 / D-06 — meters                                                */
/* ------------------------------------------------------------------ */

export function Meters() {
  return (
    <Sheet
      id="D-03 / D-06"
      title="LevelMeter & TrustMeter"
      status="draft"
      summary="The two engine readouts that already exist. Both are domain components, not primitives — they encode meaning."
    >
      <Group title="LevelMeter — dB, −60…0">
        <Matrix cols={5}>
          {[null, -60, -40, -20, -3].map((db, i) => (
            <Cell key={i} label={db == null ? 'no signal' : `${db} dB`}>
              <LevelMeter db={db} />
            </Cell>
          ))}
        </Matrix>
      </Group>

      <Group title="TrustMeter — 0…1, with the auto-mode gate">
        <div className="max-w-md space-y-4">
          {[0.42, 0.88, 0.93].map((v) => (
            <div key={v} className="space-y-1">
              <div className="flex justify-between font-mono text-[10px] text-neutral-400">
                <span>trust {Math.round(v * 100)}%</span>
                <span>gate 90%</span>
              </div>
              <TrustBar value={v} gate={0.9} />
            </div>
          ))}
        </div>
      </Group>

      <Note>
        <strong>Missing:</strong> the meter has no clip indicator and no peak hold, so an operator
        cannot see that the mic is overdriving. There is also no visual difference between “below
        gate” and “above gate” beyond bar length.
      </Note>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* C-19 / C-24 / C-67 — form + empty                                   */
/* ------------------------------------------------------------------ */

export function FormsAndEmpty() {
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);

  return (
    <Sheet
      id="C-19 / C-24 / C-67"
      title="Toggle, Field, EmptyState"
      status="draft"
      summary="Everything Settings is currently built from. Note there is no error state anywhere in the form layer."
    >
      <Group title="Toggle">
        <Cell label="on / off / disabled">
          <Toggle checked={on} onChange={setOn} label="agent enabled" />
          <Toggle checked={off} onChange={setOff} label="slow path" />
          <Toggle checked={false} onChange={() => {}} label="disabled" disabled />
        </Cell>
      </Group>

      <Group title="Field" hint="inputs are bare — hairline underline, no box">
        <div className="max-w-sm space-y-4">
          <Field label="church name" hint="shown on the companion page">
            <input className="w-full" defaultValue="Grace Chapel" />
          </Field>
          <Field label="auto-display timeout" hint="seconds before a verse clears itself">
            <input className="w-full" type="number" defaultValue={30} />
          </Field>
        </div>
      </Group>

      <Group title="EmptyState">
        <EmptyState>no verses queued</EmptyState>
      </Group>

      <Note>
        <strong>Finding: no error state exists.</strong> <code>Field</code> has a hint but no error
        slot, and no component in <code>ui.tsx</code> can render a validation failure. Settings has
        no way to tell the operator a Deepgram key was rejected.
      </Note>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* O-01 — the projector surface                                        */
/* ------------------------------------------------------------------ */

export function OutputSurface() {
  return (
    <Sheet
      id="O-01"
      title="Scripture slide"
      status="todo"
      summary="What the congregation sees. Designed here, but always verified in a real output window — the real one is frameless and transparent, which a preview cannot reproduce."
    >
      <Group title="On canvas">
        <OnCanvas>
          <div className="mx-auto max-w-3xl space-y-6 px-8 py-12 text-center">
            <p className="font-scripture text-4xl leading-snug text-white">
              For God so loved the world, that he gave his only begotten Son, that whosoever
              believeth in him should not perish, but have everlasting life.
            </p>
            <p className="text-sm uppercase tracking-[0.3em] text-white/60">John 3:16 · KJV</p>
          </div>
        </OnCanvas>
      </Group>

      <Note>
        This is a placeholder, not a design. D-23 (<code>OutputRenderer</code>) is the real target:
        one renderer shared by this sheet, the Preview monitor, the Program monitor, and the actual
        projector window — so preview can never disagree with live.
      </Note>
    </Sheet>
  );
}
