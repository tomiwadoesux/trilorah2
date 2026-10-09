import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon, ChevronRightIcon, MicIcon, PhoneIcon, QrIcon } from '../ui';
import { usePopupPlacement } from '../ui/primitives/usePopupPlacement';
import { useNoticeNavigation } from '../lib/notificationNavigation';
import { MobileRemotePanel } from './MobileRemotePanel';
import { PhoneMicPanel } from './PhoneMicPanel';
import { MobileStreamPanel } from './MobileStreamPanel';
import './mobileMenu.css';

type MobileFeature = 'microphone' | 'remote' | 'stream';
const FEATURES = [
  { id: 'microphone', label: 'Microphone', description: 'Use your phone for audio', Icon: MicIcon },
  { id: 'remote', label: 'Mobile remote', description: 'Control the service from your phone', Icon: PhoneIcon },
  { id: 'stream', label: 'Stream', description: 'QR code access to the service', Icon: QrIcon },
] as const;

/** One entry point to the phone's three jobs. Selecting a job never enables it. */
export function MobileMenu({ preview = false }: { preview?: boolean }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<MobileFeature | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const initialItem = useRef(0);
  const menuId = useId();
  const position = usePopupPlacement(open, trigger, menu);
  const placed = position !== null;
  const request = useNoticeNavigation(s => s.request);

  const closePanel = useCallback(() => {
    setActive(null);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (preview) return;
    const navigation = useNoticeNavigation.getState();
    if (navigation.target === 'remote') {
      setOpen(false);
      setActive('remote');
      navigation.clear();
    }
  }, [request, preview]);

  useEffect(() => {
    if (!open || !placed) return;
    const items = menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    items?.[initialItem.current]?.focus();
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, placed]);

  useEffect(() => {
    if (active) panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [active]);

  const select = (feature: MobileFeature) => { setOpen(false); setActive(feature); };
  const menuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
      setOpen(false);
      trigger.current?.focus();
    }
  };

  const panelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePanel(); }
    if (event.key !== 'Tab') return;
    const controls = [...panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]') ?? []]
      .filter(element => element.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  return <>
    <button ref={trigger} type="button" className="tri-header-control tri-header-remote tri-mobile-trigger"
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} title="Mobile tools"
      onClick={() => { initialItem.current = 0; setOpen(value => !value); }}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); initialItem.current = event.key === 'ArrowUp' ? FEATURES.length - 1 : 0; setOpen(true);
        }
      }}>
      <PhoneIcon size={12} className="tri-header-icon" />mobile<ChevronDownIcon size={10} className="tri-mobile-chevron" />
    </button>
    {open && createPortal(<div ref={menu} id={menuId} className="tri-mobile-menu" role="menu" aria-label="Mobile tools" onKeyDown={menuKey}
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: placed ? 'visible' : 'hidden' }}>
      {FEATURES.map(({ id, label, description, Icon }) => <button key={id} type="button" role="menuitem" className="tri-mobile-menu__item" onClick={() => select(id)}>
        <Icon size={19} /><span><strong>{label}</strong><small>{description}</small></span><ChevronRightIcon size={12} />
      </button>)}
    </div>, document.body)}
    {active && createPortal(<div ref={panel} onKeyDownCapture={panelKey}>
      {active === 'microphone' && <PhoneMicPanel open onClose={closePanel} preview={preview} />}
      {active === 'remote' && <MobileRemotePanel open onClose={closePanel} preview={preview} />}
      {active === 'stream' && <MobileStreamPanel onClose={closePanel} preview={preview} />}
    </div>, document.body)}
  </>;
}
