import { describe, expect, it } from 'vitest';
import { guideReadiness } from './guidePrerequisites';

describe('guide prerequisite checks', () => {
  it('distinguishes a missing key from an unavailable desktop bridge', async () => {
    expect(await guideReadiness('stock', undefined)).toBe('desktop');
    expect(await guideReadiness('stock', { getStockProviders: async () => [] })).toBe('missing-stock');
  });
  it('can return to search after saving a provider without reading its secret', async () => {
    let configured = false;
    const api = { getStockProviders: async () => configured ? ['pixabay'] : [] };
    expect(await guideReadiness('stock', api)).toBe('missing-stock');
    configured = true;
    expect(await guideReadiness('stock', api)).toBe('ready');
  });
  it('never calls a failed availability read a missing key', async () => {
    expect(await guideReadiness('stock', { getStockProviders: async () => { throw new Error('IPC disconnected'); } })).toBe('unknown');
  });
  it('checks the real database result, including a later recovery', async () => {
    expect(await guideReadiness('bible', { getDbStatus: async () => ({ connected: false }) })).toBe('missing-bible');
    expect(await guideReadiness('bible', { getDbStatus: async () => ({ connected: true }) })).toBe('ready');
    expect(await guideReadiness('bible', {})).toBe('desktop');
  });
});
