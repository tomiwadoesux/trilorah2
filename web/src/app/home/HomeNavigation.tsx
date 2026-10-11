'use client';

import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type MouseEvent, type ComponentType } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, ChevronDown, Radio, StickyNote, QrCode, Download, X, type IconProps } from '@/components/icons';
import BrandMark from '../live/[slug]/components/BrandMark';
import { MenuArtwork } from './MenuArtwork';
import './home-navigation.css';

type MenuId = 'product' | 'companion' | 'notebook';
type MenuLink = { title: string; description: string; href: string; icon: ComponentType<IconProps> };
const menus: { id: MenuId; label: string; width: number; height: number; links: MenuLink[] }[] = [
  { id: 'product', label: 'Product', width: 920, height: 376, links: [
    { title: 'The workspace', description: 'Bring the whole service into one place.', href: '#workspace', icon: Radio },
    { title: 'Live scripture', description: 'Follow the message as it unfolds.', href: '#workflow', icon: BookOpen },
    { title: 'Try the flow', description: 'Explore an interactive service preview.', href: '#assistant', icon: ArrowRight },
    { title: 'Portable services', description: 'Keep the details together in a .tri file.', href: '#notes', icon: Download },
  ] },
  { id: 'companion', label: 'Companion', width: 690, height: 354, links: [
    { title: 'One simple scan', description: 'Open the service on any phone.', href: '#companion', icon: QrCode },
    { title: 'Follow every word', description: 'Live scripture and a readable transcript.', href: '#companion', icon: BookOpen },
    { title: 'Return to the message', description: 'Revisit sermon notes and key passages.', href: '#companion', icon: StickyNote },
  ] },
  { id: 'notebook', label: 'Notebook', width: 660, height: 326, links: [
    { title: 'Inside Trilorah', description: 'A closer look at the way it all works.', href: '#notes', icon: BookOpen },
    { title: 'The congregation companion', description: 'A thought worth taking home.', href: '#notes', icon: StickyNote },
    { title: 'Your visual studio', description: 'Original patterns. Make one your own.', href: '#line-studio', icon: Radio },
  ] },
];
const mobileLinks = [['Product', '#workflow'], ['Companion', '#companion'], ['Notebook', '#notes'], ['Visual studio', '#line-studio']];

