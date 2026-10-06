export const DISPLAY_FONTS = {
  default: 'Roboto, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
} as const;

export function displayFontFamily(font: string): string {
  return font === 'serif' ? DISPLAY_FONTS.serif : DISPLAY_FONTS.default;
}
