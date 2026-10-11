'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import BrandMark from '../../live/[slug]/components/BrandMark';
import { ArrowRight, ChevronDown, X } from '@/components/icons';
import { ProductWorkspace } from '../ProductDemos';
import { NavigationMedia, NavigationThumbnail, type NavigationMediaKind } from './NavigationMedia';
import valley from '../../../../../src/assets/backgrounds/valley.jpg';
import companionNotes from '../assets/companion-notes.png';
import './navigation-study.css';

type Menu = 'product' | 'resources';
type Destination = { title: string; description: string; sections: string[] };
type Tile = Destination & { id: string; media: NavigationMediaKind; large?: boolean };

const blog: Tile = { id: 'blog', title: 'Blog', description: 'Ideas, stories, and a closer look at Trilorah.', media: 'blog', sections: ['Stories from Trilorah', 'Product explainers', 'Ideas for your service team'] };
const blogStories = [
  { title: 'A service that moves with you.', description: 'Songs, scripture, and screens. One place for the whole service.', sections: ['Bring the service together', 'Prepare songs and media', 'Follow the live message'], image: valley, kind: 'service', category: 'Inside Trilorah' },
  { title: 'A thought worth taking home.', description: 'Keep verses and sermon notes close, in everyone’s hands.', sections: ['Join with a QR code', 'Follow the words and verses', 'Keep a thought from the message'], image: companionNotes, kind: 'companion', category: 'The companion' },
];
const product: Tile[] = [
  { id: 'branding', title: 'Branding', description: 'Your church. Your colors. Your own look.', media: 'branding', sections: ['Your church name and logo', 'App colors and display themes', 'Scripture fonts and text layouts', 'Backgrounds for your screens'] },
  { id: 'scripture', title: 'Live scripture', description: 'Follow the message. Find the right words.', media: 'scripture', sections: ['Scripture recognition', 'Translations and corrections', 'From the spoken word to the screen'] },
  { id: 'companion', title: 'Congregation companion', description: 'One service. Everyone following along.', media: 'companion', sections: ['Join with a QR code', 'Live verses and transcript', 'Sermon notes on your phone'] },
  { id: 'presentation', title: 'Presentations & services', description: 'Songs, scripture, and screens. Ready for Sunday.', media: 'presentation', sections: ['The presentation workspace', 'Preparing a running order', 'Songs, media, and slide layouts', 'Portable service files'] },
];
const resources: Tile[] = [
  { id: 'guides', title: 'Guides', description: 'A little guidance, from setup to Sunday.', media: 'guides', large: true, sections: ['Getting started', 'Preparing your first service', 'Setting up your screens', 'Connecting the congregation'] },
  blog,
  { id: 'updates', title: 'What’s new', description: 'The latest improvements, big and small.', media: 'updates', sections: ['Product updates', 'New features', 'Fixes and improvements'] },
];
const walkthrough: Destination = { title: 'How it works', description: 'From preparation to the final amen.', sections: ['Prepare the service', 'Present and follow the message', 'Bring the congregation along'] };
const about: Destination = { title: 'About Trilorah', description: 'Made for the message. And the people behind it.', sections: ['Why Trilorah exists', 'Who we’re building for', 'The people behind Trilorah', 'Get in touch'] };
const support: Destination = { title: 'Help & support', description: 'A little help when you need it.', sections: ['Setup and system requirements', 'Troubleshooting', 'Contact support'] };

