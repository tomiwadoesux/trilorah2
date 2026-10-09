import valley from '../assets/backgrounds/valley.jpg';
import waterfall from '../assets/backgrounds/waterfall.jpg';
import sunset from '../assets/backgrounds/sunset.jpg';
import mountains from '../assets/backgrounds/mountains.jpg';
import bay from '../assets/backgrounds/bay.jpg';
import type { ThemeMedia } from '../design/screens/mediaLibrary';

/** Imported URLs are bundled by Vite and work in packaged, offline installs. */
export const STARTER_MEDIA: ThemeMedia[] = [
  { id: 'starter-valley', label: 'Yosemite valley', detail: 'Jon Sullivan · public domain', url: valley },
  { id: 'starter-sunset', label: 'Sunset over the sea', detail: 'Deshna Subramanian · CC0', url: sunset },
  { id: 'starter-waterfall', label: 'Forest waterfall', detail: 'Martin Eklund · CC0', url: waterfall },
  { id: 'starter-mountains', label: 'Yosemite mountains', detail: 'Dexter Perkins · CC0', url: mountains },
  { id: 'starter-bay', label: 'Bellingham bay', detail: 'US EPA · public domain', url: bay },
].map(item => ({ ...item, seed: 0, style: 'smoke', source: 'local', kind: 'photo', collection: 'media' }));
