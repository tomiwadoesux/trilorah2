import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './ui/tokens.css';
import ConsoleView from './design/screens/Console';

document.documentElement.dataset.theme = 'dark';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <ConsoleView variant="popup" />
    </StrictMode>,
  );
}
