'use client';

import { useEffect, useState } from 'react';
import { HomeNavigation } from '../home/HomeNavigation';
import { HeroThemeToggle } from '../hero/HeroThemeToggle';
import { useHeroTheme } from '../hero/useHeroTheme';
import { release } from './release';

function PlatformIcon({ windows = false }: { windows?: boolean }) {
  return windows ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m3 5 8-1.1V11H3V5Zm10-1.4L21 2.5V11h-8V3.6ZM3 13h8v7.1L3 19v-6Zm10 0h8v8.5l-8-1.1V13Z" /></svg>
  ) : (
    <svg width="18" height="20" viewBox="4 2 17 20" fill="currentColor" aria-hidden="true"><path d="M17.5 12.3c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-2.9-.8-1.5 0-3 .9-3.8 2.2-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.9-.7s1.8.7 3 .7 1.9-1.1 2.7-2.1c.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.2-.9-2.2-3.2ZM15.3 5.5c.6-.8 1.1-1.8 1-2.9-.9.1-2.1.6-2.7 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2-.5 2.7-1.4Z" /></svg>
  );
}

export function DownloadLanding() {
  const { theme, toggleTheme } = useHeroTheme();
  const [windows, setWindows] = useState(false);

  useEffect(() => {
    setWindows(navigator.userAgent.includes('Windows'));
  }, []);

  return (
    <div className="home-page hero-page hero-landing-page download-page" data-theme={theme}>
      <a className="home-skip" href="#main">Skip to content</a>
      <HomeNavigation
        sectionBase="/home"
        brandLogo={theme === 'light' ? '/brand/logo/trilorah-hero-light.svg' : '/brand/logo/trilorah-hero.svg'}
        showMenuIndicators={false}
        showSupport
        downloadHref="/download#downloads"
        themeControl={<HeroThemeToggle theme={theme} onToggle={toggleTheme} />}
      />
      <main id="main" className="download-main">
        <section id="downloads" className="download-hero" aria-labelledby="download-title">
          <h1 id="download-title">Download Trilorah</h1>
          <p className="download-intro">Scripture, lyrics, slides, and media, all in one place.</p>
          <a className="download-primary" href={windows ? release.windows : release.mac}>
            <PlatformIcon windows={windows} />
            <span>Download for {windows ? 'Windows' : 'macOS'}</span>
          </a>
        </section>
      </main>
    </div>
  );
}
