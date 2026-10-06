import { describe, expect, it } from 'vitest';
import { stockSearchQuery } from './stockSearchQuery';
describe('stock search intent', () => {
  it('leaves media searches literal', () => {
    expect(stockSearchQuery('  church people  ', 'media')).toBe('church people');
    expect(stockSearchQuery('', 'media')).toBe('');
  });
  it('scopes themes to backgrounds without duplicating the word', () => {
    expect(stockSearchQuery('clouds', 'themes')).toBe('clouds background');
    expect(stockSearchQuery('', 'themes')).toBe('abstract background');
    expect(stockSearchQuery('blue backgrounds', 'themes')).toBe('blue backgrounds');
  });
});
