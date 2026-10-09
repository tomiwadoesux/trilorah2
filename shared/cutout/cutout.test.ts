import { describe, expect, it } from 'vitest';
import { STUDY_PATHS } from '../../src/design/entries/iconStudiesData';
import { CONTROL_ICONS } from './controls';
import { CORE_ICONS } from './core';
import { CUTOUT_ICONS, CUTOUT_NAMES, cutoutBody, cutoutSvg } from './index';
import { SERVICE_ICONS } from './service';
import { STATUS_ICONS } from './status';
import type { CutoutDefinition } from './types';

const approvedNames = ['bible', 'microphone', 'songs', 'search', 'media'] as const;

function attributes(tag: string): Record<string, string> {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
      .map((match) => [match[1], match[2] ?? match[3]]),
  );
}

/** Compare effective path geometry/paint, allowing the new semantic group wrappers. */
function normalizedPaths(markup: string, defaults: { fill: string; stroke: string }) {
  const paths = [];
  for (const match of markup.matchAll(/<([a-zA-Z][\w:-]*)\b[^>]*>/g)) {
    const attrs = attributes(match[0]);
    // A static transform would change the drawing even if its path stayed the same.
    expect(attrs.transform).toBeUndefined();
    if (match[1] === 'g') continue;
    expect(match[1]).toBe('path');
    const stroke = attrs.stroke ?? defaults.stroke;
    paths.push({
      // Ignore whitespace/comma formatting while preserving commands and coordinates.
      d: attrs.d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g),
      fill: attrs.fill ?? defaults.fill,
      fillRule: attrs['fill-rule'] ?? 'nonzero',
      stroke,
      strokeWidth: stroke === 'none' ? undefined : Number(attrs['stroke-width'] ?? 2),
      linecap: stroke === 'none' ? undefined : (attrs['stroke-linecap'] ?? 'square'),
      linejoin: stroke === 'none' ? undefined : (attrs['stroke-linejoin'] ?? 'miter'),
    });
  }
  return paths;
}

describe('Original Cutout artwork', () => {
  it.each(approvedNames)('preserves the approved %s drawing', (name) => {
    // The study inherited outline defaults; the shared renderer inherits solid defaults.
    // The microphone stand makes its original outline styling explicit during migration.
    const reference = normalizedPaths(STUDY_PATHS.cutout[name], {
      fill: 'none', stroke: 'currentColor',
    });
    const actual = normalizedPaths(cutoutBody(name), {
      fill: 'currentColor', stroke: 'none',
    });
    expect(actual).toEqual(reference);
  });
});

describe('shared Cutout registry and animation contract', () => {
  it('does not silently overwrite an icon when combining definition modules', () => {
    const names = [CORE_ICONS, CONTROL_ICONS, SERVICE_ICONS, STATUS_ICONS]
      .flatMap((module) => Object.keys(module));
    expect(new Set(names).size).toBe(names.length);
    expect([...CUTOUT_NAMES].sort()).toEqual([...names].sort());
  });

  it('has unique semantic part names and finite SVG-coordinate pivots per icon', () => {
    for (const [name, definition] of Object.entries(CUTOUT_ICONS)) {
      const parts: CutoutDefinition['parts'] = definition.parts;
      expect(parts.length, name).toBeGreaterThan(0);
      expect(new Set(parts.map((part) => part.name)).size, name).toBe(parts.length);
      for (const part of parts) {
        const context = `${name}/${part.name}`;
        expect(part.name, context).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
        expect(part.name, context).not.toMatch(/^(?:path|shape|part)-?\d+$/);
        const origin = part.origin ?? [16, 16];
        expect(origin, context).toHaveLength(2);
        for (const coordinate of origin) {
          expect(Number.isFinite(coordinate), context).toBe(true);
          expect(coordinate, context).toBeGreaterThanOrEqual(0);
          expect(coordinate, context).toBeLessThanOrEqual(32);
        }
      }
    }
  });

  it('keeps established animation targets stable without freezing new geometry', () => {
    const requiredParts = {
      bible: ['cover'],
      microphone: ['capsule', 'stand'],
      songs: ['notes'],
      search: ['lens', 'handle'],
      media: ['frame'],
      trash: ['body', 'lid'],
      scan: ['corners', 'beam'],
      history: ['return-ring', 'hands'],
      bell: ['bell', 'clapper'],
    } as const;
    for (const [name, parts] of Object.entries(requiredParts)) {
      const body = cutoutBody(name as keyof typeof requiredParts);
      for (const part of parts) expect(body, `${name}/${part}`).toContain(`data-part="${part}"`);
    }
  });

  it('exports part hooks and pivots in the viewBox rather than each part bounding box', () => {
    for (const name of CUTOUT_NAMES) {
      const definition: CutoutDefinition = CUTOUT_ICONS[name];
      const groups = [...cutoutBody(name).matchAll(/<g\b[^>]*>/g)]
        .map((match) => attributes(match[0]));
      expect(groups.length, name).toBe(definition.parts.length);
      definition.parts.forEach((part, index) => {
        const [x, y] = part.origin ?? [16, 16];
        expect(groups[index]['data-part'], name).toBe(part.name);
        expect(groups[index]['data-motion'], `${name}/${part.name}`).toBe(part.motion);
        expect(groups[index]['data-origin'], `${name}/${part.name}`).toBe(`${x} ${y}`);
        expect(groups[index].style, `${name}/${part.name}`).toContain('transform-box:view-box');
        expect(groups[index].style, `${name}/${part.name}`).toContain(`transform-origin:${x}px ${y}px`);
      });
    }
  });

  it('can repeat standalone icons without global SVG IDs or external dependencies', () => {
    for (const name of CUTOUT_NAMES) {
      const svg = cutoutSvg(name);
      expect(svg, name).not.toMatch(/\s(?:id|href|xlink:href|src)\s*=/i);
      expect(svg, name).not.toMatch(/url\s*\(/i);
      expect(svg, name).not.toMatch(/<(?:defs|mask|clipPath|use|image|script|foreignObject)\b/i);
      expect(svg, name).not.toMatch(/\son[a-z]+\s*=/i);
    }
  });
});

describe('standalone Cutout SVG export', () => {
  it('escapes every XML-significant label character', () => {
    const label = 'A&B <"quoted"> \'single\'';
    const svg = cutoutSvg('trash', { label });
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="A&amp;B &lt;&quot;quoted&quot;&gt; &apos;single&apos;"');
    expect(svg).not.toContain(label);
  });

  it('uses the readable registry label and stays static by default', () => {
    const svg = cutoutSvg('trash');
    expect(svg).toContain('aria-label="Delete"');
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).toContain('width="32" height="32"');
    expect(svg).not.toContain('data-animate=');
  });

  it('keeps decorative exports hidden and unfocusable even when given a label', () => {
    const svg = cutoutSvg('trash', { decorative: true, label: 'Do not announce' });
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('focusable="false"');
    expect(svg).not.toContain('aria-label=');
    expect(svg).not.toContain('role="img"');
  });

  it('accepts positive finite fractional display sizes without changing the drawing grid', () => {
    const svg = cutoutSvg('search', { size: 18.5 });
    expect(svg).toContain('width="18.5" height="18.5"');
    expect(svg).toContain('viewBox="0 0 32 32"');
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects an invalid display size of %s', (size) => {
      expect(() => cutoutSvg('search', { size })).toThrow(RangeError);
    },
  );
});
