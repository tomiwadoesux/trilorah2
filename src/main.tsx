import { restoreAurora } from './ui/aurora';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './ui/tokens.css';
/* Booth mode. Still named "sandbox" because F-02 is provisional, but the
   Trilorah screens are drawn for it, so the app that renders them loads it. */
import './design/sandbox.css';
import { trackDensity } from './ui/density';

/*
 * The changeover ui/density.ts was waiting for: the app now renders the
 * Trilorah LIVE screen, so it adopts the token system — dark theme, and a
 * density tier that follows the window. Both hang off <html>, not a wrapper,
 * because the drag layer and menus portal to document.body and would
 * otherwise fall outside the theme.
 */
document.documentElement.dataset.theme = 'dark';
trackDensity();

restoreAurora();

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
