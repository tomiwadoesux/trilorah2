import { create } from 'zustand';
import type { ServiceNotice } from '../../shared/serviceNotice';

export interface NotificationEntry extends ServiceNotice {
  status: 'active' | 'resolved';
  createdAt: number;
  updatedAt: number;
  read: boolean;
  dismissed: boolean;
  episode: number;
}

export function receiveNotice(entries: NotificationEntry[], notice: ServiceNotice, now: number): NotificationEntry[] {
  const old = entries.find(e => e.id === notice.id);
  const status = notice.status ?? 'active';
  if (!old && status === 'resolved') return entries;
  if (old?.status === 'resolved' && status === 'resolved') return entries;
  if (old && old.status === status && old.title === notice.title && old.detail === notice.detail && old.severity === notice.severity && JSON.stringify(old.actions) === JSON.stringify(notice.actions)) return entries;
  const recurring = old?.status === 'resolved' && status === 'active';
  const severityRank = { info: 0, warning: 1, error: 2 };
  const escalated = old && severityRank[notice.severity] > severityRank[old.severity];
  const differentProblem = old && old.title !== notice.title && status === 'active';
  const changed = old?.status !== status || old?.severity !== notice.severity;
  const entry: NotificationEntry = {
    ...notice, status, createdAt: !old || recurring ? now : old.createdAt,
    updatedAt: !old || changed ? now : old.updatedAt,
    read: !old || changed ? false : old.read,
    dismissed: recurring || escalated || differentProblem ? false : old?.dismissed ?? false,
    episode: (old?.episode ?? 0) + (!old || recurring ? 1 : 0),
  };
  const next = [entry, ...entries.filter(e => e.id !== notice.id)];
  // Retain unresolved problems; only trim old history.
  const active = next.filter(e => e.status === 'active');
  return [...active, ...next.filter(e => e.status === 'resolved').slice(0, Math.max(0, 200 - active.length))];
}

interface NotificationState {
  entries: NotificationEntry[];
  receive: (notice: ServiceNotice) => void;
  resolve: (id: string, detail?: string) => void;
  dismiss: (id: string) => void;
  readAll: () => void;
}
export const useNotificationStore = create<NotificationState>((set) => ({
  entries: [],
  receive: notice => set(s => ({ entries: receiveNotice(s.entries, notice, Date.now()) })),
  resolve: (id, detail = 'The check has recovered.') => set(s => {
    const old = s.entries.find(e => e.id === id);
    return old ? { entries: receiveNotice(s.entries, { ...old, status: 'resolved', detail, actions: undefined }, Date.now()) } : s;
  }),
  dismiss: id => set(s => ({ entries: s.entries.map(e => e.id === id ? { ...e, dismissed: true, read: true } : e) })),
  readAll: () => set(s => s.entries.some(e => !e.read) ? { entries: s.entries.map(e => ({ ...e, read: true })) } : s),
}));
