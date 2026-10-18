'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ComponentSkeleton, componentSkeletons } from '../ComponentSkeletons';
import { defaultHeroLook, heroLookStyle } from '../heroLooks';
import type { HeroTheme } from '../AppPreview';

export function SkeletonPreview() {
  const [theme, setTheme] = useState<HeroTheme>('light');

  return <main className="hero-skeleton-page" data-theme={theme} style={heroLookStyle(defaultHeroLook, theme)}>
    <div className="hero-skeleton-container">
      <nav className="hero-skeleton-nav" aria-label="Skeleton preview">
        <Link href="/hero">← Back to hero</Link>
        <div className="hero-skeleton-modes" role="group" aria-label="Preview color mode">
          {(['light', 'dark'] as const).map(mode => <button key={mode} type="button" aria-pressed={theme === mode} onClick={() => setTheme(mode)}>{mode === 'light' ? 'Light' : 'Dark'}</button>)}
        </div>
      </nav>
      <header className="hero-skeleton-heading">
        <h1>Skeletons from the app.</h1>
        <p>{componentSkeletons.length} individual components, using the current app’s layout and controls.</p>
      </header>
      <div className="hero-skeleton-grid">
        {componentSkeletons.map((component, index) => <figure className="hero-skeleton-figure" key={component.id}>
          <div className="hero-skeleton-canvas">
            <svg viewBox={`-8 -8 ${component.width + 16} ${component.height + 16}`} role="img" aria-label={`${component.name} skeleton`}><ComponentSkeleton kind={component.id} /></svg>
          </div>
          <figcaption><h2><span>{String(index + 1).padStart(2, '0')}</span>{component.name}</h2><p>{component.detail}</p></figcaption>
        </figure>)}
      </div>
      <footer className="hero-skeleton-footer"><Link href="/hero">See these in the hero hover reveal <span aria-hidden="true">↗</span></Link></footer>
    </div>
  </main>;
}
