'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import ComponentLibrary from './components/ComponentLibrary';
import { ArrowUpRight, Check, ChevronDown } from '@/components/icons';
import './brand.css';

const palettes = {
  original: { name: 'Original', paper: '#f4f3ee', ink: '#242723', accent: '#d5d8c9', font: 'Arial, sans-serif' },
  signal: { name: 'Signal', paper: '#f6f7f9', ink: '#172026', accent: '#2449e8', font: 'Arial, sans-serif' },
  company: { name: 'Company', paper: '#f4f0e6', ink: '#242723', accent: '#ef734d', font: '"Trebuchet MS", sans-serif' },
  still: { name: 'Still', paper: '#eef0e8', ink: '#122b26', accent: '#b6ccaa', font: '"Helvetica Neue", Arial, sans-serif' },
} as const;
type Palette = keyof typeof palettes;
const filters = ['All studies', 'Mark', 'Typography', 'Campaign'] as const;
type Filter = typeof filters[number];

// The selected logo geometry stays intact. Only the study's colors change.
function StudioMark({ className = '' }: { className?: string }) {
  return <svg className={`bs-mark ${className}`} viewBox="0 -18 606 407" fill="none" aria-hidden="true">
    <g>
      <circle cx="180.539" cy="188.539" r="128" transform="rotate(-53.2637 180.539 188.539)" fill="var(--shape-fill)" stroke="var(--shape-cut)" strokeWidth="4" />
      <circle cx="116.979" cy="138.978" r="43" transform="rotate(-53.2637 116.979 138.978)" fill="var(--shape-cut)" stroke="var(--shape-cut)" strokeWidth="4" />
    </g>
    <g transform="translate(0 -16)">
      <rect x="202" y="257" width="256" height="256" transform="rotate(-90 202 257)" fill="var(--shape-fill)" stroke="var(--shape-cut)" strokeWidth="4" />
      <circle cx="386" cy="56" r="44" fill="var(--shape-cut)" stroke="var(--shape-cut)" strokeWidth="2" />
    </g>
    <g>
      <path d="M584.641 314.75H334.359L459.5 98L584.641 314.75Z" fill="var(--shape-fill)" stroke="var(--shape-cut)" strokeWidth="4" />
      <circle cx="526" cy="207" r="44" fill="var(--shape-cut)" stroke="var(--shape-fill)" strokeWidth="2" />
    </g>
  </svg>;
}

