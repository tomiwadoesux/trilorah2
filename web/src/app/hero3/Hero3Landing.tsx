'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { HomeNavigation } from '../home/HomeNavigation';
import { HeroThemeToggle } from '../hero/HeroThemeToggle';
import { useHeroTheme } from '../hero/useHeroTheme';
import { heroHeadline } from '../hero/heroCopy';
import { release } from '../download/release';
import { ArrowRight, ChevronDown } from '@/components/icons';

const downloadHref = '/download';

function AppleMark() {
  return <svg width="16" height="18" viewBox="4 2 17 20" fill="currentColor" aria-hidden="true"><path d="M17.5 12.3c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-2.9-.8-1.5 0-3 .9-3.8 2.2-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.9-.7s1.8.7 3 .7 1.9-1.1 2.7-2.1c.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.2-.9-2.2-3.2ZM15.3 5.5c.6-.8 1.1-1.8 1-2.9-.9.1-2.1.6-2.7 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2-.5 2.7-1.4Z" /></svg>;
}

function WindowsMark() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m3 5 8-1.1V11H3V5Zm10-1.4L21 2.5V11h-8V3.6ZM3 13h8v7.1L3 19v-6Zm10 0h8v8.5l-8-1.1V13Z" /></svg>;
}

/**
 * Download for the visitor's platform, with the other installers one press
 * away. The Mac build is Apple silicon only, so the label says so rather than
 * letting an Intel Mac find out after the download.
 */
function DownloadSplit({ windows }: { windows: boolean }) {
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const menu = details.current;
    if (!menu) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (menu.open && !menu.contains(event.target as Node)) menu.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary')?.focus(); }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return <div className="hero3-split">
    <a className="hero3-split-main" href={windows ? release.windows : release.mac}>
      {windows ? <WindowsMark /> : <AppleMark />}
      <span>{windows ? 'Download for Windows' : 'Download for macOS (Apple silicon)'}</span>
    </a>
    <details className="hero3-split-menu" ref={details}>
      <summary aria-label="Other downloads"><ChevronDown size={18} aria-hidden="true" /></summary>
      <ul role="list">
        <li><a href={release.mac}><AppleMark /><span>macOS <small>Apple silicon · .dmg</small></span></a></li>
        <li><a href={release.windows}><WindowsMark /><span>Windows <small>.exe installer</small></span></a></li>
        <li><a href={release.notes} target="_blank" rel="noreferrer"><span>All releases <small>version {release.version} and earlier</small></span><ArrowRight size={16} aria-hidden="true" /></a></li>
      </ul>
    </details>
  </div>;
}

export function Hero3Landing() {
  const { theme, toggleTheme } = useHeroTheme('light');
  const [windows, setWindows] = useState(false);

  useEffect(() => {
    setWindows(navigator.userAgent.includes('Windows'));
  }, []);

  return (
    <div className="home-page hero-page hero-landing-page hero3-page" data-theme={theme}>
      <a className="home-skip" href="#main">Skip to content</a>
      <HomeNavigation
        sectionBase="/home"
        brandLogo={theme === 'light' ? '/brand/logo/trilorah-hero-light-green.svg' : '/brand/logo/trilorah-hero.svg'}
        showMenuIndicators={false}
        showSupport
        downloadHref={downloadHref}
        themeControl={<HeroThemeToggle theme={theme} onToggle={toggleTheme} />}
      />
      <main id="main" className="hero3-main" aria-label="Trilorah">
        <section className="hero3-stage">
          <div className="hero3-container">
            <a className="hero3-pill" href={release.notes} target="_blank" rel="noreferrer">
              <span className="hero3-pill-tag">New</span>
              <span className="hero3-pill-text">Trilorah {release.version} is out</span>
              <span className="hero3-pill-arrow" aria-hidden="true"><ArrowRight size={14} /></span>
            </a>
            <h1 className="hero3-title">{heroHeadline}</h1>
            <div className="hero3-actions">
              <DownloadSplit windows={windows} />
              <Link className="hero3-secondary" href="/home#workflow">See how it works</Link>
            </div>
          </div>
        </section>

        <div className="hero3-stripe" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </div>

        <section className="hero3-canvas" aria-label="The Trilorah workspace">
          <span className="hero3-mark hero3-mark-left" aria-hidden="true" />
          <span className="hero3-mark hero3-mark-right" aria-hidden="true" />
          <div className="hero3-shot">
            <Image
              src="/hero-preview/interface.webp"
              alt="The Trilorah operator workspace: a caught verse, John 3:16, in the preview beside the live output and the verse list"
              width={1600}
              height={940}
              sizes="(max-width: 760px) 100vw, 1200px"
              priority
            />
          </div>
        </section>
      </main>
    </div>
  );
}
