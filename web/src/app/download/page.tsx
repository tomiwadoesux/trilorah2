import type { Metadata, Viewport } from 'next';
import { DownloadLanding } from './DownloadLanding';
import '../home/home.css';
import '../hero/hero.css';
import '../hero/landing.css';
import './download.css';

export const metadata: Metadata = {
  title: 'Download Trilorah',
  description: 'Download Trilorah for Mac or Windows. Scripture, lyrics, slides, and media in one presentation workspace.',
};
export const viewport: Viewport = { themeColor: '#14120b' };

export default function DownloadPage() {
  return <DownloadLanding />;
}
