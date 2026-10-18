'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import Link from 'next/link';
import BrandMark from '../../live/[slug]/components/BrandMark';
import { ArrowRight, ChevronDown, X } from '@/components/icons';
import { ProductWorkspace } from '../ProductDemos';
import { NavigationThumbnail } from './NavigationMedia';
import { BlogCards, NavigationDropdown, about, product, resources, walkthrough, type Destination, type Menu } from './NavigationMenu';
import './navigation-study.css';

export default function NavigationStudy() {
  const [active, setActive] = useState<Menu | null>(null);
  const [layoutMenu, setLayoutMenu] = useState<Menu>('product');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [motionSpeed, setMotionSpeed] = useState(100);
  const [destination, setDestination] = useState<Destination>(about);
  const header = useRef<HTMLElement>(null);
  const motionControls = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const triggers = useRef<Partial<Record<Menu, HTMLButtonElement>>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const keyboardRef = useRef(false);
  keyboardRef.current = keyboard;
  const visible = active !== null;
  const playbackRate = motionSpeed / 100;
  const motionStyle = { '--ns-motion-scale': 1 / playbackRate } as CSSProperties;

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
    timer.current = setTimeout(() => {
      if (motionControls.current?.contains(document.activeElement)) return;
      if (!keyboardRef.current || !header.current?.contains(document.activeElement)) setActive(null);
    }, 170);
  }
  function preview(page: Destination) {
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
      const next = menu === 'product' ? triggers.current.resources : document.getElementById('ns-about-link');
      next?.focus({ preventScroll: true });
    }
  }

  useEffect(() => {
    function outside(event: PointerEvent) { if (!header.current?.contains(event.target as Node)) { setActive(null); setMobileOpen(false); } }
    function resize() { setActive(null); setMobileOpen(false); }
    function escape(event: globalThis.KeyboardEvent) { if (event.key === 'Escape') setActive(null); }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', resize);
    return () => { cancelClose(); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); window.removeEventListener('resize', resize); };
  }, []);

  function trigger(menu: Menu, label: string) {
    return <button type="button" className="ns-nav-link ns-trigger" ref={(node) => { if (node) triggers.current[menu] = node; }} aria-expanded={active === menu} aria-controls="ns-navigation-panel" onPointerEnter={(event) => { if (event.pointerType === 'mouse') { setKeyboard(false); open(menu); } }} onClick={(event) => { setKeyboard(event.detail === 0); if (event.detail === 0 && active === menu) close(); else open(menu); }} onKeyDown={(event) => enterPanel(event, menu)}>{label}<ChevronDown selected={active === menu} size={11} /></button>;
  }

  return <div className="ns-page" style={motionStyle}>
    <a className="ns-skip" href="#ns-main">Skip to content</a>
    <div className="ns-backdrop" data-open={visible} aria-hidden="true" />
    <header ref={header} className="ns-header" data-keyboard={keyboard} onPointerEnter={cancelClose} onPointerLeave={scheduleClose} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { close(); setMobileOpen(false); } }} onKeyDown={(event) => { if (!motionControls.current?.contains(event.target as Node) && ['Tab', 'ArrowDown', 'Escape'].includes(event.key)) setKeyboard(true); if (event.key === 'Escape') { event.preventDefault(); if (active) { const previous = active; close(); triggers.current[previous]?.focus({ preventScroll: true }); } else { setMobileOpen(false); document.getElementById('ns-mobile-toggle')?.focus(); } } }}>
      <div className="ns-bar">
        <Link className="ns-brand" href="/home" aria-label="Trilorah home"><BrandMark /><span>Trilorah</span></Link>
        <nav className="ns-main-nav" aria-label="Main navigation">
          <button type="button" id="ns-how-link" className="ns-nav-link" onPointerEnter={scheduleClose} onFocus={close} onClick={() => preview(walkthrough)}>How it works</button>
          {trigger('product', 'Product')}
          {trigger('resources', 'Resources')}
          <button type="button" id="ns-about-link" className="ns-nav-link" onPointerEnter={scheduleClose} onFocus={close} onClick={() => preview(about)}>About</button>
        </nav>
        <div className="ns-account"><Link href="/app" className="ns-signin" onPointerEnter={close}>Sign in</Link><Link href="/app/signup" className="ns-primary" onPointerEnter={close}>Get started</Link><button id="ns-mobile-toggle" type="button" className="ns-mobile-toggle" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="ns-mobile-menu" onClick={() => { close(); setMobileOpen(!mobileOpen); }}>{mobileOpen ? <X size={17} /> : <span><i /><i /></span>}</button></div>
      </div>
      <NavigationDropdown active={active} layoutMenu={layoutMenu} onOpen={preview} onPanelKey={panelKey} demoHref="/home#scripture" />
      {mobileOpen && <nav className="ns-mobile-menu" id="ns-mobile-menu" aria-label="Mobile navigation">
        <button type="button" onClick={() => preview(walkthrough)}>How it works<ArrowRight size={13} /></button>
        <span>Product</span>
        {product.map((tile) => <button key={tile.id} type="button" onClick={() => preview(tile)}><span>{tile.title}</span><NavigationThumbnail kind={tile.media} /><ArrowRight size={13} /></button>)}
        <span>Resources</span>
        {resources.map((tile) => tile.id === 'blog' ? <div key={tile.id}><BlogCards current mobile onOpen={preview} /></div> : <button key={tile.id} type="button" disabled={tile.disabled} onClick={tile.disabled ? undefined : () => preview(tile)}><span>{tile.title}</span>{tile.disabled ? <small className="ns-coming-soon">Coming soon</small> : <><NavigationThumbnail kind={tile.media} /><ArrowRight size={13} /></>}</button>)}
        <button type="button" onClick={() => preview(about)}>About<ArrowRight size={13} /></button><Link href="/app">Sign in<ArrowRight size={13} /></Link>
      </nav>}
      <aside ref={motionControls} className="ns-motion-controls" aria-label="Navigation motion preview" onPointerEnter={cancelClose} onFocus={cancelClose}>
        <div className="ns-motion-heading"><div><span><i />Motion preview</span><p>Switch menus to inspect the movement.</p></div><div className="ns-motion-menus" aria-label="Preview menu">{(['product', 'resources'] as Menu[]).map((menu) => <button key={menu} type="button" aria-pressed={active === menu} onClick={() => { setKeyboard(false); open(menu); }}>{menu === 'product' ? 'Product' : 'Resources'}</button>)}</div></div>
        <div className="ns-motion-speed"><label htmlFor="ns-motion-speed">Speed</label><input id="ns-motion-speed" type="range" min="10" max="100" step="5" value={motionSpeed} aria-valuetext={`${playbackRate.toFixed(2)} times normal speed`} onChange={(event) => setMotionSpeed(Number(event.currentTarget.value))} /><output htmlFor="ns-motion-speed">{playbackRate.toFixed(2)}×</output><button type="button" onClick={() => setMotionSpeed(100)}>Normal speed</button></div>
        <div className="ns-motion-caption"><span>Slow · 0.10×</span><span>{(280 / playbackRate / 1000).toFixed(2)}s per switch</span><span>Normal · 1×</span></div>
      </aside>
    </header>
    <main id="ns-main">
      <div className="ns-hero"><span className="ns-kicker"><i /> MADE FOR THE MESSAGE</span><h1>Be in the moment.<br /><span>We’ll keep up.</span></h1><p>Scripture on screen. Your congregation connected.<br />One thoughtful workspace for everything Sunday brings.</p><Link href="/app/signup" className="ns-primary">Get started<ArrowRight size={15} /></Link><div className="ns-workspace"><ProductWorkspace /></div></div>
      <div className="ns-study-bar"><span><i /> NAVIGATION STUDY <b>05</b></span><p>Words on the left. A glimpse of the product on the right.</p></div>
    </main>
    <dialog ref={dialog} onClose={() => { const target = returnFocus.current; if (target?.isConnected && target.getClientRects().length) target.focus({ preventScroll: true }); else document.getElementById('ns-mobile-toggle')?.focus({ preventScroll: true }); }} className="ns-destination" aria-labelledby="ns-destination-title" onClick={(event) => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.current?.close(); } }}><button type="button" className="ns-dialog-close" aria-label="Close page preview" onClick={() => dialog.current?.close()} autoFocus><X size={17} /></button><small>PLANNED PAGE · NAVIGATION PREVIEW</small><h2 id="ns-destination-title">{destination.title}</h2><p>{destination.description}</p><ul>{destination.sections.map((section) => <li key={section}>{section}</li>)}</ul><span className="ns-dialog-note">This preview shows the navigation and intended page structure.</span></dialog>
  </div>;
}
