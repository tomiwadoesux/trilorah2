import { createElement, type ComponentType } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as icons from '../ui/icons';
import type { IconProps } from '../ui/NuboIcon';
import { IconSelection } from '../ui/NuboIcon';
import type { TrilorahIconName } from '../../shared/icons/nubo';

describe('Trilorah Nubo icon adapter', () => {
  it('renders every public UI glyph from the Nubo family', () => {
    const glyphs = Object.entries(icons).filter(([name]) => name.endsWith('Icon') && name !== 'TrilorahIcon' && name !== 'CutoutIcon');
    expect(glyphs.length).toBeGreaterThan(90);
    for (const [name, Icon] of glyphs) {
      const markup = renderToStaticMarkup(createElement(Icon as ComponentType<IconProps>));
      expect(markup, name).toContain('nubo-icon');
      expect(markup, name).toContain('data-icon-pack="nubo"');
      expect(markup, name).toContain('viewBox="0 0 24 24"');
      expect(markup, name).toContain('stroke-width="1.5"');
      expect(markup, name).toContain('aria-hidden="true"');
    }
  });

  it('preserves size, color, class and SVG props used by existing controls', () => {
    const markup = renderToStaticMarkup(createElement(icons.SearchIcon, {
      size: 18, color: '#8fd3c0', className: 'search-glyph', strokeWidth: 2, style: { opacity: 0.7 },
    }));
    expect(markup).toContain('width="1em"');
    expect(markup).toContain('font-size:18px');
    expect(markup).toContain('opacity:0.7');
    expect(markup).toContain('color="#8fd3c0"');
    expect(markup).toContain('search-glyph');
    expect(markup).toContain('stroke-width="2"');
    expect(renderToStaticMarkup(createElement(icons.ChevronDownIcon))).toContain('font-size:10px');
  });

  it('switches every selected glyph to Duo while keeping its dimensions', () => {
    const glyphs = Object.entries(icons).filter(([name]) => name.endsWith('Icon') && name !== 'TrilorahIcon' && name !== 'CutoutIcon');
    for (const [name, Icon] of glyphs) {
      const markup = renderToStaticMarkup(createElement(Icon as ComponentType<IconProps>, { selected: true, size: 18 }));
      expect(markup, name).toContain('data-icon-variant="duo"');
      expect(markup, name).toContain('viewBox="0 0 24 24"');
      expect(markup, name).toContain('font-size:18px');
      expect(markup, name).not.toContain('selected="');
    }
    const selected = renderToStaticMarkup(createElement(icons.BookIcon, { selected: true }));
    expect(selected).toContain('data-tone="secondary" opacity="0.3"');
    const normal = renderToStaticMarkup(createElement(icons.BookIcon));
    expect(normal).toContain('data-icon-variant="line"');
    expect(normal).not.toContain('data-tone="secondary"');
    const inherited = renderToStaticMarkup(createElement(IconSelection, { selected: true, children: createElement(icons.BookIcon) }));
    expect(inherited).toContain('data-icon-variant="duo"');
    const overridden = renderToStaticMarkup(createElement(IconSelection, { selected: true, children: createElement(icons.BookIcon, { selected: false }) }));
    expect(overridden).toContain('data-icon-variant="line"');
  });

  it('ships synchronized Nubo templates in the standalone phone remote', () => {
    const remote = readFileSync(new URL('../../public/mobile-remote.html', import.meta.url), 'utf8');
    const templates = [...remote.matchAll(/<template id="tri-nubo-([^"]+)">([\s\S]*?)<\/template>/g)];
    expect(templates).toHaveLength(11);
    for (const [, name, markup] of templates) {
      expect(markup).toBe(renderToStaticMarkup(createElement(icons.TrilorahIcon, { name: name as TrilorahIconName, size: 24 })));
      expect(markup).toContain(`data-icon="${name}"`);
      expect(markup).toContain('data-icon-pack="nubo"');
      expect(markup).toContain('viewBox="0 0 24 24"');
    }
    expect(remote).not.toContain('data-cutout-icon');
    expect(remote).not.toContain('tri-cutout-');
    expect(remote).toContain('Copyright (c) 2026 David Umoru');
  });

  it('announces standalone labelled icons without exposing decorative icons', () => {
    const labelled = renderToStaticMarkup(createElement(icons.MicIcon, { label: 'Microphone input' }));
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="Microphone input"');
    expect(labelled).not.toContain('aria-hidden="true"');
    const referenced = renderToStaticMarkup(createElement(icons.BookIcon, { 'aria-labelledby': 'scripture-heading' }));
    expect(referenced).toContain('aria-labelledby="scripture-heading"');
    expect(referenced).not.toContain('aria-hidden="true"');
  });
});
