import type { Metadata, Viewport } from 'next';
import { HeroLanding } from './HeroLanding';
import { HeroFeatures } from './HeroFeatures';
import { HomeFeatureSections, HomeFooter } from '../home/HomeSections';
import '../home/home.css';
import './hero.css';
import './landing.css';
import './heroLooks.css';
import './hero-features.css';

export const metadata: Metadata = { title: 'Hero — Trilorah' };
export const viewport: Viewport = { themeColor: '#060907' };

export default async function HeroPage({ searchParams }: { searchParams: Promise<{ look?: string; mode?: string }> }) {
  const params = await searchParams;
  return (
    <HeroLanding key={`${params.look ?? 'default'}-${params.mode ?? 'dark'}`} lookId={params.look} initialTheme={params.mode === 'light' ? 'light' : 'dark'} features={<HeroFeatures />} footer={<HomeFooter />}>
      <HomeFeatureSections />
    </HeroLanding>
  );
}
