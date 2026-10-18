import type { Metadata, Viewport } from 'next';
import { HeroVariations } from './HeroVariations';
import './variations.css';

export const metadata: Metadata = {
  title: 'Five hero looks — Trilorah',
  description: 'Five light and dark color studies for the Trilorah hero.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, themeColor: '#eaeae5' };

export default function HeroVariationsPage() {
  return <HeroVariations />;
}
