import { describe, expect, it } from 'vitest';
import { companionPublishLine } from './companionStatus';

const base: CloudStatus = { configured: true, signedIn: true, hasAccount: true, activeServiceId: null };

describe('companionPublishLine', () => {
  it('says why the page is empty when the app is signed out', () => {
    expect(companionPublishLine({ ...base, signedIn: false })).toMatchObject({ tone: 'warn', text: expect.stringContaining('not signed in') });
  });
  it('waits quietly for Start Listening', () => {
    expect(companionPublishLine(base)).toMatchObject({ tone: 'idle' });
  });
  it('reports a service that could not open', () => {
    expect(companionPublishLine({ ...base, serviceError: 'Not signed in' })).toMatchObject({ tone: 'warn', text: expect.stringContaining('Not signed in') });
  });
  it('is live once the service is open and writes are flowing', () => {
    expect(companionPublishLine({ ...base, activeServiceId: 's1', queue: { pending: 0, lastError: null, lastErrorAt: null } })).toEqual({ tone: 'live', text: 'live on the page' });
  });
  it('flags writes stuck behind a failure', () => {
    const line = companionPublishLine({ ...base, activeServiceId: 's1', queue: { pending: 12, lastError: 'fetch failed', lastErrorAt: 1 } });
    expect(line).toMatchObject({ tone: 'warn', text: '12 updates waiting — fetch failed' });
  });
  it('says nothing before the first answer', () => {
    expect(companionPublishLine(null)).toBeNull();
  });
});
