import type { Metadata } from 'next';
import Link from 'next/link';
import { BoxLedHero } from '@/components/box-led-hero/BoxLedHero';
import { ArrowRight, BookOpen, Check, Radio, StickyNote } from '@/components/icons';
import BrandMark from '../live/[slug]/components/BrandMark';
import { ProductWorkspace, CompanionScene, AssistantDemo } from './ProductDemos';
import LineStudio from './LineStudio';
import { HomeNavigation, HomeNotes } from './HomeInteractions';
import './home.css';

export const metadata: Metadata = {
  title: 'Trilorah — Be in the moment',
  description: 'Church presentation, live scripture, and a companion for your congregation. Bring the whole service together with Trilorah.',
};

function SignalDrawing({ id = 'feature-signal-fade' }: { id?: string }) {
  return (
    <svg className="home-signal-drawing" viewBox="0 0 600 350" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="600" y2="350" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9cd9c2" stopOpacity=".05" /><stop offset=".55" stopColor="#68c9a4" stopOpacity=".65" /><stop offset="1" stopColor="#96d2c6" stopOpacity=".03" />
        </linearGradient>
      </defs>
      {Array.from({ length: 17 }, (_, i) => (
        <path key={i} d={`M -40 ${80 + i * 8} C 140 ${80 + i * 8}, 130 ${320 - i * 12}, 300 ${230 - i * 7} S 480 ${45 + i * 11}, 650 ${70 + i * 12}`} stroke={`url(#${id})`} strokeWidth=".7" />
      ))}
      <path d="M300 42V278M90 160H510" stroke="#b7d3c9" strokeOpacity=".09" strokeDasharray="2 7" />
      <circle cx="300" cy="160" r="66" stroke="#72bba1" strokeOpacity=".12" />
      <circle cx="300" cy="160" r="100" stroke="#72bba1" strokeOpacity=".07" />
    </svg>
  );
}