export default function NavigationStudy() {
  const [active, setActive] = useState<Menu | null>(null);
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
  const visible = active !== null;

  function cancelClose() { if (timer.current) clearTimeout(timer.current); }
  function close() { cancelClose(); setActive(null); }
  function open(menu: Menu) { cancelClose(); setMobileOpen(false); setActive(menu); }
  function scheduleClose() {
    cancelClose();
    timer.current = setTimeout(() => {
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
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`#ns-panel-${menu} button`)?.focus({ preventScroll: true }));
  }
  function panelKey(event: KeyboardEvent<HTMLDivElement>, menu: Menu) {
    if (event.key !== 'Tab') return;
    const actions = event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]');
    if (event.shiftKey && event.target === actions[0]) {
      event.preventDefault(); close(); triggers.current[menu]?.focus({ preventScroll: true });
    } else if (!event.shiftKey && event.target === actions[actions.length - 1]) {
      event.preventDefault(); close();
      const next = menu === 'product' ? triggers.current.resources : document.getElementById('ns-how-link');
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
    return <button type="button" className="ns-nav-link ns-trigger" ref={(node) => { if (node) triggers.current[menu] = node; }} aria-expanded={active === menu} aria-controls={`ns-panel-${menu}`} onPointerEnter={(event) => { if (event.pointerType === 'mouse') { setKeyboard(false); open(menu); } }} onClick={(event) => { setKeyboard(event.detail === 0); if (event.detail === 0 && active === menu) close(); else open(menu); }} onKeyDown={(event) => enterPanel(event, menu)}>{label}<ChevronDown size={11} /></button>;
  }

  function blogCards(current: boolean, mobile = false) {
    return <section className={`ns-blog-group${mobile ? ' ns-blog-mobile' : ''}`} aria-label="Blog">
      <button type="button" className="ns-blog-heading" tabIndex={current ? 0 : -1} onClick={() => preview(blog)}>Blog<ArrowRight size={13} /></button>
      <div className="ns-blog-stories">{blogStories.map((story) => <button type="button" key={story.kind} className={`ns-blog-story ns-blog-story-${story.kind}`} tabIndex={current ? 0 : -1} onClick={() => preview(story)}>
        <span className="ns-blog-story-media" aria-hidden="true">{story.kind === 'companion' ? <span className="ns-blog-screen"><Image src={story.image} alt="" fill sizes="190px" draggable={false} /></span> : <Image src={story.image} alt="" fill sizes="190px" draggable={false} />}</span>
        <span className="ns-blog-story-copy"><small>{story.category}</small><strong>{story.title}</strong></span>
        <ArrowRight className="ns-blog-story-arrow" size={12} aria-hidden="true" />
      </button>)}</div>
    </section>;
  }

  return <div className="ns-page">
    <a className="ns-skip" href="#ns-main">Skip to content</a>
    <div className="ns-backdrop" data-open={visible} aria-hidden="true" />
    <header ref={header} className="ns-header" data-keyboard={keyboard} onPointerEnter={cancelClose} onPointerLeave={scheduleClose} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { close(); setMobileOpen(false); } }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); if (active) { const previous = active; close(); triggers.current[previous]?.focus({ preventScroll: true }); } else { setMobileOpen(false); document.getElementById('ns-mobile-toggle')?.focus(); } } }}>
      <div className="ns-bar">
        <Link className="ns-brand" href="/home" aria-label="Trilorah home"><BrandMark /><span>Trilorah</span></Link>
        <nav className="ns-main-nav" aria-label="Main navigation">
          {trigger('product', 'Product')}
          {trigger('resources', 'Resources')}
          <button type="button" id="ns-how-link" className="ns-nav-link" onPointerEnter={scheduleClose} onFocus={close} onClick={() => preview(walkthrough)}>How it works</button>
          <button type="button" id="ns-about-link" className="ns-nav-link" onPointerEnter={scheduleClose} onFocus={close} onClick={() => preview(about)}>About</button>
        </nav>
        <div className="ns-account"><Link href="/app" className="ns-signin" onPointerEnter={close}>Sign in</Link><Link href="/app/signup" className="ns-primary" onPointerEnter={close}>Get started</Link><button id="ns-mobile-toggle" type="button" className="ns-mobile-toggle" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="ns-mobile-menu" onClick={() => { close(); setMobileOpen(!mobileOpen); }}>{mobileOpen ? <X size={17} /> : <span><i /><i /></span>}</button></div>
      </div>
      <div className="ns-dropdown" data-open={visible} data-menu={active ?? 'product'}>
        {(['product', 'resources'] as Menu[]).map((menu) => {
          const current = active === menu;
          const tiles = menu === 'product' ? product : resources;
          return <div key={menu} id={`ns-panel-${menu}`} className={`ns-panel ns-panel-${menu}`} data-active={current} aria-hidden={!current} onKeyDown={(event) => panelKey(event, menu)}>
            <div className="ns-bento">{tiles.map((tile) => tile.id === 'blog' ? <div key={tile.id} className="ns-blog-slot">{blogCards(current)}</div> : <button type="button" key={tile.id} className={`ns-tile ns-tile-${tile.id}${tile.large ? ' ns-tile-large' : ''}`} tabIndex={current ? 0 : -1} onClick={() => preview(tile)}>
              <NavigationMedia kind={tile.media} /><div className="ns-tile-copy"><span>{tile.title}<ArrowRight size={14} /></span><p>{tile.description}</p></div>
            </button>)}</div>
            <div className="ns-utility">
              <span className="ns-utility-thumbnail" aria-hidden="true"><NavigationThumbnail kind={menu === 'product' ? 'presentation' : 'guides'} /></span>
              <div><strong>{menu === 'product' ? 'Try Trilorah' : 'A little help, right when you need it'}</strong><p>{menu === 'product' ? 'Get a feel for your next service.' : 'Find an answer and get back to the message.'}</p></div>
              {menu === 'product' ? <Link href="/home#assistant" className="ns-demo-link" tabIndex={current ? 0 : -1}><span>Try the demo</span><ArrowRight size={14} /></Link> : <button type="button" tabIndex={current ? 0 : -1} onClick={() => preview(support)}>Get help<ArrowRight size={13} /></button>}
            </div>
          </div>;
        })}
      </div>
      {mobileOpen && <nav className="ns-mobile-menu" id="ns-mobile-menu" aria-label="Mobile navigation">
        <span>Product</span>
        {product.map((tile) => <button key={tile.id} type="button" onClick={() => preview(tile)}><span>{tile.title}</span><NavigationThumbnail kind={tile.media} /><ArrowRight size={13} /></button>)}
        <span>Resources</span>
        {resources.map((tile) => tile.id === 'blog' ? <div key={tile.id}>{blogCards(true, true)}</div> : <button key={tile.id} type="button" onClick={() => preview(tile)}><span>{tile.title}</span><NavigationThumbnail kind={tile.media} /><ArrowRight size={13} /></button>)}
        <button type="button" onClick={() => preview(walkthrough)}>How it works<ArrowRight size={13} /></button>
        <button type="button" onClick={() => preview(about)}>About<ArrowRight size={13} /></button><Link href="/app">Sign in<ArrowRight size={13} /></Link>
      </nav>}
    </header>
    <main id="ns-main">
      <div className="ns-hero"><span className="ns-kicker"><i /> MADE FOR THE MESSAGE</span><h1>Be in the moment.<br /><span>We’ll keep up.</span></h1><p>Scripture on screen. Your congregation connected.<br />One thoughtful workspace for everything Sunday brings.</p><Link href="/app/signup" className="ns-primary">Get started<ArrowRight size={15} /></Link><div className="ns-workspace"><ProductWorkspace /></div></div>
      <div className="ns-study-bar"><span><i /> NAVIGATION STUDY <b>05</b></span><p>Words on the left. A glimpse of the product on the right.</p><div><button type="button" onClick={() => { setKeyboard(false); open('product'); }}>Open Product<ArrowRight size={12} /></button><button type="button" onClick={() => { setKeyboard(false); open('resources'); }}>Open Resources<ArrowRight size={12} /></button></div></div>
    </main>
    <dialog ref={dialog} onClose={() => { const target = returnFocus.current; if (target?.isConnected && target.getClientRects().length) target.focus({ preventScroll: true }); else document.getElementById('ns-mobile-toggle')?.focus({ preventScroll: true }); }} className="ns-destination" aria-labelledby="ns-destination-title" onClick={(event) => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.current?.close(); } }}><button type="button" className="ns-dialog-close" aria-label="Close page preview" onClick={() => dialog.current?.close()} autoFocus><X size={17} /></button><small>PLANNED PAGE · NAVIGATION PREVIEW</small><h2 id="ns-destination-title">{destination.title}</h2><p>{destination.description}</p><ul>{destination.sections.map((section) => <li key={section}>{section}</li>)}</ul><span className="ns-dialog-note">This preview shows the navigation and intended page structure.</span></dialog>
  </div>;
}
