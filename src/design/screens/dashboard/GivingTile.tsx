import { Panel } from '../parts';
import { Expandable } from './expand';
import { RowList, type Row } from '../settingsRows';

/*
 * Giving — the ways to give, as the companion page will show them.
 *
 * The short strip in the right column. It shows which methods are set up
 * as a row of chips and nothing else, because that is the whole question
 * before a service: is the giving page going to have buttons on it. Press
 * it and the strip opens onto the seven fields.
 */

const ROWS: Row[] = [
  { kind: 'text', key: 'givingZelle', label: 'Zelle', blurb: '', value: 'give@vrcministries.org', placeholder: 'email or phone' },
  { kind: 'text', key: 'givingVenmo', label: 'Venmo', blurb: '', value: '@vrcministries', placeholder: '@handle' },
  { kind: 'text', key: 'givingCashApp', label: 'Cash App', blurb: '', value: '', placeholder: '$cashtag' },
  { kind: 'text', key: 'givingPaypal', label: 'PayPal', blurb: '', value: '', placeholder: 'paypal.me/…' },
  { kind: 'text', key: 'givingBankInfo', label: 'Bank transfer', blurb: 'Account name, sort code or routing, account number.', value: '' },
  { kind: 'text', key: 'givingCustomUrl', label: 'Giving page', blurb: 'Your own giving link, if you have one.', value: 'https://vrcministries.org/give', placeholder: 'https://' },
  { kind: 'text', key: 'givingNote', label: 'Note', blurb: 'A line shown above the giving buttons.', value: 'Thank you for partnering with us.' },
];

const METHODS: { key: string; label: string }[] = [
  { key: 'givingZelle', label: 'zelle' },
  { key: 'givingVenmo', label: 'venmo' },
  { key: 'givingCashApp', label: 'cash app' },
  { key: 'givingPaypal', label: 'paypal' },
  { key: 'givingBankInfo', label: 'bank' },
  { key: 'givingCustomUrl', label: 'giving page' },
];

/* Where a method's mark goes once there is art for it. Until then the
   name, set in the method's own colour when it is configured. */
function Mark({ label, active, value }: { label: string; active: boolean; value?: string }) {
  return (
    <span
      title={active && value ? value : 'not set up'}
      className="flex min-h-0 items-center justify-center rounded-[10px] border text-[length:var(--tri-size-xs)] lowercase transition-[filter,border-color] hover:brightness-150"
      style={{
        color: active ? '#8fd3c0' : 'rgb(229 243 242 / 0.3)',
        borderColor: active ? 'rgb(143 211 192 / 0.3)' : 'rgb(255 255 255 / 0.08)',
        background: active ? 'rgb(143 211 192 / 0.05)' : 'transparent',
      }}
    >
      {label}
    </span>
  );
}

export function GivingTile({ className, face = 'strip' }: { className?: string; face?: 'strip' | 'card' }) {
  const set = new Set(ROWS.filter((r) => r.kind === 'text' && r.value).map((r) => r.key));
  const on = METHODS.filter((m) => set.has(m.key));

  return (
    <Expandable
      className={className}
      title="Giving"
      blurb="Ways to give, shown on the companion page as tappable buttons."
      size={{ w: 640, h: 560 }}
      tile={({ onOpen }) =>
        face === 'card' ? (
          <Panel title="giving" className="min-h-0 flex-1">
            <button type="button" onClick={onOpen} className="grid h-full w-full grid-cols-3 grid-rows-2 gap-2 text-left">
              {METHODS.map((m) => {
                const row = ROWS.find((r) => r.key === m.key);
                return <Mark key={m.key} label={m.label} active={set.has(m.key)} value={row?.kind === 'text' ? row.value : undefined} />;
              })}
            </button>
          </Panel>
        ) : (
        <Panel className="min-h-0 flex-1" bodyStyle={{ padding: 0 }}>
          <button type="button" onClick={onOpen} className="flex h-full w-full items-center gap-3 px-3 text-left">
            <span className="shrink-0 text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em] text-[rgb(229_243_242_/_0.55)]">giving</span>
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 overflow-hidden">
              {METHODS.map((m) => {
                const active = set.has(m.key);
                const row = ROWS.find((r) => r.key === m.key);
                const value = row?.kind === 'text' ? row.value : undefined;
                return (
                  <span
                    key={m.key}
                    /* The handle behind the chip, on hover — the one detail
                       worth leaning in for without opening the card. */
                    title={active && value ? String(value) : 'not set up'}
                    className="rounded-full px-2 py-[2px] text-[length:var(--tri-size-eyebrow)] lowercase transition-[filter] hover:brightness-150"
                    style={{
                      color: active ? '#8fd3c0' : 'rgb(229 243 242 / 0.3)',
                      boxShadow: `inset 0 0 0 1px ${active ? 'rgb(143 211 192 / 0.35)' : 'rgb(255 255 255 / 0.08)'}`,
                    }}
                  >
                    {m.label}
                  </span>
                );
              })}
            </span>
            <span className="shrink-0 text-[length:var(--tri-size-eyebrow)] tabular-nums text-[rgb(229_243_242_/_0.45)]">
              {on.length} of {METHODS.length} ›
            </span>
          </button>
        </Panel>
        )
      }
    >
      <RowList rows={ROWS} />
    </Expandable>
  );
}
