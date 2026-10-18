'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { HomeNavigation } from '../home/HomeNavigation';
import { AppPreview, type HeroTheme } from './AppPreview';
import { HeroIntro } from './HeroIntro';
import { InterfaceReveal } from './InterfaceReveal';
import { HeroThemeToggle } from './HeroThemeToggle';
import { useHeroTheme } from './useHeroTheme';
import { defaultHeroLook, findHeroLook, heroLookStyle } from './heroLooks';

const downloadHref = '/download';

export function HeroLanding({ lookId, initialTheme = 'dark', features, children, footer }: { lookId?: string; initialTheme?: HeroTheme; features?: ReactNode; children?: ReactNode; footer?: ReactNode }) {
  const saved = useHeroTheme();
  const [studyTheme, setStudyTheme] = useState(initialTheme);
  const studyLook = findHeroLook(lookId);
  const look = studyLook ?? defaultHeroLook;
  const theme = studyLook ? studyTheme : saved.theme;
  const toggleTheme = studyLook ? () => setStudyTheme(value => value === 'dark' ? 'light' : 'dark') : saved.toggleTheme;
  // The /home sections are drawn for a dark page, so they keep the look's dark palette in both modes.
  const sectionsStyle = heroLookStyle(look, 'dark');

  return (
    <div className="home-page hero-page hero-landing-page" data-theme={theme} data-look={look.id} style={heroLookStyle(look, theme)}>
      <a className="home-skip" href="#main">Skip to content</a>
      <HomeNavigation
        brandLogo={theme === 'light' ? '/brand/logo/trilorah-hero-light-green.svg' : '/brand/logo/trilorah-hero.svg'}
        showMenuIndicators={false}
        showSupport
        downloadHref={downloadHref}
        themeControl={<HeroThemeToggle theme={theme} onToggle={toggleTheme} />}
      />
      <main id="main" className="hero-main" aria-label="Trilorah">
        <div className="hero-container">
          <div className="hero-intro-row">
            <HeroIntro key={theme} downloadHref={downloadHref} />
            <InterfaceReveal />
          </div>
        </div>
        <AppPreview theme={theme} showInterface />
        {features}
        {children && <div className="hero-home-sections" style={sectionsStyle}>{children}</div>}
      </main>
      {footer && <div className="hero-home-sections" style={sectionsStyle}>{footer}</div>}
      {studyLook && <Link className="hero-look-return" href={`/hero/variations#${look.id}`}><span aria-hidden="true">←</span> All five looks <span> / {look.name}</span></Link>}
    </div>
  );
}
