import { describe, it, expect } from 'vitest';
import { givingFromSettings, publicStreamUrl } from './companionSettings';
describe('public companion settings', () => {
  it('maps only public giving fields and never substitutes sample destinations', () => {
    expect(givingFromSettings({ givingZelle: ' church@example.test ', givingCashApp: '$church', apiKey: 'private' })).toEqual({ zelle: 'church@example.test', venmo: '', cashApp: '$church', paypal: '', bankInfo: '', customUrl: '', note: '' });
    expect(Object.values(givingFromSettings({})).every(v => v === '')).toBe(true);
  });
  it('normalizes public stream URLs, clearing empty or unsafe values', () => {
    expect(publicStreamUrl(' https://www.youtube.com/watch?v=example ')).toBe('https://www.youtube.com/watch?v=example');
    for (const value of ['', 'javascript:alert(1)', 'https://user:secret@example.com', 'not a url']) expect(publicStreamUrl(value)).toBeNull();
  });
});
