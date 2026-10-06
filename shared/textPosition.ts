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

export function resolveTextPosition(value: unknown) {
  // Older display settings called bottom-center simply "bottom".
  const id = value === 'bottom' ? 'bottom-center' : value;
  const position = TEXT_POSITIONS.find((item) => item.id === id) ?? TEXT_POSITIONS[0];
  return {
    ...position,
    justifyContent: position.vertical === 'top' ? 'flex-start' : position.vertical === 'bottom' ? 'flex-end' : 'center',
    alignItems: position.horizontal === 'left' ? 'flex-start' : position.horizontal === 'right' ? 'flex-end' : 'center',
    textAlign: position.horizontal,
    referenceAbove: position.vertical === 'top',
  } as const;
}
