'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, RotateCcw } from '@/components/icons';
import workspace from '../home/assets/operator-workspace.png';
import companion from '../home/assets/companion-verses.png';
import './brand-directions.css';

const directionKeys = ['signal', 'company', 'still'] as const;
type Direction = typeof directionKeys[number];
type Part = 'circle' | 'square' | 'triangle';
const storageKey = 'trilorah-brand-review-v1';
const directions = {
  signal: {
    number: '01', name: 'Signal', character: 'Precise. Direct. Capable.',
    idea: 'Intelligence you can see working.',
    description: 'An exact, graphic identity built around signals, clear decisions, and the path from a spoken word to a screen.',
    reason: 'Makes the technology tangible. A strong route for demonstrating scripture recognition and reassuring a leader who wants to see how it works.',
    tradeoff: 'Its precision can feel clinical. Human examples and the three characters need to keep the brand approachable.',
    type: 'Compact grotesk + technical mono', typeDetail: 'Arial at bold weights; system monospace for supporting labels. A deliberately direct preview pairing.',
    palette: [['Paper', '#F6F7F9'], ['Ink', '#172026'], ['Signal', '#2449E8'], ['Mist', '#DDE4F1']],
    motion: 'A short, staggered handoff. Attention moves from listening to interpretation to delivery, then the complete mark settles.',
    art: 'Real product crops, transcription fragments, and precise connecting lines. Photograph the working setup and the people using it.',
    voice: ['The verse, found.', 'Review it. Put it on screen. Keep going.', 'Your phone has been promoted.'],
    poster: ['A reference.', 'A quotation.', 'A place to start.'],
  },
  company: {
    number: '02', name: 'Company', character: 'Warm. Sharp. A little cheeky.',
    idea: 'A few extra hands for your team.',
    description: 'Your three shapes become a small cast of capable helpers. Generous type, warm paper, and one confident orange make the technology feel approachable.',
    reason: 'The strongest connection to your founder story and preferred voice. It lets your own mark do the recognizable work across the website, product, and campaigns.',
    tradeoff: 'Character can drift into cuteness. Keep the app precise, the jokes sparse, and the shapes restrained when a service is live.',
    type: 'Rounded humanist sans + plain UI text', typeDetail: 'Trebuchet MS with system fallbacks in this study. Large, open headlines paired with clear system UI text.',
    palette: [['Paper', '#F4F0E6'], ['Ink', '#242723'], ['Orange', '#EF734D'], ['Sage', '#CDD7B9']],
    motion: 'Small turns of attention, a cooperative handoff, then stillness. The shapes have character through their existing dots and posture.',
    art: 'Bold crops of the mark, real interface details, and candid preparation moments. Show people serving together in Nigeria and the US, with permission.',
    voice: ['You’ve got backup.', 'For the people doing a lot.', 'Your phone has been promoted. (It was here every Sunday anyway.)'],
    poster: ['Your phone', 'has been', 'promoted.'],
  },
  still: {
    number: '03', name: 'Still', character: 'Calm. Considered. Assured.',
    idea: 'Space to stay with the message.',
    description: 'A quieter evolution of the current site: deep green, soft light, expansive spacing, and the actual product emerging gently from the background.',
    reason: 'Builds on the atmosphere you already respond to. It makes the congregation’s experience and the team’s sense of control feel equally important.',
    tradeoff: 'Restraint can become anonymous. Strong product explanations and disciplined use of your mark must keep it recognizably Trilorah.',
    type: 'Light grotesk + editorial serif accents', typeDetail: 'Helvetica Neue with system fallbacks; Georgia appears only in reading and message examples.',
    palette: [['Forest', '#122B26'], ['Chalk', '#EEF0E8'], ['Fern', '#B6CCAA'], ['Slate', '#47635A']],
    motion: 'A soft handoff with no overshoot. Content comes into focus, then holds. Comfortable pacing for demonstrations; immediate feedback for controls.',
    art: 'Actual screen and phone captures with controlled edge fades. Close, natural photographs of people preparing and following a service.',
    voice: ['Be in the moment.', 'We’ll keep up.', 'The message goes further.'],
    poster: ['From the room.', 'To the palm', 'of their hand.'],
  },
} as const;

