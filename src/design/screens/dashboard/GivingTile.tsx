import { isEmptyPreview } from '../../emptyPreviewMode';
import { Panel } from '../parts';
import { BankIcon, LinkIcon } from '../../../ui';
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

/* Each service in its own colour, the one people know it by. Unset, a
   method wears plain ink instead — colour means "this one is live". */
const METHODS: { key: string; label: string; ink: string }[] = [
  { key: 'givingZelle', label: 'zelle', ink: '#a879e6' },
  { key: 'givingVenmo', label: 'venmo', ink: '#4aa3ea' },
  { key: 'givingCashApp', label: 'cash app', ink: '#57c76a' },
  { key: 'givingPaypal', label: 'paypal', ink: '#5b8ede' },
  { key: 'givingBankInfo', label: 'bank', ink: '#8fd3c0' },
  { key: 'givingCustomUrl', label: 'giving page', ink: '#e4d87a' },
];

/* The card shows the handle people actually pay to, so the trailing half
   of a long one is what matters: @vrcministries reads, https://vrcmini…
   does not. A URL loses its scheme first, then its head. */
function payAddress(key: string, value: string): string {
  if (!value) return '';
  if (key === 'givingCustomUrl') {
    const bare = value.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return bare.length > 26 ? `…${bare.slice(-25)}` : bare;
  }
  return value.length > 26 ? `…${value.slice(-25)}` : value;
}

/*
 * The marks.
 *
 * Each service draws its own glyph rather than borrowing a logo file: a
 * wordmark at this size is unreadable, and a downloaded asset is a licence
 * question on a church's screen. These are the shapes people recognise —
 * Zelle's Z, Venmo's V, Cash App's $, PayPal's P, plus Solar's bank and link
 * — set in the service's own colour when it is configured and in plain ink
 * when it is not, so the card reads at a glance as "these three are on".
 */
function MethodMark({ id, color }: { id: string; color: string }) {
  const common = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none' } as const;
  switch (id) {
    case 'givingZelle':
      return (
        <svg {...common} aria-hidden>
          <path d="M12 2.5v3M12 18.5v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M7 6.5h10L7 17.5h10" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'givingVenmo':
      return (
        <svg {...common} aria-hidden>
          <path d="M6 5.5h4.4c.8 3.2 1.2 6 1.3 8.4 1.8-3 3.3-6.1 3.7-8.4H20c-1.2 5.3-4 10.4-7 13H9.2C7.9 13.6 7 9.4 6 5.5Z" fill={color} />
        </svg>
      );
    case 'givingCashApp':
      return (
        <svg {...common} aria-hidden>
          <path d="M12 3v2.2M12 18.8V21" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M15.6 8.2A4.2 4.2 0 0 0 12.4 7h-1a2.4 2.4 0 0 0-.7 4.7l3 1a2.4 2.4 0 0 1-.7 4.7h-1a4.2 4.2 0 0 1-3.2-1.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'givingPaypal':
      return (
        <svg {...common} aria-hidden>
          <path d="M8.5 20 10.8 4.5h4.4c2.6 0 4 1.5 3.6 3.9-.4 2.6-2.3 4.1-5.1 4.1h-2.3L10.7 20H8.5Z" fill={color} opacity="0.55" />
          <path d="M6 17 8.3 1.5" stroke="none" />
          <path d="M6.2 20 8.5 4.5h4.4c2.6 0 4 1.5 3.6 3.9-.4 2.6-2.3 4.1-5.1 4.1H9.1L8.4 20H6.2Z" fill={color} />
        </svg>
      );
    case 'givingBankInfo':
      return (
        <span style={{ color }}><BankIcon size={17} /></span>
      );
    default:
      return (
        <span style={{ color }}><LinkIcon size={17} /></span>
      );
  }
}


export function GivingTile({ className, face = 'strip' }: { className?: string; face?: 'strip' | 'card' }) {
  const rows = isEmptyPreview ? ROWS.map(row => row.kind === 'text' ? { ...row, value: '' } : row) : ROWS;
  const set = new Set(rows.filter((r) => r.kind === 'text' && r.value).map((r) => r.key));
  const on = METHODS.filter((m) => set.has(m.key));

  return (
    <Expandable
      className={className}
      title="Giving"
      blurb="Ways to give, shown on the companion page as tappable buttons."
      size={{ w: 640, h: 560 }}
      tile={({ onOpen }) =>
        face === 'card' ? (
          /*
            A list, not a grid of chips.
            
            The six names in boxes said only which methods exist — the one
            thing nobody needs to look up, since it is the same every week.
            What the booth is actually asked for mid-service is the HANDLE:
            "what's the Zelle?" So each method is a row — mark and name at
            the left, the number or handle at the right — and the rows that
            are set up carry their service's own colour, which is what makes
            "three of six are on" readable without counting.
          */
          <Panel
            title="giving"
            empty={set.size === 0}
            onOpen={onOpen}
            className="min-h-0 flex-1"
            bodyClass="pt-1"
          >
            <button
              type="button"
              onClick={onOpen}
              className="flex h-full w-full flex-col justify-between text-left"
            >
              {METHODS.map((m) => {
                const row = rows.find((r) => r.key === m.key);
                const value = row?.kind === 'text' ? String(row.value ?? '') : '';
                const active = set.has(m.key);
                const ink = active ? m.ink : 'rgb(229 243 242 / 0.28)';
                return (
                  <span
                    key={m.key}
                    className="flex min-h-0 flex-1 items-center gap-2.5 border-b border-[rgb(255_255_255_/_0.05)] px-0.5 last:border-b-0"
                  >
                    <span
                      className="grid size-[26px] shrink-0 place-items-center rounded-[5px]"
                      style={{
                        background: active ? `color-mix(in srgb, ${m.ink} 12%, transparent)` : 'rgb(255 255 255 / 0.035)',
                        boxShadow: `inset 0 0 0 1px ${active ? `color-mix(in srgb, ${m.ink} 30%, transparent)` : 'rgb(255 255 255 / 0.07)'}`,
                      }}
                    >
                      <MethodMark id={m.key} color={ink} />
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-[length:var(--tri-size)] lowercase"
                      style={{ color: active ? 'var(--tri-ink)' : 'rgb(229 243 242 / 0.4)' }}
                    >
                      {m.label}
                    </span>
                    <span
                      className="shrink-0 truncate text-right text-[length:var(--tri-size-xs)] tabular-nums"
                      style={{
                        maxWidth: '55%',
                        color: active ? 'rgb(229 243 242 / 0.62)' : 'rgb(229 243 242 / 0.22)',
                      }}
                      title={value || undefined}
                    >
                      {active ? payAddress(m.key, value) : 'not set up'}
                    </span>
                  </span>
                );
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
                const row = rows.find((r) => r.key === m.key);
                const value = row?.kind === 'text' ? row.value : undefined;
                return (
                  <span
                    key={m.key}
                    /* The handle behind the chip, on hover — the one detail
                       worth leaning in for without opening the card. */
                    title={active && value ? String(value) : 'not set up'}
                    className="rounded-md px-2 py-[2px] text-[length:var(--tri-size-eyebrow)] lowercase transition-[filter] hover:brightness-150"
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
              {on.length} of {METHODS.length}
            </span>
          </button>
        </Panel>
        )
      }
    >
      <RowList rows={rows} />
    </Expandable>
  );
}
