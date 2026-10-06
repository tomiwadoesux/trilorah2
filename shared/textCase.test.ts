import { describe, expect, it } from 'vitest';
import { nextTextCase, resolveTextCase } from './textCase';

describe('text case', () => {
  it('keeps original capitalization until the operator chooses a case', () => {
    expect(resolveTextCase(undefined, 'serif')).toBe('none');
    expect(nextTextCase('none')).toBe('uppercase');
  });

  it('alternates upper and lower case on repeated presses', () => {
    const first = nextTextCase('none');
    const second = nextTextCase(first);
    expect([first, second, nextTextCase(second)]).toEqual(['uppercase', 'lowercase', 'uppercase']);
  });

  it('keeps saved uppercase themes and allows a separate case to override them', () => {
    expect(resolveTextCase(undefined, 'uppercase')).toBe('uppercase');
    expect(resolveTextCase('lowercase', 'uppercase')).toBe('lowercase');
    expect(resolveTextCase('none', 'uppercase')).toBe('none');
    expect(resolveTextCase('invalid', 'serif')).toBe('none');
  });
});
