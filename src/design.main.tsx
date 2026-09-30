import { restoreAurora } from './ui/aurora';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './ui/tokens.css';
import './design/sandbox.css';
import { Gallery } from './design/Gallery';

/*
 * Entry point for the design sandbox window (design.html).
 * Loads the app's real tokens first, then the sandbox-only provisional
 * overrides — so specimens are styled exactly as the app styles them,
 * except for the foundations still under review.
 */

restoreAurora();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
