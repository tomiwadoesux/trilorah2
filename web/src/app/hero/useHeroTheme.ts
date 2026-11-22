'use client';

import { useEffect, useState } from 'react';
import type { HeroTheme } from './AppPreview';

const themeStorageKey = 'trilorah-hero-theme';

/** The visitor's last choice wins; `defaultTheme` only decides the first visit. */
export function useHeroTheme(defaultTheme: HeroTheme = 'dark') {
  const [theme, setTheme] = useState<HeroTheme>(defaultTheme);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(themeStorageKey);
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch { /* The switch still works when storage is unavailable. */ }
  }, []);

  function changeTheme(next: HeroTheme) {
    setTheme(next);
    try { localStorage.setItem(themeStorageKey, next); } catch { /* Keep the current selection in memory. */ }
  }

  return { theme, changeTheme, toggleTheme: () => changeTheme(theme === 'dark' ? 'light' : 'dark') };
}
