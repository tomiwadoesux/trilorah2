"use client";

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
      <div className="h-[calc(100vh-180px)] flex items-center justify-center text-sm text-gray-500">
        No giving methods configured.
      </div>
    );
  }

  const cards: Array<{ label: string; value: string; href?: string; copy?: boolean }> = [];
  if (methods.venmo) {
    cards.push({
      label: "Venmo",
      value: `@${methods.venmo}`,
      href: `https://venmo.com/${methods.venmo}`,
    });
  }
  if (methods.cashApp) {
    cards.push({
      label: "Cash App",
      value: `$${methods.cashApp}`,
      href: `https://cash.app/$${methods.cashApp}`,
    });
  }
  if (methods.paypal) {
    const href = methods.paypal.startsWith("http")
      ? methods.paypal
      : methods.paypal.includes("@")
        ? `https://paypal.me/${encodeURIComponent(methods.paypal)}`
        : `https://paypal.me/${methods.paypal}`;
    cards.push({ label: "PayPal", value: methods.paypal, href });
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
      href: methods.customUrl,
    });
  }

  if (cards.length === 0) {
    return (
      <div className="h-[calc(100vh-180px)] flex items-center justify-center text-sm text-gray-500">
        No giving methods configured.
      </div>
    );
  }

  return (
    <div className="px-5 py-6 pb-32 overflow-y-auto h-[calc(100vh-180px)] space-y-3">
      {methods.note && (
        <p className="text-sm text-gray-400 leading-relaxed mb-2 px-1">
          {methods.note}
        </p>
      )}
      {cards.map((c) => (
        <GivingCard key={c.label} {...c} />
      ))}
    </div>
  );
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
  const Body = (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 hover:border-brand/40 transition-colors">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">
        {label}
      </p>
      <p className="text-base font-medium text-white whitespace-pre-line break-all">
        {value}
      </p>
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
        onClick={() => {
          navigator.clipboard?.writeText(value);
        }}
        className="block w-full text-left"
      >
        {Body}
      </button>
    );
  }
  return Body;
}
