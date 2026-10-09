'use client';

/* Original Trilorah Cutout icons; the shared registry owns every shape and part. */
import { forwardRef, type SVGProps } from 'react';
import { cutoutBody, type CutoutIconName } from '../../../shared/cutout';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'dangerouslySetInnerHTML' | 'name'> {
  size?: number;
  label?: string;
  /** Explicit opt-in; icons are still by default and respect reduced motion. */
  animated?: boolean;
}

/** Keep React local to the web app; only the original SVG geometry is shared. */
export function createCutoutIcon(name: CutoutIconName, defaultSize = 24) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function CutoutIcon(
    { size = defaultSize, label, animated = false, className = '', style, ...props },
    ref,
  ) {
    const accessibleLabel = label ?? props['aria-label'];
    return (
      <svg
        ref={ref}
        width="1em"
        height="1em"
        viewBox="0 0 32 32"
        fill="none"
        color="currentColor"
        {...props}
        aria-hidden={accessibleLabel ? undefined : true}
        aria-label={accessibleLabel}
        role={accessibleLabel ? 'img' : undefined}
        focusable="false"
        className={`tri-cutout-icon ${className}`.trim()}
        style={{ fontSize: size, ...style }}
        data-icon={name}
        data-animate={animated || undefined}
        dangerouslySetInnerHTML={{ __html: cutoutBody(name) }}
      />
    );
  });
  Icon.displayName = `Cutout(${name})`;
  return Icon;
}

export const Radio = createCutoutIcon('soundwave');
export const BookOpen = createCutoutIcon('bible');
export const StickyNote = createCutoutIcon('note');
export const HandCoins = createCutoutIcon('hand-coins');
export const Copy = createCutoutIcon('copy');
export const Link = createCutoutIcon('link');
export const Plus = createCutoutIcon('plus');
export const ChevronDown = createCutoutIcon('chevron-down');
export const Headphones = createCutoutIcon('headphones');
export const ArrowDown = createCutoutIcon('arrow-down');
export const ArrowLeft = createCutoutIcon('arrow-left');
export const ArrowRight = createCutoutIcon('arrow-right');
export const Settings2 = createCutoutIcon('tuning');
export const Minus = createCutoutIcon('minus');
export const RotateCcw = createCutoutIcon('reset');
export const Check = createCutoutIcon('check');
export const Download = createCutoutIcon('download');
export const QrCode = createCutoutIcon('qr');
export const Mic = createCutoutIcon('microphone');
export const MicOff = createCutoutIcon('microphone-off');
export const X = createCutoutIcon('close');
