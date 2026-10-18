'use client';

import { useEffect, useState } from 'react';
import type { HeroTheme } from './AppPreview';

const themeStorageKey = 'trilorah-hero-theme';

export function useHeroTheme() {
  const [theme, setTheme] = useState<HeroTheme>('dark');

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
