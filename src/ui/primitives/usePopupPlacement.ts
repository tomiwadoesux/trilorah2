import { useLayoutEffect, useState, type RefObject } from 'react';
import { popupPlacement } from '../../lib/popupPlacement';

export function usePopupPlacement(open: boolean, anchor: RefObject<HTMLElement | null>, panel: RefObject<HTMLElement | null>, align: 'left' | 'right' = 'right') {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) { setPosition(null); return; }
    const place = () => {
      if (!anchor.current || !panel.current) return;
      const rect = panel.current.getBoundingClientRect();
      const next = popupPlacement(anchor.current.getBoundingClientRect(), rect, { width: window.innerWidth, height: window.innerHeight }, align);
      setPosition(old => old?.left === next.left && old?.top === next.top ? old : next);
    };
    place();
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    if (anchor.current) observer.observe(anchor.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, anchor, panel, align]);
  return position;
}

export const popupBounds = { maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto', overscrollBehavior: 'contain' } as const;
