import { forwardRef, type SVGProps } from 'react';
import { cutoutBody, type CutoutIconName } from '../../shared/cutout';
import '../../shared/cutout/motion.css';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'dangerouslySetInnerHTML' | 'name'> {
  size?: number;
  /** Omit for a decorative icon inside an already-labelled control. */
  label?: string;
  /** Play one restrained motion cycle. Off by default. */
  animated?: boolean;
}

export const CutoutIcon = forwardRef<SVGSVGElement, IconProps & { name: CutoutIconName }>(function CutoutIcon(
  { name, size = 14, className = '', style, label, animated = false, ...rest }, ref,
) {
  const accessibleLabel = label ?? rest['aria-label'];
  return <svg {...rest} ref={ref} viewBox="0 0 32 32" width="1em" height="1em" fill="currentColor"
    aria-hidden={accessibleLabel ? undefined : true} role={accessibleLabel ? 'img' : undefined}
    aria-label={accessibleLabel} focusable="false" data-icon={name} data-animate={animated || undefined}
    className={`tri-cutout-icon ${className}`} style={{ fontSize: size, ...style }}
    dangerouslySetInnerHTML={{ __html: cutoutBody(name) }} />;
});

export function createCutoutIcon(name: CutoutIconName, defaultSize = 14) {
  const Component = forwardRef<SVGSVGElement, IconProps>(function NamedCutout({ size = defaultSize, ...props }, ref) {
    return <CutoutIcon {...props} ref={ref} name={name} size={size} />;
  });
  Component.displayName = `Cutout(${name})`;
  return Component;
}
