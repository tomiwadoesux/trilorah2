import type { Metadata } from 'next';
import NavigationStudy from './NavigationStudy';

export const metadata: Metadata = {
  title: 'Trilorah — Navigation preview',
  robots: { index: false, follow: false },
};

export default function NavigationPreviewPage() {
  return <NavigationStudy />;
}
