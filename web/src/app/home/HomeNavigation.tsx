'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { scrollToSiteSection } from '@/components/SiteScroll';
import { ArrowRight, ChevronDown, X } from '@/components/icons';
import BrandMark from '../live/[slug]/components/BrandMark';
import { NavigationDropdown, about, type Destination, type Menu } from './navigation-preview/NavigationMenu';
import './home-navigation.css';

// Cards with a section on this page jump to it; the rest open the planned-page preview.
const sections: Record<string, string> = {
  branding: 'line-studio', scripture: 'scripture', companion: 'companion', presentation: 'workspace',
  'story-service': 'notes', 'story-companion': 'notes',
};
const menus: { id: Menu; label: string }[] = [{ id: 'product', label: 'Product' }, { id: 'resources', label: 'Resources' }];
const mobileLinks = [['How it works', '#workflow'], ['Product', '#workspace'], ['Resources', '#notes']];

function SupportLabel() {
  return <span className="home-nav-support-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11 8H4a1 1 0 0 0-1 1v3h8V8Zm2 0h7a1 1 0 0 1 1 1v3h-8V8ZM5 13h6v8H6a1 1 0 0 1-1-1v-7Zm8 0h6v7a1 1 0 0 1-1 1h-5v-8Z" /><path fillRule="evenodd" d="M7.5 2a3.5 3.5 0 0 0 0 7H12V7.5l-2.3-4A3.5 3.5 0 0 0 7.5 2Zm0 2a1.5 1.5 0 0 0 0 3h2.3L8.1 4.1a1.5 1.5 0 0 0-.6-.1ZM16.5 2a3.5 3.5 0 0 1 0 7H12V7.5l2.3-4A3.5 3.5 0 0 1 16.5 2Zm0 2a1.5 1.5 0 0 1 0 3h-2.3l1.7-2.9a1.5 1.5 0 0 1 .6-.1Z" /></svg><span>Support</span></span>;
}

