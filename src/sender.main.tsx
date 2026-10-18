import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './ui/tokens.css';
import { SenderBar } from './sender/SenderBar';

document.documentElement.dataset.theme = 'dark';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <SenderBar />
    </StrictMode>,
  );
}
