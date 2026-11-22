import type { Metadata, Viewport } from 'next';
import { Hero3Landing } from './Hero3Landing';
import '../home/home.css';
import '../hero/hero.css';
import '../hero/landing.css';
import './hero3.css';

export const metadata: Metadata = {
  title: 'Hero 3 — Trilorah',
  description: 'A centred hero study: announcement, headline, download, and the workspace on a grid.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, themeColor: '#ffffff' };

export default function Hero3Page() {
  return <Hero3Landing />;
}
