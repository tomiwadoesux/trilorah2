import { create } from 'zustand';
import type { NoticeTarget } from '../../shared/serviceNotice';

export const useNoticeNavigation = create<{ target: NoticeTarget | null; request: number; open: (target: NoticeTarget) => void; clear: () => void }>(set => ({
  target: null, request: 0,
  open: target => set(s => ({ target, request: s.request + 1 })),
  clear: () => set({ target: null }),
}));
export const openNoticeTarget = (target: NoticeTarget) => useNoticeNavigation.getState().open(target);
