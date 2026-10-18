import type { Metadata } from 'next';
import LogoStudy from './LogoStudy';

export const metadata: Metadata = {
  title: 'Trilorah — Logo',
  robots: { index: false, follow: false },
};

export default function LogoPage() {
  return <LogoStudy />;
}