// Original Group 1227 geometry, including the raised square and 4-unit outer borders.
// Color treatments belong to this concept study; the source logo remains unchanged.
function Shape({ part }: { part: Part }) {
  if (part === 'circle') return <g className="bd-shape bd-circle">
    <circle cx="180.539" cy="188.539" r="128" transform="rotate(-53.2637 180.539 188.539)" fill="var(--mark-fill)" stroke="var(--mark-cut)" strokeWidth="4" />
    <circle className="bd-eye" cx="116.979" cy="138.978" r="43" transform="rotate(-53.2637 116.979 138.978)" fill="var(--mark-cut)" stroke="var(--mark-cut)" strokeWidth="4" />
  </g>;
  if (part === 'square') return <g className="bd-shape bd-square"><g transform="translate(0 -16)">
    <rect x="202" y="257" width="256" height="256" transform="rotate(-90 202 257)" fill="var(--mark-fill)" stroke="var(--mark-cut)" strokeWidth="4" />
    <circle className="bd-eye" cx="386" cy="56" r="44" fill="var(--mark-cut)" stroke="var(--mark-cut)" strokeWidth="2" />
  </g></g>;
  return <g className="bd-shape bd-triangle">
    <path d="M584.641 314.75H334.359L459.5 98L584.641 314.75Z" fill="var(--mark-fill)" stroke="var(--mark-cut)" strokeWidth="4" />
    <circle className="bd-eye" cx="526" cy="207" r="44" fill="var(--mark-cut)" stroke="var(--mark-fill)" strokeWidth="2" />
  </g>;
}

function Mark({ part, className = '' }: { part?: Part; className?: string }) {
  const viewBox = part === 'circle' ? '48 56 265 265' : part === 'square' ? '198 -19 264 264' : part === 'triangle' ? '330 94 260 226' : '0 -18 606 407';
  return <svg className={`bd-mark ${className}`} viewBox={viewBox} fill="none" aria-hidden="true">
    {part ? <Shape part={part} /> : <><Shape part="circle" /><Shape part="square" /><Shape part="triangle" /></>}
  </svg>;
}

function Wordmark() {
  return <span className="bd-wordmark"><Mark /><span>trilorah</span></span>;
}

function SiteNav() {
  return <div className="bd-site-nav" aria-label="Illustrative website navigation">
    <Wordmark /><div><span>How it works</span><span>Product</span><span>Resources</span></div><span className="bd-nav-end">Made for your team <ArrowUpRight size={13} /></span>
  </div>;
}

function SiteHero({ direction }: { direction: Direction }) {
  return <section className={`bd-website bd-website-${direction}`} aria-label={`${directions[direction].name} website concept`}>
    <SiteNav />
    {direction === 'company' ? <>
      <div className="bd-company-hero">
        <div className="bd-company-copy"><span className="bd-kicker">FOR THE PEOPLE DOING A LOT</span><h2>You’ve got<br />backup<span>.</span></h2><p>Church presentation, with a few extra hands.<br />Prepare the service. Follow the message.<br />Bring your congregation along.</p><a href="#brand-team" className="bd-concept-cta">Meet your team <ArrowUpRight size={17} /></a></div>
        <div className="bd-company-art"><div className="bd-company-orbit" /><Mark /><span className="bd-art-aside">Three shapes.<br />One thoughtful team.</span><span className="bd-art-number">tri / 03</span></div>
      </div>
      <div className="bd-website-foot"><span>A little help, right where you are.</span><span>SONGS · SCRIPTURE · SCREENS</span></div>
    </> : direction === 'signal' ? <>
      <div className="bd-signal-hero"><div className="bd-signal-copy"><span className="bd-kicker">CHURCH PRESENTATION, CONNECTED</span><h2>Keep up.<br /><span>Stay in<br />control.</span></h2><p>Prepare the service. Find the scripture.<br />See what’s ready before the room does.</p><a href="#brand-product" className="bd-concept-cta">See the workflow <ArrowUpRight size={17} /></a></div><div className="bd-signal-system"><div className="bd-system-heading"><span>TRILORAH / SIGNAL PATH</span><span>01—03</span></div>{(['circle', 'square', 'triangle'] as Part[]).map((part, i) => <div className="bd-signal-node" key={part}><span>0{i + 1}</span><Mark part={part} /><div><strong>{['Listen', 'Understand', 'Deliver'][i]}</strong><small>{['Receive the spoken words', 'Prepare the relevant passage', 'Bring the message to the room'][i]}</small></div><ArrowRight size={17} /></div>)}<div className="bd-system-bottom"><span className="bd-status-dot" />You choose what goes live.</div></div></div>
      <div className="bd-website-foot"><span>Built around the next clear action.</span><span>INPUT → UNDERSTANDING → OUTPUT</span></div>
    </> : <>
      <div className="bd-still-hero"><span className="bd-kicker">MADE FOR THE MESSAGE</span><h2>Be in the moment.<br /><span>We’ll keep up.</span></h2><p>Scripture on screen. Your congregation connected.<br />A thoughtful workspace for the people behind the service.</p><a href="#brand-product" className="bd-concept-cta">Explore the workspace <ArrowUpRight size={17} /></a><div className="bd-still-workspace"><Image src={workspace} alt="Current Trilorah operator workspace shown within the Still concept" sizes="(max-width: 700px) 100vw, 1000px" unoptimized /></div><Mark className="bd-still-watermark" /></div>
    </>}
  </section>;
}

