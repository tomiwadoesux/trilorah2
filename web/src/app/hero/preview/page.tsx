import type { Metadata, Viewport } from 'next';
import { HomeNavigation } from '../../home/HomeNavigation';
import { InteractiveAppPreview } from './InteractiveAppPreview';
import '../../home/home.css';
import '../hero.css';
import './preview.css';

export const metadata: Metadata = { title: 'Saved hero preview — Trilorah' };
export const viewport: Viewport = { themeColor: '#000000' };

export default function SavedHeroPreviewPage() {
  return (
    <div className="home-page hero-page">
      <a className="home-skip" href="#main">Skip to content</a>
      <HomeNavigation sectionBase="/home" />
      <main id="main" className="hero-main" aria-label="Saved Trilorah desktop app preview">
        <InteractiveAppPreview />
      </main>
    </div>
  );
}