export default function BrandStudio({ initialArea = 'identity' }: { initialArea?: 'identity' | 'components' }) {
  const [area, setArea] = useState<'identity' | 'components'>(initialArea);
  useEffect(() => {
    const restore = () => setArea(new URLSearchParams(location.search).get('section') === 'components' ? 'components' : 'identity');
    restore(); window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  function changeArea(next: 'identity' | 'components') {
    setArea(next);
    const url = new URL(location.href);
    if (next === 'components') url.searchParams.set('section', 'components');
    else { url.searchParams.delete('section'); url.searchParams.delete('component'); }
    history.pushState(null, '', url);
  }
  const [palette, setPalette] = useState<Palette>('original');
  const [filter, setFilter] = useState<Filter>('All studies');
  const [inverse, setInverse] = useState(false);
  const selected = palettes[palette];
  const show = (category: Filter) => filter === 'All studies' || filter === category;
  const style = {
    '--study-paper': selected.paper,
    '--study-ink': selected.ink,
    '--study-accent': selected.accent,
    '--study-font': selected.font,
  } as CSSProperties;

  return <div className="bs-page" style={style}>
    <a className="bs-skip" href="#brand-workspace">Skip to practice boards</a>
    <header className="bs-header">
      <Link href="/home" className="bs-home"><StudioMark /><span>trilorah<span> / brand</span></span></Link>
      <span className="bs-header-note"><i /> A WORK IN PROGRESS</span>
      <Link href="/brand-directions" className="bs-text-link">Original directions <ArrowUpRight size={15} /></Link>
    </header>

    <main className="bs-main" id="brand-workspace">
      <nav className="bs-areas" aria-label="Brand workspace sections"><button aria-current={area === 'identity' ? 'page' : undefined} onClick={() => changeArea('identity')}>Brand studies</button><button aria-current={area === 'components' ? 'page' : undefined} onClick={() => changeArea('components')}>Components <span>DESIGN SYSTEM</span></button></nav>
      {area === 'components' ? <><div className="bs-intro bs-component-intro"><div><span className="bs-eyebrow">THE TRILORAH WORKING SYSTEM</span><h1>Components<span>.</span></h1></div><p>Every piece, in one place.<br />Explore the app. Refine the details.<br />Bring what works back to Trilorah.</p></div><ComponentLibrary /></> : <>
      <div className="bs-intro">
        <div><span className="bs-eyebrow">THE TRILORAH WORKING STUDIO</span><h1>Brand<span>.</span></h1></div>
        <p>A place to try things.<br />Logo, type, color, and the little details<br className="bs-wide-break" /> that make Trilorah feel like itself.</p>
      </div>

      <div className="bs-toolbar">
        <div className="bs-filters" role="group" aria-label="Filter practice boards">
          {filters.map(item => <button type="button" key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}
        </div>
        <span className="bs-study-count" role="status">{filter === 'All studies' ? '03 studies' : '01 study'}<span> / EXPLORATION</span></span>
      </div>

      <fieldset className="bs-palettes">
        <legend>Try a color direction</legend>
        <div>{(Object.keys(palettes) as Palette[]).map(key => <label key={key}>
          <input type="radio" name="brand-palette" value={key} checked={palette === key} onChange={() => setPalette(key)} />
          <span className="bs-palette-option"><i style={{ backgroundColor: palettes[key].accent }} />{palettes[key].name}{palette === key && <Check selected size={13} />}</span>
        </label>)}</div>
        <p>Change the practice boards below.</p>
      </fieldset>

      <div className={`bs-boards${filter !== 'All studies' ? ' bs-boards-filtered' : ''}`}>
        {show('Mark') && <section className="bs-board bs-logo-board" aria-labelledby="bs-mark-heading">
          <div className={`bs-logo-canvas${inverse ? ' bs-inverse' : ''}`}>
            <div className="bs-canvas-label"><span>TRILORAH / THE MARK</span><span>01</span></div>
            <StudioMark />
            <div className="bs-canvas-bottom"><span>Three shapes. One Trilorah.</span><button type="button" aria-pressed={inverse} onClick={() => setInverse(!inverse)}><span className="bs-invert-symbol" />{inverse ? 'Use light background' : 'Use dark background'}</button></div>
          </div>
          <div className="bs-board-caption"><div><h2 id="bs-mark-heading">The mark, in practice.</h2><p>Composition, contrast, and room to breathe.</p></div><Link href="/logo" aria-label="Open the original logo and motion study"><ArrowUpRight size={19} /></Link></div>
        </section>}

        {show('Typography') && <section className="bs-board bs-type-board" aria-labelledby="bs-type-heading">
          <div className="bs-type-canvas"><div className="bs-canvas-label"><span>TYPE / FIRST IMPRESSIONS</span><span>02</span></div><strong>Aa<span>.</span></strong><p>For the people<br />doing a lot.</p><div className="bs-type-alphabet">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />abcdefghijklmnopqrstuvwxyz<br /><span>0123456789 &amp;!?()</span></div></div>
          <div className="bs-board-caption"><div><h2 id="bs-type-heading">Find our voice in type.</h2><p>System-font studies. Room to refine.</p></div></div>
        </section>}

        {show('Campaign') && <section className={`bs-board bs-campaign-board bs-campaign-${palette}`} aria-labelledby="bs-campaign-heading">
          <div className="bs-campaign-canvas"><div className="bs-campaign-copy"><span className="bs-eyebrow">FOR THE PEOPLE DOING A LOT</span><p>You’ve got<br />backup<span>.</span></p><span className="bs-campaign-signoff">Church presentation, with a few extra hands.</span></div><div className="bs-campaign-art"><StudioMark /><span>trilorah</span></div></div>
          <div className="bs-board-caption"><div><h2 id="bs-campaign-heading">Put the brand to work.</h2><p>A starting point for campaigns, launch graphics, and everyday expressions.</p></div><span className="bs-caption-number">03 / CAMPAIGN</span></div>
        </section>}
      </div>

      <details className="bs-foundation"><summary><div><span className="bs-eyebrow">WHAT WE’RE BUILDING ON</span><strong>The foundation stays with us.</strong></div><ChevronDown size={20} /></summary><div className="bs-foundation-grid"><p><span>01 / PEOPLE</span>Churches of every size. Pastors and ministry leaders first; the teams behind the service always in view.</p><p><span>02 / STARTING POINT</span>Nigeria and the US. English first, with more languages to come.</p><p><span>03 / CHARACTER</span>A technology brand with a human purpose. Faith comes through how the product is used.</p><p><span>04 / PRINCIPLES</span>A useful free core. Clear control during a service. Personality where there’s room for it.</p></div></details>

      </>}
      <footer className="bs-footer"><p>Practice here. Keep what works.</p><Link href="/brand-directions" className="bs-text-link">View the original three directions <ArrowUpRight size={15} /></Link></footer>
    </main>
  </div>;
}