function MotionStudy({ direction }: { direction: Direction }) {
  const stage = useRef<HTMLDivElement>(null);
  const animations = useRef<Animation[]>([]);
  const sequence = useRef(0);
  const [status, setStatus] = useState('Three responsibilities, working together.');

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cancel = () => { ++sequence.current; animations.current.forEach(animation => animation.cancel()); animations.current = []; };
    const onChange = () => { cancel(); setStatus(preference.matches ? 'Reduced motion: the complete mark stays visible.' : 'Three responsibilities, working together.'); };
    preference.addEventListener('change', onChange);
    return () => { preference.removeEventListener('change', onChange); cancel(); };
  }, []);

  function replay() {
    const elements = Array.from(stage.current?.querySelectorAll<SVGGElement>('.bd-shape') ?? []);
    const current = elements.map(element => ({ transform: getComputedStyle(element).transform, opacity: getComputedStyle(element).opacity }));
    ++sequence.current;
    animations.current.forEach(animation => animation.cancel());
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStatus('Reduced motion: the complete mark stays visible.');
      return;
    }
    const token = sequence.current;
    setStatus('Listen. Understand. Deliver.');
    const poses = direction === 'signal' ? ['translateX(-14px)', 'translateY(-14px)', 'translateX(14px)'] : direction === 'company' ? ['translate(-12px, 5px) rotate(-7deg)', 'translateY(-18px) rotate(3deg)', 'translate(13px, 3px) rotate(6deg)'] : ['translateY(-6px)', 'translateY(-9px)', 'translateY(-6px)'];
    animations.current = elements.map((element, i) => element.animate([current[i], { transform: poses[i], opacity: .65, offset: .32 }, { transform: 'none', opacity: 1 }], { duration: direction === 'still' ? 1000 : 720, delay: i * 70, easing: 'cubic-bezier(.77,0,.175,1)', fill: 'both' }));
    void Promise.all(animations.current.map(animation => animation.finished)).then(() => {
      if (token === sequence.current) setStatus('Together.');
    }).catch(() => { /* An intentional replay supersedes the previous sequence. */ });
  }

  return <div className="bd-motion-study"><div className="bd-motion-stage" ref={stage}><Mark /><span>LISTEN / UNDERSTAND / DELIVER</span></div><div className="bd-motion-caption"><span role="status">{status}</span><button type="button" onClick={replay}><RotateCcw size={15} />Play motion</button></div></div>;
}

function ProductStudy() {
  const [live, setLive] = useState(false);
  return <div className="bd-product-study" id="brand-product">
    <div className="bd-section-label"><span>02 / IN THE PRODUCT</span><span>Illustrative control · current app capture</span></div>
    <div className="bd-product-grid"><div className="bd-product-image"><div className="bd-product-title"><Wordmark /><span>The workspace</span></div><Image src={workspace} alt="Actual Trilorah interface with libraries, preview, and live output" sizes="(max-width: 800px) 100vw, 750px" unoptimized /></div>
      <div className="bd-cue"><div className="bd-cue-heading"><span className="bd-status-dot" />SCRIPTURE FOUND<span>DEMO</span></div><small>PSALM 46:10 · KJV</small><blockquote>“Be still, and know<br />that I am God…”</blockquote><p>{live ? 'The passage is on the demo screen.' : 'Ready when you are.'}</p><button type="button" className="bd-cue-action" aria-pressed={live} onClick={() => setLive(!live)}>{live ? <><Check selected size={16} />Live in this demo</> : <>Send to demo screen <ArrowRight size={16} /></>}</button><span className="bd-cue-note" role="status">{live ? 'Click again to reset. No real output is connected.' : 'A suggestion stays a suggestion until you act.'}</span></div>
    </div>
  </div>;
}

