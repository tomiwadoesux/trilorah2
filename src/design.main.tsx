import { restoreAurora } from './ui/aurora';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './ui/tokens.css';
import './design/sandbox.css';
import { Gallery } from './design/Gallery';
import { LibraryEmptyPreview } from './design/entries/LibraryEmptyPreview';
import { EmptyIllustrationPreview } from './design/entries/EmptyIllustrationPreview';

/*
 * Entry point for the design sandbox window (design.html).
 * Loads the app's real tokens first, then the sandbox-only provisional
 * overrides — so specimens are styled exactly as the app styles them,
 * except for the foundations still under review.
 */

restoreAurora();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {new URLSearchParams(window.location.search).has('empty-art-preview')
      ? <main className="mx-auto max-w-[1100px] p-5"><EmptyIllustrationPreview /></main>
      : new URLSearchParams(window.location.search).has('library-empty-preview')
      ? <main className="mx-auto max-w-[1000px] p-5"><LibraryEmptyPreview /></main>
      : <Gallery />}
  </StrictMode>,
);
