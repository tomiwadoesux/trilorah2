import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import '../../src/ui/tokens.css';
import { LiveScreen } from '../../src/design/screens/Live';
import { ArtboardProvider, tierForWidth } from '../../src/design/screens/artboard';
import { importMedia } from '../../src/design/screens/mediaLibrary';
import { STARTER_MEDIA } from '../../src/lib/starterMedia';

// A separate browser origin, without the desktop bridge, keeps this review
// independent of the operator's saved service and presentation output.
importMedia([
  { ...STARTER_MEDIA[0], id: 'review-poster', label: 'Sunday welcome — community lunch after the service', detail: 'Sample picture · 1920 × 1080' },
  { ...STARTER_MEDIA[2], id: 'review-video', kind: 'video', label: 'Waterfall loop', detail: 'Sample video card · 1920 × 1080', poster: STARTER_MEDIA[2].url },
  { ...STARTER_MEDIA[3], id: 'review-video-no-poster', kind: 'video', label: 'Evening worship opening', detail: 'Sample video card · thumbnail unavailable', poster: undefined },
]);
function Review() {
  const [size, setSize] = useState({ w: innerWidth, h: innerHeight });
  useEffect(() => {
    const resize = () => setSize({ w: innerWidth, h: innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const tier = tierForWidth(size.w);
  return <ArtboardProvider value={{ ...size, id: 'review', label: 'Review', note: 'Browser review with sample content', tier }}>
    <div data-theme="dark" data-density={tier} style={{ width: '100vw', height: '100vh' }}><LiveScreen /></div>
  </ArtboardProvider>;
}
createRoot(document.getElementById('root')!).render(<Review />);
