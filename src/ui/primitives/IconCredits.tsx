import { cx } from '../lib/cx';

/** Visible attribution required by Solar's CC BY 4.0 artwork license. */
export function IconCredits({ className }: { className?: string }) {
  const linkClass = 'underline decoration-white/20 underline-offset-2 hover:text-white/70 focus-visible:text-white';
  return (
    <p className={cx('text-[11px] leading-relaxed text-white/40', className)}>
      Icons: <a className={linkClass} href="https://solar-icons.vercel.app/" target="_blank" rel="noreferrer">Solar</a>
      {' by '}<a className={linkClass} href="https://www.figma.com/community/file/1166831539721848736" target="_blank" rel="noreferrer">480 Design</a>
      {' · '}<a className={linkClass} href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>
    </p>
  );
}
