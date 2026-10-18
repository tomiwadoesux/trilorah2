"use client";
import { useState } from 'react';
import { ArrowUpRight, Check, Copy } from '@/components/icons';
import { IconCredits } from '@/components/IconCredits';

interface GivingMethods {
  zelle: string;
  venmo: string;
  cashApp: string;
  paypal: string;
  bankInfo: string;
  customUrl: string;
  note: string;
}

export default function GiveTab({ methods }: { methods: GivingMethods | null }) {
  if (!methods) {
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-4 items-center justify-center text-sm text-gray-500">
        Giving details haven’t been added by your church yet.
        <IconCredits />
      </div>
    );
  }

  const cards: Array<{ label: string; value: string; href?: string; copy?: boolean }> = [];
  if (methods.venmo) {
    const handle = methods.venmo.trim().replace(/^@/, '');
    cards.push({
      label: "Venmo",
      value: `@${handle}`,
      href: `https://venmo.com/${encodeURIComponent(handle)}`,
    });
  }
  if (methods.cashApp) {
    const handle = methods.cashApp.trim().replace(/^\$/, '');
    cards.push({
      label: "Cash App",
      value: `$${handle}`,
      href: `https://cash.app/$${encodeURIComponent(handle)}`,
    });
  }
  if (methods.paypal) {
    const value = methods.paypal.trim();
    const href = value.includes('@') ? undefined : value.startsWith('http') ? safeGivingUrl(value)
      : value.startsWith('paypal.me/') ? safeGivingUrl('https://' + value) : 'https://paypal.me/' + encodeURIComponent(value);
    cards.push({ label: 'PayPal', value, href, copy: !href });
  }
  if (methods.zelle) {
    cards.push({ label: "Zelle", value: methods.zelle, copy: true });
  }
  if (methods.bankInfo) {
    cards.push({ label: "Bank info", value: methods.bankInfo, copy: true });
  }
  if (methods.customUrl) {
    cards.push({
      label: "Online giving",
      value: methods.customUrl,
      href: safeGivingUrl(methods.customUrl),
      copy: !safeGivingUrl(methods.customUrl),
    });
  }

  if (cards.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-4 items-center justify-center text-sm text-gray-500">
        Giving details haven’t been added by your church yet.
        <IconCredits />
      </div>
    );
  }

  return (
    <div className="companion-giving overflow-y-auto flex-1 min-h-0">
      {methods.note && (
        <p className="text-sm text-gray-400 leading-relaxed mb-2 px-1">
          {methods.note}
        </p>
      )}
      {cards.map((c) => (
        <GivingCard key={c.label} {...c} />
      ))}
      <IconCredits className="pt-4 px-1" />
    </div>
  );
}

function safeGivingUrl(value: string): string | undefined {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}

function GivingCard({
  label,
  value,
  href,
  copy,
}: {
  label: string;
  value: string;
  href?: string;
  copy?: boolean;
}) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const Body = (
    <div className="companion-giving-row">
      <div className="companion-giving-copy">
        <p>{label}</p>
        <p>{value}</p>
      </div>
      {href ? <span className="companion-giving-action">Open <ArrowUpRight size={16}/></span> : copy ? <span className="companion-giving-action" aria-live="polite">{copyStatus === 'copied' ? <><Check size={16}/>Copied</> : copyStatus === 'failed' ? 'Try again' : <><Copy size={16}/>Copy</>}</span> : null}
    </div>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {Body}
      </a>
    );
  }
  if (copy) {
    return (
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopyStatus('copied');
          } catch {
            setCopyStatus('failed');
          }
        }}
        className="block w-full text-left"
      >
        {Body}
      </button>
    );
  }
  return Body;
}
