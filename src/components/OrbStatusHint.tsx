import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/** A portal keeps the orb's message above the workspace cards and their clipping. */
export function OrbStatusHint({ id, message, anchor, automatic = false }: {
  id: string; message: string; anchor: RefObject<HTMLDivElement | null>;
  automatic?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      if (!anchor.current || !panel.current) return;
      const group = anchor.current.getBoundingClientRect();
      const button = anchor.current.closest('.tri-live-controls')?.querySelector('.tri-orb-action')?.getBoundingClientRect();
      const rowHeight = button?.height ?? (parseFloat(getComputedStyle(anchor.current).getPropertyValue('--tri-field-h')) || 38);
      panel.current.style.setProperty('--orb-hint-height', `${rowHeight}px`);
      const controls = anchor.current.closest('.tri-live-controls')?.querySelector('[data-guide="mobile-tools"]')?.getBoundingClientRect();
      const rightEdge = controls ? controls.left - 16 : window.innerWidth - 12;
      const availableWidth = Math.max(0, rightEdge - group.right - 8);
      const beside = availableWidth >= 96;
      panel.current.style.maxWidth = `${beside ? availableWidth : Math.max(96, window.innerWidth - 24)}px`;
      const hint = panel.current.getBoundingClientRect();
      const left = beside ? group.right + 8 : Math.max(12, Math.min(group.left, window.innerWidth - hint.width - 12));
      const top = beside ? (button?.top ?? group.top + (group.height - rowHeight) / 2) : group.bottom + 8;
      setPosition({ left, top: Math.max(beside ? 0 : 12, Math.min(top, window.innerHeight - hint.height - 12)) });
    };
    place();
    const observer = new ResizeObserver(place);
    if (anchor.current) observer.observe(anchor.current);
    if (panel.current) observer.observe(panel.current);
    const action = anchor.current?.closest('.tri-live-controls')?.querySelector('.tri-orb-action');
    const controls = anchor.current?.closest('.tri-live-controls')?.querySelector('[data-guide="mobile-tools"]');
    if (action) observer.observe(action);
    if (controls) observer.observe(controls);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, message]);
  return createPortal(<div ref={panel} id={id} role={automatic ? 'status' : 'tooltip'} title={message} className="tri-orb-status-hint" data-automatic={automatic || undefined}
    style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden' }}>
    <span>{message}</span>
  </div>, document.body);
}
