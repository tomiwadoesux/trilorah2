/** Place a floating surface inside the viewport, preferring below its anchor. */
export function popupPlacement(anchor: { left: number; right: number; top: number; bottom: number }, size: { width: number; height: number }, viewport: { width: number; height: number }, align: 'left' | 'right' = 'right') {
  const gap = 12;
  const width = Math.min(size.width, Math.max(0, viewport.width - gap * 2));
  const height = Math.min(size.height, Math.max(0, viewport.height - gap * 2));
  const below = anchor.bottom + 6;
  const above = anchor.top - height - 6;
  const top = below + height <= viewport.height - gap ? below : above >= gap ? above : Math.max(gap, Math.min(below, viewport.height - height - gap));
  return { left: Math.max(gap, Math.min(align === 'right' ? anchor.right - width : anchor.left, viewport.width - width - gap)), top: Math.max(gap, Math.min(top, viewport.height - height - gap)) };
}
