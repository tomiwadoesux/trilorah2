/**
 * Join class names, dropping anything falsy.
 *
 * Every component was carrying its own `[...].filter(Boolean).join(' ')`.
 * One function instead, so a conditional class reads as a condition:
 *
 *   cx('tri-surface', danger && 'tri-surface--danger', className)
 */
export type ClassValue = string | false | null | undefined;

export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
