import { useEffect, useState } from 'react';
import { ContextMenu, type ContextMenuState } from '../design/screens/run/ContextMenu';
import { GUIDE_ACTION_SELECTOR } from '../lib/contextGuide';

/** Existing specialized menus handle their own event; this fills the remaining controls. */
export function GuideContextMenu() {
  const [at, setAt] = useState<ContextMenuState | null>(null);
  useEffect(() => {
    const control = (target: EventTarget | null) => {
      if (!(target instanceof Element) || target.closest('.tri-context-menu, .product-guide-panel, .product-guide-demo, input, textarea, [contenteditable="true"]')) return null;
      return target.closest<HTMLElement>(GUIDE_ACTION_SELECTOR);
    };
    const pointer = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const target = control(event.target);
      if (!target) return;
      event.preventDefault();
      const rect = target.getBoundingClientRect();
      setAt({ x: event.clientX || rect.left + 12, y: event.clientY || rect.bottom - 2, from: target });
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) return;
      const target = control(event.target);
      if (!target) return;
      event.preventDefault();
      const rect = target.getBoundingClientRect();
      setAt({ x: rect.left + 12, y: rect.bottom - 2, from: target });
    };
    window.addEventListener('contextmenu', pointer);
    window.addEventListener('keydown', keyboard);
    return () => { window.removeEventListener('contextmenu', pointer); window.removeEventListener('keydown', keyboard); };
  }, []);
  return <ContextMenu at={at} items={[]} label="Control help" onClose={() => setAt(null)} onSelect={() => undefined} />;
}