export function HomeNavigation() {
  const [active, setActive] = useState<MenuId | null>(null);
  const [lastActive, setLastActive] = useState<MenuId>('product');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const header = useRef<HTMLElement>(null);
  const triggers = useRef<Partial<Record<MenuId, HTMLButtonElement>>>({});
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const keyboardRef = useRef(keyboardMode);
  keyboardRef.current = keyboardMode;
  const activeRef = useRef(active);
  activeRef.current = active;
  const selected = menus.find((item) => item.id === lastActive)!;

  function cancelClose() { if (closeTimer.current) clearTimeout(closeTimer.current); }
  function show(id: MenuId) { cancelClose(); setMobileOpen(false); setLastActive(id); setActive(id); }
  function close() { cancelClose(); setActive(null); }
  function scheduleClose() {
    cancelClose();
    // A short grace period lets the pointer cross from the navigation into its panel.
    closeTimer.current = setTimeout(() => { if (!keyboardRef.current || !header.current?.contains(document.activeElement)) setActive(null); }, 140);
  }
  function activate(event: MouseEvent<HTMLButtonElement>, id: MenuId) {
    if (event.detail === 0) { setKeyboardMode(true); if (active === id) close(); else show(id); }
    else { setKeyboardMode(false); show(id); }
  }
  function onTriggerKey(event: KeyboardEvent<HTMLButtonElement>, id: MenuId) {
    if (event.key !== 'ArrowDown' && !(event.key === 'Tab' && !event.shiftKey && active === id)) return;
    event.preventDefault(); setKeyboardMode(true); show(id);
    requestAnimationFrame(() => document.querySelector<HTMLAnchorElement>(`#home-menu-${id} a`)?.focus({ preventScroll: true }));
  }
  function onBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { close(); setMobileOpen(false); }
  }
  function escape(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (active) { const previous = active; close(); triggers.current[previous]?.focus({ preventScroll: true }); }
    else if (mobileOpen) { setMobileOpen(false); document.getElementById('home-menu-button')?.focus(); }
  }
  function followLink() { close(); setMobileOpen(false); }
  function onPanelKey(event: KeyboardEvent<HTMLDivElement>, id: MenuId) {
    if (event.key !== 'Tab') return;
    const links = event.currentTarget.querySelectorAll<HTMLAnchorElement>('a');
    if (event.shiftKey && event.target === links[0]) {
      event.preventDefault(); close(); triggers.current[id]?.focus({ preventScroll: true });
    } else if (!event.shiftKey && event.target === links[links.length - 1]) {
      event.preventDefault(); close();
      const next = menus[menus.findIndex((item) => item.id === id) + 1];
      if (next) triggers.current[next.id]?.focus({ preventScroll: true });
      else header.current?.querySelector<HTMLAnchorElement>('.home-nav-links > a')?.focus({ preventScroll: true });
    }
  }

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) { setActive(null); setMobileOpen(false); }
    };
    const onEscape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape' && !header.current?.contains(event.target as Node)) setActive(null); };
    const onScroll = () => { if (activeRef.current) setActive(null); };
    const onResize = () => { setActive(null); setMobileOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => { cancelClose(); document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onEscape); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); };
  }, []);

  const visible = active !== null;
  return (
    <>
      <div className="home-menu-backdrop" data-open={visible} aria-hidden="true" onPointerDown={close} />
      <header ref={header} className="home-nav home-nav-with-menu" data-menu-open={visible} data-keyboard={keyboardMode} onKeyDown={escape} onBlur={onBlur} onPointerLeave={scheduleClose} onPointerEnter={cancelClose}>
        <div className="home-container home-nav-inner">
          <a href="#main" className="home-brand" aria-label="Trilorah home" onClick={followLink}><BrandMark />Trilorah</a>
          <nav className="home-nav-links" aria-label="Main navigation">
            {menus.map((menu) => <button type="button" className="home-nav-trigger" key={menu.id} ref={(node) => { if (node) triggers.current[menu.id] = node; }} aria-expanded={active === menu.id} aria-controls={`home-menu-${menu.id}`} onPointerEnter={(event) => { if (event.pointerType === 'mouse') { setKeyboardMode(false); show(menu.id); } }} onClick={(event) => activate(event, menu.id)} onKeyDown={(event) => onTriggerKey(event, menu.id)}>{menu.label}<ChevronDown size={10} /></button>)}
            <a href="#line-studio" onPointerEnter={close} onFocus={close} onClick={followLink}>Visual studio</a>
          </nav>
          <div className="home-nav-actions"><Link href="/app" className="home-nav-login" onPointerEnter={close}>Sign in</Link><Link className="home-button home-button-primary" href="/app/signup" onPointerEnter={close}>Start your service</Link><button type="button" id="home-menu-button" className="home-menu-toggle" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="home-mobile-navigation" onClick={() => { close(); setMobileOpen(!mobileOpen); }}>{mobileOpen ? <X size={16} /> : <><span /><span /></>}</button></div>
        </div>
        <div className="home-mega-shell" data-open={visible} style={{ '--menu-width': `${selected.width}px`, '--menu-height': `${selected.height}px` } as CSSProperties}>
          {menus.map((menu) => {
            const current = active === menu.id;
            return <div key={menu.id} id={`home-menu-${menu.id}`} className={`home-mega-panel home-mega-${menu.id}`} data-active={current} aria-hidden={!current} aria-label={`${menu.label} navigation`} onKeyDown={(event) => onPanelKey(event, menu.id)} style={{ '--panel-width': `${menu.width}px`, '--panel-height': `${menu.height}px` } as CSSProperties}>
              {menu.id !== 'product' && <a className="home-mega-image-card" tabIndex={current ? 0 : -1} href={menu.id === 'companion' ? '#companion' : '#notes'} onClick={followLink}><MenuArtwork kind={menu.id} /><div className="home-mega-image-caption"><span>{menu.id === 'companion' ? 'One service. Every screen.' : 'The Trilorah notebook.'}<ArrowRight size={15} /></span><p>{menu.id === 'companion' ? 'Bring the congregation a little closer to the message.' : 'Ideas, details, and a closer look at Trilorah.'}</p></div></a>}
              <div className="home-mega-links">{menu.links.map(({ title, description, href, icon: Icon }, index) => <a key={title} href={href} className="home-mega-link" tabIndex={current ? 0 : -1} onClick={followLink}><span className={`home-mega-icon home-mega-icon-${index}`}><Icon size={20} /></span><span><strong>{title}</strong><small>{description}</small></span><ArrowRight className="home-mega-link-arrow" size={13} /></a>)}</div>
              {menu.id === 'product' && <><a className="home-mega-image-card" tabIndex={current ? 0 : -1} href="#workspace" onClick={followLink}><MenuArtwork kind="workspace" /><div className="home-mega-image-caption"><span>Your Sunday workspace<ArrowRight size={15} /></span><p>A little less operating. More room to be present.</p></div></a><a className="home-mega-image-card" tabIndex={current ? 0 : -1} href="#line-studio" onClick={followLink}><MenuArtwork kind="studio" /><div className="home-mega-image-caption"><span>Make it your own<ArrowRight size={15} /></span><p>Explore original line patterns for your next idea.</p></div></a></>}
            </div>;
          })}
        </div>
        <nav className="home-mobile-nav home-mobile-disclosure" data-open={mobileOpen} id="home-mobile-navigation" aria-label="Mobile navigation" aria-hidden={!mobileOpen}>
          <div>{mobileLinks.map(([label, href]) => <a key={label} href={href} tabIndex={mobileOpen ? 0 : -1} onClick={followLink}>{label}<ArrowRight size={14} /></a>)}<Link href="/app" tabIndex={mobileOpen ? 0 : -1}>Sign in</Link></div>
        </nav>
      </header>
    </>
  );
}
