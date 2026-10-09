/*
 * Trilorah design system — the public surface.
 *
 * Import from here, never from a file path inside: `import { Button } from
 * '../ui'`. That keeps the internal layout free to change and gives one
 * place to see everything the system offers.
 *
 *   tokens.css   the design decisions, as CSS variables
 *   lib/         how the system is composed (surface recipe, cx)
 *   hooks/       shared interaction behaviour (useNudge)
 *   primitives/  the components themselves
 *   icons.tsx    glyphs, currentColor, sized by the caller
 *
 * Components own only what makes them that component. Anything a second
 * component would repeat belongs in lib/ or hooks/ first.
 */

export { Button } from './primitives/Button';
export { Slider } from './primitives/Slider';
export { DashboardButton } from './primitives/DashboardButton';
export { DisplayFontPicker, type FontOption } from './primitives/DisplayFontPicker';
export { TextTransitionPicker } from './primitives/TextTransitionPicker';
export { TextPositionPicker, type TextPositionOption } from './primitives/TextPositionPicker';
export { Select, type SelectOption, TEXT_EFFECT_OPTIONS } from './primitives/Select';
export {
  ScriptureReferenceInput,
  type ScriptureBook,
  type ResolvedReference,
} from './primitives/ScriptureReferenceInput';
export {
  ActionMenu,
  type ActionMenuItem,
  type ActionMenuGroup,
  type ActionMenuProps,
} from './primitives/ActionMenu';
export { SearchField, type SearchFieldProps } from './primitives/SearchField';
export { SlideThumb, type SlideThumbProps } from './primitives/SlideThumb';
export { AddCard, type AddCardProps } from './primitives/AddCard';
export { IconCredits } from './primitives/IconCredits';
export {
  SegmentedControl,
  type SegmentOption,
  type SegmentedControlProps,
} from './primitives/SegmentedControl';
export { ArrangeList, type ArrangeOption, type ArrangeListProps } from './primitives/ArrangeList';

export * from './icons';

export { cx, type ClassValue } from './lib/cx';
export {
  slideBackdrop,
  BACKDROP_STYLES,
  BACKDROP_BY_CONTENT,
  type BackdropStyle,
} from './lib/slideBackdrop';
export {
  surface,
  toneClass,
  strokeStyle,
  type SurfaceOptions,
  type SurfaceShape,
  type SurfaceTone,
} from './lib/surface';
export { useNudge } from './hooks/useNudge';
export { useAnimatedNumber } from './hooks/useAnimatedNumber';
export { useElementWidth } from './hooks/useElementWidth';
