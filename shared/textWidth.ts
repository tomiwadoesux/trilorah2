/** Text width is a percentage of the whole screen, independent of the safe guide. */
export const TEXT_WIDTH = { min: 40, max: 100, step: 1, default: 80 } as const;

export function clampTextWidth(value: unknown, fallback: number = TEXT_WIDTH.default): number {
  const validFallback = Number.isFinite(fallback) ? fallback : TEXT_WIDTH.default;
  const width = typeof value === 'number' && Number.isFinite(value) ? value : validFallback;
  return Math.max(TEXT_WIDTH.min, Math.min(TEXT_WIDTH.max, width));
}

export function textWidthFrame(safeMargin: number, value: unknown, alignment: 'left' | 'center' | 'right') {
  const margin = Number.isFinite(safeMargin) ? Math.max(0, Math.min(49, safeMargin)) : 10;
  const width = clampTextWidth(value, 100 - margin * 2);
  const anchor = alignment === 'left' ? margin : alignment === 'right' ? 100 - margin - width : (100 - width) / 2;
  // Keep the selected alignment until widening reaches a physical screen edge.
  return { width, left: Math.max(0, Math.min(100 - width, anchor)) };
}
