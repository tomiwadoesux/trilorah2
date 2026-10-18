import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ enqueue: vi.fn(), insert: vi.fn(), signedIn: true }));
vi.mock('./offlineQueue', () => ({ enqueue: mocks.enqueue, size: () => 0, flush: vi.fn() }));
vi.mock('./supabaseClient', () => ({
  isCloudConfigured: () => true,
  getPublicSupabase: () => null,
  getSupabase: () => ({
    auth: { getUser: async () => ({ data: { user: mocks.signedIn ? { id: 'owner' } : null } }) },
    from: (table: string) => table === 'accounts'
      ? { select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: 'church' }, error: null }) }) }) }) }
      : { insert: (data: unknown) => { mocks.insert(data); return { select: () => ({ single: async () => ({ data: { id: 'service' }, error: null }) }) }; } },
  }),
}));
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); mocks.enqueue.mockReset(); mocks.insert.mockReset(); mocks.signedIn = true; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
describe('companion publishing settings', () => {
  it('includes a configured stream when a service starts and queues edits for the same service', async () => {
    const cloud = await import('./cloudSync');
    const url = 'https://www.youtube.com/watch?v=sample';
    expect((await cloud.startService({ streamUrl: url, audienceTrainingEnabled: true })).success).toBe(true);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ stream_url: url, audience_training_enabled: true }));
    cloud.syncServiceCompanion({ streamUrl: null, audienceTrainingEnabled: false });
    expect(mocks.enqueue).toHaveBeenCalledWith({ table: 'services', op: 'update', payload: { id: 'service', stream_url: null, audience_training_enabled: false } });
  });
  it('queues giving changes instead of losing a failed network update', async () => {
    const { syncGivingMethods } = await import('./cloudSync');
    expect(await syncGivingMethods({ zelle: 'church@example.test' })).toBe(true);
    expect(mocks.enqueue).toHaveBeenCalledWith({ table: 'accounts', op: 'update', payload: { id: 'church', giving_methods: { zelle: 'church@example.test' } } });
  });
  it('does not report giving as queued while signed out, or send stream changes without a service', async () => {
    mocks.signedIn = false;
    const cloud = await import('./cloudSync');
    expect(await cloud.syncGivingMethods({})).toBe(false);
    cloud.syncServiceCompanion({ streamUrl: null, audienceTrainingEnabled: false });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});
