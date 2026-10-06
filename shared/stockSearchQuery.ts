/** Only theme searches receive background terms. Media searches stay literal. */
export function stockSearchQuery(value: string, mode: 'themes' | 'media'): string {
  const query = value.trim();
  if (mode === 'media') return query;
  return query ? /\bbackgrounds?\b/i.test(query) ? query : `${query} background` : 'abstract background';
}
