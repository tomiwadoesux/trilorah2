import { useState, type CSSProperties } from 'react';
import { Button } from '../../ui/Button';
import { Slider } from '../../ui/Slider';
import { DashboardButton } from '../../ui/DashboardButton';
import { SettingsIcon, TrashIcon } from '../../ui/icons';
import { Sheet, Group, Cell, Matrix, Note, Spec, Stage } from '../Sheet';

/*
 * Sheets for the components built from the Figma file (Section 1, 38:236).
 * These are the real design system — the ui.tsx sheets alongside them are
 * the old greyscale baseline they replace.
 */

/** Hover cannot be photographed, so force the alpha to show it side by side. */
const HOVER = { '--tri-alpha': 0.7 } as CSSProperties;

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
          ['icons', 'exported from your file — settings 17px, trash 16px, recoloured to currentColor'],
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
      summary="Built from Slider (87:400). Drag it — a transparent range input sits on top, so pointer, keyboard and screen-reader behaviour come from the platform."
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

      <Spec
        rows={[
          ['track', '34px tall, 8px radius, solid #07271C border'],
          ['fill', 'same gradient at alpha 1.0'],
          ['ticks', '7 × 2px dots at --tri-ink-muted'],
          ['handle', '1px × 14px hairline'],
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
