import { restoreAurora } from './ui/aurora';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './ui/tokens.css';
import './design/sandbox.css';
import { CutoutLibrary } from './design/entries/CutoutLibrary';

// Only load the selected preview. The standalone icon library does not need
// the operator screen, its engine connections, or the other illustration demos.
const Gallery = lazy(() => import('./design/Gallery').then(module => ({ default: module.Gallery })));
const LibraryEmptyPreview = lazy(() => import('./design/entries/LibraryEmptyPreview').then(module => ({ default: module.LibraryEmptyPreview })));
const EmptyIllustrationPreview = lazy(() => import('./design/entries/EmptyIllustrationPreview').then(module => ({ default: module.EmptyIllustrationPreview })));
const IconStudies = lazy(() => import('./design/entries/IconStudies').then(module => ({ default: module.IconStudies })));
const ConnectionEmptyPreview = lazy(() => import('./design/entries/ConnectionEmptyPreview').then(module => ({ default: module.ConnectionEmptyPreview })));

/*
 * Entry point for the design sandbox window (design.html).
 * Loads the app's real tokens first, then the sandbox-only provisional
 * overrides — so specimens are styled exactly as the app styles them,
 * except for the foundations still under review.
 */

restoreAurora();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<main role="status" className="p-5">Loading preview…</main>}>
    {new URLSearchParams(window.location.search).has('connection-empty-preview')
      ? <ConnectionEmptyPreview />
      : new URLSearchParams(window.location.search).has('cutout-library')
      ? <CutoutLibrary />
      : new URLSearchParams(window.location.search).has('cutout-studies')
      ? <IconStudies key="cutout" cutout />
      : new URLSearchParams(window.location.search).has('icon-studies')
      ? <IconStudies key="all" />
      : new URLSearchParams(window.location.search).has('empty-art-preview')
      ? <main className="mx-auto max-w-[1100px] p-5"><EmptyIllustrationPreview /></main>
      : new URLSearchParams(window.location.search).has('library-empty-preview')
      ? <main className="mx-auto max-w-[1000px] p-5"><LibraryEmptyPreview /></main>
      : <Gallery />}
    </Suspense>
  </StrictMode>,
);
