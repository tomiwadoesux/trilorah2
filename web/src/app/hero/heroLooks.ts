import type { CSSProperties } from 'react';
import type { HeroTheme } from './AppPreview';

export const HERO_YELLOW = '#e4d87a';
export const HERO_GREEN = '#07271c';

export function heroAccent(theme: HeroTheme) {
  return theme === 'light' ? HERO_GREEN : HERO_YELLOW;
}

export type HeroPalette = {
  background: string;
  gradient?: string;
  text: string;
  muted: string;
  surface: string;
};

export type HeroLook = {
  id: string;
  name: string;
  description: string;
  dark: HeroPalette;
  light: HeroPalette;
};

export const heroLooks: HeroLook[] = [
  {
    id: 'carbon', name: 'Carbon', description: 'Near-black with a faint green undertone, paired with soft gray and brand yellow.',
    dark: { background: '#060907', text: '#edf3ee', muted: '#acb9ae', surface: '#141a16' },
    light: { background: '#f0f1f3', text: '#22252a', muted: '#5c6570', surface: '#ffffff' },
  },
  {
    id: 'slate', name: 'Slate', description: 'Blue-black and cool porcelain, with a soft wash of light.',
    dark: { background: '#101924', gradient: 'linear-gradient(125deg, transparent 28%, #1d3045 100%)', text: '#edf3f7', muted: '#a8b8c9', surface: '#293c50' },
    light: { background: '#eaf0f7', gradient: 'linear-gradient(125deg, #f9fbff 0%, transparent 80%)', text: '#17283b', muted: '#52677c', surface: '#ffffff' },
  },
  {
    id: 'pine', name: 'Pine', description: 'Deep forest and pale sage. Closest to Trilorah’s green identity.',
    dark: { background: '#0e1c18', gradient: 'radial-gradient(ellipse at 90% 100%, #233b2e 0%, transparent 75%)', text: '#e8f1eb', muted: '#a7bcb0', surface: '#2b4235' },
    light: { background: '#eaf0e8', gradient: 'radial-gradient(ellipse at 10% 0%, #fafcf5 0%, transparent 75%)', text: '#1c3026', muted: '#55695d', surface: '#fafff7' },
  },
  {
    id: 'sand', name: 'Sand', description: 'Warm graphite and ivory. Soft, grounded, and easy to read.',
    dark: { background: '#1c1913', gradient: 'linear-gradient(160deg, #302a20 0%, transparent 72%)', text: '#f3eee4', muted: '#bfb5a4', surface: '#3a3226' },
    light: { background: '#f1ecdf', gradient: 'linear-gradient(160deg, #fffdf6 0%, transparent 72%)', text: '#322a1e', muted: '#6e6454', surface: '#fffdf7' },
  },
  {
    id: 'plum', name: 'Plum', description: 'Smoky violet and soft lilac. A distinctive setting for the yellow.',
    dark: { background: '#201a24', gradient: 'radial-gradient(ellipse at 100% 15%, #3a2d40 0%, transparent 72%)', text: '#f3edf5', muted: '#bfb0c6', surface: '#43374a' },
    light: { background: '#eee8f1', gradient: 'radial-gradient(ellipse at 0% 15%, #fffbff 0%, transparent 72%)', text: '#302537', muted: '#6d5d77', surface: '#fefaff' },
  },
];

export const defaultHeroLook = heroLooks[0];

export function findHeroLook(id: string | undefined) {
  return heroLooks.find(look => look.id === id);
}

export function heroLookStyle(look: HeroLook, theme: HeroTheme): CSSProperties {
  const palette = look[theme];
  return {
    '--home-bg': palette.background,
    '--home-ink': palette.text,
    '--home-muted': palette.muted,
    '--hero-secondary': palette.surface,
    '--hero-secondary-hover': `color-mix(in srgb, ${palette.surface}, ${palette.text} 8%)`,
    '--hero-primary-hover': theme === 'light' ? '#123f2e' : '#eee293',
    '--hero-study-background': palette.gradient ? `${palette.gradient}, ${palette.background}` : palette.background,
    '--hero-accent': heroAccent(theme),
    '--hero-study-button-ink': theme === 'light' ? '#e5f3f2' : '#24231c',
    '--hero-study-rule': `color-mix(in srgb, ${palette.text} 16%, transparent)`,
    colorScheme: theme,
  } as CSSProperties;
}
