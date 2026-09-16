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

export function GivingTile({ className }: { className?: string }) {
  const set = new Set(ROWS.filter((r) => r.kind === 'text' && r.value).map((r) => r.key));
  const on = METHODS.filter((m) => set.has(m.key));

  return (
    <Expandable
      className={className}
      title="Giving"
      blurb="Ways to give, shown on the companion page as tappable buttons."
      size={{ w: 640, h: 560 }}
      tile={({ onOpen }) => (
        <Panel className="min-h-0 flex-1" bodyStyle={{ padding: 0 }} unavailable="add your giving details to show them on the companion page">
          <button type="button" onClick={onOpen} className="flex h-full w-full items-center gap-3 px-3 text-left">
            <span className="shrink-0 text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em] text-[rgb(229_243_242_/_0.55)]">giving</span>
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 overflow-hidden">
              {METHODS.map((m) => {
                const active = set.has(m.key);
                return (
                  <span
                    key={m.key}
                    className="rounded-full px-2 py-[2px] text-[length:var(--tri-size-eyebrow)] lowercase"
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
      )}
    >
      <RowList rows={ROWS} />
    </Expandable>
  );
}
