import type { Metadata, Viewport } from 'next';
import BrandStudio from './BrandStudio';

export const metadata: Metadata = {
  title: 'Brand — Trilorah',
  description: 'A working space for Trilorah branding experiments and practice designs.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#efeee9',
};

export default async function BrandPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const params = await searchParams;
  return <BrandStudio initialArea={params.section === 'components' ? 'components' : 'identity'} />;
}
