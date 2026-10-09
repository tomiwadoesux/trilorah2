import type { ServiceNotice } from '../shared/serviceNotice';

/** Retain early failures until the operator window subscribes. No Electron dependency. */
const notices = new Map<string, ServiceNotice>();
const noticeListeners = new Set<(notice: ServiceNotice) => void>();
const healthListeners = new Set<() => void>();
export function publishServiceNotice(notice: ServiceNotice) {
  if (notice.status === 'resolved') notices.delete(notice.id);
  else notices.set(notice.id, notice);
  for (const listener of noticeListeners) listener(notice);
}
export function currentServiceNotices() { return [...notices.values()]; }
export function observeServiceNotices(listener: (notice: ServiceNotice) => void) {
  noticeListeners.add(listener);
  return () => noticeListeners.delete(listener);
}
export function notifyCloudHealth() { for (const listener of healthListeners) listener(); }
export function observeCloudHealth(listener: () => void) { healthListeners.add(listener); return () => healthListeners.delete(listener); }
