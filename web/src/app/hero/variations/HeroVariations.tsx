'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen } from '@/components/icons';
import { heroHeadline, heroDescription } from '../heroCopy';
import { heroLooks, heroLookStyle, heroAccent, type HeroLook } from '../heroLooks';
import type { HeroTheme } from '../AppPreview';

function HeroSample({ look, mode }: { look: HeroLook; mode: HeroTheme }) {
  const palette = look[mode];
  const swatches = [
    ['Background', palette.background],
    ['Text', palette.text],
    ['Surface', palette.surface],
    ['Brand', heroAccent(mode)],
  ];

  return <div className="hero-study-column">
    <div className="hero-study-mode">
      <span>{mode === 'dark' ? 'Dark mode' : 'Light mode'}</span>
      <Link href={`/hero?look=${look.id}&mode=${mode}`} aria-label={`View ${look.name} ${mode} on the full hero`}>View full hero <ArrowUpRight size={15} aria-hidden="true" /></Link>
    </div>
    <article className="hero-study-sample" style={heroLookStyle(look, mode)} aria-label={`${look.name}, ${mode} mode`}>
      <div className="hero-study-nav">
        <span className="hero-study-brand"><Image src={mode === 'light' ? '/brand/logo/trilorah-hero-light-green.svg' : '/brand/logo/trilorah-hero.svg'} alt="" width={38} height={24} />Trilorah</span>
        <span className="hero-study-nav-copy">Made for the message.</span>
      </div>
      <div className="hero-study-copy">
        <h3>{heroHeadline}</h3>
        <p>{heroDescription}</p>
        <div className="hero-study-actions">
          <Link className="hero-study-primary" href="/download">Download <ArrowDown size={16} aria-hidden="true" /></Link>
          <Link className="hero-study-secondary" href="/home#workflow">Explore Trilorah <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>
      <div className="hero-study-surface">
        <span className="hero-study-surface-icon"><BookOpen size={21} aria-hidden="true" /></span>
        <div><strong>A place for your next service.</strong><span>Prepare. Listen. Present.</span></div>
        <span className="hero-study-status" aria-label="Ready" />
      </div>
    </article>
    <div className="hero-study-swatches" aria-label={`${look.name} ${mode} palette`}>
      {swatches.map(([label, value]) => <div key={label}><span className="hero-study-swatch" style={{ backgroundColor: value }} /><span>{label}<code>{value.toUpperCase()}</code></span></div>)}
    </div>
  </div>;
}

export function HeroVariations() {
  const [filter, setFilter] = useState<'both' | HeroTheme>('both');
  const modes: HeroTheme[] = filter === 'both' ? ['dark', 'light'] : [filter];

  return <main className="hero-studies">
    <header className="hero-studies-header">
      <div className="hero-studies-masthead"><Link href="/hero">Trilorah <span>/ Hero studies</span></Link><span>01 — 05</span></div>
      <div className="hero-studies-heading"><div><p className="hero-studies-eyebrow">ONE BRAND. FIVE ATMOSPHERES.</p><h1>A different kind of light.</h1></div><p>Five backgrounds. Two modes each.<br />The same words, with a different feel.</p></div>
      <div className="hero-studies-toolbar">
        <nav aria-label="Jump to a color study" className="hero-studies-jump">
          {heroLooks.map((look, i) => <a href={`#${look.id}`} key={look.id}><span className="hero-studies-pair" style={{ background: `linear-gradient(90deg, ${look.dark.background} 50%, ${look.light.background} 50%)` }} /><span><small>0{i + 1}</small>{look.name}</span></a>)}
        </nav>
        <div className="hero-studies-filter" role="group" aria-label="Show color modes">
          {(['both', 'dark', 'light'] as const).map(mode => <button key={mode} type="button" aria-pressed={filter === mode} onClick={() => setFilter(mode)}>{mode === 'both' ? 'Compare' : mode === 'dark' ? 'Dark' : 'Light'}</button>)}
        </div>
      </div>
    </header>
    <div className="hero-studies-list" data-filter={filter}>
      {heroLooks.map((look, i) => <section className="hero-study" id={look.id} key={look.id} aria-labelledby={`${look.id}-heading`}>
        <div className="hero-study-heading"><div><span>0{i + 1}</span><h2 id={`${look.id}-heading`}>{look.name}</h2></div><p>{look.description}</p></div>
        <div className="hero-study-pair">{modes.map(mode => <HeroSample key={mode} look={look} mode={mode} />)}</div>
      </section>)}
    </div>
    <footer className="hero-studies-footer"><span className="hero-studies-brand-chip" />Deep green in light mode. Trilorah yellow in dark mode.<Link href="/hero">Back to the current hero <ArrowUpRight size={15} aria-hidden="true" /></Link></footer>
    <span className="hero-studies-sr" aria-live="polite">Showing {filter === 'both' ? 'dark and light modes side by side' : `${filter} mode`} for all five looks.</span>
  </main>;
}
