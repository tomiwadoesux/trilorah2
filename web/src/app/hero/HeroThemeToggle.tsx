'use client';

import { useId, useState } from 'react';
import type { HeroTheme } from './AppPreview';

export function HeroThemeToggle({ theme, onToggle }: { theme: HeroTheme; onToggle: () => void }) {
  const maskId = useId();
  const [animate, setAnimate] = useState(false);
  const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;

  return (
    <button
      type="button"
      className="hero-theme-toggle"
      data-theme={theme}
      data-animate={animate}
      aria-label={label}
      title={label}
      onClick={(event) => { setAnimate(event.detail !== 0); onToggle(); }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <rect width="24" height="24" fill="white" />
            <circle className="hero-theme-cutout" cx="24" cy="0" r="8" fill="black" />
          </mask>
        </defs>
        <circle className="hero-theme-disc" cx="12" cy="12" r="8" fill="currentColor" mask={`url(#${maskId})`} />
        <g className="hero-theme-rays" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M12 1.5v2m0 17v2M1.5 12h2m17 0h2M4.575 4.575l1.414 1.414m12.022 12.022 1.414 1.414M4.575 19.425l1.414-1.414M18.011 5.989l1.414-1.414" />
        </g>
      </svg>
    </button>
  );
}