function Applications({ direction }: { direction: Direction }) {
  const d = directions[direction];
  return <div className="bd-applications"><div className="bd-section-label"><span>03 / OUT IN THE WORLD</span><span>Campaign · companion · app icon</span></div><div className="bd-application-grid">
    <div className="bd-poster"><Wordmark /><div className="bd-poster-title">{d.poster.map(line => <span key={line}>{line}</span>)}</div>{direction === 'company' && <p>(It was here every Sunday anyway.)</p>}<Mark part={direction === 'signal' ? 'triangle' : direction === 'company' ? 'square' : 'circle'} className="bd-poster-shape" /><span className="bd-poster-footer">TRILORAH / MADE FOR YOUR TEAM</span></div>
    <div className="bd-pocket"><span className="bd-kicker">THE MESSAGE GOES FURTHER</span><h3>Keep it<br />with you.</h3><div className="bd-phone"><Image src={companion} alt="Current Trilorah congregation companion showing live scripture" sizes="250px" unoptimized /></div><span className="bd-pocket-caption">Actual companion interface</span></div>
    <div className="bd-identity-parts"><div className="bd-icon-study"><div className="bd-app-icon"><Mark /></div><span>Trilorah</span><small>APP ICON STUDY</small></div><div className="bd-type-study"><span className="bd-kicker">THE LETTERFORMS</span><strong>Aa</strong><p>The message<br />keeps moving.</p><small>0123456789</small></div></div>
  </div></div>;
}

function Brief() {
  return <details className="bd-brief"><summary><div><span className="bd-kicker">THE FOUNDATION</span><strong>The decisions behind the directions</strong></div><ChevronDown size={20} /></summary><div className="bd-brief-content">
    <p className="bd-brief-lead">Trilorah began with a first-time volunteer watching an operator juggle verses, unidentified scripture quotations, and songs prepared on the spot. The identity should recognize the people doing that work.</p>
    <div className="bd-brief-grid"><div><h3>Confirmed with you</h3><ul><li>Churches of every size; pastors and ministry leaders are the first audience to win over.</li><li>Nigeria and the United States are the first reachable markets. English first; other languages later.</li><li>A technology brand, with Christian purpose expressed through product use.</li><li>A useful free core, with paid AI or cloud extras. Exact inclusions and prices still need a cost review.</li><li>Longer term: optional automatic presentation once there is sufficient evidence for a particular preacher.</li><li>Your overlapping three-shape mark, Nubo icons, and dry, straight-faced humor.</li></ul></div><div><h3>Proposed brand structure</h3><p><b>One master brand: Trilorah.</b> Presentation, live scripture, and the congregation companion remain plainly named capabilities under it.</p><p><b>Three responsibilities:</b> Listen, Understand, Deliver. These explain the mark; they don’t add three separate products to the navigation.</p><p>Branding is a customization capability. Guides, Blog, What’s new, and the planned Reported issues area belong in Resources.</p><p><b>Current boundary:</b> scripture delivery requires an operator action. Earned automation is a future direction, not a launch claim.</p></div></div>
    <div className="bd-brief-grid"><div><h3>How decisions resolve conflicts</h3><p>During a service, readable controls and clear feedback take priority. In a campaign, the mark and wit can have more room. Both should sound like the same capable, considerate team.</p><p>Use real demonstrations to support intelligence claims. A free core must be useful in practice. Capability, availability, and price should agree across the site and app.</p></div><div><h3>Research carried forward</h3><p>EasyWorship and ProPresenter already emphasize usability. Pewbeam already offers AI scripture detection and notes. Affordable access and intelligence need proof through specific Trilorah workflows.</p><div className="bd-source-links"><a href="https://easyworship.com/software/pricing" target="_blank" rel="noreferrer">EasyWorship pricing <ArrowUpRight size={12} /></a><a href="https://www.renewedvision.com/industries/worship" target="_blank" rel="noreferrer">ProPresenter positioning <ArrowUpRight size={12} /></a><a href="https://pewbeam.com/pricing" target="_blank" rel="noreferrer">Pewbeam capabilities <ArrowUpRight size={12} /></a></div><small>Sources reviewed October 11, 2026. Review feedback gives hypotheses to test, not proof that Trilorah outperforms these products.</small></div></div>
    <div className="bd-brief-next"><strong>After choosing a direction</strong><p>Refine the wordmark and type pairing, test small-size logo use and contrast, settle the color and motion rules, develop real photography briefs for both markets, and build the complete reusable identity kit. These are first creative directions; the individual copy and visual treatments remain proposals.</p></div>
  </div></details>;
}

