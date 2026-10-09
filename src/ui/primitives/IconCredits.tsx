import { cx } from '../lib/cx';

/** The active UI icon family. Historical third-party notices remain in the repo. */
export function IconCredits({ className }: { className?: string }) {
  return (
    <p className={cx('text-[11px] leading-relaxed text-white/40', className)}>
      Icons: Trilorah Cutout · original artwork
    </p>
  );
}
