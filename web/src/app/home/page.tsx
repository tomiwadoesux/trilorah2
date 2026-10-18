import type { Metadata } from 'next';
import Link from 'next/link';
import { BoxLedHero } from '@/components/box-led-hero/BoxLedHero';
import { ArrowRight } from '@/components/icons';
import { ProductWorkspace } from './ProductDemos';
import { HomeNavigation } from './HomeInteractions';
import { HomeFeatureSections, HomeFooter } from './HomeSections';
import './home.css';

export const metadata: Metadata = {
  title: 'Trilorah — Be in the moment',
  description: 'Church presentation, live scripture, and a companion for your congregation. Bring the whole service together with Trilorah.',
};

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

        <HomeFeatureSections />
      </main>
      <HomeFooter />
    </div>
  );
}
