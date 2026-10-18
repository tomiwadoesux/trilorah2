import type { Metadata, Viewport } from 'next';
import BrandDirections from './BrandDirections';

export const metadata: Metadata = {
  title: 'Trilorah — Brand directions',
  description: 'Three identity directions built from Trilorah’s founder discovery.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 5,
  themeColor: '#f1f0eb',
};

export default function BrandDirectionsPage() {
  return <BrandDirections />;
}
