import { capitalizeScriptureNames, lowercaseScriptureText } from './scriptureNames';

export type TextCase = 'none' | 'uppercase' | 'lowercase';

/** Case content before rendering so a lowercase theme cannot undo divine capitals. */
export function formatDisplayText(text: string, textCase: TextCase = 'none'): string {
  if (textCase === 'uppercase') return text.toUpperCase();
  return textCase === 'lowercase' ? lowercaseScriptureText(text) : capitalizeScriptureNames(text);
}

/** Older themes stored uppercase in the font choice. Keep their appearance. */
export function resolveTextCase(value: unknown, font?: string): TextCase {
  if (value === 'none' || value === 'uppercase' || value === 'lowercase') return value;
  return font === 'uppercase' ? 'uppercase' : 'none';
}

/** The case card names the action the next press will apply. */
export function nextTextCase(value: TextCase): Exclude<TextCase, 'none'> {
  return value === 'uppercase' ? 'lowercase' : 'uppercase';
}