export default function BrandDirections() {
  const [active, setActive] = useState<Direction>('company');
  const [shortlist, setShortlist] = useState<Direction | null>(null);
  const [notes, setNotes] = useState<Record<Direction, string>>({ signal: '', company: '', still: '' });
  const [message, setMessage] = useState('Your shortlist and notes stay in this browser.');
  const [animateEntry, setAnimateEntry] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('direction') ?? window.location.hash.slice(1);
    if (directionKeys.includes(fromUrl as Direction)) setActive(fromUrl as Direction);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as { shortlist?: unknown; notes?: Partial<Record<Direction, unknown>> } | null;
      if (saved && directionKeys.includes(saved.shortlist as Direction)) setShortlist(saved.shortlist as Direction);
      if (saved?.notes && typeof saved.notes === 'object') {
        setNotes(Object.fromEntries(directionKeys.map(key => [key, typeof saved.notes?.[key] === 'string' ? saved.notes[key] : ''])) as Record<Direction, string>);
      }
    } catch { setMessage('Browser storage is unavailable. You can still compare directions here.'); }
  }, []);

  function switchDirection(direction: Direction, animate = false) {
    setAnimateEntry(animate); setActive(direction);
    const url = new URL(window.location.href);
    url.searchParams.set('direction', direction);
    url.hash = '';
    window.history.replaceState(null, '', url);
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % directionKeys.length;
    else if (event.key === 'ArrowLeft') next = (index + directionKeys.length - 1) % directionKeys.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = directionKeys.length - 1;
    else return;
    event.preventDefault(); switchDirection(directionKeys[next]); tabRefs.current[next]?.focus();
  }

  function save(nextShortlist: Direction | null, nextNotes: Record<Direction, string>) {
    try { localStorage.setItem(storageKey, JSON.stringify({ shortlist: nextShortlist, notes: nextNotes })); setMessage('Saved in this browser. Nothing has been published.'); }
    catch { setMessage('Couldn’t save to this browser. Your choices remain visible for this visit.'); }
  }

  function toggleShortlist() { const next = shortlist === active ? null : active; setShortlist(next); save(next, notes); }
  const d = directions[active];

  return <div className="bd-page"><a className="bd-skip" href="#brand-main">Skip to directions</a>
    <header className="bd-header"><Link href="/logo" className="bd-studio-brand"><Mark /><span>trilorah<span> / identity studio</span></span></Link><span>FIRST DIRECTIONS · OCTOBER 2026</span><Link href="/logo">Your original mark <ArrowUpRight size={14} /></Link></header>
    <main id="brand-main" className="bd-main"><div className="bd-intro"><div><span className="bd-kicker">BUILT FROM OUR DISCOVERY</span><h1>One Trilorah.<br /><span>Three ways to meet it.</span></h1></div><p>A technology brand with a human purpose.<br />Explore the whole direction, from the first<br className="bd-desktop-br" /> impression to the smallest interaction.</p></div>
      <div className="bd-facts"><span>NIGERIA + UNITED STATES</span><span>ENGLISH FIRST</span><span>CHURCHES OF EVERY SIZE</span><span>USEFUL FREE CORE</span></div>
      <div className="bd-picker"><div role="tablist" aria-label="Brand directions">{directionKeys.map((key, i) => <button key={key} ref={node => { tabRefs.current[i] = node; }} id={`brand-tab-${key}`} role="tab" type="button" aria-selected={active === key} aria-controls="brand-panel" tabIndex={active === key ? 0 : -1} onClick={event => switchDirection(key, event.detail > 0)} onKeyDown={event => onTabKey(event, i)}><span className={`bd-tab-dot bd-tab-dot-${key}`} /><small>{directions[key].number}</small><strong>{directions[key].name}</strong>{key === 'company' && <span className="bd-recommended">Recommended</span>}{shortlist === key && <Check size={15} label="Shortlisted" />}</button>)}</div><span className="bd-picker-hint">Choose a direction to explore <ArrowDownGlyph /></span></div>
      <div id="brand-panel" role="tabpanel" aria-labelledby={`brand-tab-${active}`} tabIndex={0} className={`bd-panel bd-direction-${active}${animateEntry ? ' bd-enter' : ''}`} key={active}>
        <div className="bd-direction-intro"><div><span className="bd-kicker">DIRECTION {d.number} / {d.character}</span><h2>{d.idea}</h2></div><p>{d.description}</p></div>
        <div className="bd-section-label"><span>01 / THE FIRST IMPRESSION</span><span>Website concept · proposed copy</span></div><SiteHero direction={active} />
        <div className="bd-rationale"><div><span className="bd-kicker">WHY THIS DIRECTION</span><p>{d.reason}</p></div><div><span className="bd-kicker">THE TRADEOFF</span><p>{d.tradeoff}</p></div></div>
        <ProductStudy /><Applications direction={active} />
        <div className="bd-language-section"><div className="bd-section-label"><span>04 / THE DESIGN LANGUAGE</span><span>Color · typography · voice · art direction</span></div><div className="bd-language-grid"><div className="bd-palette">{d.palette.map(([name, hex]) => <div key={name}><div style={{ background: hex }} /><span>{name}<small>{hex}</small></span></div>)}</div><div className="bd-type-notes"><h3>{d.type}</h3><p>{d.typeDetail}</p><small>System fonts make this preview portable. Final font selection and licensing follow the chosen direction.</small></div><div className="bd-voice"><span className="bd-kicker">HOW IT SOUNDS</span>{d.voice.map((line, i) => <p key={line}><small>0{i + 1}</small>{line}</p>)}</div><div className="bd-art-direction"><span className="bd-kicker">WHAT WE SHOW</span><p>{d.art}</p><p className="bd-art-rule">Keep scripture and consequential controls literal. Give wit room in introductions, campaigns, and successful moments.</p></div></div></div>
        <div className="bd-team-section" id="brand-team"><div className="bd-section-label"><span>05 / THREE SHAPES, WORKING TOGETHER</span><span>Proposed meaning · motion study</span></div><div className="bd-team-grid"><MotionStudy direction={active} /><div className="bd-team-copy">{(['circle', 'square', 'triangle'] as Part[]).map((part, i) => <div key={part}><Mark part={part} /><div><h3>{['The Listener', 'The Interpreter', 'The Messenger'][i]}</h3><p>{['Receives audio and captures the words.', 'Finds likely scripture, applies reviewed corrections, and prepares notes.', 'Helps deliver approved content to the room and congregation.'][i]}</p></div></div>)}<p className="bd-motion-principle">{d.motion}</p></div></div></div>
      </div>
      <section className="bd-review" aria-labelledby="brand-review-heading"><div><span className="bd-kicker">YOUR CREATIVE REVIEW</span><h2 id="brand-review-heading">What feels like Trilorah?</h2><p>Pick the direction with the right character. We can refine color, type, and detail around it.</p><button type="button" className="bd-shortlist" aria-pressed={shortlist === active} onClick={toggleShortlist}>{shortlist === active ? <><Check selected size={18} />{d.name} is shortlisted</> : <>Shortlist {d.name}<ArrowUpRight size={18} /></>}</button><span className="bd-review-status" role="status">{message}</span></div><div><label htmlFor="brand-review-notes">Your notes on {d.name}</label><textarea id="brand-review-notes" value={notes[active]} placeholder="What feels right? What would you change?" onChange={event => setNotes({ ...notes, [active]: event.target.value })} onBlur={() => save(shortlist, notes)} rows={4} /><span className="bd-notes-hint">Notes save when you leave this field.</span></div></section>
      <Brief />
      <footer className="bd-footer"><span>TRILORAH · FOUNDER DISCOVERY → CREATIVE DIRECTIONS</span><Link href="/home/navigation-preview">Back to navigation study <ArrowUpRight size={14} /></Link></footer>
    </main>
  </div>;
}

function ArrowDownGlyph() { return <ArrowRight size={15} style={{ transform: 'rotate(90deg)' } as CSSProperties} aria-hidden="true" />; }
