import type { Metadata } from 'next';
import { SkeletonPreview } from './SkeletonPreview';
import '../landing.css';
import './skeleton.css';

export const metadata: Metadata = {
  title: 'App component skeletons — Trilorah',
  robots: { index: false, follow: false },
};

export default function HeroSkeletonPage() {
  return <SkeletonPreview />;
}
