const givingFields = { zelle: 'givingZelle', venmo: 'givingVenmo', cashApp: 'givingCashApp', paypal: 'givingPaypal', bankInfo: 'givingBankInfo', customUrl: 'givingCustomUrl', note: 'givingNote' } as const;
export const GIVING_SETTING_KEYS = Object.values(givingFields);
export function givingFromSettings(settings: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(givingFields).map(([publicKey, localKey]) => [publicKey, typeof settings[localKey] === 'string' ? String(settings[localKey]).trim() : '']));
}
export function publicStreamUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try { const url = new URL(value.trim()); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