export default function HomeLandingPage() {
  return (
    <div className="home-page">
      <a className="home-skip" href="#main">Skip to content</a>
      <HomeNavigation />
      <main id="main">
        <section className="home-hero" aria-labelledby="hero-heading">
          <div className="home-container home-hero-copy">
            <a href="#companion" className="home-announcement"><span>Meet your companion</span><span className="home-announcement-divider" />A little closer to the message <ArrowRight size={14} /></a>
            <h1 id="hero-heading">Be in the moment.<br /><span>We’ll keep up.</span></h1>
            <div className="home-hero-bottom">
              <div>
                <p>Scripture on screen. Your congregation connected.<br className="home-desktop-break" /> One thoughtful workspace for everything Sunday brings.</p>
                <div className="home-actions">
                  <Link href="/app/signup" className="home-button home-button-primary">Start your service <ArrowRight size={16} /></Link>
                  <a href="#workflow" className="home-button home-button-secondary">Explore Trilorah</a>
                </div>
              </div>
              <p className="home-hero-aside">Made for the message.<br />And the people behind it.</p>
            </div>
          </div>
          <div className="home-hero-visual" id="workspace">
            <BoxLedHero className="home-led-frame" showControls={false} allowTouchScroll>
              <ProductWorkspace />
            </BoxLedHero>
            <div className="home-visual-caption"><span className="home-live-dot" />A quieter kind of control.<span>Trilorah for your service team</span></div>
          </div>
        </section>

        <section className="home-section home-intro" id="workflow" aria-labelledby="workflow-heading">
          <div className="home-container">
            <div className="home-section-heading">
              <div><span className="home-eyebrow">From the first word to the final amen</span><h2 id="workflow-heading">Everything in its place.<br /><span>Everyone in the moment.</span></h2></div>
              <p>The best tools leave room for what matters. Bring your service, your screens, and your congregation together with less to keep track of.</p>
            </div>
            <div className="home-bento">
              <a className="home-feature home-feature-scripture" href="#assistant">
                <div className="home-feature-art"><SignalDrawing /><div className="home-verse-float"><span><Radio size={14} /> Scripture recognized</span><p>Psalm 46:10</p><small>“Be still, and know that I am God…”</small><div><Check size={13} /> Ready for the screen</div></div></div>
                <div className="home-feature-copy"><BookOpen size={22} /><h3>The right verse.<br />Right when it’s needed.</h3><p>Trilorah listens along, finds scripture references, and helps you follow the message as it unfolds.</p><span className="home-feature-link">See it in action <ArrowRight size={16} /></span></div>
              </a>
              <a className="home-feature home-feature-companion" href="#companion">
                <div className="home-small-feature-copy"><StickyNote size={21} /><h3>A seat for everyone.</h3><p>Live verses, a transcript, and sermon notes. Right there on their phone.</p><span className="home-feature-link">Meet the companion <ArrowRight size={16} /></span></div>
                <div className="home-pocket-card" aria-hidden="true"><div className="home-pocket-top"><BrandMark /><span>Sunday, together</span></div><div className="home-pocket-rule" /><small>SERMON NOTES</small><p>Make room<br />for the stillness.</p><div className="home-pocket-lines"><i /><i /><i /></div><span className="home-pocket-saved"><Check size={12} /> A thought worth keeping</span></div>
              </a>
              <a className="home-feature home-feature-portable" href="#notes">
                <div className="home-small-feature-copy"><span className="home-file-icon">.tri</span><h3>Your service travels.</h3><p>Keep songs, media, and layouts together in a portable service file.</p><span className="home-feature-link">Take a closer look <ArrowRight size={16} /></span></div>
                <div className="home-file-stack" aria-hidden="true"><div /><div /><div><span>TRILORAH</span><strong>Sunday<br />service</strong><span className="home-file-type">.tri <ArrowRight size={18} /></span></div></div>
              </a>
            </div>
            <div className="home-capabilities"><span><Radio size={17} /> Live scripture recognition</span><span><BookOpen size={17} /> Songs & presentation</span><span><StickyNote size={17} /> Congregation companion</span><span><Check size={17} /> Portable service files</span></div>
          </div>
        </section>

        <section className="home-section home-companion-section" id="companion" aria-labelledby="companion-heading">
          <div className="home-container">
            <div className="home-section-heading">
              <div><span className="home-eyebrow">The message goes further</span><h2 id="companion-heading">From the room.<br /><span>To the palm of their hand.</span></h2></div>
              <div><p>A simple QR code opens a shared moment. Follow the verses, read along, and keep the thoughts that stay with you.</p><Link href="/app/signup" className="home-text-link">Bring your congregation along <ArrowRight size={16} /></Link></div>
            </div>
            <CompanionScene />
            <div className="home-feature-footnotes"><div><span>01</span><h3>Scan. Settle in.</h3><p>Open the service companion on your phone. No app download for your congregation.</p></div><div><span>02</span><h3>Stay with the message.</h3><p>Scripture and a live transcript help everyone follow along in their own way.</p></div><div><span>03</span><h3>Keep it close.</h3><p>Revisit the key points and scripture from the message, without leaving the service.</p></div></div>
          </div>
        </section>

        <section className="home-section home-assistant-section" id="assistant" aria-labelledby="assistant-heading">
          <div className="home-container home-assistant-layout">
            <div className="home-assistant-copy"><span className="home-eyebrow">A little help, right where you are</span><h2 id="assistant-heading">Less searching.<br /><span>More following along.</span></h2><p>Explore how your service comes together, from a scripture reference to the screen in front of your congregation.</p><p className="home-quiet">Pick a prompt. Try a thought. Get a feel for the flow.</p><a href="#workspace" className="home-text-link">Back to the workspace <ArrowRight size={16} /></a></div>
            <AssistantDemo />
          </div>
        </section>

        <HomeNotes />
        <LineStudio />

        <section className="home-closing" aria-labelledby="closing-heading"><div className="home-container"><div className="home-closing-art" aria-hidden="true"><SignalDrawing id="closing-signal-fade" /></div><span className="home-eyebrow">Built around what matters</span><h2 id="closing-heading">Your next service.<br /><span>A little more present.</span></h2><Link href="/app/signup" className="home-button home-button-primary">Start your service <ArrowRight size={16} /></Link><p>Already part of Trilorah? <Link href="/app">Sign in <span aria-hidden="true">↗</span></Link></p></div></section>
      </main>
      <footer className="home-footer"><div className="home-container"><Link href="/home" className="home-brand"><BrandMark />Trilorah</Link><p>Beautiful. Effortless. Present.</p><nav aria-label="Footer"><a href="#workflow">Product</a><a href="#notes">Notebook</a><a href="#line-studio">Visual studio</a><Link href="/app">Sign in</Link></nav><span>© {new Date().getFullYear()} Trilorah</span></div></footer>
    </div>
  );
}
