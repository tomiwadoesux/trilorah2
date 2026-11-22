/** One position vocabulary for the picker, preview, projector and saved themes. */
export const TEXT_POSITIONS = [
  { id: 'center', label: 'center', vertical: 'center', horizontal: 'center' },
  { id: 'bottom-center', label: 'bottom center', vertical: 'bottom', horizontal: 'center' },
  { id: 'top', label: 'top center', vertical: 'top', horizontal: 'center' },
  { id: 'bottom-left', label: 'bottom left', vertical: 'bottom', horizontal: 'left' },
  { id: 'top-left', label: 'top left', vertical: 'top', horizontal: 'left' },
  { id: 'top-right', label: 'top right', vertical: 'top', horizontal: 'right' },
  { id: 'middle-left', label: 'middle left', vertical: 'center', horizontal: 'left' },
  { id: 'middle-right', label: 'middle right', vertical: 'center', horizontal: 'right' },
  { id: 'bottom-right', label: 'bottom right', vertical: 'bottom', horizontal: 'right' },
] as const;

export type TextPositionOption = typeof TEXT_POSITIONS[number]['id'];

export function isTextPosition(value: unknown): value is TextPositionOption {
  return TEXT_POSITIONS.some((position) => position.id === value);
}

/**
 * How the LINES sit within the block — its own choice, apart from where the
 * block sits on the screen. 'auto' is what every older theme had: the lines
 * follow the position (a bottom-left block reads ragged-left, a centred one
 * centred). The others pin it, so a centred block can carry flush-left lines
 * and a corner block can carry centred ones.
 */
export const TEXT_ALIGNMENTS = ['auto', 'left', 'center', 'right'] as const;
export type TextAlignOption = (typeof TEXT_ALIGNMENTS)[number];

export function resolveTextAlign(value: unknown): TextAlignOption {
  return TEXT_ALIGNMENTS.includes(value as TextAlignOption) ? (value as TextAlignOption) : 'auto';
}

export function resolveTextPosition(value: unknown, align: unknown = 'auto') {
  // Older display settings called bottom-center simply "bottom".
  const id = value === 'bottom' ? 'bottom-center' : value;
  const position = TEXT_POSITIONS.find((item) => item.id === id) ?? TEXT_POSITIONS[0];
  const chosen = resolveTextAlign(align);
  return {
    ...position,
    justifyContent: position.vertical === 'top' ? 'flex-start' : position.vertical === 'bottom' ? 'flex-end' : 'center',
    /* Block placement follows the POSITION alone; the alignment override
       moves the lines within the block, never the block on the screen. */
    alignItems: position.horizontal === 'left' ? 'flex-start' : position.horizontal === 'right' ? 'flex-end' : 'center',
    textAlign: chosen === 'auto' ? position.horizontal : chosen,
    referenceAbove: position.vertical === 'top',
  } as const;
}
