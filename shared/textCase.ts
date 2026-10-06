export type TextCase = 'none' | 'uppercase' | 'lowercase';

/** Older themes stored uppercase in the font choice. Keep their appearance. */
export function resolveTextCase(value: unknown, font?: string): TextCase {
  if (value === 'none' || value === 'uppercase' || value === 'lowercase') return value;
  return font === 'uppercase' ? 'uppercase' : 'none';
}

/** The case card names the action the next press will apply. */
export function nextTextCase(value: TextCase): Exclude<TextCase, 'none'> {
  return value === 'uppercase' ? 'lowercase' : 'uppercase';
}