export function HomeNavigation({ sectionBase = '', brandLogo, showMenuIndicators = true, showSupport = false, downloadHref, themeControl }: { sectionBase?: string; brandLogo?: string; showMenuIndicators?: boolean; showSupport?: boolean; downloadHref?: string; themeControl?: ReactNode } = {}) {
  const [active, setActive] = useState<Menu | null>(null);
  const [layoutMenu, setLayoutMenu] = useState<Menu>('product');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [destination, setDestination] = useState<Destination>(about);
  const header = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const triggers = useRef<Partial<Record<Menu, HTMLButtonElement>>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const keyboardRef = useRef(false);
  keyboardRef.current = keyboard;
  const activeRef = useRef(active);
  activeRef.current = active;
  const visible = active !== null;

  function cancelClose() { if (timer.current) clearTimeout(timer.current); }
  function close() { cancelClose(); setActive(null); }
  function open(menu: Menu) {
    cancelClose(); setMobileOpen(false);
    if (active === menu) return;
    setLayoutMenu(menu);
    setActive(menu);
  }
  function scheduleClose() {
    cancelClose();
    // A short grace period lets the pointer cross from the bar into the panel.
    timer.current = setTimeout(() => {
      if (!keyboardRef.current || !header.current?.contains(document.activeElement)) setActive(null);
    }, 170);
  }
  function go(page: Destination) {
    const section = page.id ? sections[page.id] : undefined;
    if (section) {
      close(); setMobileOpen(false);
      if (sectionBase) { window.location.assign(`${sectionBase}#${section}`); return; }
      scrollToSiteSection(section, keyboardRef.current);
      return;
    }
    returnFocus.current = active ? triggers.current[active] ?? null : document.activeElement as HTMLElement;
    close(); setMobileOpen(false); setDestination(page); dialog.current?.showModal();
  }
  function enterPanel(event: KeyboardEvent<HTMLButtonElement>, menu: Menu) {
    if (event.key !== 'ArrowDown' && !(event.key === 'Tab' && !event.shiftKey && active === menu)) return;
    event.preventDefault(); setKeyboard(true); open(menu);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('#ns-navigation-panel button:not([tabindex="-1"]):not(:disabled), #ns-navigation-panel a[href]:not([tabindex="-1"])')?.focus({ preventScroll: true }));
  }
  function panelKey(event: KeyboardEvent<HTMLDivElement>, menu: Menu) {
    if (event.key !== 'Tab') return;
    const actions = event.currentTarget.querySelectorAll<HTMLElement>('button:not([tabindex="-1"]):not(:disabled), a[href]:not([tabindex="-1"])');
    if (event.shiftKey && event.target === actions[0]) {
      event.preventDefault(); close(); triggers.current[menu]?.focus({ preventScroll: true });
    } else if (!event.shiftKey && event.target === actions[actions.length - 1]) {
      event.preventDefault(); close();
      const next = menu === 'product' ? triggers.current.resources : document.getElementById('home-about-link');
      next?.focus({ preventScroll: true });
    }
  }
  function onHeaderKey(event: KeyboardEvent<HTMLElement>) {
    if (['Tab', 'ArrowDown', 'Escape'].includes(event.key)) setKeyboard(true);
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (active) { const previous = active; close(); triggers.current[previous]?.focus({ preventScroll: true }); }
    else if (mobileOpen) { setMobileOpen(false); document.getElementById('home-menu-button')?.focus(); }
  }
  function followLink() { close(); setMobileOpen(false); }

  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) { setActive(null); setMobileOpen(false); } };
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setActive(null); };
    const scroll = () => { if (activeRef.current) setActive(null); };
    const resize = () => { setActive(null); setMobileOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', resize);
    return () => { cancelClose(); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); window.removeEventListener('scroll', scroll); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <>
      <div className="home-menu-backdrop" data-open={visible} aria-hidden="true" onPointerDown={close} />
      <header ref={header} className="home-nav home-nav-with-menu ns-menu-host" data-menu-open={visible} data-keyboard={keyboard} onKeyDown={onHeaderKey} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { close(); setMobileOpen(false); } }} onPointerLeave={scheduleClose} onPointerEnter={cancelClose}>
        <div className="home-container home-nav-inner">
          <a href={`${sectionBase}#main`} className="home-brand" aria-label="Trilorah home" onClick={followLink}>{brandLogo ? <Image className="home-brand-logo" src={brandLogo} alt="" width={42} height={26} /> : <BrandMark />}Trilorah</a>
          <nav className="home-nav-links" aria-label="Main navigation">
            <a href={`${sectionBase}#workflow`} onPointerEnter={scheduleClose} onFocus={close} onClick={followLink}>How it works</a>
            {menus.map((menu) => <button type="button" className="home-nav-trigger" key={menu.id} ref={(node) => { if (node) triggers.current[menu.id] = node; }} aria-expanded={active === menu.id} aria-controls="ns-navigation-panel" onPointerEnter={(event) => { if (event.pointerType === 'mouse') { setKeyboard(false); open(menu.id); } }} onClick={(event) => { setKeyboard(event.detail === 0); if (event.detail === 0 && active === menu.id) close(); else open(menu.id); }} onKeyDown={(event) => enterPanel(event, menu.id)}>{menu.label}{showMenuIndicators && <ChevronDown selected={active === menu.id} size={10} />}</button>)}
            <button type="button" id="home-about-link" className="home-nav-plain" onPointerEnter={scheduleClose} onFocus={close} onClick={() => go(about)}>About</button>
            {showSupport && <button type="button" className="home-nav-plain" onPointerEnter={scheduleClose} onFocus={close}><SupportLabel /></button>}
          </nav>
          <div className="home-nav-actions">{themeControl}{!downloadHref && <Link href="/app" className="home-nav-login" onPointerEnter={close}>Sign in</Link>}<Link className="home-button home-button-primary" href={downloadHref ?? '/app/signup'} onPointerEnter={close}>{downloadHref ? 'Download' : 'Start your service'}</Link><button type="button" id="home-menu-button" className="home-menu-toggle" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="home-mobile-navigation" onClick={() => { close(); setMobileOpen(!mobileOpen); }}>{mobileOpen ? <X size={16} /> : <><span /><span /></>}</button></div>
        </div>
        <NavigationDropdown active={active} layoutMenu={layoutMenu} onOpen={go} onPanelKey={panelKey} demoHref={`${sectionBase}#scripture`} onDemo={followLink} />
        <nav className="home-mobile-nav home-mobile-disclosure" data-open={mobileOpen} id="home-mobile-navigation" aria-label="Mobile navigation" aria-hidden={!mobileOpen}>
          <div>{mobileLinks.map(([label, href]) => <a key={label} href={`${sectionBase}${href}`} tabIndex={mobileOpen ? 0 : -1} onClick={followLink}>{label}<ArrowRight size={14} /></a>)}<button type="button" tabIndex={mobileOpen ? 0 : -1} onClick={() => go(about)}>About<ArrowRight size={14} /></button>{showSupport && <button type="button" tabIndex={mobileOpen ? 0 : -1}><SupportLabel /></button>}{!downloadHref && <Link href="/app" tabIndex={mobileOpen ? 0 : -1}>Sign in</Link>}</div>
        </nav>
      </header>
      <dialog ref={dialog} className="ns-destination" aria-labelledby="home-destination-title" onClose={() => { const target = returnFocus.current; if (target?.isConnected && target.getClientRects().length) target.focus({ preventScroll: true }); }} onClick={(event) => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.current?.close(); } }}>
        <button type="button" className="ns-dialog-close" aria-label="Close page preview" onClick={() => dialog.current?.close()} autoFocus><X size={17} /></button>
        <small>PLANNED PAGE</small>
        <h2 id="home-destination-title">{destination.title}</h2>
        <p>{destination.description}</p>
        <ul>{destination.sections.map((section) => <li key={section}>{section}</li>)}</ul>
        <span className="ns-dialog-note">This page is on its way. Here is what it will cover.</span>
      </dialog>
    </>
  );
}
